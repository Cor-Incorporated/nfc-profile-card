# ローカル名刺 OCR パイプライン選定結果

測定日時: 2026-08-31 JST
対象: GB10 `thinkstationpgx-ab59`、合成・匿名化した8種類の名刺、各3回

## 結論

本番候補は **PP-OCRv6 medium → bbox付きテキスト → Phi-4
multimodal（text-only）→ 決定論的突合** とする。

PP-OCRv6 は24/24回成功し、期待フィールドの生文字包含率が100%、p95が
4.47秒、ピークRSSが1.27GBだった。Phi-4へ画像を渡すと空欄幻覚率が
86.05%だった一方、PP-OCRのbbox付きテキストだけを渡すとJSON成功率
100%、フィールド一致率76.92%、p95 1.99秒まで改善した。両段のp95単純和
は6.46秒で、アプリの9秒ローカル期限に2.54秒の余裕がある。

Phi-4の出力だけでは空欄幻覚率23.26%が残る。そのため、email、phone、
mobile、fax、postal_code、URLは必ずPP-OCR生文字から決定論的に抽出する。
氏名、会社、部署、役職、住所も正規化後の生文字に裏付けられない値は自動
確定せず、空値または `human_review=true` とする。

## 比較結果

| 候補                             | JSON成功率 | フィールド一致率 | 空欄幻覚率 |           CER / 生文字包含 |     p95 | 判定                   |
| -------------------------------- | ---------: | ---------------: | ---------: | -------------------------: | ------: | ---------------------- |
| PP-OCRv6 medium                  |        N/A |              N/A |        N/A | CER 10.87%、期待値包含100% |  4.47秒 | 生文字・bboxの主系統   |
| PP-OCRv6 → Phi-4 text            |       100% |           76.92% |     23.26% |        PP生文字でgrounding |  1.99秒 | 条件付き採用           |
| PaddleOCR-VL 1.6 画像・無制限    |         0% |              N/A |        N/A |                 CER 18.44% | 26.45秒 | 棄却                   |
| PaddleOCR-VL 1.6 画像・512 token |         0% |              N/A |        N/A |                 CER 18.44% |  2.49秒 | JSON契約不適合で棄却   |
| Phi-4 画像                       |       100% |           12.50% |     86.05% |                        N/A |  2.43秒 | 棄却                   |
| HunyuanOCR 1.5 画像              |        50% |           46.15% |       100% |                        N/A |  1.37秒 | 精度・法務の両面で棄却 |

PaddleOCR-VLの無制限実行では1ケースで空行生成が続き、3回とも約26.4秒
だった。512 token上限で遅延は抑えられたが、そのケースは生文字が欠落し、
全ケースで意味JSONを一度も返さなかった。現行の画像→JSONアダプタ契約には
使えない。

HunyuanOCRは公式ライセンス条件と既存の法務ゲートにより本番利用対象外で
ある。今回の実測でもJSON不達が半数、空欄幻覚率100%だったため、法務判断が
変わっても現パイプラインでは採用しない。

## 本番契約

1. PP-OCRv6 mediumが `rawText`、`bbox`、`confidence` を返す。
2. exact値はラベルを保持した決定論的parserだけが確定する。
3. Phi-4には画像を送らず、`[x1,y1,x2,y2] text` のみを渡す。
4. Phi-4の意味値はPP生文字とのgrounding検査を通す。
5. 裏付けのない意味値、exact不一致、片系失敗は `human_review=true`。
6. ローカル経路の一時障害だけGeminiへfallbackする。認証・設定・恒久エラー
   ではfallbackしない。
7. Hunyuan、EVO、共有Ollamaにはfallbackしない。

## まだ必要な受入検査

- 統合アダプタを同じ24回で実行し、誤ったexact値の自動確定が0件であること。
- cold startを含む統合p95が9秒未満、8GB slice内であること。
- 実物の日本語・英語名刺で、保存前のUI確認と中間名保持を確認すること。
- 漏洩済みGeminiキーを失効・更新した後、local success時0回、transient failure
  時1回だけGeminiが呼ばれることを実キーで確認すること。
- Previewと本番をgateway経由で確認し、VercelからTailscale IPへ直接接続しない
  こと。

合成データは再現性と負例検査のためのものであり、実物カードUATを代替しない。

## 一次資料

- [PaddleOCR-VL公式モデル](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.5)
- [Phi-4 multimodal公式モデル](https://huggingface.co/microsoft/Phi-4-multimodal-instruct)
- [HunyuanOCR公式モデルとライセンス](https://huggingface.co/tencent/HunyuanOCR)
