# ThinkStation GB10 reservation (do not evict)

Card OCR for `nfc-profile-card` is self-hosted on the existing Tailscale
cluster. It is isolated from other Cor products.

## Host

|            |                                                |
| ---------- | ---------------------------------------------- |
| Hostname   | `thinkstationpgx-ab59`                         |
| Hardware   | NVIDIA GB10, ~121GB RAM                        |
| Memory cap | **8GB** (cgroup / systemd slice)               |
| Network    | Tailscale `100.93.32.70` / LAN `192.168.11.26` |

Do **not** place this workload on `evo-x2`, `evo-x2-2` (35B/26B/12B keepwarm),
or `jetson-thor`.

## Dedicated ports (production)

| Service                                         | Port     | URL                           |
| ----------------------------------------------- | -------- | ----------------------------- |
| PaddleOCR-VL-1.6 `llama-server` (GGUF + mmproj) | **8092** | `http://100.93.32.70:8092/v1` |
| Native PP-OCRv6_medium                          | **8093** | `http://100.93.32.70:8093`    |

LAN aliases: `http://192.168.11.26:8092` and `http://192.168.11.26:8093`.

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
- Dedicated native PP-OCRv6 process.
- Both under a systemd/cgroup slice with an 8GB memory cap.
- Next.js on Vercel calls these URLs through `OCR_VLM_URL` and `OCR_PPOCR_URL`.
