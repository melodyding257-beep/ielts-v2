import unittest

from backend.main import _merge_repair, _repair_scope, normalize_parsed_output, validate_parsed_output


def sample_payload(answer_status: str = "none", answers: dict | None = None) -> dict:
    return {
        "title": "Singing dunes",
        "articleBlocks": [
            {
                "type": "subtitle",
                "text": "A desert mystery",
                "label": None,
                "runs": [
                    {
                        "text": "A desert mystery",
                        "bold": False,
                        "italic": True,
                        "underline": False,
                    }
                ],
                "alignment": "left",
                "sizeRole": "subtitle",
                "fontFamilyRole": "serif",
                "page": 1,
            },
            {
                "type": "paragraph",
                "text": "The dunes can sing.",
                "label": {"text": "A", "bold": True, "italic": False},
                "runs": [{"text": "The dunes can sing.", "bold": False, "italic": False}],
                "page": 1,
            },
        ],
        "questions": [
            {
                "id": "37-38",
                "sectionTitle": "Questions 37-38",
                "direction": "Complete the summary.",
                "type": "fill_blank_summary",
                "text": "Known as 37 _______ and shaped by 38 _______.",
                "options": None,
                "selectCount": 1,
                "sharedOptions": None,
                "contentBlocks": [
                    {"type": "paragraph", "text": "Known as 37 _______ and shaped by 38 _______."}
                ],
            }
        ],
        "answerStatus": answer_status,
        "answerSource": "uploaded_document" if answer_status == "complete" else "none",
        "analysisStatus": "none",
        "analysisSource": "none",
        "answers": answers or {},
        "answerEvidence": {},
        "locations": {},
        "explanations": {},
    }


