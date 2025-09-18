# 開発チェックリスト

## 🚨 必須確認事項（破壊的変更時）

### データ構造変更時
- [ ] 既存データとの後方互換性を確保
- [ ] マイグレーションをフィーチャーフラグで制御
- [ ] ロールバック手順を文書化
- [ ] 本番データのコピーでテスト実施

### リリース前チェック
- [ ] ローカル環境でユーザーとしてログイン確認
- [ ] 新規ユーザー作成フローの確認
- [ ] 既存ユーザーデータでの動作確認
- [ ] エラーハンドリングの確認

### コード変更時
- [ ] TypeScript型チェック: `npm run type-check`
- [ ] ESLint: `npm run lint`
- [ ] テスト: `npm test`
- [ ] ビルド確認: `npm run build`

## テスト手順

### 1. 既存ユーザーでのテスト
```bash
# 開発サーバー起動
npm run dev

# ブラウザで以下を確認
1. http://localhost:3000/signin でログイン
2. ダッシュボードが正常表示
3. プロファイル編集が可能
4. 保存・読み込みが正常
```

### 2. 新規ユーザーでのテスト
```bash
1. 新規アカウント作成
2. プロファイル作成
3. 編集・保存
4. ログアウト・ログイン後の表示確認
```

### 3. データ移行テスト（該当する場合）
```bash
1. 移行前のデータバックアップ
2. 移行スクリプト実行
3. データ整合性確認
4. ロールバックテスト
```

## フィーチャーフラグ実装例

```typescript
// 環境変数で制御
const ENABLE_PROFILE_MIGRATION = process.env.NEXT_PUBLIC_ENABLE_PROFILE_MIGRATION === 'true';

if (ENABLE_PROFILE_MIGRATION && await needsMigration(userId)) {
  await migrateUserProfile(userId);
}
```

## エラー監視

### Sentryまたは同等のエラー監視ツール導入
```typescript
try {
  // 危険な操作
} catch (error) {
  console.error('Critical error:', error);
  // Sentryに送信
  Sentry.captureException(error);
  // ユーザーにフォールバック表示
}
```

## デプロイ戦略

### 段階的リリース
1. **Stage 1**: 開発環境でテスト（1日）
2. **Stage 2**: 社内ユーザーのみ有効化（2日）
3. **Stage 3**: 5%のユーザーに展開（3日）
4. **Stage 4**: 全ユーザーに展開

## 責任者チェック

- [ ] 実装者がローカルテスト完了
- [ ] レビュアーがコードレビュー完了
- [ ] QAチームがステージング環境でテスト完了
- [ ] プロダクトマネージャーが最終承認

---

**このチェックリストは全ての破壊的変更において必須です。**
**スキップは許可されません。**