# 🤝 TapForge Contributing Guide

TapForgeへの貢献に興味を持っていただき、ありがとうございます！

## 📋 目次

- [行動規範](#行動規範)
- [貢献の方法](#貢献の方法)
- [開発環境のセットアップ](#開発環境のセットアップ)
- [開発ワークフロー](#開発ワークフロー)
- [コーディング規約](#コーディング規約)
- [プルリクエストのガイドライン](#プルリクエストのガイドライン)
- [イシューの報告](#イシューの報告)
- [コミュニティ](#コミュニティ)

## 🌟 行動規範

- **敬意を持つ**: すべての貢献者に対して敬意を持って接しましょう
- **建設的である**: フィードバックは具体的で建設的なものにしましょう
- **包括的である**: 多様な視点と経験を歓迎します
- **プロフェッショナル**: 職業的な態度を保ちましょう

## 🚀 貢献の方法

### 1. バグ報告

バグを発見した場合は、[Issues](https://github.com/your-username/nfc-profile-card/issues)から報告してください。

### 2. 機能提案

新機能のアイデアがある場合は、まずIssueを作成して議論しましょう。

### 3. ドキュメント改善

誤字脱字の修正から、新しい使用例の追加まで、どんな改善も歓迎です。

### 4. コード貢献

バグ修正や新機能の実装を行う場合は、以下のガイドラインに従ってください。

## 🛠️ 開発環境のセットアップ

### 前提条件

- Node.js 18.0以上
- npm 8.0以上
- Firebaseアカウント
- Git

### セットアップ手順

1. **リポジトリをフォーク**

   ```bash
   # GitHubでフォークボタンをクリック
   ```

2. **ローカルにクローン**

   ```bash
   git clone https://github.com/YOUR_USERNAME/nfc-profile-card.git
   cd nfc-profile-card
   ```

3. **上流リポジトリを追加**

   ```bash
   git remote add upstream https://github.com/original-owner/nfc-profile-card.git
   ```

4. **依存関係をインストール**

   ```bash
   npm install
   ```

5. **環境変数を設定**

   ```bash
   cp .env.example .env.local
   # .env.localを編集して必要な値を設定
   ```

6. **開発サーバーを起動**
   ```bash
   npm run dev
   ```

## 💻 開発ワークフロー

### 1. ブランチを作成

```bash
# 最新のmainを取得
git checkout main
git pull upstream main

# 新しいブランチを作成
git checkout -b feature/your-feature-name
# または
git checkout -b fix/bug-description
```

### ブランチ命名規則

- `feature/` - 新機能
- `fix/` - バグ修正
- `docs/` - ドキュメント更新
- `refactor/` - リファクタリング
- `test/` - テスト追加・修正
- `chore/` - その他の変更

### 2. 開発前の確認

**⚠️ 重要: 特許リスクの確認**

開発を始める前に、以下のドキュメントを必ず確認してください：

- [CLAUDE.md](./CLAUDE.md) - プロジェクトガイドライン
- [特許リスク回避開発ガイドライン](./特許リスク回避開発ガイドライン.md)
- [DEVELOPMENT_CHECKLIST.md](./DEVELOPMENT_CHECKLIST.md)

**実装してはいけない機能:**

- ❌ NFCカードとクラウドの動的データ連携
- ❌ カメラロールの自動監視によるOCR
- ❌ メール転送による自動データ取り込み
- ❌ 企業向けB2B機能

### 3. コードを書く

```bash
# 開発
npm run dev

# 型チェック
npm run type-check

# リント
npm run lint

# ビルド
npm run build
```

### 4. コミット

```bash
# 変更をステージング
git add .

# コミット（コミットメッセージの規約に従う）
git commit -m "feat: add user profile export feature"
```

### コミットメッセージ規約

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type:**

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント変更
- `style`: コードスタイルの変更（機能に影響しない）
- `refactor`: リファクタリング
- `test`: テストの追加・修正
- `chore`: ビルドプロセスやツールの変更

**例:**

```
feat(profile): add VCard export functionality

- Implement VCard 3.0 compliant export
- Add download button to profile page
- Support Japanese phone number format

Closes #123
```

### 5. プッシュとプルリクエスト

```bash
# フォークにプッシュ
git push origin feature/your-feature-name

# GitHubでプルリクエストを作成
```

## 📏 コーディング規約

### TypeScript/JavaScript

```typescript
// ✅ 良い例
interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

async function fetchUserProfile(userId: string): Promise<UserProfile> {
  try {
    const response = await api.getUser(userId);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch user:", error);
    throw error;
  }
}

// ❌ 悪い例
async function getUser(id) {
  const data = await api.getUser(id);
  return data;
}
```

### React/Next.js

```tsx
// ✅ 良い例
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}

export function Button({
  onClick,
  children,
  variant = "primary",
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn("btn", variant)}
      aria-label={typeof children === "string" ? children : undefined}
    >
      {children}
    </button>
  );
}

// ❌ 悪い例
export function Button(props) {
  return <button onClick={props.onClick}>{props.children}</button>;
}
```

### CSS/Tailwind

```tsx
// ✅ 良い例: Tailwindクラスを使用
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  {/* content */}
</div>

// ❌ 悪い例: インラインスタイル
<div style={{ display: 'flex', padding: '16px' }}>
  {/* content */}
</div>
```

## 🔍 プルリクエストのガイドライン

### PRテンプレート

```markdown
## 概要

この変更の目的と内容を簡潔に説明してください。

## 変更内容

- [ ] 機能A を実装
- [ ] バグB を修正
- [ ] ドキュメントC を更新

## テスト

- [ ] ローカルでテスト済み
- [ ] 新しいテストを追加
- [ ] すべてのテストがパス

## スクリーンショット（UIの変更がある場合）

変更前後のスクリーンショットを添付

## チェックリスト

- [ ] [DEVELOPMENT_CHECKLIST.md](./DEVELOPMENT_CHECKLIST.md)の項目を確認
- [ ] コードがプロジェクトのスタイルガイドに従っている
- [ ] セルフレビューを実施
- [ ] コメントを追加（特に複雑な部分）
- [ ] ドキュメントを更新
- [ ] 破壊的変更がない（ある場合は説明を追加）

## 関連Issue

Closes #(issue番号)
```

### PRレビュープロセス

1. **自動チェック**: CI/CDが自動的に実行されます
2. **コードレビュー**: メンテナーがコードをレビューします
3. **フィードバック**: 必要に応じて修正をお願いします
4. **マージ**: 承認後、メンテナーがマージします

## 🐛 イシューの報告

### バグ報告テンプレート

```markdown
## バグの概要

バグの簡潔な説明

## 再現手順

1. '...'に移動
2. '...'をクリック
3. '...'までスクロール
4. エラーが表示される

## 期待される動作

本来どうなるべきか

## 実際の動作

実際に何が起きたか

## スクリーンショット

可能であればスクリーンショットを添付

## 環境

- OS: [例: iOS 15.0]
- ブラウザ: [例: Chrome 100]
- バージョン: [例: v1.0.0]

## 追加情報

問題解決に役立つその他の情報
```

### 機能リクエストテンプレート

```markdown
## 機能の概要

提案する機能の簡潔な説明

## 動機と背景

なぜこの機能が必要か

## 詳細な説明

機能がどのように動作すべきか

## 代替案

検討した他の解決策

## 追加情報

実装に役立つリンクや参考資料
```

## 🌐 コミュニティ

### 質問と議論

- [GitHub Discussions](https://github.com/your-username/nfc-profile-card/discussions)
- [Discord Server](https://discord.gg/your-invite)

### 連絡先

- メンテナー: @your-username
- Email: contact@tapforge.app

## 📜 ライセンス

貢献していただいたコードは、プロジェクトと同じライセンス（MIT）の下で公開されます。

## 🙏 謝辞

すべての貢献者の皆様に感謝します！

### コントリビューター

<!-- ALL-CONTRIBUTORS-LIST:START -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

---

**質問がある場合は、遠慮なくIssueやDiscussionsで聞いてください！**

**Happy Coding! 🚀**
