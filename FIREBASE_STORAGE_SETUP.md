# Firebase Storage セットアップガイド

## 1. Firebase コンソールでStorageを有効化

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択
3. 左メニューから「Storage」をクリック
4. 「始める」をクリック
5. セキュリティルールはデフォルトのまま「次へ」
6. ロケーションは「us-central1」を選択して「完了」（無料枠利用のため）

## 2. CORS設定の適用

### 方法1: Google Cloud SDKを使用（推奨）

1. Google Cloud SDKをインストール

```bash
# macOS
brew install --cask google-cloud-sdk

# その他のOS
# https://cloud.google.com/sdk/docs/install を参照
```

2. 認証

```bash
gcloud auth login
```

3. プロジェクトIDを設定

```bash
gcloud config set project nfc-profile-card
```

4. CORS設定を適用

```bash
gsutil cors set cors.json gs://nfc-profile-card.firebasestorage.app
```

### 方法2: Firebase CLIを使用

1. Firebase CLIをインストール

```bash
npm install -g firebase-tools
```

2. ログイン

```bash
firebase login
```

3. プロジェクトを初期化

```bash
firebase init storage
```

4. storage.rulesをデプロイ

```bash
firebase deploy --only storage:rules
```

## 3. 環境変数の確認

`.env.local`に以下が設定されていることを確認：

```env
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=nfc-profile-card.firebasestorage.app
```

**注意**: 新しいFirebaseプロジェクトでは、バケット名が`.firebasestorage.app`形式になります。

## 4. トラブルシューティング

### CORSエラーが解決しない場合

1. CORS設定が正しく適用されているか確認：

```bash
gsutil cors get gs://nfc-profile-card.firebasestorage.app
```

2. ブラウザのキャッシュをクリア

3. より緩いCORS設定を一時的に試す：

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["*"]
  }
]
```

### アップロードが失敗する場合

1. Firebase Authenticationが正しく動作しているか確認
2. Storage セキュリティルールを確認
3. ネットワークタブでエラーレスポンスを確認

## 5. セキュリティルールの説明

`storage.rules`ファイルの内容：

- `/users/{userId}/**`: 各ユーザーのファイル
  - 読み取り: 全員可能（プロフィール画像は公開）
  - 書き込み: 本人のみ

- `/temp/**`: 一時ファイル用（開発環境）
  - 読み書き: 認証済みユーザーのみ

- `/default-user/**`: デフォルトユーザー用（開発環境）
  - 読み取り: 全員可能
  - 書き込み: 認証済みユーザーのみ

## 6. 本番環境への移行時の注意

本番環境では、セキュリティルールをより厳密に設定してください：

```javascript
// 本番環境用のセキュリティルール例
match /users/{userId}/{allPaths=**} {
  allow read: if true;
  allow write: if request.auth != null
    && request.auth.uid == userId
    && request.resource.size < 5 * 1024 * 1024 // 5MB制限
    && request.resource.contentType.matches('image/.*'); // 画像のみ
}
```
