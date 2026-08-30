#!/usr/bin/env python3
"""Generate a deterministic, PII-free business-card OCR corpus."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

WIDTH = 1260
HEIGHT = 720


def _font_path() -> str:
    candidates = (
        "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJKjp-Regular.otf",
    )
    for candidate in candidates:
        if Path(candidate).is_file():
            return candidate
    try:
        matched = subprocess.check_output(
            ["fc-match", "-f", "%{file}", "Noto Sans CJK JP"], text=True
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        matched = ""
    if matched and Path(matched).is_file():
        return matched
    raise RuntimeError("A Japanese-capable Noto or Hiragino font is required")


def _font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


def _draw_single(draw: ImageDraw.ImageDraw, lines: list[str], font_path: str) -> None:
    y = 58
    for index, line in enumerate(lines):
        if index == 0:
            size = 64
        elif index in {1, 2}:
            size = 37
        else:
            size = 31 if len(line) < 45 else 27
        draw.text((70, y), line, font=_font(font_path, size), fill=(24, 31, 42))
        y += size + 18


def _draw_two_column(
    draw: ImageDraw.ImageDraw, lines: list[str], font_path: str
) -> None:
    left = lines[:4]
    right = lines[4:]
    for column, entries in enumerate((left, right)):
        x = 58 + column * 620
        y = 74
        for index, line in enumerate(entries):
            size = 42 if column == 0 and index == 0 else 29
            draw.text((x, y), line, font=_font(font_path, size), fill=(19, 31, 49))
            y += size + 30


def _apply_variant(image: Image.Image, variant: str, seed: int) -> Image.Image:
    if variant == "clean":
        return image
    if variant == "low_contrast_rotated":
        image = ImageEnhance.Contrast(image).enhance(0.58)
        image = image.filter(ImageFilter.GaussianBlur(radius=0.55))
        return image.rotate(2.0, resample=Image.Resampling.BICUBIC, fillcolor="white")
    if variant == "small_blurred":
        reduced = image.resize((756, 432), Image.Resampling.LANCZOS)
        image = reduced.resize((WIDTH, HEIGHT), Image.Resampling.BICUBIC)
        image = image.filter(ImageFilter.GaussianBlur(radius=0.75))
        pixels = np.asarray(image, dtype=np.int16)
        noise = np.random.default_rng(seed).normal(0, 2.0, pixels.shape)
        return Image.fromarray(np.clip(pixels + noise, 0, 255).astype(np.uint8))
    raise ValueError(f"Unknown variant: {variant}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--corpus", type=Path, default=Path(__file__).with_name("corpus.json")
    )
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    corpus = json.loads(args.corpus.read_text(encoding="utf-8"))
    font_path = _font_path()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    for index, case in enumerate(corpus):
        image = Image.new("RGB", (WIDTH, HEIGHT), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, WIDTH, 20), fill=(29, 78, 216))
        draw.rectangle((WIDTH - 22, 0, WIDTH, HEIGHT), fill=(226, 232, 240))
        if case["layout"] == "two_column":
            _draw_two_column(draw, case["lines"], font_path)
        else:
            _draw_single(draw, case["lines"], font_path)
        image = _apply_variant(image, case["variant"], seed=index + 731)
        image.save(args.output_dir / f"{case['id']}.png", format="PNG", optimize=True)

    print(f"generated={len(corpus)} output={args.output_dir}")


if __name__ == "__main__":
    main()
