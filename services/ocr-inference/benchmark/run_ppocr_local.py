#!/usr/bin/env python3
"""Run the production PP-OCR adapter directly on the benchmark corpus."""

from __future__ import annotations

import argparse
import hashlib
import json
import resource
import sys
import time
from pathlib import Path
from typing import Any

from PIL import Image


def _peak_rss_mb() -> float:
    # Linux reports KiB and macOS bytes. The production benchmark runs on Linux.
    value = float(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    return (
        value / 1024.0 if sys.platform.startswith("linux") else value / 1024.0 / 1024.0
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--corpus", type=Path, default=Path(__file__).with_name("corpus.json")
    )
    parser.add_argument("--image-dir", type=Path, required=True)
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.repeats < 1 or args.repeats > 10:
        raise SystemExit("--repeats must be between 1 and 10")

    service_root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(service_root))
    from engines.ppocr_adapter import run_ppocr

    corpus = json.loads(args.corpus.read_text(encoding="utf-8"))
    first_image = Image.open(args.image_dir / f"{corpus[0]['id']}.png").convert("RGB")
    warmup_started = time.perf_counter()
    run_ppocr(first_image)
    warmup_ms = (time.perf_counter() - warmup_started) * 1000

    results: list[dict[str, Any]] = []
    for case in corpus:
        image = Image.open(args.image_dir / f"{case['id']}.png").convert("RGB")
        for repeat in range(args.repeats):
            started = time.perf_counter()
            try:
                prediction = run_ppocr(image)
                result = {
                    "case_id": case["id"],
                    "repeat": repeat,
                    "latency_ms": round((time.perf_counter() - started) * 1000, 3),
                    "error": None,
                    "content": prediction["rawText"],
                    "fields": None,
                    "transcript": prediction["rawText"],
                    "finish_reason": "ppocr",
                    "blocks": prediction["blocks"],
                    "peak_rss_mb": round(_peak_rss_mb(), 3),
                }
            except (
                Exception  # noqa: BLE001 -- preserve runtime backend failures
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
                    "blocks": [],
                    "peak_rss_mb": round(_peak_rss_mb(), 3),
                }
            results.append(result)
            print(
                f"case={case['id']} repeat={repeat} latency_ms={result['latency_ms']} "
                f"error={result['error']} peak_rss_mb={result['peak_rss_mb']}",
                flush=True,
            )

    artifact = {
        "protocol": "ppocr-local",
        "model": "pp-ocrv6-medium",
        "corpus_sha256": hashlib.sha256(args.corpus.read_bytes()).hexdigest(),
        "endpoint_origin": "local-process",
        "repeats": args.repeats,
        "warmup_ms": round(warmup_ms, 3),
        "success_count": sum(result["error"] is None for result in results),
        "total_count": len(results),
        "peak_rss_mb": max(result["peak_rss_mb"] for result in results),
        "results": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"wrote={args.output}")


if __name__ == "__main__":
    main()
