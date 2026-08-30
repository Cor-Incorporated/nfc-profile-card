from __future__ import annotations

from typing import Any

from PIL import Image


def decode_qr(image: Image.Image) -> list[dict[str, Any]]:
    try:
        from pyzbar.pyzbar import decode
    except ImportError:
        return []

    payloads = []
    for item in decode(image):
        payloads.append(
            {
                "text": item.data.decode("utf-8", errors="replace"),
                "format": item.type,
            }
        )
    return payloads
