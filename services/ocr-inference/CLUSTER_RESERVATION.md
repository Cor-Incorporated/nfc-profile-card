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
- Dual adapter owns native PP-OCRv6 and calls the private VLM process.
- Next.js owns deterministic exact-field comparison and `human_review`.
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

Do not install these units on `evo-x2`, `evo-x2-2`, or `jetson-thor`.

The unit names above are repository candidates, not live evidence. Reconcile
them with the ai-cluster service catalog before the human-only GB10 bring-up.
