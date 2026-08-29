from __future__ import annotations

import base64
import io

from PIL import Image, ImageEnhance, ImageOps


def preprocess_image(image_b64: str, mime_type: str) -> Image.Image:
    raw = image_b64.split(",", 1)[1] if image_b64.startswith("data:") else image_b64
    image = Image.open(io.BytesIO(base64.b64decode(raw)))
    image = ImageOps.exif_transpose(image)
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    longest = max(image.size)
    if longest > 1800:
        scale = 1800 / longest
        image = image.resize(
            (max(1, int(image.width * scale)), max(1, int(image.height * scale))),
            Image.Resampling.LANCZOS,
        )

    image = ImageOps.autocontrast(image)
    image = ImageEnhance.Contrast(image).enhance(1.15)
    image = ImageEnhance.Sharpness(image).enhance(1.1)
    return image
