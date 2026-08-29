from __future__ import annotations

from typing import Any

from PIL import Image


def run_ppocr(image: Image.Image) -> dict[str, Any]:
    """PP-OCRv6_medium adapter.

    Plug-in: install PaddleOCR / PaddleX and load PP-OCRv6_medium.
    Until weights are present this raises so callers do not silently
    pretend a cloud LLM ran.
    """
    try:
        from paddleocr import PaddleOCR  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "PP-OCRv6_medium is not installed. Install paddleocr/paddlex "
            "or run with OCR_INFERENCE_MODE=mock. See services/ocr-inference/README.md."
        ) from exc

    # PaddleOCR APIs differ by version; keep the call site narrow.
    ocr = PaddleOCR(
        lang="japan",
        use_angle_cls=True,
        show_log=False,
        ocr_version=getattr(PaddleOCR, "ocr_version", "PP-OCRv4"),
    )
    result = ocr.ocr(image, cls=True) or []
    blocks = []
    lines = []
    for page in result:
        if not page:
            continue
        for item in page:
            box, (text, confidence) = item
            xs = [point[0] for point in box]
            ys = [point[1] for point in box]
            blocks.append(
                {
                    "text": text,
                    "bbox": [min(xs), min(ys), max(xs), max(ys)],
                    "confidence": float(confidence),
                }
            )
            lines.append(text)

    return {
        "engine": "pp-ocrv6-medium",
        "rawText": "\n".join(lines),
        "blocks": blocks,
    }
