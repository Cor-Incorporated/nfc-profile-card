"""Self-hosted business-card OCR sidecar.

Vercel / Cloudflare Workers cannot run 0.9–1B VLMs. Next.js calls this
service, which runs classic PP-OCR and a VLM side by side.
"""

from __future__ import annotations

import os
import secrets
from typing import Literal, cast

from fastapi import FastAPI, Header, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.requests import Request

from engines.mock_engine import run_mock_pipeline
from engines.paddle_vl_adapter import (
    check_paddle_vl_ready,
    run_paddle_vl,
    validate_vlm_configuration,
)
from engines.ppocr_adapter import run_ppocr
from engines.preprocess import preprocess_image
from engines.qr import decode_qr

INVALID_REQUEST_DETAIL = "Invalid OCR request"
INVALID_IMAGE_DETAIL = "Invalid card image"
UNAUTHORIZED_DETAIL = "Unauthorized"
AUTH_CONFIGURATION_DETAIL = "OCR adapter is unavailable"
INFERENCE_FAILURE_DETAIL = "OCR inference is unavailable"
INVALID_RESULT_DETAIL = "OCR inference returned an invalid result"

app = FastAPI(
    title="TapForge OCR Inference",
    version="1.0.0",
    description="Local dual-pipeline OCR for business cards",
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExtractRequest(StrictModel):
    image: str = Field(
        ..., min_length=1, description="Base64 image, with or without data URL"
    )
    mimeType: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"


class OcrBlock(StrictModel):
    text: str
    bbox: tuple[float, float, float, float]
    confidence: float


class ClassicResult(StrictModel):
    engine: Literal["pp-ocrv6-medium", "mock"]
    rawText: str
    blocks: list[OcrBlock]


class SemanticFields(StrictModel):
    name: str
    name_kana: str
    company: str
    department: str
    title: str
    email: str
    phone: str
    mobile: str
    fax: str
    postal_code: str
    address: str
    url: str
    social: str


class SemanticResult(StrictModel):
    engine: Literal["paddleocr-vl-1.6", "mock"]
    fields: SemanticFields


class QrResult(StrictModel):
    text: str
    format: str


class DualPipelineResult(StrictModel):
    classic: ClassicResult
    semantic: SemanticResult
    qr: list[QrResult]


class ExtractResponse(StrictModel):
    success: Literal[True]
    data: DualPipelineResult
    mode: Literal["mock", "live"]


class HealthResponse(StrictModel):
    status: Literal["ok"]
    mode: Literal["mock", "live"]
    classic_backend: Literal["mock", "pp-ocrv6-medium"]
    vlm_backend: Literal["mock", "paddleocr-vl-1.6"]
    hunyuan_enabled: Literal[False]


@app.exception_handler(RequestValidationError)
async def request_validation_error(
    _request: Request, _error: RequestValidationError
) -> JSONResponse:
    # FastAPI's default validation response can echo rejected request values.
    # Card images and extra fields are private input, so always return a fixed body.
    return JSONResponse(status_code=422, content={"detail": INVALID_REQUEST_DETAIL})


def _mode() -> Literal["mock", "live"]:
    configured = os.getenv("OCR_INFERENCE_MODE", "mock").strip().lower()
    if configured not in {"mock", "live"}:
        raise HTTPException(status_code=503, detail=AUTH_CONFIGURATION_DETAIL)
    return cast(Literal["mock", "live"], configured)


def _expected_adapter_api_key() -> str | None:
    value = os.getenv("OCR_ADAPTER_API_KEY", "")
    if not value:
        return None
    if any(character.isspace() for character in value):
        raise HTTPException(status_code=503, detail=AUTH_CONFIGURATION_DETAIL)
    return value


def _authorize(authorization: str | None) -> None:
    mode = _mode()
    expected = _expected_adapter_api_key()
    if not expected:
        if mode == "live":
            raise HTTPException(status_code=503, detail=AUTH_CONFIGURATION_DETAIL)
        return

    scheme, separator, candidate = (authorization or "").partition(" ")
    scheme_matches = secrets.compare_digest(scheme.encode(), b"Bearer")
    token_matches = secrets.compare_digest(candidate.encode(), expected.encode())
    if not separator or not scheme_matches or not token_matches:
        raise HTTPException(status_code=401, detail=UNAUTHORIZED_DETAIL)
    if mode == "live":
        _validate_vlm_configuration()


def _validate_vlm_configuration() -> None:
    try:
        validate_vlm_configuration()
    except ValueError:
        raise HTTPException(status_code=503, detail=AUTH_CONFIGURATION_DETAIL) from None


def _response(data: object, mode: Literal["mock", "live"]) -> ExtractResponse:
    try:
        response = ExtractResponse(success=True, data=data, mode=mode)
    except ValidationError:
        raise HTTPException(status_code=502, detail=INVALID_RESULT_DETAIL) from None
    expected_engines = (
        ("pp-ocrv6-medium", "paddleocr-vl-1.6") if mode == "live" else ("mock", "mock")
    )
    if (
        response.data.classic.engine,
        response.data.semantic.engine,
    ) != expected_engines:
        raise HTTPException(status_code=502, detail=INVALID_RESULT_DETAIL)
    return response


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    mode = _mode()
    if mode == "live" and not _expected_adapter_api_key():
        raise HTTPException(status_code=503, detail=AUTH_CONFIGURATION_DETAIL)
    if mode == "live":
        _validate_vlm_configuration()
        try:
            check_paddle_vl_ready()
        except Exception:
            raise HTTPException(
                status_code=503, detail=INFERENCE_FAILURE_DETAIL
            ) from None
    return HealthResponse(
        status="ok",
        mode=mode,
        classic_backend="pp-ocrv6-medium" if mode == "live" else "mock",
        vlm_backend="paddleocr-vl-1.6" if mode == "live" else "mock",
        hunyuan_enabled=False,
    )


@app.post("/v1/ocr/extract", response_model=ExtractResponse)
def extract(
    payload: ExtractRequest,
    authorization: str | None = Header(default=None),
) -> ExtractResponse:
    _authorize(authorization)

    try:
        image = preprocess_image(payload.image, payload.mimeType)
    except Exception:
        raise HTTPException(status_code=400, detail=INVALID_IMAGE_DETAIL) from None
    try:
        qr = decode_qr(image)
    except Exception:
        raise HTTPException(status_code=503, detail=INFERENCE_FAILURE_DETAIL) from None

    if _mode() != "live":
        data = run_mock_pipeline()
        data["qr"] = qr or data.get("qr") or []
        return _response(data, "mock")

    try:
        classic = run_ppocr(image)
        semantic = run_paddle_vl(image)
    except Exception:
        raise HTTPException(status_code=503, detail=INFERENCE_FAILURE_DETAIL) from None

    return _response(
        {
            "classic": classic,
            "semantic": semantic,
            "qr": qr,
        },
        "live",
    )
