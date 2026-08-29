from __future__ import annotations

from typing import Any

from PIL import Image

SEMANTIC_PROMPT = """Extract business-card fields as JSON only.
Keys: name, name_kana, company, department, title, email, phone, mobile, fax,
postal_code, address, url, social.
Associate name / company / title from layout. Do not invent email, phone, URL,
or postal_code if they are not visible. Empty string if unseen.
"""


def run_paddle_vl(image: Image.Image) -> dict[str, Any]:
    """PaddleOCR-VL-1.6 adapter (default production VLM, Apache 2.0)."""
    try:
        from paddlex import create_model  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "PaddleOCR-VL-1.6 is not installed. Install paddlex and download "
            "PaddleOCR-VL-1.6, or run OCR_INFERENCE_MODE=mock. "
            "See services/ocr-inference/README.md."
        ) from exc

    model = create_model("PaddleOCR-VL-1.6")
    raw = model.predict(image, prompt=SEMANTIC_PROMPT)
    fields = raw if isinstance(raw, dict) else {}
    if hasattr(raw, "json"):
        fields = raw.json()
    return {
        "engine": "paddleocr-vl-1.6",
        "fields": _normalize_fields(fields),
    }


def _normalize_fields(fields: dict[str, Any]) -> dict[str, str]:
    keys = [
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
    ]
    return {key: str(fields.get(key) or "") for key in keys}
