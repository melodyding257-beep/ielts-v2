from __future__ import annotations

import time
from typing import Any

import fitz
from fastapi import HTTPException

from backend.config import MAX_PAGES
from backend.timing import _now_ms, logger

def _extract_native_spans(page: fitz.Page) -> list[dict[str, Any]]:
    spans: list[dict[str, Any]] = []
    try:
        page_dict = page.get_text("dict")
        for block in page_dict.get("blocks", []):
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = str(span.get("text", "")).strip()
                    if not text:
                        continue
                    flags = int(span.get("flags", 0))
                    spans.append(
                        {
                            "text": text,
                            "bbox": [round(float(value), 1) for value in span.get("bbox", [])],
                            "font": str(span.get("font", "")),
                            "size": round(float(span.get("size", 0)), 1),
                            "bold": bool(flags & 16) or "bold" in str(span.get("font", "")).lower(),
                            "italic": bool(flags & 2) or "italic" in str(span.get("font", "")).lower(),
                        }
                    )
    except Exception as exc:
        print(f"Native text evidence warning: {type(exc).__name__}: {exc}")
    return spans


def process_pdf_bytes(
    pdf_bytes: bytes, run_id: str | None = None,
) -> tuple[list[dict[str, Any]], list[bytes], list[list[dict[str, Any]]]]:
    try:
        document = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="PDF文件无法打开或已损坏") from exc

    if len(document) > MAX_PAGES:
        document.close()
        raise HTTPException(status_code=400, detail=f"一次最多解析{MAX_PAGES}页")

    pages: list[dict[str, Any]] = []
    images: list[bytes] = []
    native_evidence: list[list[dict[str, Any]]] = []
    try:
        for page_index, page in enumerate(document):
            native_started = time.perf_counter()
            native_text = page.get_text("text").strip()
            spans = _extract_native_spans(page)
            native_ms = _now_ms(native_started)
            render_started = time.perf_counter()
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            image_bytes = pixmap.tobytes("png")
            images.append(image_bytes)
            render_ms = _now_ms(render_started)
            if run_id:
                logger.info(
                    "[parse:%s] step=pdf_page page=%s native_ms=%s render_ms=%s image_bytes=%s",
                    run_id, page_index + 1, native_ms, render_ms, len(image_bytes),
                )
            native_evidence.append(spans)
            pages.append(
                {
                    "page_num": page_index + 1,
                    "text": native_text,
                    "is_scan": len(native_text) <= 100,
                    "ocr_used": True,
                    "has_text_layer": bool(native_text),
                }
            )
    finally:
        document.close()
    return pages, images, native_evidence


def process_image_bytes(images: list[tuple[str, bytes]]) -> tuple[list[dict[str, Any]], list[bytes], list[list[dict[str, Any]]]]:
    pages = [
        {
            "page_num": index,
            "text": "",
            "is_scan": True,
            "ocr_used": True,
            "has_text_layer": False,
            "source_name": filename,
        }
        for index, (filename, _) in enumerate(images, start=1)
    ]
    return pages, [content for _, content in images], [[] for _ in images]
