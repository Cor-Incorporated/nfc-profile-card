# OCR pipeline benchmark

This benchmark uses deterministic, synthetic business cards with reserved
`.example` domains. It does not contain production contacts or Firebase data.

The corpus covers Japanese, English, a middle name, an email-only card,
two-column bilingual layout, labelled phone/FAX/mobile numbers, low contrast,
rotation, blur, small text, and empty optional fields. Each model receives the
same image and prompt. Results retain only synthetic text.

```bash
uv run --with numpy --with pillow python benchmark/generate_corpus.py \
  --output-dir /tmp/tapforge-ocr-corpus

python benchmark/run_benchmark.py \
  --protocol openai \
  --endpoint http://127.0.0.1:8092 \
  --model paddleocr-vl-1.6 \
  --image-dir /tmp/tapforge-ocr-corpus \
  --repeats 3 \
  --output benchmark/results/paddle-image.json

python benchmark/score_benchmark.py \
  --results benchmark/results/paddle-image.json \
  --output benchmark/results/paddle-image.metrics.json
```

The recorded PP-OCR run used CPython 3.11.15 with `paddlepaddle==3.1.1`,
`paddleocr==3.7.0`, and `paddlex==3.7.2` on the GB10 host. Execute the checked-in
analysis notebook from the repository root with:

```bash
uv run --with jupyter --with nbconvert jupyter nbconvert \
  --to notebook --execute --inplace \
  services/ocr-inference/benchmark/analysis.ipynb
```

Raw response artifacts are checked in as `results/*.json.gz` to keep the Git
diff reviewable. The adjacent `*.metrics.json` files and the executed notebook
remain plain text. Decompress a raw artifact before rerunning the scorer.

For a transcript-to-JSON model, pass a prior OCR result with `--transcripts`.
Use `--transcript-format blocks` when the source artifact contains PP-OCR bbox
blocks. This preserves layout without sending the card image to the semantic
model. `--max-tokens 512` is a corpus-safe guard because every reference card
is below 300 characters; the uncapped run remains the diagnostic baseline.
For the private adapter, use `--protocol adapter --token-env OCR_BENCH_TOKEN`;
the token value is read from the environment and is never written to results.

Interpretation limits:

- Synthetic cards establish repeatability and catch hallucination, parser,
  timeout, and transport defects. They do not replace real-card UAT.
- CER is meaningful for transcription outputs. Semantic models are compared by
  field exact accuracy, missing rate, and hallucination rate instead.
- A model is not production-ready solely because it returns valid JSON. Empty
  fields and exact strings must remain correct, and the complete route must fit
  the application deadline and memory limits.
