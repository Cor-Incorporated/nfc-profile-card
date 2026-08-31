# ハンドオフ: 名刺 OCR を Gemini → ローカル AI クラスターへ(ai-cluster → nfc 実装)

**状態: パイプライン稼働中(2026-08-31 実機貫通確認済)。** クライアント統合を進めてください。
本書は ai-cluster 側(クラスター/gateway/資格情報)から nfc-profile-card 実装への引き継ぎです。

## 1. 使うエンドポイント

```
POST http://<gateway>/v1/ocr/extract
```

- **到達アドレス**: gateway は Mac Studio 上の `mac-studio.tailb30e58.ts.net:4000`(Tailscale serve・plain HTTP)。
  クラウド(Cloud Run 等)からは TS sidecar socks5 または Cloudflare Tunnel 経由。
  **生の Tailscale IP `100.x:11434` へ直接叩かないこと**(不達。ai-cluster `docs/evidence/node-reachability-audit-2026-08-30.md`)。
- **認証**: クライアント→gateway は既存の公開経路の認証に従う。**下流(GB10 OCR)の Bearer は gateway が注入する**
  ので、クライアント側で OCR 用の秘密鍵を持つ必要はない(鍵は GB10 `/etc/tapforge-ocr/adapter.env` と
  Mac Studio `gateway/.env` に配送済・ai-cluster 管理)。

## 2. リクエスト / レスポンス契約

リクエスト:

```json
{ "image": "<base64>", "mimeType": "image/png" } // jpeg|png|webp
```

レスポンス(実測・HTTP 200):

```json
{
  "success": true,
  "mode": "...",
  "data": {
    "classic":  { "engine": "pp-ocrv6-medium",
                  "rawText": "Cor. Incorporated\n寺田 康祐 /CEO\nEmail: ...\nTEL: ...\n〒150-0041 ...",
                  "blocks": [ { "text": "...", "bbox": [x0,y0,x1,y1], "confidence": 0.9996 } ] },
    "semantic": { "engine": "phi-4-multimodal-instruct",
                  "fields": { "name":"寺田 康祐","name_kana":"","company":"Cor. Incorporated",
                              "department":"","title":"CEO","email":"","phone":"","mobile":"",
                              "fax":"","postal_code":"","address":"東京都渋谷区神南1-2-3",
                              "url":"","social":"" } },
    "qr": { ... }
  }
}
```

監査ヘッダ: `x-cluster-served-model: PP-OCRv6_medium` / `-node-class: gb10` / `-egress: local` / `-fallback: false`。

## 3. クライアント側の実装指針(最重要)

**二系統照合を守ること。1 系統に全部任せない。**

- **氏名・会社・部署・役職** → `semantic.fields`(VLM の対応付け)を採用。
- **email / phone / mobile / fax / postal_code / url** → **`semantic` に頼らない**
  (semantic は現状これらを**意図的に空**で返す=VLM に推測させない設計)。
  **`classic.rawText` + 決定論パーサで確定**する:
  - email: regex(`classic.rawText` から抽出)
  - phone/mobile/fax: 電話番号パーサ
  - postal_code / address: 郵便番号パーサ + 正規化
  - url / social: URL パーサ
  - QR: `data.qr` を採用(ZXing 等)
- **VLM に email/phone を「補完」させない**(`092-xxx-xxxx` を文脈で埋める挙動は事故。生 OCR との一致でのみ確定)。
- 不一致時(semantic vs classic)は `confidence=low, human_review=true` に落とす。

抽出フィールド: `name, name_kana, company, department, title, email, phone, mobile, fax, postal_code, address, url, social`。

## 4. 移行方針

- **段階移行**: cluster OCR を opt-in で追加し、**Gemini は fallback 温存** → 実測で切替(cluster_gateway パターン)。
- カットオーバーは PO 裁定。前提(gateway 永続化・到達・認証)は充足済み。

## 5. A/B 用の在庫(semantic エンジン差し替え候補・ai-cluster が NAS 確保済)

現状 semantic は `phi-4-multimodal-instruct`。名刺 IE により強い候補を評価したい場合、ai-cluster に依頼:

| model                    | 特徴                                    | 状態                                      |
| ------------------------ | --------------------------------------- | ----------------------------------------- |
| `HunyuanOCR-1.5`(1B)     | image→JSON 抽出(card IE 92.40)・313 t/s | NAS 済・GB10 :8094 予約(起動は人間ゲート) |
| `PaddleOCR-VL-1.6`(0.9B) | Apache-2.0・撮影/傾きに強い・374 t/s    | NAS 済・GB10 :8092 稼働                   |

評価軸: 氏名/会社/email/phone/郵便 exact-match、住所 normalized、CER、hallucination 率、missing 率、p50/p95、VRAM。

## 6. 責任分界

- **ai-cluster**: gateway/中継/ノード serving/下流資格情報/パイプライン実測/記録(本書・nfc#80・evidence・台帳)。
- **nfc 実装(あなた)**: クライアント統合・二系統照合の実装・Gemini fallback・UI/保存・カットオーバー判断。

## 参照

- ai-cluster: `docs/03-runbooks/nfc-ocr-upstream-key.md`(鍵発行/配送)/ `docs/evidence/nfc-ocr-pipeline-live-2026-08-31.md`(実機貫通)/
  `docs/evidence/node-reachability-audit-2026-08-30.md`(到達性)/ `config/port-allocation.yaml`(:8092/:8093/:8094)。
- issue: ai-cluster #186 / nfc-profile-card #80(統合スペックと実測ログ)。

鍵配送・serving・実測は ai-cluster 側で整備済です。実装で不足エンドポイント/フィールド/モデルがあれば nfc#80 で依頼してください。
