from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Support both existing `uvicorn main:app` from backend/ and package startup.
if not __package__:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.config import ALLOWED_ORIGINS, MAX_PAGES, PARSER_PROFILE, PARSER_VERSION, PROMPT_VERSION
from backend.normalization import normalize_parsed_output
from backend.preprocessing import process_image_bytes, process_pdf_bytes
from backend.prompts import PARSE_PROMPT
from backend.providers import call_active_model, get_active_model_profile
from backend.timing import ParseRequestTimingMiddleware, _log_step, _now_ms, logger
from backend.validation import _hash_uploads, _merge_repair, _repair_prompt, _repair_scope, validate_parsed_output

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ParseRequestTimingMiddleware)

@app.post("/parse")
async def parse_file(
    request: Request,
    files: list[UploadFile] | None = File(None),
    file: UploadFile | None = File(None),
) -> Dict[str, Any]:
    backend_started = time.perf_counter()
    request.state.parse_handler_started = backend_started
    run_id = request.state.parse_run_id
    try:
        active_profile = get_active_model_profile()
    except ValueError as exc:
        logger.error("[parse:%s] model_configuration_failed reason=%s", run_id, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    logger.info("[parse:%s] model_profile=%s model=%s", run_id, active_profile["profile"], active_profile["model"])
    timings = {
        "uploadReadMs": 0,
        "inputValidationMs": 0,
        "preprocessMs": 0,
        "primaryModelMs": 0,
        "validationMs": 0,
        "verificationModelMs": 0,
        "postprocessMs": 0,
        "backendTotalMs": 0,
    }

    incoming = list(files or [])
    if file is not None:
        incoming.append(file)
    if not incoming:
        raise HTTPException(status_code=400, detail="请上传一个PDF或至少一张图片")

    upload_read_started = time.perf_counter()
    image_extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    uploads: list[tuple[str, bytes]] = []
    for index, upload in enumerate(incoming, start=1):
        uploads.append((upload.filename or f"page-{index}", await upload.read()))
    timings["uploadReadMs"] = _log_step(
        run_id, "upload_read", upload_read_started,
        files=len(uploads), bytes=sum(len(content) for _, content in uploads),
    )

    input_validation_started = time.perf_counter()
    extensions = [Path(name).suffix.lower() for name, _ in uploads]
    is_single_pdf = len(uploads) == 1 and extensions[0] == ".pdf"
    is_image_batch = bool(uploads) and all(extension in image_extensions for extension in extensions)
    if not is_single_pdf and not is_image_batch:
        raise HTTPException(
            status_code=400,
            detail="一次只能上传一个PDF，或一组属于同一篇阅读的图片；不能混合上传",
        )
    if is_image_batch and len(uploads) > MAX_PAGES:
        raise HTTPException(status_code=400, detail=f"一次最多上传{MAX_PAGES}张图片")
    timings["inputValidationMs"] = _log_step(
        run_id, "input_validation", input_validation_started,
        format="pdf" if is_single_pdf else "images", files=len(uploads),
    )

    preprocess_started = time.perf_counter()
    try:
        if is_single_pdf:
            pages, page_images, native_evidence = process_pdf_bytes(uploads[0][1], run_id)
        else:
            pages, page_images, native_evidence = process_image_bytes(uploads)
    except Exception as exc:
        _log_step(run_id, "preprocess_failed", preprocess_started, error_type=type(exc).__name__)
        raise
    timings["preprocessMs"] = _log_step(
        run_id, "preprocess", preprocess_started,
        pages=len(pages), image_bytes=sum(len(image) for image in page_images),
    )

    primary_started = time.perf_counter()
    logger.info("[parse:%s] step=primary_model_started pages=%s", run_id, len(page_images))
    try:
        primary, raw_primary, primary_ms = await call_active_model(
            active_profile,
            PARSE_PROMPT,
            page_images,
        )
    except Exception as exc:
        _log_step(run_id, "primary_model_failed", primary_started, error_type=type(exc).__name__)
        raise
    timings["primaryModelMs"] = primary_ms
    _log_step(run_id, "primary_model", primary_started, output_chars=len(raw_primary))

    postprocess_started = time.perf_counter()
    normalized = normalize_parsed_output(primary)
    timings["postprocessMs"] += _log_step(
        run_id, "primary_normalize", postprocess_started,
        article_blocks=len(normalized.get("articleBlocks", [])), questions=len(normalized.get("questions", [])),
    )

    validation_started = time.perf_counter()
    report = validate_parsed_output(normalized, native_evidence)
    timings["validationMs"] += _log_step(
        run_id, "primary_validation", validation_started,
        status=report["status"], errors=len(report["errors"]), warnings=len(report["warnings"]),
    )
    initial_validation_errors = list(report["errors"])
    retry_count = 0
    raw_verification = ""
    verification_pages: list[int] = []

    if initial_validation_errors:
        for index, error in enumerate(initial_validation_errors, start=1):
            logger.warning("[parse:%s] initial_validation_error[%s]=%s", run_id, index, error)
        retry_count = 1
        repair_planning_started = time.perf_counter()
        repair_indices, repair_fields = _repair_scope(normalized, initial_validation_errors, native_evidence)
        verification_pages = [index + 1 for index in repair_indices]
        repair_prompt = _repair_prompt(normalized, report, repair_fields)
        _log_step(
            run_id, "repair_planning", repair_planning_started,
            pages=verification_pages, fields=repair_fields,
        )
        verification_started = time.perf_counter()
        logger.info("[parse:%s] step=verification_model_started pages=%s", run_id, verification_pages)
        try:
            repaired, raw_verification, verification_ms = await call_active_model(
                active_profile,
                repair_prompt,
                [page_images[index] for index in repair_indices],
                verification_pages,
            )
        except Exception as exc:
            _log_step(run_id, "verification_model_failed", verification_started, error_type=type(exc).__name__)
            raise
        timings["verificationModelMs"] = verification_ms
        _log_step(run_id, "verification_model", verification_started, output_chars=len(raw_verification))
        postprocess_started = time.perf_counter()
        repaired_normalized = normalize_parsed_output(_merge_repair(normalized, repaired, repair_fields))
        timings["postprocessMs"] += _log_step(run_id, "repair_merge_normalize", postprocess_started)
        validation_started = time.perf_counter()
        repaired_report = validate_parsed_output(repaired_normalized, native_evidence)
        timings["validationMs"] += _log_step(
            run_id, "verification_validation", validation_started,
            status=repaired_report["status"], errors=len(repaired_report["errors"]),
            warnings=len(repaired_report["warnings"]),
        )
        if len(repaired_report["errors"]) < len(report["errors"]):
            normalized = repaired_normalized
            report = repaired_report
            logger.info("[parse:%s] repair_result=accepted", run_id)
        else:
            logger.warning("[parse:%s] repair_result=rejected reason=errors_not_reduced", run_id)

    report["initialErrors"] = initial_validation_errors
    report["verificationPages"] = verification_pages
    for index, warning in enumerate(report["warnings"], start=1):
        logger.warning("[parse:%s] final_validation_warning[%s]=%s", run_id, index, warning)
    for index, error in enumerate(report["errors"], start=1):
        logger.error("[parse:%s] final_validation_error[%s]=%s", run_id, index, error)

    response_build_started = time.perf_counter()
    if report["errors"]:
        file_hash = _hash_uploads(uploads)
        failure_detail = {
            "message": "文件解析结果未通过完整性验收",
            "runId": run_id,
            "validation": report,
            "timing": timings,
            "answerStatus": normalized.get("answerStatus", "uncertain"),
            "pageCount": len(pages),
            "questionCount": len(normalized.get("questions", [])),
            "normalizedOutput": normalized,
            "parseMeta": {
                "runId": run_id,
                "fileHash": file_hash,
                "profile": active_profile["profile"],
                "provider": active_profile["provider"],
                "protocol": active_profile["protocol"],
                "model": active_profile["model"],
                "parserVersion": PARSER_VERSION,
                "promptVersion": PROMPT_VERSION,
                "retryCount": retry_count,
                "initialValidationErrors": initial_validation_errors,
                "verificationPages": verification_pages,
                "rawModelOutput": {
                    "primary": raw_primary,
                    "verification": raw_verification or None,
                },
            },
        }
        timings["responseBuildMs"] = _log_step(run_id, "failure_response_build", response_build_started)
        timings["backendTotalMs"] = _now_ms(backend_started)
        logger.info(
            "[parse:%s] handler_complete status=422 pages=%s questions=%s retry=%s timings=%s",
            run_id, len(pages), len(normalized.get("questions", [])), retry_count,
            json.dumps(timings, ensure_ascii=False),
        )
        request.state.parse_handler_finished = time.perf_counter()
        raise HTTPException(status_code=422, detail=failure_detail)

    title_value = normalized.get("title")
    title = title_value.strip() if isinstance(title_value, str) else ""
    if not title:
        title = Path(uploads[0][0]).stem or "阅读材料"

    result = {
        "pages": pages,
        "total_pages": len(pages),
        "title": title,
        "article": normalized.get("article", ""),
        "articleBlocks": normalized.get("articleBlocks", []),
        "questions": normalized.get("questions", []),
        "questions_raw": "",
        "answerStatus": normalized.get("answerStatus", "none"),
        "answerSource": normalized.get("answerSource", "none"),
        "analysisStatus": normalized.get("analysisStatus", "none"),
        "analysisSource": normalized.get("analysisSource", "none"),
        "answers": normalized.get("answers", {}),
        "answerEvidence": normalized.get("answerEvidence", {}),
        "locations": normalized.get("locations", {}),
        "explanations": normalized.get("explanations", {}),
        "parseMeta": {
            "runId": run_id,
            "fileHash": _hash_uploads(uploads),
            "profile": active_profile["profile"],
            "provider": active_profile["provider"],
            "protocol": active_profile["protocol"],
            "model": active_profile["model"],
            "parserVersion": PARSER_VERSION,
            "promptVersion": PROMPT_VERSION,
            "retryCount": retry_count,
            "initialValidationErrors": initial_validation_errors,
            "verificationPages": verification_pages,
            "timing": timings,
            "validation": report,
            "rawModelOutput": {
                "primary": raw_primary,
                "verification": raw_verification or None,
            },
        },
    }
    timings["responseBuildMs"] = _log_step(run_id, "success_response_build", response_build_started)
    timings["backendTotalMs"] = _now_ms(backend_started)
    logger.info(
        "[parse:%s] handler_complete status=200 pages=%s questions=%s retry=%s validation=%s timings=%s",
        run_id, len(pages), len(normalized.get("questions", [])), retry_count, report["status"],
        json.dumps(timings, ensure_ascii=False),
    )
    request.state.parse_handler_finished = time.perf_counter()
    return result


@app.get("/")
async def root() -> dict[str, Any]:
    try:
        profile = get_active_model_profile()
        model_status: dict[str, Any] = {
            "configured": True,
            "profile": profile["profile"],
            "provider": profile["provider"],
            "protocol": profile["protocol"],
            "model": profile["model"],
        }
    except ValueError as exc:
        model_status = {
            "configured": False,
            "profile": PARSER_PROFILE,
            "error": str(exc),
        }
    return {
        "message": "IELTS parser API is running",
        "parserVersion": PARSER_VERSION,
        "promptVersion": PROMPT_VERSION,
        "activeModel": model_status,
    }
