from __future__ import annotations

import base64
import http.client
import json
import os
import secrets
from contextlib import suppress
from io import BytesIO
from typing import Any

from PIL import Image

VLM_HOST = "127.0.0.1"
VLM_PORT = 8092
VLM_PATH = "/v1/chat/completions"
VLM_MODELS_PATH = "/v1/models"
VLM_MODEL_ALIAS = "paddleocr-vl-1.6"
MAX_TIMEOUT_SECONDS = 10.0
MAX_RESPONSE_BYTES = 64 * 1024
SEMANTIC_FIELD_KEYS = (
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

SEMANTIC_PROMPT = """OCR:
Extract business-card fields as one JSON object only.
Use exactly these string keys: name, name_kana, company, department, title,
email, phone, mobile, fax, postal_code, address, url, social.
Associate name / company / title from layout. Do not invent email, phone, URL,
or postal_code if they are not visible. Use an empty string if unseen.
"""


class PaddleVlInferenceError(RuntimeError):
    """Secret-safe fixed failure raised at the private VLM boundary."""

    def __init__(self) -> None:
        super().__init__("PaddleOCR-VL inference failed")


def validate_vlm_configuration() -> tuple[str, float]:
    """Return the dedicated leaf credential and a bounded request timeout."""
    adapter_key = os.getenv("OCR_ADAPTER_API_KEY", "")
    api_key = os.getenv("OCR_VLM_API_KEY", "")
    timeout_value = os.getenv("OCR_VLM_TIMEOUT_SECONDS", "")

    if not adapter_key or any(character.isspace() for character in adapter_key):
        raise ValueError("OCR adapter credential is unavailable")
    if (
        not api_key
        or "," in api_key
        or any(character.isspace() for character in api_key)
    ):
        raise ValueError("OCR VLM credential is unavailable")
    if secrets.compare_digest(api_key.encode(), adapter_key.encode()):
        raise ValueError("OCR boundary credentials must be distinct")

    if not timeout_value.isascii() or not timeout_value.isdecimal():
        raise ValueError("OCR VLM timeout is invalid")
    timeout = float(timeout_value)
    if not 0 < timeout <= MAX_TIMEOUT_SECONDS:
        raise ValueError("OCR VLM timeout is invalid")
    return api_key, timeout


def run_paddle_vl(image: Image.Image) -> dict[str, Any]:
    """Call the fixed private PaddleOCR-VL llama-server leaf."""
    api_key, timeout = validate_vlm_configuration()

    try:
        payload = {
            "model": VLM_MODEL_ALIAS,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": _canonical_png_data_url(image)},
                        },
                        {"type": "text", "text": SEMANTIC_PROMPT},
                    ],
                }
            ],
            "temperature": 0,
            "stream": False,
            "cache_prompt": False,
            "response_format": {"type": "json_object"},
        }
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(
            "utf-8"
        )
        response_body = _request("POST", VLM_PATH, api_key, timeout, body)
        fields = _parse_completion(response_body)
        normalized = _normalize_fields(fields)
    except PaddleVlInferenceError:
        raise
    except Exception:
        raise PaddleVlInferenceError() from None

    return {
        "engine": VLM_MODEL_ALIAS,
        "fields": normalized,
    }


def check_paddle_vl_ready() -> None:
    """Verify authenticated leaf reachability and the fixed served alias."""
    api_key, timeout = validate_vlm_configuration()
    try:
        # A successful anonymous call means the leaf ignored its dedicated key.
        _request(
            "GET",
            VLM_MODELS_PATH,
            None,
            timeout,
            expected_status=401,
        )
        response_body = _request("GET", VLM_MODELS_PATH, api_key, timeout)
        parsed = json.loads(response_body.decode("utf-8"))
        if not isinstance(parsed, dict) or parsed.get("object") != "list":
            raise PaddleVlInferenceError()
        models = parsed.get("data")
        if not isinstance(models, list) or not any(
            isinstance(model, dict) and model.get("id") == VLM_MODEL_ALIAS
            for model in models
        ):
            raise PaddleVlInferenceError()
    except PaddleVlInferenceError:
        raise
    except Exception:
        raise PaddleVlInferenceError() from None


def _request(
    method: str,
    path: str,
    api_key: str | None,
    timeout: float,
    body: bytes | None = None,
    *,
    expected_status: int = 200,
) -> bytes:
    connection: http.client.HTTPConnection | None = None
    try:
        # HTTPConnection deliberately bypasses proxy variables and has no redirect
        # or retry behavior. The fixed loopback destination cannot be overridden.
        connection = http.client.HTTPConnection(VLM_HOST, VLM_PORT, timeout=timeout)
        headers = {"Authorization": f"Bearer {api_key}"} if api_key is not None else {}
        if body is not None:
            headers["Content-Type"] = "application/json"
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        if response.status != expected_status:
            raise PaddleVlInferenceError()
        if expected_status != 200:
            return b""
        response_body = response.read(MAX_RESPONSE_BYTES + 1)
        if len(response_body) > MAX_RESPONSE_BYTES:
            raise PaddleVlInferenceError()
        return response_body
    except PaddleVlInferenceError:
        raise
    except Exception:
        raise PaddleVlInferenceError() from None
    finally:
        if connection is not None:
            with suppress(Exception):
                connection.close()


def _canonical_png_data_url(image: Image.Image) -> str:
    normalized = image if image.mode in ("RGB", "L") else image.convert("RGB")
    output = BytesIO()
    normalized.save(output, format="PNG")
    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _parse_completion(response_body: bytes) -> dict[str, Any]:
    parsed = json.loads(response_body.decode("utf-8"))
    if not isinstance(parsed, dict):
        raise PaddleVlInferenceError()
    if parsed.get("object") != "chat.completion":
        raise PaddleVlInferenceError()
    if parsed.get("model") != VLM_MODEL_ALIAS:
        raise PaddleVlInferenceError()

    choices = parsed.get("choices")
    if not isinstance(choices, list) or len(choices) != 1:
        raise PaddleVlInferenceError()
    choice = choices[0]
    if not isinstance(choice, dict) or choice.get("finish_reason") != "stop":
        raise PaddleVlInferenceError()
    message = choice.get("message")
    if not isinstance(message, dict) or message.get("role") != "assistant":
        raise PaddleVlInferenceError()
    content = message.get("content")
    if not isinstance(content, str) or not content:
        raise PaddleVlInferenceError()

    fields = json.loads(content)
    if not isinstance(fields, dict):
        raise PaddleVlInferenceError()
    return fields


def _normalize_fields(fields: dict[str, Any]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for key in SEMANTIC_FIELD_KEYS:
        value = fields.get(key)
        if value is None:
            normalized[key] = ""
        elif isinstance(value, str):
            normalized[key] = value
        else:
            raise PaddleVlInferenceError()
    return normalized
