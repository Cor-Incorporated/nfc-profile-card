from __future__ import annotations

import base64
import json
import os
import unittest
from io import BytesIO
from unittest.mock import call, patch

from PIL import Image

from engines import paddle_vl_adapter as adapter

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


class FakeResponse:
    def __init__(self, status: int, body: bytes) -> None:
        self.status = status
        self.body = body
        self.read_size: int | None = None

    def read(self, size: int = -1) -> bytes:
        self.read_size = size
        return self.body if size < 0 else self.body[:size]


class FakeConnection:
    response = FakeResponse(200, b"{}")
    request_error: Exception | None = None
    instances: list["FakeConnection"] = []

    def __init__(self, host: str, port: int, timeout: float) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout
        self.requests: list[tuple[str, str, bytes | None, dict[str, str]]] = []
        self.closed = False
        type(self).instances.append(self)

    def request(
        self,
        method: str,
        path: str,
        body: bytes | None,
        headers: dict[str, str],
    ) -> None:
        self.requests.append((method, path, body, headers))
        if type(self).request_error:
            raise type(self).request_error

    def getresponse(self) -> FakeResponse:
        return type(self).response

    def close(self) -> None:
        self.closed = True


def completion(content: object, *, status: int = 200) -> FakeResponse:
    body = json.dumps(
        {
            "object": "chat.completion",
            "model": "paddleocr-vl-1.6",
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {"role": "assistant", "content": content},
                }
            ],
        }
    ).encode()
    return FakeResponse(status, body)


