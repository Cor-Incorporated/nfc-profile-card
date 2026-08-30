# Local business-card OCR inference service

Vercel and Cloudflare Workers cannot run 0.9–1B VLMs. The Next.js app
sends the card image here. This process owns native PP-OCR and calls the
dedicated PaddleOCR-VL `llama-server` on private loopback.

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

- `PP-OCRv6_medium_det` + `PP-OCRv6_medium_rec` (reported as
  `pp-ocrv6-medium` only after both return a valid PaddleOCR 3.7 result)
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

Authentication uses three independent credential values across two private
hops:

- Vercel `OCR_INFERENCE_API_KEY` authenticates to the public gateway.
- Gateway `NFC_OCR_ADAPTER_BEARER_TOKEN` equals adapter
  `OCR_ADAPTER_API_KEY` for that hop.
- Adapter `OCR_VLM_API_KEY` equals leaf `LLAMA_API_KEY` for the loopback hop.

The public, adapter, and VLM values must be pairwise distinct. The gateway
enforces public-versus-adapter separation; the adapter enforces
adapter-versus-VLM separation. Compare public-versus-VLM only in the approved
secret-management process instead of copying the public secret onto the GB10.

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

## PP-OCRv6 live runtime

The live classic adapter is pinned to the official PaddleOCR 3.7 API and its
exact `PP-OCRv6_medium_det` / `PP-OCRv6_medium_rec` pair. It passes a BGR NumPy
array to `predict()` and reads `rec_texts`, `rec_scores`, and `rec_boxes` from
the PaddleX `OCRResult`. It does not call the deprecated 2.x `ocr()` API.

Install the separate CPU runtime only on the approved OCR host:

```bash
cd services/ocr-inference
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements-live-cpu.txt
python -c 'import paddle; paddle.utils.run_check()'
```

The pins are `paddleocr==3.7.0`, `paddlex[ocr-core]==3.7.2`, and
`paddlepaddle==3.1.1`. PaddleOCR 3.7 officially requires PaddleX `>=3.7,<3.8`
and PaddlePaddle `>=3.0`. PyPI publishes a CPython 3.11
`manylinux2014_aarch64` CPU wheel for PaddlePaddle 3.1.1. PaddlePaddle's
official install guide states that arm64 GPU wheels are not published, so the
GB10 candidate must first be measured on the official CPU wheel. A GPU source
build is a separate human-approved experiment; do not substitute an unverified
community wheel.

Provision both model directories out of band, then inject absolute paths. The
adapter requires these values and never falls back to PaddleOCR's automatic
weight download. Each directory's official `inference.yml` must declare the
matching exact model name; an older model behind a v6-looking path is rejected:

```bash
export PPOCR_DET_MODEL_DIR=/absolute/path/to/PP-OCRv6_medium_det
export PPOCR_REC_MODEL_DIR=/absolute/path/to/PP-OCRv6_medium_rec
export OCR_INFERENCE_MODE=live
```

Run the dedicated PaddleOCR-VL-1.6 GGUF + mmproj with `llama-server` on
`127.0.0.1:8092`, alias `paddleocr-vl-1.6`, and a dedicated `LLAMA_API_KEY`.
Set distinct `OCR_ADAPTER_API_KEY` / `OCR_VLM_API_KEY` values on the adapter;
`OCR_VLM_API_KEY` must match the leaf's `LLAMA_API_KEY`. Set an integer
`OCR_VLM_TIMEOUT_SECONDS` from 1 through 10, starting with 5 seconds so the
outer request still has room to fall back. The adapter always sends a
canonical PNG `image_url` to the fixed loopback endpoint and does not honor
URL or model overrides.

One pipeline is loaded lazily and cached per uvicorn process; predictions are
serialized because Paddle's predictor is process state. Run one uvicorn worker
until concurrency and memory have been measured. Live `/health` initializes
the classic pipeline and returns a fixed 503 if dependencies, directories, or
model loading are invalid. An image-level inference check is still required
before promotion.

Official references:

- [PaddleOCR 3.7 OCR pipeline](https://github.com/PaddlePaddle/PaddleOCR/blob/v3.7.0/paddleocr/_pipelines/ocr.py)
- [PaddleOCR general OCR usage](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/OCR.en.md)
- [PaddleOCR and PaddleX compatibility](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/paddleocr_and_paddlex.md)
- [PaddlePaddle 3.1.1 PyPI files](https://pypi.org/project/paddlepaddle/3.1.1/)
- [PaddlePaddle installation guide](https://www.paddlepaddle.org.cn/documentation/docs/zh/install/index_cn.html)

Before GB10 promotion, a human must record Python/package versions,
`paddle.utils.run_check()`, `/health`, and real Japanese/English business-card
results. Measure warm p50/p95 latency and peak cgroup memory. With Gemini
fallback enabled, the current application budget leaves at most 9 seconds for
the complete local request; the PP-OCR and VLM path must fit that budget. Keep
the route dark if the 2GB adapter cap, accuracy checks, or deadline fail.
Hunyuan experiments, if legally approved, must use a separate offline harness.
They are intentionally unreachable from this HTTP service.

## Auth

Live mode requires `OCR_ADAPTER_API_KEY`, `OCR_VLM_API_KEY`, and a bounded
`OCR_VLM_TIMEOUT_SECONDS`; missing or invalid values make `/health` and an
authorized `/v1/ocr/extract` return a fixed 503 response. Adapter and VLM keys
must differ. Whitespace is invalid in either key, and the VLM key also rejects
commas so llama-server cannot interpret it as a key list. Wrong or missing
adapter bearer headers return a fixed 401 response, and comparisons use
constant-time matching. The gateway injects the adapter value from
`NFC_OCR_ADAPTER_BEARER_TOKEN`. Never expose adapter or VLM keys to Vercel.

The standard-library transport has one fixed destination and a 64 KiB response
limit. Each inference performs one request. It does not use proxy variables,
redirects, retries, or
`max_tokens`, and sends `cache_prompt: false`. Non-200, truncated, malformed,
or wrong-model responses collapse to the adapter's fixed secret-safe 503.
In live mode, adapter startup and `/health` require an anonymous `/v1/models`
call to return 401, then a dedicated-Bearer call to return the fixed alias.
This distinguishes an authenticated leaf from a merely reachable one without
putting the VLM key in process arguments.

`cache_prompt: false` prevents cross-request prompt reuse but is not proof of
immediate GPU/RAM zeroization. Before route enablement, the human GB10 gate must
verify the installed binary's cache/UI-disable flags and reconcile the host
unit; unsupported flags must not be guessed into this candidate unit.

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
