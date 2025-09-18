# Phase 1 実装チェックリスト

**実施日**: 2025年9月19日
**目標**: アナリティクス機能とフォント選択UIの実装

---

## 🌅 午前タスク（9:00-12:00）

### 1. E2Eテスト実行 ⏰ 9:00-10:00
```bash
# テスト実行
npm run test:e2e

# デバッグが必要な場合
npm run test:e2e:debug

# UIモードで確認
npm run test:e2e:ui
```

**チェック項目**:
- [ ] 既存ユーザーフロー: PASS
- [ ] エラーハンドリング: PASS
- [ ] データ整合性確認: PASS
- [ ] パフォーマンス基準確認: PASS

### 2. アナリティクス実装 ⏰ 10:00-12:00

#### 2.1 プロファイルページ統合
**ファイル**: `/src/app/p/[username]/page.tsx`

```typescript
// 追加するimport
import { trackPageView } from "@/lib/analytics";

// useEffectに追加（60行目付近）
useEffect(() => {
  const track = async () => {
    if (username) {
      await trackPageView(username as string);
    }
  };
  track();
}, [username]);
```

#### 2.2 ダッシュボード表示
**ファイル**: `/src/app/dashboard/page.tsx`

1. importを追加
2. useStateでanalytics stateを追加
3. useEffectでデータ取得
4. アナリティクスカードを追加

---

## ☀️ 午後タスク（13:00-18:00）

### 3. フォント選択UI ⏰ 13:00-15:00
**ファイル**: `/src/components/editor/editableComponents/Text.tsx`

```typescript
import { JAPANESE_FONTS } from '@/lib/fonts';

// TextSettings内に追加
<div className="mb-4">
  <label className="text-sm font-medium">フォント</label>
  <select
    value={fontFamily}
    onChange={(e) => setProp(props => props.fontFamily = e.target.value)}
    className="w-full p-2 border rounded"
  >
    {JAPANESE_FONTS.map(font => (
      <option key={font.value} value={font.className}>
        {font.label}
      </option>
    ))}
  </select>
</div>
```

### 4. Lighthouse計測 ⏰ 15:00-16:00

```bash
# インストール（初回のみ）
npm install -g @lhci/cli

# 実行
npx lhci autorun --config=./scripts/lighthouse-ci.js
```

**目標スコア**:
- Performance: 70以上
- Accessibility: 90以上
- FCP: 2秒以内
- LCP: 2.5秒以内

### 5. 統合テスト ⏰ 16:00-17:00

**確認項目**:
- [ ] アナリティクストラッキング動作確認
- [ ] ダッシュボード表示確認
- [ ] フォント選択・保存確認
- [ ] エラーなしでビルド完了
- [ ] TypeScriptエラーなし
- [ ] ESLintエラーなし

---

## 📊 報告フォーマット

### 12:00 中間報告
```
【Phase 1 中間報告】
✅ E2Eテスト: 全XX件PASS
✅ アナリティクス実装: 完了
⏳ フォント選択UI: 実装中
```

### 18:00 完了報告
```
【Phase 1 完了報告】
✅ アナリティクス機能: 実装完了・動作確認済み
✅ フォント選択UI: 実装完了・動作確認済み
✅ Lighthouse Score: Performance XX点
✅ 統合テスト: 全項目PASS

デプロイ準備完了
```

---

## ⚠️ トラブルシューティング

### E2Eテスト失敗時
1. `npm run dev`でサーバーが起動しているか確認
2. localhost:3000が使用可能か確認
3. テストユーザーの認証情報を確認

### TypeScriptエラー時
```bash
npm run type-check
```

### ESLintエラー時
```bash
npm run lint
npm run format  # 自動修正
```

### Firestoreエラー時
- `.env.local`の設定を確認
- Firebase Consoleでプロジェクト状態を確認

---

## 🚀 デプロイ前チェックリスト

- [ ] 全テストPASS
- [ ] ビルド成功
- [ ] TypeScriptエラーなし
- [ ] ESLintエラーなし
- [ ] console.logの削除
- [ ] エラートラッキング動作確認
- [ ] パフォーマンス基準達成