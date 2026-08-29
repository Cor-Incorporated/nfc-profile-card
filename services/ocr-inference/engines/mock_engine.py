from __future__ import annotations

from typing import Any


def run_mock_pipeline() -> dict[str, Any]:
    """Fixture used when model weights are not installed."""
    return {
        "classic": {
            "engine": "mock",
            "rawText": (
                "山田 太郎\nヤマダ タロウ\n株式会社タップフォージ\n"
                "プロダクト部\nエンジニア\ntaro.yamada@tapforge.example\n"
                "03-1234-5678\n090-1234-5678\n〒150-0001\n"
                "東京都渋谷区神宮前1-1-1\nhttps://tapforge.example"
            ),
            "blocks": [
                {
                    "text": "山田 太郎",
                    "bbox": [40, 20, 220, 60],
                    "confidence": 0.98,
                },
                {
                    "text": "taro.yamada@tapforge.example",
                    "bbox": [40, 180, 360, 210],
                    "confidence": 0.97,
                },
            ],
        },
        "semantic": {
            "engine": "mock",
            "fields": {
                "name": "山田 太郎",
                "name_kana": "ヤマダ タロウ",
                "company": "株式会社タップフォージ",
                "department": "プロダクト部",
                "title": "エンジニア",
                "email": "taro.yamada@tapforge.example",
                "phone": "03-1234-5678",
                "mobile": "090-1234-5678",
                "fax": "",
                "postal_code": "150-0001",
                "address": "東京都渋谷区神宮前1-1-1",
                "url": "https://tapforge.example",
                "social": "",
            },
        },
        "qr": [],
    }
