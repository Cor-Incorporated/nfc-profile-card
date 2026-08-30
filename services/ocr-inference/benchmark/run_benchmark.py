#!/usr/bin/env python3
"""Run the same synthetic corpus through an OpenAI-compatible VLM or adapter."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import statistics
import time
import urllib.error
import urllib.parse
import urllib.request
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

SEMANTIC_PROMPT = """Extract one business card into one JSON object only.
Use exactly these string keys: name, name_kana, company, department, title,
email, phone, mobile, fax, postal_code, address, url, social.
Copy only visible text. Never infer kana, URLs, contact values, or social links.
Split department and title only when both are visible. Empty string if unseen."""


def _json_object(content: str) -> dict[str, str] | None:
    cleaned = content.strip().removeprefix("```json").removesuffix("```").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        value = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return None
    if not isinstance(value, dict):
        return None
    if set(value) != set(FIELDS):
        return None
    fields: dict[str, str] = {}
    for key in FIELDS:
        raw = value.get(key, "")
        if not isinstance(raw, str):
            return None
        fields[key] = raw
    return fields


def _request(
    url: str, payload: dict[str, Any], token: str | None, timeout: float
) -> dict[str, Any]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(),
        headers=headers,
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = json.load(response)
    if not isinstance(body, dict):
        raise TypeError("endpoint returned a non-object body")
    return body


def _vlm_payload(
    model: str,
    image: bytes,
    transcript: str | None,
    max_tokens: int | None,
) -> dict[str, Any]:
    if transcript is None:
        content: Any = [
            {
                "type": "image_url",
                "image_url": {
                    "url": "data:image/png;base64,"
                    + base64.b64encode(image).decode("ascii")
                },
            },
            {"type": "text", "text": SEMANTIC_PROMPT},
        ]
    else:
        content = f"{SEMANTIC_PROMPT}\n\nOCR TEXT:\n{transcript}"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "temperature": 0,
        "stream": False,
        "cache_prompt": False,
        "response_format": {"type": "json_object"},
    }
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    return payload


def _block_transcript(result: dict[str, Any]) -> str:
    lines: list[str] = []
    for block in result.get("blocks", []):
        text = str(block.get("text", "")).strip()
        bbox = block.get("bbox")
        if not text or not isinstance(bbox, list) or len(bbox) != 4:
            continue
        coordinates = ",".join(str(round(float(value), 1)) for value in bbox)
        lines.append(f"[{coordinates}] {text}")
    return "\n".join(lines)


def _load_transcripts(path: Path | None, transcript_format: str) -> dict[str, str]:
    if path is None:
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    transcripts: dict[str, str] = {}
    for result in data["results"]:
        if result.get("error") is None:
            raw = (
                _block_transcript(result)
                if transcript_format == "blocks"
                else result.get("transcript") or result.get("content", "")
            )
            compact = "\n".join(
                line.strip() for line in raw.splitlines() if line.strip()
            )
            transcripts[result["case_id"]] = compact[:16_384]
    return transcripts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--protocol", choices=("openai", "adapter"), required=True)
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--model", default="")
    parser.add_argument(
        "--corpus", type=Path, default=Path(__file__).with_name("corpus.json")
    )
    parser.add_argument("--image-dir", type=Path, required=True)
    parser.add_argument("--transcripts", type=Path)
    parser.add_argument(
        "--transcript-format", choices=("text", "blocks"), default="text"
    )
    parser.add_argument("--token-env", default="")
    parser.add_argument("--repeats", type=int, default=1)
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--max-tokens", type=int)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.repeats < 1 or args.repeats > 10:
        raise SystemExit("--repeats must be between 1 and 10")

    corpus = json.loads(args.corpus.read_text(encoding="utf-8"))
    if args.max_tokens is not None and not 64 <= args.max_tokens <= 4096:
        raise SystemExit("--max-tokens must be between 64 and 4096")
    transcripts = _load_transcripts(args.transcripts, args.transcript_format)
    token = os.environ.get(args.token_env) if args.token_env else None
    if args.token_env and not token:
        raise SystemExit(f"missing token environment: {args.token_env}")

    results: list[dict[str, Any]] = []
    for case in corpus:
        image_path = args.image_dir / f"{case['id']}.png"
        image = image_path.read_bytes()
        for repeat in range(args.repeats):
            started = time.perf_counter()
            try:
                if args.protocol == "openai":
                    payload = _vlm_payload(
                        args.model,
                        image,
                        transcripts.get(case["id"]) if args.transcripts else None,
                        args.max_tokens,
                    )
                    body = _request(
                        args.endpoint.rstrip("/") + "/v1/chat/completions",
                        payload,
                        token,
                        args.timeout,
                    )
                    content = body["choices"][0]["message"]["content"]
                    if not isinstance(content, str):
                        raise RuntimeError("completion content is not text")
                    fields = _json_object(content)
                    transcript = content if fields is None else ""
                    finish_reason = body["choices"][0].get("finish_reason")
                else:
                    payload = {
                        "image": base64.b64encode(image).decode("ascii"),
                        "mimeType": "image/png",
                    }
                    body = _request(
                        args.endpoint.rstrip("/") + "/v1/ocr/extract",
                        payload,
                        token,
                        args.timeout,
                    )
                    data = body.get("data", body)
                    content = json.dumps(
                        data, ensure_ascii=False, separators=(",", ":")
                    )
                    fields = data["semantic"]["fields"]
                    transcript = data["classic"]["rawText"]
                    finish_reason = "adapter"
                result = {
                    "case_id": case["id"],
                    "repeat": repeat,
                    "latency_ms": round((time.perf_counter() - started) * 1000, 3),
                    "error": None,
                    "content": content,
                    "fields": fields,
                    "transcript": transcript,
                    "finish_reason": finish_reason,
                }
            except (
                KeyError,
                TypeError,
                RuntimeError,
                urllib.error.URLError,
                TimeoutError,
            ) as error:
                result = {
                    "case_id": case["id"],
                    "repeat": repeat,
                    "latency_ms": round((time.perf_counter() - started) * 1000, 3),
                    "error": type(error).__name__,
                    "content": "",
                    "fields": None,
                    "transcript": "",
                    "finish_reason": None,
                }
            results.append(result)
            print(
                f"case={case['id']} repeat={repeat} latency_ms={result['latency_ms']} error={result['error']}"
            )

    successful_latencies = [
        result["latency_ms"] for result in results if result["error"] is None
    ]
    artifact = {
        "protocol": args.protocol,
        "model": args.model,
        "corpus_sha256": hashlib.sha256(args.corpus.read_bytes()).hexdigest(),
        "transcript_source": str(args.transcripts) if args.transcripts else None,
        "transcript_format": args.transcript_format if args.transcripts else None,
        "max_tokens": args.max_tokens,
        "endpoint_origin": urllib.parse.urlsplit(args.endpoint)
        ._replace(path="", query="", fragment="")
        .geturl(),
        "repeats": args.repeats,
        "success_count": len(successful_latencies),
        "total_count": len(results),
        "latency_median_ms": (
            round(statistics.median(successful_latencies), 3)
            if successful_latencies
            else None
        ),
        "results": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"wrote={args.output}")


if __name__ == "__main__":
    main()
