# ThinkStation GB10 reservation (do not evict)

Card OCR for `nfc-profile-card` is self-hosted on the existing Tailscale
cluster. It is isolated from other Cor products.

## Host

|            |                                                                |
| ---------- | -------------------------------------------------------------- |
| Hostname   | `thinkstationpgx-ab59`                                         |
| Hardware   | NVIDIA GB10, ~121GB RAM                                        |
| Memory cap | **8GB** (cgroup / systemd slice)                               |
| Network    | Private cluster only; node addresses stay out of this app repo |

Do **not** place this workload on `evo-x2`, `evo-x2-2` (35B/26B/12B keepwarm),
or `jetson-thor`.

## Dedicated ports (production)

| Service                                          | Port     | Exposure        |
| ------------------------------------------------ | -------- | --------------- |
| PaddleOCR-VL-1.6 `llama-server` (GGUF + mmproj)  | **8092** | cluster-private |
| Dual adapter (raw PP-OCR + semantic VLM results) | **8093** | gateway only    |

## Ports that must stay unused by this product

| Port                       | Owner                                                                  |
| -------------------------- | ---------------------------------------------------------------------- |
| 8090                       | deck-forge llama on Mac Studio — **local mock only**, never production |
| 8080                       | GPUStack on Mac                                                        |
| 11434                      | Shared cluster Ollama (`qwen` / `gemma`). **Never** load card OCR here |
| 8091 / 8188 / 8190 / 50052 | Existing GB10 reservations                                             |

Sister repos that share the cluster (do not edit from this PR):
`engineai-thor-sidecar`, `ai-cluster`, `Grift`, `deck-forge`, `cor-os`.

Reservation issues already filed: `ai-cluster#184`, `Grift#2259`,
`deck-forge#183`, `cor-os#118`, `engineai-thor-sidecar#12`.

## Process shape

- Dedicated `llama-server` for PaddleOCR-VL-1.6 — not the shared Ollama pool.
- Dual adapter owns native PP-OCRv6 and calls only
  `http://127.0.0.1:8092/v1/chat/completions` with fixed alias
  `paddleocr-vl-1.6`.
- Next.js owns deterministic exact-field comparison and `human_review`.
- The gateway validates its public token, then sends a distinct adapter token
  from `NFC_OCR_ADAPTER_BEARER_TOKEN`. The adapter compares that value against
  `OCR_ADAPTER_API_KEY`, then uses a third value, `OCR_VLM_API_KEY`, which
  matches the leaf's `LLAMA_API_KEY`. Public, adapter, and VLM values must be
  pairwise distinct; none belongs in Git or application logs.
- The live adapter accepts only `{image, mimeType}` and always runs PaddleOCR-VL.
  Hunyuan is not exposed through the HTTP contract.
- Both under `systemd/tapforge-ocr.slice` (`MemoryMax=8G`).
- Next.js on Vercel calls only the authenticated public gateway through
  `OCR_INFERENCE_URL`; it never calls these ports directly.
- Not Modal. Not RunPod. Not a Vercel function.

Install on `thinkstationpgx-ab59` only:

```bash
sudo cp services/ocr-inference/systemd/tapforge-ocr.slice /etc/systemd/system/
sudo cp services/ocr-inference/systemd/tapforge-ocr-vl.service /etc/systemd/system/
sudo cp services/ocr-inference/systemd/tapforge-ocr-ppocr.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tapforge-ocr.slice tapforge-ocr-vl.service tapforge-ocr-ppocr.service
```

Before starting the candidate units, inject `LLAMA_API_KEY` into the VLM unit
and distinct `OCR_ADAPTER_API_KEY` / `OCR_VLM_API_KEY` values into the adapter
unit through the host-approved secret mechanism or systemd drop-ins.
`OCR_VLM_API_KEY` and `LLAMA_API_KEY` are the same hop credential. The
repository does not prescribe a host secret path and contains no secret value.
Both unit preflights and the live `/health` endpoint fail closed while required
configuration is absent or invalid. Adapter startup and `/health` also require
the loopback leaf to reject an anonymous `/v1/models` request with 401, accept
the dedicated Bearer, and advertise the fixed alias.

Do not install these units on `evo-x2`, `evo-x2-2`, or `jetson-thor`.

The unit names above are repository candidates, not live evidence. Reconcile
them with the ai-cluster service catalog before the human-only GB10 bring-up.
The installed binary/flags, real multimodal semantic JSON, 8GB behavior, and
authenticated negative/positive calls remain human gates before route enablement.
The request disables prompt reuse, but immediate GPU/RAM zeroization remains
unproven until the installed binary's cache-disable flags are inspected and the
host unit is reconciled.
