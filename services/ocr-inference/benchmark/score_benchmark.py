#!/usr/bin/env python3
"""Score OCR transcription and semantic extraction without external packages."""

from __future__ import annotations

import argparse
import json
import math
import statistics
import unicodedata
from pathlib import Path
from typing import Any

FIELDS = (
    "name",
    "name_kana",
    "company",
    "department",
    "title",
    "email",
    "phone",
    "mobile",
    "fax",
    "postal_code",
    "address",
    "url",
    "social",
)
DIGIT_FIELDS = {"phone", "mobile", "fax", "postal_code"}


def _normalize(field: str, value: str) -> str:
    value = unicodedata.normalize("NFKC", value).strip().lower()
    if field in DIGIT_FIELDS:
        return "".join(character for character in value if character.isdigit())
    if field == "url":
        value = value.removeprefix("http://").removeprefix("https://").rstrip("/")
    return "".join(value.split())


def _percentile(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    rank = (len(ordered) - 1) * percentile
    lower = math.floor(rank)
    upper = math.ceil(rank)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (rank - lower)


def _distance(left: str, right: str) -> int:
    previous = list(range(len(right) + 1))
    for row, left_character in enumerate(left, start=1):
        current = [row]
        for column, right_character in enumerate(right, start=1):
            current.append(
                min(
                    current[-1] + 1,
                    previous[column] + 1,
                    previous[column - 1] + (left_character != right_character),
                )
            )
        previous = current
    return previous[-1]


def _normalized_lines(value: str) -> str:
    return "\n".join(
        sorted(
            normalized
            for line in value.splitlines()
            if (normalized := _normalize("transcript", line))
        )
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--corpus", type=Path, default=Path(__file__).with_name("corpus.json")
    )
    parser.add_argument("--results", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    corpus = {
        case["id"]: case for case in json.loads(args.corpus.read_text(encoding="utf-8"))
    }
    artifact = json.loads(args.results.read_text(encoding="utf-8"))
    field_correct = 0
    field_total = 0
    nonempty_correct = 0
    nonempty_total = 0
    hallucinations = 0
    expected_empty = 0
    missing = 0
    expected_nonempty = 0
    semantic_json = 0
    transcript_distance = 0
    transcript_characters = 0
    line_order_invariant_distance = 0
    line_order_invariant_characters = 0
    raw_field_supported = 0
    raw_field_expected = 0
    per_field: dict[str, dict[str, int]] = {
        field: {"correct": 0, "total": 0} for field in FIELDS
    }
    raw_support_per_field: dict[str, dict[str, int]] = {
        field: {"supported": 0, "expected": 0} for field in FIELDS
    }
    per_case: dict[str, dict[str, Any]] = {}
    latencies: list[float] = []

    for result in artifact["results"]:
        if result.get("error") is not None:
            continue
        case = corpus[result["case_id"]]
        case_metrics = per_case.setdefault(
            result["case_id"],
            {
                "successful_predictions": 0,
                "semantic_predictions": 0,
                "field_correct": 0,
                "field_total": 0,
                "hallucinations": 0,
                "expected_empty": 0,
                "missing": 0,
                "expected_nonempty": 0,
                "transcript_distance": 0,
                "transcript_characters": 0,
                "line_order_invariant_distance": 0,
                "line_order_invariant_characters": 0,
                "raw_field_supported": 0,
                "raw_field_expected": 0,
                "latencies_ms": [],
            },
        )
        case_metrics["successful_predictions"] += 1
        case_metrics["latencies_ms"].append(float(result["latency_ms"]))
        latencies.append(float(result["latency_ms"]))
        fields = result.get("fields")
        if isinstance(fields, dict):
            semantic_json += 1
            case_metrics["semantic_predictions"] += 1
            for field in FIELDS:
                truth = _normalize(field, case["fields"][field])
                prediction = _normalize(field, fields.get(field, ""))
                correct = truth == prediction
                field_total += 1
                field_correct += int(correct)
                case_metrics["field_total"] += 1
                case_metrics["field_correct"] += int(correct)
                per_field[field]["total"] += 1
                per_field[field]["correct"] += int(correct)
                if truth:
                    expected_nonempty += 1
                    nonempty_total += 1
                    nonempty_correct += int(correct)
                    missing += int(not prediction)
                    case_metrics["expected_nonempty"] += 1
                    case_metrics["missing"] += int(not prediction)
                else:
                    expected_empty += 1
                    hallucinations += int(bool(prediction))
                    case_metrics["expected_empty"] += 1
                    case_metrics["hallucinations"] += int(bool(prediction))
        transcript = result.get("transcript") or ""
        if transcript:
            truth_text = _normalize("transcript", "\n".join(case["lines"]))
            predicted_text = _normalize("transcript", transcript)
            distance = _distance(truth_text, predicted_text)
            transcript_distance += distance
            transcript_characters += len(truth_text)
            case_metrics["transcript_distance"] += distance
            case_metrics["transcript_characters"] += len(truth_text)
            truth_lines = _normalized_lines("\n".join(case["lines"]))
            predicted_lines = _normalized_lines(transcript)
            line_distance = _distance(truth_lines, predicted_lines)
            line_order_invariant_distance += line_distance
            line_order_invariant_characters += len(truth_lines)
            case_metrics["line_order_invariant_distance"] += line_distance
            case_metrics["line_order_invariant_characters"] += len(truth_lines)
            for field in FIELDS:
                truth = _normalize(field, case["fields"][field])
                if not truth:
                    continue
                raw_field_expected += 1
                case_metrics["raw_field_expected"] += 1
                raw_support_per_field[field]["expected"] += 1
                supported = truth in _normalize(field, transcript)
                raw_field_supported += int(supported)
                case_metrics["raw_field_supported"] += int(supported)
                raw_support_per_field[field]["supported"] += int(supported)

    summarized_cases: dict[str, dict[str, Any]] = {}
    for case_id, values in per_case.items():
        summarized_cases[case_id] = {
            "success_count": values["successful_predictions"],
            "semantic_json_rate": values["semantic_predictions"]
            / max(1, values["successful_predictions"]),
            "field_exact_accuracy": values["field_correct"]
            / max(1, values["field_total"]),
            "hallucination_rate_on_empty": values["hallucinations"]
            / max(1, values["expected_empty"]),
            "missing_rate_on_nonempty": values["missing"]
            / max(1, values["expected_nonempty"]),
            "transcription_cer": values["transcript_distance"]
            / max(1, values["transcript_characters"]),
            "line_order_invariant_cer": values["line_order_invariant_distance"]
            / max(1, values["line_order_invariant_characters"]),
            "raw_field_coverage": values["raw_field_supported"]
            / max(1, values["raw_field_expected"]),
            "latency_p50_ms": statistics.median(values["latencies_ms"]),
            "latency_p95_ms": _percentile(values["latencies_ms"], 0.95),
        }

    metrics: dict[str, Any] = {
        "source": str(args.results),
        "model": artifact.get("model"),
        "success_rate": artifact.get("success_count", 0)
        / max(1, artifact.get("total_count", 0)),
        "semantic_json_rate": semantic_json / max(1, artifact.get("success_count", 0)),
        "field_exact_accuracy": field_correct / max(1, field_total),
        "nonempty_field_exact_accuracy": nonempty_correct / max(1, nonempty_total),
        "hallucination_rate_on_empty": hallucinations / max(1, expected_empty),
        "missing_rate_on_nonempty": missing / max(1, expected_nonempty),
        "transcription_cer": transcript_distance / max(1, transcript_characters),
        "line_order_invariant_cer": line_order_invariant_distance
        / max(1, line_order_invariant_characters),
        "raw_field_coverage": raw_field_supported / max(1, raw_field_expected),
        "latency_p50_ms": statistics.median(latencies) if latencies else None,
        "latency_p95_ms": _percentile(latencies, 0.95),
        "warmup_ms": artifact.get("warmup_ms"),
        "peak_rss_mb": artifact.get("peak_rss_mb"),
        "per_field": per_field,
        "raw_support_per_field": raw_support_per_field,
        "per_case": summarized_cases,
        "counts": {
            "successful_predictions": len(latencies),
            "semantic_predictions": semantic_json,
            "field_total": field_total,
            "expected_nonempty": expected_nonempty,
            "expected_empty": expected_empty,
            "transcript_characters": transcript_characters,
            "raw_field_supported": raw_field_supported,
            "raw_field_expected": raw_field_expected,
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
