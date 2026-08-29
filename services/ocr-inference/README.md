# Local business-card OCR inference service

Vercel and Cloudflare Workers cannot run 0.9–1B VLMs. The Next.js app
sends the card image here. This process owns the models.

## Pipeline

```
card image → preprocess
  ├─ PP-OCRv6_medium → raw text + bbox + confidence
  └─ PaddleOCR-VL-1.6 (default) or HunyuanOCR-1.5 (flag)
       → semantic JSON
Next.js then merges the two and verifies email / phone / URL / postal code
against classic OCR strings. The VLM never invents those fields.
```

Default production engines (Apache 2.0, commercial-safe):

- `PP-OCRv6_medium`
- `PaddleOCR-VL-1.6`

`HunyuanOCR-1.5` is an optional internal A/B path only. The Tencent Hunyuan
Community License forbids EU/UK/KR use, requires attribution, and forbids
training on outputs. Do not enable it in production without legal review.

## Run locally (mock, no model weights)

This is the CI / laptop path. The HTTP contract is identical to live mode.

```bash
cd services/ocr-inference
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export OCR_INFERENCE_MODE=mock
uvicorn app:app --host 127.0.0.1 --port 8090
```

Health check: `curl http://127.0.0.1:8090/health`

In the Next.js app:

```bash
OCR_PROVIDER=local
OCR_INFERENCE_URL=http://127.0.0.1:8090
OCR_INFERENCE_MODE=live   # Next.js talks to the sidecar
```

`OCR_INFERENCE_MODE=mock` on the Next.js side skips the HTTP call and uses
the same fixture locally (useful for unit tests).

## Docker

```bash
docker compose -f services/ocr-inference/docker-compose.yml up --build
```

## Plug in real weights

1. Install PaddlePaddle + PaddleX / PaddleOCR in this environment (GPU
   recommended).
2. Download `PP-OCRv6_medium` and `PaddleOCR-VL-1.6` per the PaddleOCR docs.
3. Set `OCR_INFERENCE_MODE=live` for the sidecar.
4. Restart uvicorn. The adapters in `engines/ppocr_adapter.py` and
   `engines/paddle_vl_adapter.py` are the plug-in points if API names change.

Optional Hunyuan A/B:

```bash
export OCR_ENABLE_HUNYUAN=true
export OCR_VLM_ENGINE=hunyuanocr-1.5
```

Only do this on an internal host after accepting the Hunyuan license.

## Auth

If `OCR_INFERENCE_API_KEY` is set, callers must send
`Authorization: Bearer <key>`. The Next.js server reads the same variable.

## Why this is not a Next.js API route

The models are far too large for Vercel serverless. `/api/business-card/scan`
stays on Vercel (auth, quota, merge, vCard). Only the raw OCR/VLM step runs
here.
