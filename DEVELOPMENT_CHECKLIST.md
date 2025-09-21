# 📋 TapForge 開発チェックリスト

**最終更新**: 2025年9月21日
**対象**: すべての開発者・コーディングエージェント

## 🎯 このドキュメントの目的

新機能開発や既存機能の修正時に必ず確認すべき項目をリスト化しています。
すべてのチェック項目をクリアしてからコードをコミットしてください。

## ✅ 新機能実装前チェックリスト

### 1. 📖 ドキュメント確認

- [ ] [CLAUDE.md](./CLAUDE.md)を読んだ
- [ ] [特許リスク回避開発ガイドライン](./特許リスク回避開発ガイドライン.md)を確認した
- [ ] [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md)で優先順位を確認した
- [ ] 実装予定の機能が特許リスクに該当しないか確認した

### 2. 🚨 特許リスク確認

以下の機能を実装しようとしていませんか？

- [ ] NFCカードとクラウドの動的データ連携 → ❌ 実装禁止
- [ ] カメラロールの自動監視によるOCR → ❌ 実装禁止
- [ ] メール転送による自動データ取り込み → ❌ 実装禁止
- [ ] 企業向けB2B機能 → ❌ 実装禁止

### 3. 🎨 設計確認

- [ ] モバイルファーストで設計されているか
- [ ] 既存のコンポーネントを再利用できないか検討した
- [ ] shadcn/uiコンポーネントを活用しているか
- [ ] TypeScriptの型定義を適切に行っているか

## 🔧 実装中のチェックリスト

### 1. コーディング規約

```typescript
// ✅ 良い例: 型定義を明確に
interface UserProfile {
  id: string;
  name: string;
  email: string;
}

// ❌ 悪い例: any型の使用
const data: any = fetchData();
```

### 2. エラーハンドリング

```typescript
// ✅ 良い例: 適切なエラーハンドリング
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  console.error('Operation failed:', error);
  toast({
    title: "エラー",
    description: "処理に失敗しました",
    variant: "destructive"
  });
  return null;
}

// ❌ 悪い例: エラーを無視
const result = await riskyOperation(); // エラー時にクラッシュ
```

### 3. Firebase使用時の注意

```typescript
// ✅ 良い例: Firestoreのルールに従った実装
const userDoc = doc(db, 'users', userId);
const userData = await getDoc(userDoc);
if (userData.exists()) {
  // データ処理
}

// ❌ 悪い例: 権限チェックなし
const allUsers = await getDocs(collection(db, 'users')); // 全ユーザー取得は避ける
```

### 4. パフォーマンス考慮

- [ ] 不要な再レンダリングを避けているか（React.memo, useMemo, useCallback）
- [ ] 画像は最適化されているか（next/image使用）
- [ ] 大きなバンドルサイズを避けているか
- [ ] 遅延ロード（dynamic import）を適切に使用しているか

## 🧪 テスト・検証チェックリスト

### 1. 基本テスト

- [ ] `npm run dev`でエラーなく起動する
- [ ] `npm run build`が成功する
- [ ] `npm run lint`でエラーがない
- [ ] `npm run type-check`でエラーがない

### 2. ユーザーフローテスト

#### 既存ユーザーでのテスト
```bash
# 開発サーバー起動
npm run dev

# ブラウザで以下を確認
1. http://localhost:3000/signin でログイン
2. ダッシュボードが正常表示
3. プロファイル編集が可能
4. 保存・読み込みが正常
```

#### 新規ユーザーでのテスト
```bash
1. 新規アカウント作成
2. プロファイル作成
3. 編集・保存
4. ログアウト・ログイン後の表示確認
```

### 3. ブラウザ互換性テスト

- [ ] Chrome（最新版）で動作確認
- [ ] Safari（最新版）で動作確認
- [ ] Firefox（最新版）で動作確認
- [ ] Edge（最新版）で動作確認

### 4. レスポンシブテスト

- [ ] iPhone 12以降で正常に表示
- [ ] Android 10以降で正常に表示
- [ ] タブレット（iPad）で正常に表示
- [ ] デスクトップで正常に表示

### 5. アクセシビリティ

- [ ] キーボードナビゲーションが可能
- [ ] スクリーンリーダー対応（適切なaria-label）
- [ ] コントラスト比が十分（WCAG AA準拠）
- [ ] フォーカス状態が明確

## 🚨 破壊的変更時の必須確認事項

### データ構造変更時
- [ ] 既存データとの後方互換性を確保
- [ ] マイグレーションをフィーチャーフラグで制御
- [ ] ロールバック手順を文書化
- [ ] 本番データのコピーでテスト実施

### データ移行テスト（該当する場合）
```bash
1. 移行前のデータバックアップ
2. 移行スクリプト実行
3. データ整合性確認
4. ロールバックテスト
```

