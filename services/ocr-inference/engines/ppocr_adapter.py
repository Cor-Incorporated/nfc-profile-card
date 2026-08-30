from __future__ import annotations

import os
import re
from collections.abc import Mapping
from math import isfinite
from pathlib import Path
from threading import Lock
from typing import Any, Protocol, cast

import numpy as np
from PIL import Image

ENGINE_NAME = "pp-ocrv6-medium"
DETECTION_MODEL_NAME = "PP-OCRv6_medium_det"
RECOGNITION_MODEL_NAME = "PP-OCRv6_medium_rec"
DETECTION_MODEL_DIR_ENV = "PPOCR_DET_MODEL_DIR"
RECOGNITION_MODEL_DIR_ENV = "PPOCR_REC_MODEL_DIR"
_MODEL_NAME_PATTERN = re.compile(
    r"^[ \t]*model_name:[ \t]*([A-Za-z0-9_.-]+)[ \t]*$", re.MULTILINE
)


class _PaddleOCRPipeline(Protocol):
    def predict(self, input: np.ndarray) -> list[Mapping[str, Any]]: ...


_pipeline: _PaddleOCRPipeline | None = None
_pipeline_init_lock = Lock()
_predict_lock = Lock()


def _required_model_directory(variable: str, expected_model: str) -> str:
    configured = os.getenv(variable, "")
    directory = Path(configured)
    if not configured or not directory.is_absolute() or not directory.is_dir():
        raise RuntimeError(f"{variable} must be an existing absolute directory")
    try:
        manifest = (directory / "inference.yml").read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"{variable} is missing inference.yml") from exc
    model_names = _MODEL_NAME_PATTERN.findall(manifest)
    if not model_names or model_names[0] != expected_model:
        raise RuntimeError(f"{variable} does not contain {expected_model}")
    return str(directory)


def _build_pipeline() -> _PaddleOCRPipeline:
    try:
        from paddleocr import PaddleOCR  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError(
            "PP-OCRv6_medium runtime dependencies are not installed"
        ) from exc

    # Supplying both exact model names and local directories prevents PaddleOCR
    # from selecting an older language model or downloading weights at runtime.
    pipeline = PaddleOCR(
        text_detection_model_name=DETECTION_MODEL_NAME,
        text_detection_model_dir=_required_model_directory(
            DETECTION_MODEL_DIR_ENV, DETECTION_MODEL_NAME
        ),
        text_recognition_model_name=RECOGNITION_MODEL_NAME,
        text_recognition_model_dir=_required_model_directory(
            RECOGNITION_MODEL_DIR_ENV, RECOGNITION_MODEL_NAME
        ),
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        device="cpu",
        engine="paddle_static",
    )
    if not callable(getattr(pipeline, "predict", None)):
        raise RuntimeError("PaddleOCR 3.7 predict API is unavailable")
    return cast(_PaddleOCRPipeline, pipeline)


def _get_pipeline() -> _PaddleOCRPipeline:
    global _pipeline

    if _pipeline is None:
        with _pipeline_init_lock:
            if _pipeline is None:
                _pipeline = _build_pipeline()
    return _pipeline


def ensure_ppocr_ready() -> None:
    """Load and cache the exact PP-OCRv6 model pair or raise."""

    _get_pipeline()


def _result_values(page: Mapping[str, Any], field: str) -> list[Any]:
    value = page.get(field)
    if isinstance(value, np.ndarray):
        return list(value)
    if not isinstance(value, (list, tuple)):
        raise RuntimeError(f"PaddleOCR result is missing {field}")
    return list(value)


def _convert_page(page: Mapping[str, Any]) -> tuple[list[str], list[dict[str, Any]]]:
    texts = _result_values(page, "rec_texts")
    scores = _result_values(page, "rec_scores")
    boxes = _result_values(page, "rec_boxes")
    if len(texts) != len(scores) or len(texts) != len(boxes):
        raise RuntimeError("PaddleOCR result fields have different lengths")

    lines: list[str] = []
    blocks: list[dict[str, Any]] = []
    for text, score, box in zip(texts, scores, boxes):
        if not isinstance(text, str):
            raise RuntimeError("PaddleOCR returned non-text recognition output")
        try:
            confidence = float(score)
            coordinates = np.asarray(box, dtype=np.float64)
        except (TypeError, ValueError, OverflowError) as exc:
            raise RuntimeError("PaddleOCR returned invalid numeric output") from exc
        if not isfinite(confidence) or not 0.0 <= confidence <= 1.0:
            raise RuntimeError("PaddleOCR returned an invalid confidence")
        if coordinates.shape != (4,) or not np.isfinite(coordinates).all():
            raise RuntimeError("PaddleOCR returned an invalid bounding box")

        left, top, right, bottom = (float(value) for value in coordinates)
        if left > right or top > bottom:
            raise RuntimeError("PaddleOCR returned an inverted bounding box")
        lines.append(text)
        blocks.append(
            {
                "text": text,
                "bbox": [left, top, right, bottom],
                "confidence": confidence,
            }
        )
    return lines, blocks


def run_ppocr(image: Image.Image) -> dict[str, Any]:
    """Run the PaddleOCR 3.7 PP-OCRv6_medium det/rec pipeline."""

    rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
    bgr = rgb[:, :, ::-1].copy()
    pipeline = _get_pipeline()
    with _predict_lock:
        result = pipeline.predict(bgr)

    # One ndarray input must produce exactly one PaddleX OCRResult. This rejects
    # the nested list emitted by the deprecated PaddleOCR 2.x `ocr()` API.
    if not isinstance(result, list) or len(result) != 1:
        raise RuntimeError("PaddleOCR returned an unexpected result count")
    page = result[0]
    if not isinstance(page, Mapping):
        raise RuntimeError("PaddleOCR returned a legacy result shape")
    lines, blocks = _convert_page(page)

    return {
        "engine": ENGINE_NAME,
        "rawText": "\n".join(lines),
        "blocks": blocks,
    }
