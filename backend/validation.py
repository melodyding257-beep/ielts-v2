from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from backend.normalization import expand_question_id, normalize_question_id

def _expected_answer_ids(questions: list[dict[str, Any]]) -> list[str]:
    expected: list[str] = []
    for question in questions:
        for question_id in expand_question_id(str(question.get("id", ""))):
            if question_id and question_id not in expected:
                expected.append(question_id)
    return expected


def _native_label_candidates(native_evidence: list[list[dict[str, Any]]]) -> list[str]:
    candidates: list[str] = []
    pattern = re.compile(r"^(?:[A-Z]|i|ii|iii|iv|v|vi|vii|viii|ix|x)$")
    for page_spans in native_evidence:
        for span in page_spans:
            text = str(span.get("text", "")).strip()
            bbox = span.get("bbox", [])
            if pattern.fullmatch(text) and isinstance(bbox, list) and len(bbox) == 4:
                # Keep this as weak evidence only. Question options can have the same shape.
                candidates.append(text)
    return list(dict.fromkeys(candidates))


def validate_parsed_output(
    parsed: dict[str, Any],
    native_evidence: list[list[dict[str, Any]]],
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    questions = parsed.get("questions", [])
    article_blocks = parsed.get("articleBlocks", [])
    answers = parsed.get("answers", {})
    answer_status = parsed.get("answerStatus")
    analysis_status = parsed.get("analysisStatus")

    if not article_blocks:
        errors.append("未提取到文章正文")
    if not questions:
        errors.append("未提取到题目")

    expected_ids = _expected_answer_ids(questions if isinstance(questions, list) else [])
    answer_ids = [key for key, value in answers.items() if str(value).strip()] if isinstance(answers, dict) else []
    expected_from_sections: list[str] = []
    allowed_question_types = {
        "choice_single", "choice_multi", "choice_judge", "matching_paragraph",
        "matching_headings", "matching_list", "fill_blank", "fill_blank_summary",
    }
    range_allowed_types = {"choice_multi", "fill_blank_summary"}
    actual_question_ids: list[str] = []
    for question in questions if isinstance(questions, list) else []:
        question_id = str(question.get("id", ""))
        question_type = question.get("type")
        if question_type not in allowed_question_types:
            errors.append(f"题号{question_id}的题型无效：{question_type}")

        expanded_ids = expand_question_id(question_id)
        is_range = len(expanded_ids) > 1
        if is_range and question_type not in range_allowed_types:
            errors.append(
                f"题型{question_type}不允许使用范围题号{question_id}，必须每题返回一个独立对象"
            )
        else:
            for item in expanded_ids:
                if item not in actual_question_ids:
                    actual_question_ids.append(item)

        text = str(question.get("text", "")).strip()
        if question_type in {
            "choice_single", "choice_judge", "matching_paragraph",
            "matching_headings", "matching_list", "fill_blank",
        } and not text:
            errors.append(f"题号{question_id}缺少题干text")

        options = question.get("options")
        if question_type in {"choice_single", "choice_judge"}:
            if not isinstance(options, list) or len(options) < 2:
                errors.append(f"题号{question_id}缺少完整选项")
        if question_type == "matching_list":
            shared_options = question.get("sharedOptions")
            if not isinstance(shared_options, list) or len(shared_options) < 2:
                errors.append(f"题号{question_id}缺少公用选项sharedOptions")

        section_title = str(question.get("sectionTitle", ""))
        section_match = re.search(r"Questions?\s+(\d+)\s*[-–—]\s*(\d+)", section_title, re.IGNORECASE)
        if section_match:
            for value in range(int(section_match.group(1)), int(section_match.group(2)) + 1):
                question_id = str(value)
                if question_id not in expected_from_sections:
                    expected_from_sections.append(question_id)
    missing_question_ids = [
        question_id for question_id in expected_from_sections
        if question_id not in actual_question_ids
    ]
    if missing_question_ids:
        errors.append(f"题组范围内缺少题号：{', '.join(missing_question_ids)}")

    summary_sections: dict[str, list[dict[str, Any]]] = {}
    for question in questions if isinstance(questions, list) else []:
        section_title = str(question.get("sectionTitle", ""))
        if re.search(r"Questions?\s+\d+\s*[-–—]\s*\d+", section_title, re.IGNORECASE):
            summary_sections.setdefault(section_title, []).append(question)
    for section_title, section_questions in summary_sections.items():
        if (
            len(section_questions) > 1
            and all(question.get("type") == "fill_blank" for question in section_questions)
            and any(re.search(r"\bsummary\b", str(question.get("direction", "")), re.IGNORECASE)
                    for question in section_questions)
        ):
            warnings.append(f"摘要填空题组{section_title}被拆成独立题目；前端将按连续摘要合并显示")

    blank_ids: list[str] = []
    for question in questions if isinstance(questions, list) else []:
        if question.get("type") != "fill_blank_summary":
            continue
        question_text = str(question.get("text", ""))
        content_blocks = question.get("contentBlocks", []) or []
        block_text = "\n".join(
            str(block.get("text", ""))
            for block in content_blocks
            if isinstance(block, dict)
        )
        found_in_text = re.findall(r"(\d+)\s*_{3,}", question_text)
        found_in_blocks = re.findall(r"(\d+)\s*_{3,}", block_text)
        for question_id in expand_question_id(str(question.get("id", ""))):
            if question_id not in found_in_text:
                errors.append(f"摘要填空缺少编号{question_id}的空格")
            if content_blocks and question_id not in found_in_blocks:
                errors.append(f"摘要填空排版块缺少编号{question_id}的空格")
            if found_in_text.count(question_id) > 1:
                errors.append(f"摘要填空正文中编号{question_id}重复出现")
            if found_in_blocks.count(question_id) > 1:
                errors.append(f"摘要填空排版块中编号{question_id}重复出现")
            if question_id not in blank_ids:
                blank_ids.append(question_id)
        if len(re.findall(r"_{3,}", question_text)) > len(expand_question_id(str(question.get("id", "")))):
            errors.append(f"摘要填空题组{question.get('id', '')}包含多余的原文空格")

    if answer_status in {"complete", "incomplete", "uncertain"}:
        missing = [question_id for question_id in expected_ids if question_id not in answer_ids]
        extra = [question_id for question_id in answer_ids if question_id not in expected_ids]
        if missing and answer_status == "complete":
            errors.append(f"官方答案缺少题号：{', '.join(missing)}")
        elif missing and answer_status == "incomplete":
            warnings.append(f"上传答案仅覆盖部分题号：{', '.join(missing)}")
        if answer_status == "uncertain":
            warnings.append("上传文件中的答案区域无法确定，请人工核对")
        if extra:
            warnings.append(f"官方答案包含未知题号：{', '.join(extra)}")
        evidence = parsed.get("answerEvidence", {})
        missing_evidence = [question_id for question_id in answer_ids if question_id not in evidence]
        if missing_evidence:
            errors.append(f"部分官方答案缺少页面证据：{', '.join(missing_evidence)}")
        for question_id in answer_ids:
            item = evidence.get(question_id) if isinstance(evidence, dict) else None
            if not isinstance(item, dict):
                continue
            page = item.get("page")
            evidence_text = str(item.get("text", ""))
            if not isinstance(page, (int, float)) or page < 1 or page > len(native_evidence):
                errors.append(f"题号{question_id}的答案证据页码无效")
            if str(answers.get(question_id, "")).strip().lower() not in evidence_text.lower():
                errors.append(f"题号{question_id}的答案与页面证据不一致")
    elif answer_status == "none":
        if answer_ids or parsed.get("answerEvidence"):
            errors.append("答案状态为none但answers或answerEvidence不为空")
    else:
        errors.append(f"答案状态为{answer_status}，需要重新核对上传文件中的答案区域")

    locations = parsed.get("locations", {})
    explanations = parsed.get("explanations", {})
    location_ids = [key for key, value in locations.items() if str(value).strip()] if isinstance(locations, dict) else []
    explanation_ids = [key for key, value in explanations.items() if str(value).strip()] if isinstance(explanations, dict) else []
    if analysis_status == "complete":
        analysis_ids = answer_ids or expected_ids
        missing_locations = [question_id for question_id in analysis_ids if question_id not in location_ids]
        missing_explanations = [question_id for question_id in analysis_ids if question_id not in explanation_ids]
        if missing_locations:
            errors.append("上传解析页缺少定位题号：" + ", ".join(missing_locations))
        if missing_explanations:
            errors.append("上传解析页缺少解释题号：" + ", ".join(missing_explanations))
    elif analysis_status == "none":
        if location_ids or explanation_ids:
            errors.append("解析状态为none但locations或explanations不为空")
    elif analysis_status == "incomplete":
        warnings.append("上传文件只包含部分题目的定位或解释")
    else:
        warnings.append(f"解析状态为{analysis_status}，未生成或补写任何解析")

    parsed_labels = [
        str(block.get("label", {}).get("text", "")).strip()
        for block in article_blocks
        if isinstance(block, dict) and isinstance(block.get("label"), dict)
    ]
    invalid_labels = [
        label for label in parsed_labels
        if not re.fullmatch(r"(?:[A-Z]|i|ii|iii|iv|v|vi|vii|viii|ix|x)", label)
    ]
    if invalid_labels:
        errors.append("发现无效段落标记：" + ", ".join(invalid_labels))
    native_candidates = _native_label_candidates(native_evidence)
    missing_candidates = [label for label in native_candidates if label not in parsed_labels]
    if missing_candidates:
        warnings.append(
            "PDF文字层检测到可能的段落/列表标记但文章未采用："
            + ", ".join(missing_candidates)
        )

    native_spans = [span for page in native_evidence for span in page]
    native_bold_count = sum(1 for span in native_spans if span.get("bold"))
    native_italic_count = sum(1 for span in native_spans if span.get("italic"))
    parsed_runs = [
        run
        for block in article_blocks
        if isinstance(block, dict)
        for run in block.get("runs", [])
        if isinstance(run, dict)
    ]
    parsed_bold_count = sum(1 for run in parsed_runs if run.get("bold"))
    parsed_italic_count = sum(1 for run in parsed_runs if run.get("italic"))
    if native_italic_count and not parsed_italic_count:
        warnings.append("PDF文字层包含斜体，但文章结构未保留任何斜体片段")
    if native_bold_count and not parsed_bold_count and not parsed_labels:
        warnings.append("PDF文字层包含粗体，但文章结构未保留粗体片段或段落标记")

    status = "failed" if errors else ("warning" if warnings else "passed")
    return {
        "status": status,
        "errors": errors,
        "warnings": warnings,
        "expectedQuestionIds": expected_ids,
        "expectedFromSectionTitles": expected_from_sections,
        "missingQuestionIds": missing_question_ids,
        "blankIds": blank_ids,
        "answerIds": answer_ids,
        "analysisStatus": analysis_status,
        "locationIds": location_ids,
        "explanationIds": explanation_ids,
        "nativeLabelCandidates": native_candidates,
        "parsedParagraphLabels": parsed_labels,
        "styleMetrics": {
            "nativeBoldSpans": native_bold_count,
            "nativeItalicSpans": native_italic_count,
            "parsedBoldRuns": parsed_bold_count,
            "parsedItalicRuns": parsed_italic_count,
        },
    }


def _repair_scope(
    previous: dict[str, Any],
    errors: list[str],
    native_evidence: list[list[dict[str, Any]]],
) -> tuple[list[int], list[str]]:
    """Use source page evidence; include every page when a safe page match is unavailable."""
    fields: list[str] = []
    for error in errors:
        if any(term in error for term in ("文章正文", "段落标记")):
            fields.extend(["title", "articleBlocks"])
        if any(term in error for term in ("题型", "题干", "选项", "摘要填空", "题组范围", "未提取到题目")):
            fields.append("questions")
        if any(term in error for term in ("答案", "证据")):
            fields.extend(["answerStatus", "answers", "answerEvidence"])
        if any(term in error for term in ("解析", "定位", "解释")):
            fields.extend(["analysisStatus", "locations", "explanations"])
    fields = list(dict.fromkeys(fields))
    if not fields:
        return list(range(len(native_evidence))), [
            "title", "articleBlocks", "questions", "answerStatus", "answers",
            "answerEvidence", "analysisStatus", "locations", "explanations",
        ]

    page_numbers: set[int] = set()
    if "articleBlocks" in fields:
        # Missing paragraphs have no reliable page number in the model output.
        return list(range(len(native_evidence))), fields

    requested_ids = set(re.findall(r"(?<!\d)\d{1,3}(?!\d)", " ".join(errors)))
    if "questions" in fields:
        if not requested_ids:
            return list(range(len(native_evidence))), fields
        matched_ids: set[str] = set()
        for page_index, spans in enumerate(native_evidence):
            for span in spans:
                span_text = str(span.get("text", "")).strip()
                for question_id in requested_ids:
                    if re.match(rf"^{re.escape(question_id)}(?:\s|[.)]|$)", span_text):
                        page_numbers.add(page_index)
                        matched_ids.add(question_id)
        if matched_ids != requested_ids:
            return list(range(len(native_evidence))), fields

    if any(field in fields for field in ("answers", "locations", "explanations")):
        answer_pages: set[int] = set()
        evidence = previous.get("answerEvidence", {})
        if isinstance(evidence, dict):
            for item in evidence.values():
                if isinstance(item, dict) and isinstance(item.get("page"), int):
                    page_index = item["page"] - 1
                    if 0 <= page_index < len(native_evidence):
                        answer_pages.add(page_index)
        for page_index, spans in enumerate(native_evidence):
            page_text = " ".join(str(span.get("text", "")) for span in spans).lower()
            if any(term in page_text for term in ("答案", "解析", "answer key", "explanation", "精确定位")):
                answer_pages.add(page_index)
        if not answer_pages:
            return list(range(len(native_evidence))), fields
        # Answer and explanation tables often continue onto pages without a repeated heading.
        page_numbers.update(range(min(answer_pages), len(native_evidence)))

    return sorted(page_numbers) if page_numbers else list(range(len(native_evidence))), fields


def _repair_prompt(previous: dict[str, Any], report: dict[str, Any], fields: list[str]) -> str:
    context = {field: previous.get(field) for field in fields}
    if "questions" in fields:
        context["existingQuestionIds"] = [question.get("id") for question in previous.get("questions", [])]
    return (
        "你是雅思阅读材料的视觉转录助手。仅根据附图修复验收错误，禁止解题、猜测答案或补写原图没有的内容。"
        "图片前的【第N页】是原PDF页码。只返回一个JSON对象，且只包含所列字段；"
        "已正确的题目和答案不要重写。questions仅返回需修复的题目对象，"
        "若错误涉及被拆开的连续摘要题组，返回一个包含该题组全部编号和完整连续原文的fill_blank_summary对象；"
        "每个空只写一次如'22 _______'的内部标记，不重复原文下划线或相邻句子。"
        "answers、answerEvidence、locations、explanations仅返回需补正的题号。"
        "文章有遗漏时articleBlocks须返回完整文章。不得把List of Headings的i-ix选项作为文章段落标签。\n"
        f"【需要修复的字段】{json.dumps(fields, ensure_ascii=False)}\n"
        f"【验收错误】{json.dumps(report['errors'], ensure_ascii=False)}\n"
        f"【已有结果供上下文参考】{json.dumps(context, ensure_ascii=False)}"
    )


def _merge_repair(previous: dict[str, Any], patch: dict[str, Any], fields: list[str]) -> dict[str, Any]:
    merged = dict(previous)
    for field in fields:
        value = patch.get(field)
        if field == "questions" and isinstance(value, list) and value:
            repaired_questions = [question for question in value if isinstance(question, dict)]
            if not repaired_questions:
                continue
            repaired_ids = {
                item_id
                for question in repaired_questions
                for item_id in expand_question_id(normalize_question_id(question.get("id", "")))
            }
            old_questions = [
                question for question in previous.get("questions", [])
                if not set(expand_question_id(str(question.get("id", "")))).issubset(repaired_ids)
            ]
            merged[field] = sorted(
                old_questions + repaired_questions,
                key=lambda question: int(re.match(r"\d+", str(question.get("id", ""))).group())
                if re.match(r"\d+", str(question.get("id", ""))) else 10**9,
            )
        elif field in {"answers", "answerEvidence", "locations", "explanations"} and isinstance(value, dict):
            merged[field] = {**previous.get(field, {}), **value}
        elif field == "articleBlocks" and isinstance(value, list) and value:
            merged[field] = value
        elif field in {"title", "answerStatus", "analysisStatus"} and isinstance(value, str) and value.strip():
            merged[field] = value
    return merged


def _hash_uploads(uploads: list[tuple[str, bytes]]) -> str:
    digest = hashlib.sha256()
    for _, content in uploads:
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(content)
    return digest.hexdigest()