### フィーチャーフラグ実装例
```typescript
// 環境変数で制御
const ENABLE_PROFILE_MIGRATION = process.env.NEXT_PUBLIC_ENABLE_PROFILE_MIGRATION === 'true';

if (ENABLE_PROFILE_MIGRATION && await needsMigration(userId)) {
  await migrateUserProfile(userId);
}
```

## 📝 コードレビュー前チェックリスト

### 1. コード品質

- [ ] 不要なconsole.logを削除した
- [ ] コメントは適切で過不足ない
- [ ] 変数名・関数名が分かりやすい
- [ ] 重複コードがない（DRY原則）
- [ ] 複雑な処理には説明コメントがある

### 2. セキュリティ

- [ ] APIキーや秘密情報をハードコードしていない
- [ ] ユーザー入力を適切にサニタイズしている
- [ ] SQLインジェクション対策済み（Firestoreは基本的に安全）
- [ ] XSS対策済み（Reactは基本的に安全）
- [ ] CSRF対策済み（必要な場合）

### 3. Firebase特有の考慮事項

- [ ] Firestoreのセキュリティルールが適切
- [ ] ストレージのセキュリティルールが適切
- [ ] 読み取り/書き込み回数を最小化している
- [ ] リアルタイムリスナーを適切にクリーンアップしている

```typescript
// ✅ 良い例: クリーンアップ処理
useEffect(() => {
  const unsubscribe = onSnapshot(doc(db, 'users', userId), (doc) => {
    // データ処理
  });

  return () => unsubscribe(); // クリーンアップ
}, [userId]);
```

## 🚀 デプロイ前チェックリスト

### 1. 最終確認

- [ ] すべての機能が本番環境で動作することを確認
- [ ] 環境変数が正しく設定されている
- [ ] エラー監視（Sentryなど）が設定されている
- [ ] アナリティクスが正しく動作している

### 2. ドキュメント更新

- [ ] READMEに新機能の説明を追加した
- [ ] CLAUDE.mdを必要に応じて更新した
- [ ] CHANGELOGを更新した（該当する場合）
- [ ] APIドキュメントを更新した（該当する場合）

### 3. パフォーマンス目標

- [ ] Lighthouse スコア > 90
- [ ] 初期ロード時間 < 2秒
- [ ] Time to Interactive < 3秒
- [ ] Cumulative Layout Shift < 0.1

### 4. デプロイ戦略

#### 段階的リリース
1. **Stage 1**: 開発環境でテスト（1日）
2. **Stage 2**: 社内ユーザーのみ有効化（2日）
3. **Stage 3**: 5%のユーザーに展開（3日）
4. **Stage 4**: 全ユーザーに展開

## 🔍 エラー監視

### Sentryまたは同等のエラー監視ツール導入
```typescript
try {
  // 危険な操作
} catch (error) {
  console.error('Critical error:', error);
  // Sentryに送信
  if (typeof window !== 'undefined' && window.Sentry) {
    window.Sentry.captureException(error);
  }
  // ユーザーにフォールバック表示
}
```

## ✔️ 責任者チェック

- [ ] 実装者がローカルテスト完了
- [ ] レビュアーがコードレビュー完了
- [ ] QAチームがステージング環境でテスト完了（該当する場合）
- [ ] プロダクトマネージャーが最終承認

## 🎓 学習リソース

### 必読ドキュメント

1. [Next.js公式ドキュメント](https://nextjs.org/docs)
2. [Firebase公式ドキュメント](https://firebase.google.com/docs)
3. [TypeScript公式ドキュメント](https://www.typescriptlang.org/docs/)
4. [React公式ドキュメント](https://react.dev)
5. [shadcn/ui](https://ui.shadcn.com)

### プロジェクト固有のドキュメント

- [CLAUDE.md](./CLAUDE.md) - プロジェクトガイドライン
- [特許リスク評価レポート](./特許リスク評価レポート_TapForge_20250921.md)
- [特許リスク回避開発ガイドライン](./特許リスク回避開発ガイドライン.md)
- [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)

## 🆘 困ったときは

1. **技術的な質問**: チームのSlackチャンネルで質問
2. **特許リスクの懸念**: 法務担当に相談
3. **設計の相談**: テックリードにレビュー依頼
4. **緊急の問題**: プロダクトマネージャーにエスカレーション

## 📊 チェックリスト利用履歴

```markdown
### 利用履歴
- 2025-09-21: 初版作成・包括的チェックリストに更新
- [日付]: [開発者名] - [機能名]の実装時に使用
```

---

**⚠️ 重要**: このチェックリストは全ての開発において必須です。スキップは許可されません。

**📝 注記**: このチェックリストは生きたドキュメントです。改善案があれば積極的に提案してください。

**配布先**: 開発チーム全員、コーディングエージェント
**更新頻度**: 月次レビュー