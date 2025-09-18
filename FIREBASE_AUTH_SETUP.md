# Firebase認証設定ガイド

## 重要: Firebase Consoleでの設定確認

Firebase認証が正常に動作するには、Firebase ConsoleとGoogle Cloud Consoleでの適切な設定が必要です。

## 1. Firebase Console設定

### 認証プロバイダの有効化

1. [Firebase Console](https://console.firebase.google.com)にアクセス
2. プロジェクト「nfc-profile-card」を選択
3. Authentication > Sign-in methodに移動
4. 以下のプロバイダを有効化：
   - メール/パスワード認証
   - Google認証

### 承認済みドメインの追加

1. Authentication > Settings > Authorized domainsに移動
2. 以下のドメインが追加されていることを確認：
   - `localhost`
   - `nfc-profile-card.firebaseapp.com`
   - 本番ドメイン（Vercelのドメイン）

## 2. Google Cloud Console設定

### OAuth 2.0クライアントIDの確認

1. [Google Cloud Console](https://console.cloud.google.com)にアクセス
2. プロジェクトを選択
3. APIs & Services > Credentialsに移動
4. OAuth 2.0 Client IDsセクションで設定を確認
5. 承認済みのJavaScript生成元に以下を追加：
   - `http://localhost`
   - `http://localhost:3000`
   - `http://localhost:3001`
   - 本番URL

6. 承認済みのリダイレクト URIに以下を追加：
   - `http://localhost`
   - `http://localhost:3000/__/auth/handler`
   - `https://nfc-profile-card.firebaseapp.com/__/auth/handler`

## 3. 環境変数の確認

`.env.local`ファイルに以下の環境変数が正しく設定されていることを確認：

```
NEXT_PUBLIC_FIREBASE_API_KEY=<your-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=nfc-profile-card.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nfc-profile-card
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=nfc-profile-card.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID=<your-app-id>
```

## 4. よくある問題と解決方法

### "auth/configuration-not-found" エラー

- Firebase Consoleで認証プロバイダが有効になっているか確認
- プロジェクトIDが正しいか確認

### Googleサインインができない

- Google Cloud ConsoleでOAuth設定を確認
- 承認済みドメインにlocalhostが追加されているか確認

### 認証後にリダイレクトされない

- `authDomain`が`nfc-profile-card.firebaseapp.com`になっているか確認
- ブラウザのコンソールでエラーを確認

### "auth/unauthorized-domain" エラー

- Firebase Console > Authentication > Settings > Authorized domainsに現在のドメインを追加

## 5. デバッグ方法

1. ブラウザのデベロッパーツール（F12）を開く
2. Consoleタブでエラーメッセージを確認
3. Networkタブで認証関連のリクエストを確認
4. Application > Cookies/Local Storageで認証データを確認

## 6. テストアカウント

開発用にテストアカウントを作成することをお勧めします：

- メール: `test@example.com`
- パスワード: `Test123456`

## 注意事項

- Firebase認証は自動的にセッションを管理します
- ブラウザをリロードしても認証状態は保持されます
- サインアウトするまで認証は有効です
