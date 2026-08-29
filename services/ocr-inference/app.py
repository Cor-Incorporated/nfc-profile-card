"""Self-hosted business-card OCR sidecar.

Vercel / Cloudflare Workers cannot run 0.9–1B VLMs. Next.js calls this
service, which runs classic PP-OCR and a VLM side by side.
"""

from __future__ import annotations

import os
from typing import Any, Literal

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from engines.hunyuan_adapter import run_hunyuan
from engines.mock_engine import run_mock_pipeline
from engines.paddle_vl_adapter import run_paddle_vl
from engines.ppocr_adapter import run_ppocr
from engines.preprocess import preprocess_image
from engines.qr import decode_qr

VlmEngine = Literal["paddleocr-vl-1.6", "hunyuanocr-1.5"]

app = FastAPI(
    title="TapForge OCR Inference",
    version="1.0.0",
    description="Local dual-pipeline OCR for business cards",
)


class ExtractRequest(BaseModel):
    image: str = Field(..., description="Base64 image, with or without data URL")
    mimeType: str = "image/jpeg"
    vlmEngine: VlmEngine = "paddleocr-vl-1.6"


class HealthResponse(BaseModel):
    status: str
    mode: str
    classic_backend: str
    vlm_backend: str
    hunyuan_enabled: bool


def _mode() -> str:
    return os.getenv("OCR_INFERENCE_MODE", "mock").strip().lower()


def _expected_api_key() -> str | None:
    value = os.getenv("OCR_INFERENCE_API_KEY", "").strip()
    return value or None


def _authorize(authorization: str | None) -> None:
    expected = _expected_api_key()
    if not expected:
        return
    if not authorization or authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Invalid inference API key")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    mode = _mode()
    return HealthResponse(
        status="ok",
        mode=mode,
        classic_backend="pp-ocrv6-medium" if mode == "live" else "mock",
        vlm_backend="paddleocr-vl-1.6" if mode == "live" else "mock",
        hunyuan_enabled=os.getenv("OCR_ENABLE_HUNYUAN", "false") == "true",
    )


@app.post("/v1/ocr/extract")
def extract(
    payload: ExtractRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(authorization)

    image = preprocess_image(payload.image, payload.mimeType)
    qr = decode_qr(image)

    if _mode() != "live":
        data = run_mock_pipeline()
        data["qr"] = qr or data.get("qr") or []
        return {"success": True, "data": data, "mode": "mock"}

    classic = run_ppocr(image)
    if payload.vlmEngine == "hunyuanocr-1.5":
        if os.getenv("OCR_ENABLE_HUNYUAN", "false") != "true":
            raise HTTPException(
                status_code=403,
                detail=(
                    "HunyuanOCR-1.5 is optional/internal only. "
                    "Set OCR_ENABLE_HUNYUAN=true after reviewing the "
                    "Tencent Hunyuan Community License (no EU/UK/KR, attribution, "
                    "no training on outputs)."
                ),
            )
        semantic = run_hunyuan(image)
    else:
        semantic = run_paddle_vl(image)

    return {
        "success": True,
        "data": {
            "classic": classic,
            "semantic": semantic,
            "qr": qr,
        },
        "mode": "live",
    }
