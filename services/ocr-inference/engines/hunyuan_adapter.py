from __future__ import annotations

from typing import Any

from PIL import Image

from engines.paddle_vl_adapter import SEMANTIC_PROMPT, _normalize_fields


def run_hunyuan(image: Image.Image) -> dict[str, Any]:
    """Optional HunyuanOCR-1.5 A/B path.

    License: Tencent Hunyuan Community License — no EU/UK/KR, attribution
    required, do not train on outputs. Keep this behind OCR_ENABLE_HUNYUAN.
    """
    try:
        from transformers import AutoModel, AutoProcessor  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "HunyuanOCR-1.5 extras are not installed. This engine is optional "
            "and license-restricted. Prefer PaddleOCR-VL-1.6 in production."
        ) from exc

    processor = AutoProcessor.from_pretrained("tencent/HunyuanOCR-1.5")
    model = AutoModel.from_pretrained("tencent/HunyuanOCR-1.5")
    inputs = processor(images=image, text=SEMANTIC_PROMPT, return_tensors="pt")
    generated = model.generate(**inputs)
    text = processor.batch_decode(generated, skip_special_tokens=True)[0]
    fields: dict[str, Any] = {}
    try:
        import json

        fields = json.loads(text)
    except json.JSONDecodeError:
        fields = {}

    return {
        "engine": "hunyuanocr-1.5",
        "fields": _normalize_fields(fields),
    }