class PaddleVlTransportTests(unittest.TestCase):
    def setUp(self) -> None:
        FakeConnection.instances = []
        FakeConnection.request_error = None
        FakeConnection.response = completion(json.dumps(FIELDS))

    def environment(self, **overrides: str):
        values = {
            "OCR_ADAPTER_API_KEY": "adapter-boundary-token",
            "OCR_VLM_API_KEY": "vlm-leaf-token",
            "OCR_VLM_TIMEOUT_SECONDS": "5",
        }
        values.update(overrides)
        return patch.dict(os.environ, values, clear=True)

    def run_adapter(self, image: Image.Image | None = None) -> dict[str, object]:
        with self.environment(), patch(
            "engines.paddle_vl_adapter.http.client.HTTPConnection", FakeConnection
        ):
            return adapter.run_paddle_vl(image or Image.new("RGB", (2, 3), "white"))

    def assert_safe_failure(self) -> RuntimeError:
        with self.assertRaises(RuntimeError) as caught:
            self.run_adapter()
        self.assertEqual(str(caught.exception), "PaddleOCR-VL inference failed")
        self.assertNotIn("vlm-leaf-token", str(caught.exception))
        self.assertNotIn("private-card-text", str(caught.exception))
        return caught.exception

    def test_request_is_fixed_authenticated_and_uses_canonical_png(self) -> None:
        with self.environment(
            HTTP_PROXY="http://attacker.invalid:9000",
            HTTPS_PROXY="http://attacker.invalid:9000",
            OCR_VLM_URL="http://attacker.invalid/v1",
            OCR_VLM_ENGINE="hunyuanocr-1.5",
        ), patch(
            "engines.paddle_vl_adapter.http.client.HTTPConnection", FakeConnection
        ):
            result = adapter.run_paddle_vl(Image.new("RGBA", (2, 3), (1, 2, 3, 4)))

        self.assertEqual(result, {"engine": "paddleocr-vl-1.6", "fields": FIELDS})
        self.assertEqual(len(FakeConnection.instances), 1)
        connection = FakeConnection.instances[0]
        self.assertEqual((connection.host, connection.port), ("127.0.0.1", 8092))
        self.assertEqual(connection.timeout, 5.0)
        self.assertTrue(connection.closed)
        self.assertEqual(len(connection.requests), 1)

        method, path, raw_body, headers = connection.requests[0]
        self.assertEqual((method, path), ("POST", "/v1/chat/completions"))
        self.assertEqual(
            headers,
            {
                "Authorization": "Bearer vlm-leaf-token",
                "Content-Type": "application/json",
            },
        )
        payload = json.loads(raw_body)
        self.assertEqual(
            set(payload),
            {
                "model",
                "messages",
                "temperature",
                "stream",
                "cache_prompt",
                "response_format",
            },
        )
        self.assertEqual(payload["model"], "paddleocr-vl-1.6")
        self.assertEqual(payload["temperature"], 0)
        self.assertIs(payload["stream"], False)
        self.assertIs(payload["cache_prompt"], False)
        self.assertEqual(payload["response_format"], {"type": "json_object"})
        self.assertNotIn("max_tokens", payload)

        content = payload["messages"][0]["content"]
        self.assertEqual([item["type"] for item in content], ["image_url", "text"])
        data_url = content[0]["image_url"]["url"]
        self.assertTrue(data_url.startswith("data:image/png;base64,"))
        png = base64.b64decode(data_url.split(",", 1)[1], validate=True)
        self.assertEqual(png[:8], b"\x89PNG\r\n\x1a\n")
        reopened = Image.open(BytesIO(png))
        self.assertEqual((reopened.format, reopened.size), ("PNG", (2, 3)))
        self.assertEqual(content[1]["text"], adapter.SEMANTIC_PROMPT)
        self.assertTrue(content[1]["text"].startswith("OCR:\n"))

    def test_missing_and_null_fields_normalize_to_exact_string_contract(self) -> None:
        FakeConnection.response = completion(
            json.dumps({"name": "山田 太郎", "phone": None, "extra": "drop me"})
        )
        result = self.run_adapter()
        fields = result["fields"]
        self.assertEqual(set(fields), set(FIELDS))
        self.assertEqual(fields["name"], "山田 太郎")
        self.assertTrue(all(isinstance(value, str) for value in fields.values()))
        self.assertTrue(
            all(not value for key, value in fields.items() if key != "name")
        )

    def test_non_string_known_field_is_rejected(self) -> None:
        for invalid in (123, ["090"], {"value": "090"}, True):
            with self.subTest(invalid=invalid):
                FakeConnection.response = completion(json.dumps({"phone": invalid}))
                self.assert_safe_failure()

    def test_invalid_configuration_fails_before_opening_a_connection(self) -> None:
        invalid_environments = [
            {"OCR_VLM_API_KEY": ""},
            {"OCR_VLM_API_KEY": "vlm leaf"},
            {"OCR_VLM_API_KEY": "one,two"},
            {"OCR_VLM_API_KEY": "adapter-boundary-token"},
            {"OCR_VLM_TIMEOUT_SECONDS": ""},
            {"OCR_VLM_TIMEOUT_SECONDS": "0"},
            {"OCR_VLM_TIMEOUT_SECONDS": "-1"},
            {"OCR_VLM_TIMEOUT_SECONDS": "11"},
            {"OCR_VLM_TIMEOUT_SECONDS": "nan"},
            {"OCR_VLM_TIMEOUT_SECONDS": "inf"},
            {"OCR_VLM_TIMEOUT_SECONDS": "5.5"},
            {"OCR_VLM_TIMEOUT_SECONDS": "five"},
        ]
        for invalid in invalid_environments:
            with self.subTest(invalid=invalid), self.environment(**invalid), patch(
                "engines.paddle_vl_adapter.http.client.HTTPConnection", FakeConnection
            ), self.assertRaises(ValueError):
                adapter.run_paddle_vl(Image.new("RGB", (1, 1)))
            self.assertEqual(FakeConnection.instances, [])

    def test_non_success_status_is_not_followed_or_retried(self) -> None:
        for status in (301, 307, 401, 429, 500):
            with self.subTest(status=status):
                FakeConnection.instances = []
                FakeConnection.response = FakeResponse(
                    status, b'private-card-text {"secret":"do-not-log"}'
                )
                self.assert_safe_failure()
                self.assertEqual(len(FakeConnection.instances), 1)
                self.assertEqual(len(FakeConnection.instances[0].requests), 1)

    def test_transport_error_is_not_retried_and_connection_is_closed(self) -> None:
        FakeConnection.request_error = TimeoutError("private-card-text")
        self.assert_safe_failure()
        self.assertEqual(len(FakeConnection.instances), 1)
        self.assertEqual(len(FakeConnection.instances[0].requests), 1)
        self.assertTrue(FakeConnection.instances[0].closed)

    def test_readiness_requires_authenticated_fixed_alias(self) -> None:
        models = json.dumps(
            {
                "object": "list",
                "data": [{"id": "paddleocr-vl-1.6", "object": "model"}],
            }
        ).encode()
        with self.environment(), patch(
            "engines.paddle_vl_adapter._request", side_effect=[b"", models]
        ) as request:
            adapter.check_paddle_vl_ready()

        self.assertEqual(
            request.call_args_list,
            [
                call(
                    "GET",
                    "/v1/models",
                    None,
                    5.0,
                    expected_status=401,
                ),
                call("GET", "/v1/models", "vlm-leaf-token", 5.0),
            ],
        )

        for responses in (
            [adapter.PaddleVlInferenceError()],
            [b"", b'{"object":"list","data":[]}'],
        ):
            with self.subTest(responses=responses):
                with self.environment(), patch(
                    "engines.paddle_vl_adapter._request", side_effect=responses
                ), self.assertRaisesRegex(
                    RuntimeError, "^PaddleOCR-VL inference failed$"
                ):
                    adapter.check_paddle_vl_ready()

    def test_anonymous_auth_probe_requires_401_without_reading_body(self) -> None:
        FakeConnection.response = FakeResponse(401, b"private-card-text")
        with patch(
            "engines.paddle_vl_adapter.http.client.HTTPConnection", FakeConnection
        ):
            response = adapter._request(  # type: ignore[attr-defined]
                "GET", "/v1/models", None, 5.0, expected_status=401
            )
        self.assertEqual(response, b"")
        self.assertIsNone(FakeConnection.response.read_size)
        self.assertEqual(FakeConnection.instances[0].requests[0][3], {})

        FakeConnection.instances = []
        FakeConnection.response = FakeResponse(200, b'{"object":"list"}')
        with patch(
            "engines.paddle_vl_adapter.http.client.HTTPConnection", FakeConnection
        ), self.assertRaisesRegex(RuntimeError, "^PaddleOCR-VL inference failed$"):
            adapter._request(  # type: ignore[attr-defined]
                "GET", "/v1/models", None, 5.0, expected_status=401
            )
        self.assertIsNone(FakeConnection.response.read_size)

    def test_invalid_response_envelopes_fail_without_exposing_content(self) -> None:
        invalid_bodies = [
            b"private-card-text",
            b"{}",
            json.dumps(
                {
                    "object": "chat.completion",
                    "model": "paddleocr-vl-1.6",
                    "choices": [],
                }
            ).encode(),
            json.dumps(
                {
                    "object": "chat.completion",
                    "model": "paddleocr-vl-1.6",
                    "choices": {},
                }
            ).encode(),
            completion(json.dumps({})).body.replace(
                b'"paddleocr-vl-1.6"', b'"wrong-model"'
            ),
            completion(json.dumps({})).body.replace(
                b'"finish_reason": "stop"', b'"finish_reason": "length"'
            ),
            completion(json.dumps({})).body.replace(
                b'"role": "assistant"', b'"role": "tool"'
            ),
            completion(42).body,
            completion("").body,
            completion("private-card-text").body,
            completion("```json\\n{}\\n```").body,
            completion(json.dumps([])).body,
        ]
        for body in invalid_bodies:
            with self.subTest(body=body):
                FakeConnection.response = FakeResponse(200, body)
                self.assert_safe_failure()

    def test_oversized_response_is_rejected_with_bounded_read(self) -> None:
        FakeConnection.response = FakeResponse(
            200, b"x" * (adapter.MAX_RESPONSE_BYTES + 1)
        )
        self.assert_safe_failure()
        self.assertEqual(
            FakeConnection.response.read_size, adapter.MAX_RESPONSE_BYTES + 1
        )


if __name__ == "__main__":
    unittest.main()
