# Local business-card OCR inference service

Vercel and Cloudflare Workers cannot run 0.9–1B VLMs. The Next.js app
sends the card image here. This process owns the models.

## Pipeline

```
card image → preprocess
  ├─ PP-OCRv6_medium → raw text + bbox + confidence
  └─ PaddleOCR-VL-1.6
       → semantic JSON
Next.js then merges the two and verifies email / phone / URL / postal code
against classic OCR strings. The VLM never invents those fields.
```

Default production engines (Apache 2.0, commercial-safe):

- `PP-OCRv6_medium`
- `PaddleOCR-VL-1.6`

`HunyuanOCR-1.5` remains an offline, non-production experiment only. The HTTP
adapter has no engine selector and never imports or invokes Hunyuan, even if a
caller adds an old Hunyuan environment flag. Do not enable it in production.

## Production gateway contract

Vercel calls only the authenticated public OCR gateway. The gateway accepts
`POST /v1/ocr/extract` with `model: "nfc-ocr"` and routes to the GB10 dual
adapter. The adapter owns PP-OCR and calls the dedicated PaddleOCR-VL process
inside the private cluster. Node addresses and individual engine URLs never
belong in the application environment.

Authentication uses two independent boundaries:

- Vercel `OCR_INFERENCE_API_KEY` authenticates to the public gateway.
- The gateway's `NFC_OCR_ADAPTER_BEARER_TOKEN` authenticates to the adapter's
  `OCR_ADAPTER_API_KEY`. These two production tokens must not be reused.

The adapter body is exactly `{image, mimeType}`. `model`, `vlmEngine`, and all
other extra fields are rejected. It returns only raw classic, semantic, and QR
results; deterministic exact-field merge and `human_review` stay in Next.js.

```bash
OCR_PROVIDER=local
OCR_INFERENCE_URL=https://replace-with-ocr-gateway.example.com
OCR_INFERENCE_API_KEY=replace_with_dedicated_gateway_token
OCR_INFERENCE_MODE=live
```

See `CLUSTER_RESERVATION.md`. Do not put these models on shared Ollama,
GPUStack, or another product's reserved service.

## Run locally (mock, no model weights)

**Local-dev only.** Port 8090 is reserved in production for deck-forge.

```bash
cd services/ocr-inference
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export OCR_INFERENCE_MODE=mock
export OCR_ADAPTER_API_KEY=local-adapter-only-token
uvicorn app:app --host 127.0.0.1 --port 8090
```

Health check: `curl http://127.0.0.1:8090/health`

```bash
OCR_PROVIDER=local
OCR_INFERENCE_URL=http://127.0.0.1:8090   # laptop aggregator only
OCR_INFERENCE_API_KEY=local-adapter-only-token  # direct local call only
OCR_INFERENCE_MODE=live
```

The two local values above match only because the Next.js process calls the
loopback adapter directly. Production must keep the gateway and adapter tokens
distinct.

`OCR_INFERENCE_MODE=mock` on the Next.js side skips HTTP and uses the same
fixture locally (unit tests).

## Docker (local-dev mock only)

Binds **8090 on localhost**. Do not publish this port on the cluster.

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

Hunyuan experiments, if legally approved, must use a separate offline harness.
They are intentionally unreachable from this HTTP service.

## Auth

Live mode requires `OCR_ADAPTER_API_KEY`; a missing value makes `/health` and
`/v1/ocr/extract` return a fixed 503 response. Wrong or missing bearer headers
return a fixed 401 response, and token comparison uses constant-time matching.
Tokens containing whitespace are invalid configuration and also fail closed.
The gateway injects the matching private value from
`NFC_OCR_ADAPTER_BEARER_TOKEN`. Never expose it to Vercel.

Mock mode may omit adapter authentication only while bound to loopback. If
`OCR_ADAPTER_API_KEY` is set in mock mode, callers must authenticate.

Run the executable adapter tests with:

```bash
cd services/ocr-inference
python -m unittest discover -s tests -v
```

## Why this is not a Next.js API route

The models are far too large for Vercel serverless. `/api/business-card/scan`
stays on Vercel (auth, quota, merge, vCard). Only the raw OCR/VLM step runs
here.
