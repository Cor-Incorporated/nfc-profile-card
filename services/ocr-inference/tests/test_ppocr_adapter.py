from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
from PIL import Image

from engines import ppocr_adapter


class FakePaddleOCR:
    init_calls: list[dict[str, object]] = []
    predict_calls: list[np.ndarray] = []
    output: object = []

    def __init__(self, **kwargs: object) -> None:
        self.init_calls.append(kwargs)

    def predict(self, image: np.ndarray) -> object:
        self.predict_calls.append(image)
        return self.output


class PpocrAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        FakePaddleOCR.init_calls = []
        FakePaddleOCR.predict_calls = []
        FakePaddleOCR.output = [
            {
                "rec_texts": ["山田 太郎", "Cor.Inc."],
                "rec_scores": np.array([0.98, 0.75]),
                "rec_boxes": np.array([[1, 2, 31, 12], [3, 14, 44, 25]]),
            }
        ]

    def runtime_environment(self, root: Path) -> dict[str, str]:
        detection = root / "det"
        recognition = root / "rec"
        detection.mkdir()
        recognition.mkdir()
        (detection / "inference.yml").write_text(
            "Global:\n  model_name: PP-OCRv6_medium_det\n", encoding="utf-8"
        )
        (recognition / "inference.yml").write_text(
            "Global:\n  model_name: PP-OCRv6_medium_rec\n", encoding="utf-8"
        )
        return {
            ppocr_adapter.DETECTION_MODEL_DIR_ENV: str(detection),
            ppocr_adapter.RECOGNITION_MODEL_DIR_ENV: str(recognition),
        }

    def run_with_fake(self, environment: dict[str, str]):
        fake_module = SimpleNamespace(PaddleOCR=FakePaddleOCR)
        return (
            patch.dict(os.environ, environment, clear=True),
            patch.dict(sys.modules, {"paddleocr": fake_module}),
            patch.object(ppocr_adapter, "_pipeline", None),
        )

    def test_uses_exact_v6_models_predict_bgr_and_converts_result(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            environment = self.runtime_environment(root)
            env_patch, module_patch, cache_patch = self.run_with_fake(environment)
            image = Image.new("RGB", (1, 1), (10, 20, 30))
            with env_patch, module_patch, cache_patch:
                result = ppocr_adapter.run_ppocr(image)

        self.assertEqual(len(FakePaddleOCR.init_calls), 1)
        kwargs = FakePaddleOCR.init_calls[0]
        self.assertEqual(
            kwargs,
            {
                "text_detection_model_name": "PP-OCRv6_medium_det",
                "text_detection_model_dir": str(root / "det"),
                "text_recognition_model_name": "PP-OCRv6_medium_rec",
                "text_recognition_model_dir": str(root / "rec"),
                "use_doc_orientation_classify": False,
                "use_doc_unwarping": False,
                "use_textline_orientation": False,
                "device": "cpu",
                "engine": "paddle_static",
            },
        )
        self.assertEqual(len(FakePaddleOCR.predict_calls), 1)
        np.testing.assert_array_equal(
            FakePaddleOCR.predict_calls[0], np.array([[[30, 20, 10]]], dtype=np.uint8)
        )
        self.assertEqual(result["engine"], "pp-ocrv6-medium")
        self.assertEqual(result["rawText"], "山田 太郎\nCor.Inc.")
        self.assertEqual(result["blocks"][0]["bbox"], [1.0, 2.0, 31.0, 12.0])
        self.assertAlmostEqual(result["blocks"][0]["confidence"], 0.98)

    def test_pipeline_is_lazily_cached_once_per_process(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            environment = self.runtime_environment(Path(temporary))
            env_patch, module_patch, cache_patch = self.run_with_fake(environment)
            with env_patch, module_patch, cache_patch:
                self.assertEqual(FakePaddleOCR.init_calls, [])
                ppocr_adapter.ensure_ppocr_ready()
                ppocr_adapter.run_ppocr(Image.new("RGB", (1, 1)))
                ppocr_adapter.run_ppocr(Image.new("RGB", (1, 1)))

        self.assertEqual(len(FakePaddleOCR.init_calls), 1)
        self.assertEqual(len(FakePaddleOCR.predict_calls), 2)

    def test_missing_local_model_directory_fails_before_initialization(self) -> None:
        fake_module = SimpleNamespace(PaddleOCR=FakePaddleOCR)
        with patch.dict(os.environ, {}, clear=True), patch.dict(
            sys.modules, {"paddleocr": fake_module}
        ), patch.object(ppocr_adapter, "_pipeline", None), self.assertRaises(
            RuntimeError
        ) as caught:
            ppocr_adapter.ensure_ppocr_ready()

        self.assertIn(ppocr_adapter.DETECTION_MODEL_DIR_ENV, str(caught.exception))
        self.assertEqual(FakePaddleOCR.init_calls, [])

    def test_wrong_model_manifest_fails_before_initialization(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            environment = self.runtime_environment(root)
            (root / "rec" / "inference.yml").write_text(
                "Global:\n  model_name: PP-OCRv4_server_rec\n", encoding="utf-8"
            )
            env_patch, module_patch, cache_patch = self.run_with_fake(environment)
            with env_patch, module_patch, cache_patch, self.assertRaises(
                RuntimeError
            ) as caught:
                ppocr_adapter.ensure_ppocr_ready()

        self.assertIn(ppocr_adapter.RECOGNITION_MODEL_DIR_ENV, str(caught.exception))
        self.assertEqual(FakePaddleOCR.init_calls, [])

    def test_legacy_and_malformed_results_fail_closed(self) -> None:
        invalid_results = (
            [[[[0, 0], [1, 0], [1, 1], [0, 1]], ("legacy", 0.9)]],
            [
                {
                    "rec_texts": ["text"],
                    "rec_scores": [],
                    "rec_boxes": [[0, 0, 1, 1]],
                }
            ],
            [
                {
                    "rec_texts": ["text"],
                    "rec_scores": [float("nan")],
                    "rec_boxes": [[0, 0, 1, 1]],
                }
            ],
            [
                {
                    "rec_texts": ["text"],
                    "rec_scores": [0.9],
                    "rec_boxes": [[2, 0, 1, 1]],
                }
            ],
        )
        with tempfile.TemporaryDirectory() as temporary:
            environment = self.runtime_environment(Path(temporary))
            for output in invalid_results:
                with self.subTest(output=output):
                    FakePaddleOCR.output = output
                    env_patch, module_patch, cache_patch = self.run_with_fake(
                        environment
                    )
                    with env_patch, module_patch, cache_patch, self.assertRaises(
                        RuntimeError
                    ):
                        ppocr_adapter.run_ppocr(Image.new("RGB", (1, 1)))

    def test_empty_official_result_is_valid(self) -> None:
        FakePaddleOCR.output = [
            {"rec_texts": [], "rec_scores": [], "rec_boxes": np.empty((0, 4))}
        ]
        with tempfile.TemporaryDirectory() as temporary:
            environment = self.runtime_environment(Path(temporary))
            env_patch, module_patch, cache_patch = self.run_with_fake(environment)
            with env_patch, module_patch, cache_patch:
                result = ppocr_adapter.run_ppocr(Image.new("RGB", (1, 1)))

        self.assertEqual(
            result, {"engine": "pp-ocrv6-medium", "rawText": "", "blocks": []}
        )


if __name__ == "__main__":
    unittest.main()
