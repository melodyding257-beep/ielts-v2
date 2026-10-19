from __future__ import annotations

import re
from typing import Any

def normalize_question_id(value: object) -> str:
    question_id = str(value).strip().rstrip(".")
    question_id = question_id.replace("–", "-").replace("—", "-")
    return re.sub(r"\s*-\s*", "-", question_id)


def expand_question_id(question_id: str) -> list[str]:
    match = re.fullmatch(r"(\d+)-(\d+)", question_id)
    if not match:
        return [question_id] if question_id else []
    start, end = int(match.group(1)), int(match.group(2))
    if end < start or end - start > 50:
        return []
    return [str(value) for value in range(start, end + 1)]


def _normalize_runs(block: dict[str, Any], fallback_text: str) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    runs = block.get("runs")
    if isinstance(runs, list):
        for run in runs:
            if not isinstance(run, dict) or not isinstance(run.get("text"), str):
                continue
            text = run["text"]
            if not text:
                continue
            normalized.append(
                {
                    "text": text,
                    "bold": bool(run.get("bold", False)),
                    "italic": bool(run.get("italic", False)),
                    "underline": bool(run.get("underline", False)),
                }
            )
    if normalized and fallback_text:
        joined = re.sub(r"\s+", " ", "".join(run["text"] for run in normalized)).strip()
        expected = re.sub(r"\s+", " ", fallback_text).strip()
        if joined != expected:
            # Never lose source text just because the model returned incomplete style runs.
            normalized = []
    return normalized or ([{"text": fallback_text, "bold": False, "italic": False, "underline": False}] if fallback_text else [])


