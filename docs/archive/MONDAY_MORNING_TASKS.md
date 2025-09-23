# 🚀 月曜朝一番の作業指示 - 名刺スキャナー統合

**開発チーム各位**

おはようございます！月曜日の作業開始前に必ずこのドキュメントを確認してください。

## ⚡ 重要な変更

**API Keyは既に設定済みです！** 新たな設定は不要です。

```bash
# 確認コマンド（最初に実行）
grep "GEMINI_API_KEY" .env.local
# 出力されれば準備OK！
```

## 📋 月曜日（9/23）のタスク割り当て

### 👤 バックエンド担当（田中さん想定）

**9:00-10:00**: 環境準備とAPI Route作成
```bash
# 1. パッケージインストール
npm install @google/genai

# 2. API Routeファイル作成
mkdir -p src/app/api/business-card/scan
touch src/app/api/business-card/scan/route.ts
```

**10:00-12:00**: API実装
```typescript
// route.ts の実装（URGENT_API_KEY_UPDATE.mdを参照）
// 既存のGEMINI_API_KEYを使用！
```

### 👤 フロントエンド担当（佐藤さん想定）

**9:00-10:00**: コンポーネント移植準備
```bash
# 1. ディレクトリ作成
mkdir -p src/components/business-card
mkdir -p src/app/dashboard/business-cards/scan

# 2. 名刺スキャナーのコンポーネントをコピー
cp 名刺スキャナー-&-vcard保存/components/* src/components/business-card/
```

**10:00-12:00**: UIコンポーネント実装
- ImageSelector.tsx の移植
- ContactForm.tsx の移植
- API呼び出し部分をfetch経由に修正

### 👤 フロントエンド担当2（鈴木さん想定）

**9:00-12:00**: ダッシュボード統合
- ダッシュボードに名刺スキャンボタン追加
- スキャンページのルーティング設定
- スタイリング調整（既存UIに合わせる）

## 🔍 確認ポイント

### 朝会（10:00）で共有すること

1. **環境変数の確認結果**
   - GEMINI_API_KEYが存在するか
   - 他に必要な設定はないか

2. **作業分担の確認**
   - 誰が何を担当するか明確化
   - ブロッカーがないか確認

3. **目標設定**
   - 本日中にスキャン機能のMVP動作確認
   - 火曜日にFirestore保存まで完了

## ⚠️ 注意事項 - 必読！

### ❌ やらないこと
```javascript
// 1. 新しい.env.localを作らない
// 2. NEXT_PUBLIC_GEMINI_API_KEYを使わない（セキュリティ違反）
// 3. クライアントサイドで直接Gemini APIを呼ばない
```

### ✅ やること
```javascript
// 1. 既存の環境変数を使用
// 2. API Route経由でGemini APIを呼ぶ
// 3. エラーハンドリングを適切に実装
```

## 📱 コミュニケーション

### Slackチャンネル
- 進捗報告: #dev-nfc-profile
- 質問・相談: @PdM をメンション
- 緊急時: 電話OK

### 定例
- 10:00 - 朝会（15分）
- 13:00 - 進捗確認（5分）
- 17:00 - 夕会（10分）

## 🎯 本日のゴール

**必須（Must）**:
- [ ] API Route作成・動作確認
- [ ] 画像アップロード機能実装
- [ ] Gemini API呼び出し成功

**できれば（Should）**:
- [ ] OCR結果の表示
- [ ] 編集フォーム実装開始
- [ ] エラーハンドリング

**余裕があれば（Could）**:
- [ ] Firestore保存
- [ ] UIポリッシュ

## 📂 参考ファイル

必ず以下のドキュメントを確認してください：

1. **API実装詳細**: `/URGENT_API_KEY_UPDATE.md`
2. **全体計画**: `/BUSINESS_CARD_SCANNER_INTEGRATION.md`
3. **実装ガイド**: `/IMPLEMENTATION_GUIDE_BUSINESS_CARD.md`

## 💪 最後に

今週は名刺スキャナー統合の重要な週です。
既にAPIキーは準備済みなので、スムーズに開発を開始できます。

**ポイント**:
- 既存のリソースを最大限活用
- セキュリティを最優先
- 段階的に実装（完璧を求めない）

何か不明点があれば、遠慮なく質問してください！
良い一週間のスタートを切りましょう！

---

**Let's build! 🚀**

PdM
2025-09-23（月）作業開始用