class ParserLogicTests(unittest.TestCase):
    def test_no_answer_document_is_valid(self) -> None:
        parsed = normalize_parsed_output(sample_payload())
        report = validate_parsed_output(parsed, [[]])
        self.assertEqual(report["status"], "passed")
        self.assertEqual(parsed["answerStatus"], "none")

    def test_complete_answer_document_requires_every_question(self) -> None:
        parsed = normalize_parsed_output(sample_payload("complete", {"37": "barchans"}))
        report = validate_parsed_output(parsed, [[]])
        self.assertEqual(report["status"], "failed")
        self.assertTrue(any("38" in error for error in report["errors"]))

    def test_complete_answers_with_page_evidence_are_valid(self) -> None:
        payload = sample_payload("complete", {"37": "barchans", "38": "shape"})
        payload["answerEvidence"] = {
            "37": {"page": 1, "text": "37 barchans"},
            "38": {"page": 1, "text": "38 shape"},
        }
        parsed = normalize_parsed_output(payload)
        report = validate_parsed_output(parsed, [[]])
        self.assertEqual(report["status"], "passed")

    def test_summary_layout_blocks_must_contain_every_blank(self) -> None:
        payload = sample_payload()
        payload["questions"][0]["contentBlocks"] = [
            {"type": "paragraph", "text": "Known as 37 _______."}
        ]
        parsed = normalize_parsed_output(payload)
        report = validate_parsed_output(parsed, [[]])
        self.assertEqual(report["status"], "failed")
        self.assertTrue(any("38" in error for error in report["errors"]))

    def test_split_summary_is_renderable_warning(self) -> None:
        payload = sample_payload()
        payload["questions"] = [
            {
                "id": str(number),
                "sectionTitle": "Questions 22-26",
                "direction": "Complete the summary below.",
                "type": "fill_blank",
                "text": f"Sentence with {number} _______ blank.",
            }
            for number in range(22, 27)
        ]
        report = validate_parsed_output(normalize_parsed_output(payload), [[]])
        self.assertEqual(report["errors"], [])
        self.assertTrue(any("被拆成独立题目" in warning for warning in report["warnings"]))

    def test_summary_rejects_duplicate_source_blanks(self) -> None:
        payload = sample_payload()
        payload["questions"][0]["text"] = "37 _______ first, then 37 _______ and 38 _______."
        payload["questions"][0]["contentBlocks"] = None
        report = validate_parsed_output(normalize_parsed_output(payload), [[]])
        self.assertTrue(any("重复出现" in error for error in report["errors"]))
        self.assertTrue(any("多余的原文空格" in error for error in report["errors"]))

    def test_grouped_summary_repair_replaces_all_split_questions(self) -> None:
        payload = sample_payload()
        payload["questions"] = [
            {"id": str(number), "type": "fill_blank", "text": f"{number} _______"}
            for number in range(22, 27)
        ]
        repaired = _merge_repair(
            payload,
            {"questions": [{"id": "22-26", "type": "fill_blank_summary", "text": "22 _______ 23 _______ 24 _______ 25 _______ 26 _______"}]},
            ["questions"],
        )
        self.assertEqual([question["id"] for question in repaired["questions"]], ["22-26"])

    def test_none_status_cannot_hide_returned_answers(self) -> None:
        parsed = normalize_parsed_output(sample_payload("none", {"37": "barchans"}))
        report = validate_parsed_output(parsed, [[]])
        self.assertEqual(report["status"], "failed")

    def test_rich_text_and_paragraph_label_are_preserved(self) -> None:
        parsed = normalize_parsed_output(sample_payload())
        subtitle = parsed["articleBlocks"][0]
        paragraph = parsed["articleBlocks"][1]
        self.assertTrue(subtitle["runs"][0]["italic"])
        self.assertEqual(paragraph["label"]["text"], "A")
        self.assertTrue(paragraph["label"]["bold"])

    def test_incomplete_style_runs_fall_back_to_complete_text(self) -> None:
        payload = sample_payload()
        payload["articleBlocks"][0]["runs"] = [{"text": "A desert", "italic": True}]
        parsed = normalize_parsed_output(payload)
        self.assertEqual(parsed["articleBlocks"][0]["runs"][0]["text"], "A desert mystery")

    def test_grouped_matching_list_is_safely_split_from_content_blocks(self) -> None:
        payload = sample_payload()
        payload["questions"] = [
            {
                "id": "14-16",
                "sectionTitle": "Questions 14-16",
                "direction": "Match each statement with the correct person.",
                "type": "matching_list",
                "text": "",
                "options": None,
                "selectCount": 1,
                "sharedOptions": ["A Alice", "B Bob"],
                "contentBlocks": [
                    {"type": "bullet", "text": "14 First statement"},
                    {"type": "bullet", "text": "15 Second statement"},
                    {"type": "bullet", "text": "16 Third statement"},
                ],
            }
        ]

        parsed = normalize_parsed_output(payload)
        self.assertEqual([question["id"] for question in parsed["questions"]], ["14", "15", "16"])
        self.assertEqual(parsed["questions"][1]["text"], "Second statement")
        self.assertIsNone(parsed["questions"][1]["contentBlocks"])
        report = validate_parsed_output(parsed, [[]])
        self.assertEqual(report["status"], "passed")

    def test_grouped_single_choice_is_rejected_and_marks_items_missing(self) -> None:
        payload = sample_payload()
        payload["questions"] = [
            {
                "id": "19-21",
                "sectionTitle": "Questions 19-21",
                "direction": "Choose the correct letter.",
                "type": "choice_single",
                "text": "",
                "options": ["A First", "B Second", "C Third", "D Fourth"],
                "selectCount": 1,
                "sharedOptions": None,
                "contentBlocks": [
                    {"type": "bullet", "text": "19 First question"},
                    {"type": "bullet", "text": "20 Second question"},
                    {"type": "bullet", "text": "21 Third question"},
                ],
            }
        ]

        parsed = normalize_parsed_output(payload)
        report = validate_parsed_output(parsed, [[]])
        self.assertEqual(report["status"], "failed")
        self.assertEqual(report["missingQuestionIds"], ["19", "20", "21"])
        self.assertTrue(any("不允许使用范围题号19-21" in error for error in report["errors"]))
        self.assertTrue(any("缺少题干text" in error for error in report["errors"]))

    def test_uploaded_complete_analysis_requires_every_answered_question(self) -> None:
        payload = sample_payload("complete", {"37": "barchans", "38": "shape"})
        payload["answerEvidence"] = {
            "37": {"page": 1, "text": "37 barchans"},
            "38": {"page": 1, "text": "38 shape"},
        }
        payload["analysisStatus"] = "complete"
        payload["analysisSource"] = "uploaded_document"
        payload["locations"] = {"37": "Printed location for 37"}
        payload["explanations"] = {"37": "Printed explanation for 37"}

        parsed = normalize_parsed_output(payload)
        report = validate_parsed_output(parsed, [[]])
        self.assertEqual(report["status"], "failed")
        self.assertTrue(any("定位题号：38" in error for error in report["errors"]))
        self.assertTrue(any("解释题号：38" in error for error in report["errors"]))

    def test_uploaded_complete_analysis_is_preserved(self) -> None:
        payload = sample_payload("complete", {"37": "barchans", "38": "shape"})
        payload["answerEvidence"] = {
            "37": {"page": 1, "text": "37 barchans"},
            "38": {"page": 1, "text": "38 shape"},
        }
        payload["analysisStatus"] = "complete"
        payload["analysisSource"] = "uploaded_document"
        payload["locations"] = {
            "37": "Printed location for 37",
            "38": "Printed location for 38",
        }
        payload["explanations"] = {
            "37": "Printed explanation for 37",
            "38": "Printed explanation for 38",
        }

        parsed = normalize_parsed_output(payload)
        report = validate_parsed_output(parsed, [[]])
        self.assertEqual(report["status"], "passed")
        self.assertEqual(parsed["locations"], payload["locations"])
        self.assertEqual(parsed["explanations"], payload["explanations"])

    def test_no_uploaded_analysis_remains_empty(self) -> None:
        parsed = normalize_parsed_output(sample_payload())
        report = validate_parsed_output(parsed, [[]])
        self.assertEqual(report["status"], "passed")
        self.assertEqual(parsed["analysisStatus"], "none")
        self.assertEqual(parsed["locations"], {})
        self.assertEqual(parsed["explanations"], {})

    def test_partial_printed_answers_do_not_force_retry(self) -> None:
        payload = sample_payload("incomplete", {"37": "barchans"})
        payload["answerEvidence"] = {"37": {"page": 1, "text": "37 barchans"}}
        parsed = normalize_parsed_output(payload)
        report = validate_parsed_output(parsed, [[]])
        self.assertEqual(report["status"], "warning")
        self.assertEqual(report["errors"], [])
        self.assertEqual(parsed["answerSource"], "uploaded_document")

    def test_partial_answers_still_require_page_evidence(self) -> None:
        parsed = normalize_parsed_output(sample_payload("incomplete", {"37": "barchans"}))
        report = validate_parsed_output(parsed, [[]])
        self.assertTrue(any("页面证据" in error for error in report["errors"]))

    def test_uncertain_answer_region_is_a_warning(self) -> None:
        parsed = normalize_parsed_output(sample_payload("uncertain"))
        report = validate_parsed_output(parsed, [[]])
        self.assertEqual(report["status"], "warning")
        self.assertEqual(report["errors"], [])

    def test_repair_uses_only_page_with_missing_question(self) -> None:
        evidence = [
            [{"text": "27 The first question"}],
            [{"text": "38 Second question"}],
            [{"text": "Answers"}],
        ]
        pages, fields = _repair_scope(sample_payload(), ["题组范围内缺少题号：38"], evidence)
        self.assertEqual(pages, [1])
        self.assertEqual(fields, ["questions"])

    def test_repair_uses_printed_answer_page(self) -> None:
        payload = sample_payload("complete", {"37": "barchans"})
        payload["answerEvidence"] = {"37": {"page": 3, "text": "37 barchans"}}
        pages, fields = _repair_scope(
            payload,
            ["官方答案缺少题号：38"],
            [[{"text": "Reading passage"}], [{"text": "Questions 37-38"}], [{"text": "Answers 37 barchans"}]],
        )
        self.assertEqual(pages, [2])
        self.assertEqual(fields, ["answerStatus", "answers", "answerEvidence"])

    def test_repair_keeps_unrelated_answers_and_questions(self) -> None:
        payload = sample_payload("complete", {"37": "barchans", "38": "shape"})
        payload["questions"] = [
            {"id": "37", "type": "fill_blank", "text": "37 _______"},
            {"id": "38", "type": "fill_blank", "text": "38 _______"},
        ]
        merged = _merge_repair(
            payload,
            {"questions": [{"id": "38", "type": "fill_blank", "text": "38 _______"}], "answers": {"38": "new"}},
            ["questions", "answers"],
        )
        self.assertEqual(merged["answers"], {"37": "barchans", "38": "new"})
        self.assertEqual([question["id"] for question in merged["questions"]], ["37", "38"])


if __name__ == "__main__":
    unittest.main()
