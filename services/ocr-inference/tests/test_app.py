from __future__ import annotations

import asyncio
import json
import os
import unittest
from contextlib import AbstractContextManager
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

from app import (
    AUTH_CONFIGURATION_DETAIL,
    INFERENCE_FAILURE_DETAIL,
    INVALID_REQUEST_DETAIL,
    INVALID_RESULT_DETAIL,
    UNAUTHORIZED_DETAIL,
    ExtractRequest,
    _authorize,
    extract,
    health,
    request_validation_error,
)

FIELDS = {
    "name": "山田 太郎",
    "name_kana": "ヤマダ タロウ",
    "company": "株式会社タップフォージ",
    "department": "プロダクト部",
    "title": "エンジニア",
    "email": "taro@example.com",
    "phone": "03-1234-5678",
    "mobile": "090-1234-5678",
    "fax": "",
    "postal_code": "150-0001",
    "address": "東京都渋谷区",
    "url": "https://example.com",
    "social": "",
}
CLASSIC = {"engine": "pp-ocrv6-medium", "rawText": "Cor", "blocks": []}
SEMANTIC = {"engine": "paddleocr-vl-1.6", "fields": FIELDS}
REQUEST = ExtractRequest(image="ZmFrZQ==", mimeType="image/png")


class AdapterSecurityTests(unittest.TestCase):
    def live_environment(self) -> AbstractContextManager[dict[str, str]]:
        return patch.dict(
            os.environ,
            {
                "OCR_INFERENCE_MODE": "live",
                "OCR_ADAPTER_API_KEY": "adapter-test-token",
                "OCR_VLM_API_KEY": "vlm-test-token",
                "OCR_VLM_TIMEOUT_SECONDS": "5",
            },
            clear=True,
        )

    def call_live(self, classic: object = CLASSIC, semantic: object = SEMANTIC):
        with self.live_environment(), patch(
            "app.preprocess_image", return_value=object()
        ), patch("app.decode_qr", return_value=[]), patch(
            "app.run_ppocr", return_value=classic
        ) as classic_call, patch(
            "app.run_paddle_vl", return_value=semantic
        ) as paddle_call:
            response = extract(REQUEST, "Bearer adapter-test-token")
        return response, classic_call, paddle_call

    def test_live_mode_fails_closed_without_adapter_token(self) -> None:
        with patch.dict(os.environ, {"OCR_INFERENCE_MODE": "live"}, clear=True):
            for operation in (_authorize, lambda _header: health()):
                with self.subTest(operation=operation.__name__):
                    with self.assertRaises(HTTPException) as caught:
                        operation(None)
                    self.assertEqual(caught.exception.status_code, 503)
                    self.assertEqual(caught.exception.detail, AUTH_CONFIGURATION_DETAIL)

    def test_live_health_initializes_classic_backend_before_claiming_ok(self) -> None:
        with self.live_environment(), patch(
            "app.ensure_ppocr_ready"
        ) as ensure_ready, patch("app.check_paddle_vl_ready") as vlm_ready:
            response = health()

        ensure_ready.assert_called_once_with()
        vlm_ready.assert_called_once_with()
        self.assertEqual(response.classic_backend, "pp-ocrv6-medium")

    def test_live_health_masks_classic_backend_failure(self) -> None:
        with self.live_environment(), patch(
            "app.ensure_ppocr_ready", side_effect=RuntimeError("secret model path")
        ), self.assertRaises(HTTPException) as caught:
            health()

        self.assertEqual(caught.exception.status_code, 503)
        self.assertEqual(caught.exception.detail, INFERENCE_FAILURE_DETAIL)

    def test_missing_and_wrong_bearer_tokens_use_fixed_error(self) -> None:
        for header in (None, "Bearer attacker-controlled-secret", "Bearer 誤り"):
            with self.subTest(header=header), self.live_environment():
                with self.assertRaises(HTTPException) as caught:
                    _authorize(header)
                self.assertEqual(caught.exception.status_code, 401)
                self.assertEqual(caught.exception.detail, UNAUTHORIZED_DETAIL)
                self.assertNotIn(str(header), str(caught.exception.detail))

    def test_whitespace_bearing_token_is_invalid_configuration(self) -> None:
        with patch.dict(
            os.environ,
            {
                "OCR_INFERENCE_MODE": "live",
                "OCR_ADAPTER_API_KEY": " adapter-test-token\n",
            },
            clear=True,
        ), self.assertRaises(HTTPException) as caught:
            _authorize("Bearer adapter-test-token")
        self.assertEqual(caught.exception.status_code, 503)
        self.assertEqual(caught.exception.detail, AUTH_CONFIGURATION_DETAIL)

    def test_vlm_configuration_fails_closed_with_fixed_error(self) -> None:
        invalid_environments = [
            {"OCR_VLM_API_KEY": ""},
            {"OCR_VLM_API_KEY": "adapter-test-token"},
            {"OCR_VLM_TIMEOUT_SECONDS": ""},
            {"OCR_VLM_TIMEOUT_SECONDS": "11"},
        ]
        for invalid in invalid_environments:
            with self.subTest(invalid=invalid), self.live_environment(), patch.dict(
                os.environ, invalid
            ), self.assertRaises(HTTPException) as caught:
                health()
            self.assertEqual(caught.exception.status_code, 503)
            self.assertEqual(caught.exception.detail, AUTH_CONFIGURATION_DETAIL)

    def test_health_requires_ready_authenticated_vlm_leaf(self) -> None:
        with self.live_environment(), patch("app.ensure_ppocr_ready"), patch(
            "app.check_paddle_vl_ready"
        ) as readiness:
            self.assertEqual(health().status, "ok")
            readiness.assert_called_once_with()

        with self.live_environment(), patch("app.ensure_ppocr_ready"), patch(
            "app.check_paddle_vl_ready", side_effect=RuntimeError("private leaf error")
        ), self.assertRaises(HTTPException) as caught:
            health()
        self.assertEqual(caught.exception.status_code, 503)
        self.assertEqual(caught.exception.detail, INFERENCE_FAILURE_DETAIL)

    def test_unknown_mode_fails_closed(self) -> None:
        with patch.dict(
            os.environ,
            {"OCR_INFERENCE_MODE": "lvie", "OCR_ADAPTER_API_KEY": "token"},
            clear=True,
        ), self.assertRaises(HTTPException) as caught:
            _authorize("Bearer token")
        self.assertEqual(caught.exception.status_code, 503)
        self.assertEqual(caught.exception.detail, AUTH_CONFIGURATION_DETAIL)

    def test_correct_token_returns_only_fixed_raw_contract(self) -> None:
        response, classic_call, paddle_call = self.call_live()
        classic_call.assert_called_once()
        paddle_call.assert_called_once()
        body = response.model_dump()
        self.assertEqual(set(body), {"success", "data", "mode"})
        self.assertEqual(set(body["data"]), {"classic", "semantic", "qr"})
        self.assertEqual(set(body["data"]["classic"]), set(CLASSIC))
        self.assertEqual(set(body["data"]["semantic"]), set(SEMANTIC))
        self.assertEqual(set(body["data"]["semantic"]["fields"]), set(FIELDS))
        self.assertNotIn("human_review", body["data"])

    def test_hunyuan_engine_override_is_rejected_as_extra_input(self) -> None:
        with patch.dict(os.environ, {"OCR_ENABLE_HUNYUAN": "true"}, clear=True):
            with self.assertRaises(ValidationError) as caught:
                ExtractRequest.model_validate(
                    {
                        "image": "ZmFrZQ==",
                        "mimeType": "image/png",
                        "vlmEngine": "hunyuanocr-1.5",
                    }
                )
        self.assertEqual(caught.exception.errors()[0]["type"], "extra_forbidden")

    def test_request_validation_handler_does_not_echo_values(self) -> None:
        response = asyncio.run(request_validation_error(None, None))  # type: ignore[arg-type]
        self.assertEqual(response.status_code, 422)
        self.assertEqual(json.loads(response.body), {"detail": INVALID_REQUEST_DETAIL})

    def test_engine_failure_uses_fixed_secret_safe_error(self) -> None:
        with self.live_environment(), patch(
            "app.preprocess_image", return_value=object()
        ), patch("app.decode_qr", return_value=[]), patch(
            "app.run_ppocr", side_effect=RuntimeError("secret model path")
        ), self.assertRaises(
            HTTPException
        ) as caught:
            extract(REQUEST, "Bearer adapter-test-token")
        self.assertEqual(caught.exception.status_code, 503)
        self.assertEqual(caught.exception.detail, INFERENCE_FAILURE_DETAIL)

    def test_qr_failure_uses_fixed_secret_safe_error(self) -> None:
        with self.live_environment(), patch(
            "app.preprocess_image", return_value=object()
        ), patch(
            "app.decode_qr", side_effect=RuntimeError("secret qr payload")
        ), self.assertRaises(
            HTTPException
        ) as caught:
            extract(REQUEST, "Bearer adapter-test-token")
        self.assertEqual(caught.exception.status_code, 503)
        self.assertEqual(caught.exception.detail, INFERENCE_FAILURE_DETAIL)

    def test_unexpected_engine_fields_are_not_forwarded(self) -> None:
        classic = {**CLASSIC, "internal_path": "/secret/model/path"}
        with self.assertRaises(HTTPException) as caught:
            self.call_live(classic=classic)
        self.assertEqual(caught.exception.status_code, 502)
        self.assertEqual(caught.exception.detail, INVALID_RESULT_DETAIL)

    def test_mock_engine_labels_are_rejected_in_live_mode(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            self.call_live(classic={**CLASSIC, "engine": "mock"})
        self.assertEqual(caught.exception.status_code, 502)
        self.assertEqual(caught.exception.detail, INVALID_RESULT_DETAIL)