def normalize_article_blocks(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    blocks = parsed.get("articleBlocks")
    normalized: list[dict[str, Any]] = []
    allowed_types = {"subtitle", "heading", "paragraph", "bullet"}
    allowed_alignment = {"left", "center", "right", "justify"}
    allowed_sizes = {"subtitle", "heading", "body", "small"}
    allowed_families = {"serif", "sans", "monospace", "unknown"}

    if isinstance(blocks, list):
        for block in blocks:
            if not isinstance(block, dict):
                continue
            block_type = block.get("type")
            if block_type not in allowed_types:
                continue
            raw_text = block.get("text") if isinstance(block.get("text"), str) else ""
            runs = _normalize_runs(block, raw_text.strip())
            text = raw_text.strip() or "".join(run["text"] for run in runs).strip()
            if not text:
                continue

            raw_label = block.get("label")
            label: dict[str, Any] | None = None
            if isinstance(raw_label, str):
                label_text = raw_label.strip()
                if label_text:
                    label = {"text": label_text, "bold": False, "italic": False}
            elif isinstance(raw_label, dict) and isinstance(raw_label.get("text"), str):
                label_text = raw_label["text"].strip()
                if label_text:
                    label = {
                        "text": label_text,
                        "bold": bool(raw_label.get("bold", False)),
                        "italic": bool(raw_label.get("italic", False)),
                    }

            page = block.get("page")
            normalized.append(
                {
                    "type": block_type,
                    "text": text,
                    "label": label,
                    "runs": runs,
                    "alignment": block.get("alignment") if block.get("alignment") in allowed_alignment else "left",
                    "sizeRole": block.get("sizeRole") if block.get("sizeRole") in allowed_sizes else ("heading" if block_type == "heading" else "body"),
                    "fontFamilyRole": block.get("fontFamilyRole") if block.get("fontFamilyRole") in allowed_families else "unknown",
                    "page": int(page) if isinstance(page, (int, float)) and page > 0 else None,
                }
            )

    if normalized:
        return normalized

    article = parsed.get("article", "")
    if not isinstance(article, str):
        return []
    return [
        {
            "type": "paragraph",
            "text": paragraph.strip(),
            "label": None,
            "runs": [{"text": paragraph.strip(), "bold": False, "italic": False, "underline": False}],
            "alignment": "left",
            "sizeRole": "body",
            "fontFamilyRole": "unknown",
            "page": None,
        }
        for paragraph in re.split(r"\n\s*\n", article)
        if paragraph.strip()
    ]


def normalize_parsed_output(parsed: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(parsed)
    normalized["articleBlocks"] = normalize_article_blocks(parsed)
    normalized["article"] = "\n\n".join(block["text"] for block in normalized["articleBlocks"])

    questions: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    raw_questions = parsed.get("questions", [])
    if isinstance(raw_questions, list):
        for question in raw_questions:
            if not isinstance(question, dict):
                continue
            question_id = normalize_question_id(question.get("id", ""))
            if not question_id or question_id in seen_ids:
                continue
            seen_ids.add(question_id)
            normalized_question = {**question, "id": question_id}
            direction = str(question.get("direction", ""))
            section_title = str(question.get("sectionTitle", ""))
            heading_cue = f"{section_title} {direction}".lower()
            if question.get("type") == "matching_paragraph" and (
                "list of headings" in heading_cue
                or "correct heading" in heading_cue
                or re.search(r"\bi\s*[-–—]\s*ix\b", heading_cue)
            ):
                normalized_question["type"] = "matching_headings"
                if not question.get("sharedOptions") and isinstance(question.get("options"), list):
                    normalized_question["sharedOptions"] = question.get("options")
                normalized_question["options"] = None

            content_blocks = question.get("contentBlocks")
            if isinstance(content_blocks, list):
                normalized_question["contentBlocks"] = [
                    {"type": block.get("type"), "text": block.get("text").strip()}
                    for block in content_blocks
                    if isinstance(block, dict)
                    and block.get("type") in {"title", "subheading", "bullet", "paragraph"}
                    and isinstance(block.get("text"), str)
                    and block.get("text").strip()
                ]

            # A matching-list group is safely recoverable when the model put
            # every numbered statement in contentBlocks. Split it here rather
            # than forcing a second vision call. Other grouped question types
            # (notably choice_single) are not safe to split because each item
            # has its own options, which may already have been omitted.
            if normalized_question.get("type") == "matching_list":
                range_ids = expand_question_id(question_id)
                blocks = normalized_question.get("contentBlocks") or []
                statements: dict[str, str] = {}
                for block in blocks:
                    block_text = str(block.get("text", "")).strip()
                    match = re.match(r"^(\d+)\s*[.)]?\s+(.+)$", block_text, re.DOTALL)
                    if match:
                        statements[match.group(1)] = match.group(2).strip()
                if len(range_ids) > 1 and all(statements.get(item) for item in range_ids):
                    for item in range_ids:
                        if item in seen_ids:
                            continue
                        seen_ids.add(item)
                        questions.append(
                            {
                                **normalized_question,
                                "id": item,
                                "text": statements[item],
                                "contentBlocks": None,
                            }
                        )
                    continue
            questions.append(normalized_question)
    normalized["questions"] = questions

    for field in ("answers", "answerEvidence", "locations", "explanations"):
        values = parsed.get(field, {})
        normalized[field] = (
            {normalize_question_id(key): value for key, value in values.items()}
            if isinstance(values, dict)
            else {}
        )

    answer_status = str(parsed.get("answerStatus", "")).lower()
    if answer_status not in {"complete", "none", "incomplete", "uncertain"}:
        answer_status = "complete" if normalized["answers"] else "none"
    normalized["answerStatus"] = answer_status
    normalized["answerSource"] = (
        "uploaded_document" if answer_status in {"complete", "incomplete"} and normalized["answers"] else "none"
    )

    analysis_status = str(parsed.get("analysisStatus", "")).lower()
    if analysis_status not in {"complete", "none", "incomplete", "uncertain"}:
        has_analysis = bool(normalized["locations"] or normalized["explanations"])
        analysis_status = "complete" if has_analysis else "none"
    normalized["analysisStatus"] = analysis_status
    normalized["analysisSource"] = (
        "uploaded_document" if analysis_status in {"complete", "incomplete"} else "none"
    )
    return normalized
