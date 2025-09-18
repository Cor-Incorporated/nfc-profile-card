# Firebase セットアップガイド

## 📝 概要

このドキュメントでは、NFC Profile CardアプリケーションでFirebase Authenticationを設定する手順を説明します。

現在発生しているエラー `auth/configuration-not-found` は、Firebaseプロジェクトが正しく設定されていないことを示しています。

## 🚀 セットアップ手順

### 1. Firebaseプロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを作成」をクリック
3. プロジェクト名を `nfc-profile-card` に設定
4. Google アナリティクスは任意（推奨：有効）
5. プロジェクトを作成

### 2. Firebase Authenticationの設定

#### メール/パスワード認証の有効化

1. Firebase Console → Authentication → Sign-in method
2. 「メール/パスワード」を選択
3. 「有効にする」をオン
4. 「保存」をクリック

#### Google認証の有効化

1. Firebase Console → Authentication → Sign-in method
2. 「Google」を選択
3. 「有効にする」をオン
4. プロジェクトのサポートメールを設定
5. 「保存」をクリック

### 3. Firebaseウェブアプリの追加

1. Firebase Console → プロジェクトの概要 → ⚙️ → プロジェクトの設定
2. 「アプリを追加」→ ウェブアイコンを選択
3. アプリ名を `NFC Profile Card Web` に設定
4. 「Firebase Hosting」はスキップ（Vercelを使用するため）
5. 「アプリを登録」をクリック

### 4. Firebase設定の取得

登録後に表示される設定をコピー：

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "nfc-profile-card.firebaseapp.com",
  projectId: "nfc-profile-card",
  storageBucket: "nfc-profile-card.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef...",
};
```

### 5. 環境変数の設定

プロジェクトルートに `.env.local` ファイルを作成し、以下の内容を設定：

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=nfc-profile-card.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nfc-profile-card
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=nfc-profile-card.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Google Gemini API (OCR機能用)
GEMINI_API_KEY=your_gemini_api_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME="NFC Profile Card"
```

### 6. Firestore Databaseの有効化（重要！）

⚠️ **データベースは必須です！** ユーザー情報、プロフィール、SNSリンク、名刺データの保存に必要です。

1. Firebase Console → Firestore Database
2. 「データベースを作成」をクリック
3. セキュリティルール：「本番環境モード」を選択
4. ロケーション：`asia-northeast1` (東京) を選択
5. 「有効にする」をクリック

**データベースに保存されるデータ:**

- ユーザープロフィール（名前、会社、役職、自己紹介等）
- SNSリンク（最大10個まで）
- スキャンした名刺データ
- NFCカード情報
- アナリティクスデータ

### 7. Firestoreセキュリティルールの設定

Firebase Console → Firestore Database → ルール で以下を設定：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザーは自分のドキュメントのみ読み書き可能
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // 連絡先サブコレクション
      match /contacts/{contactId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // アナリティクスサブコレクション
      match /analytics/{analyticsId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if false; // サーバーサイドのみ書き込み可能
      }
    }

    // 公開プロフィールは誰でも読み取り可能
    match /users/{userId} {
      allow read: if resource.data.public == true;
    }
  }
}
```

## 🔧 Firebase Admin SDK Setup (オプション)

### Important: Service Account Security

The Firebase service account JSON file contains sensitive credentials and should **NEVER** be committed to version control.

### Setup Instructions

1. **Store the service account file securely**
   - Keep the service account JSON file in a secure location outside the repository
   - Or store it locally but ensure it's in .gitignore

2. **For local development**
   - Place the service account file in the project root
   - The file is already added to .gitignore to prevent accidental commits

3. **For production deployment (Vercel)**
   - Convert the service account JSON to a base64 string:
     ```bash
     base64 -i service-account.json | tr -d '\n'
     ```
   - Add the base64 string as an environment variable in Vercel:
     - Variable name: `FIREBASE_ADMIN_SDK_BASE64`
   - In your application code, decode it:
     ```javascript
     const serviceAccount = JSON.parse(
       Buffer.from(process.env.FIREBASE_ADMIN_SDK_BASE64, "base64").toString(),
     );
     ```

4. **Alternative: Use individual environment variables**
   - Extract key values from the JSON and store them separately:
     - `FIREBASE_PROJECT_ID`
     - `FIREBASE_PRIVATE_KEY`
     - `FIREBASE_CLIENT_EMAIL`
   - Reference these in your Firebase admin initialization

## 🔍 トラブルシューティング

### "auth/configuration-not-found" エラー

このエラーは以下の原因で発生します：

1. **Firebase プロジェクトが存在しない**
   - Firebase Consoleでプロジェクトを作成してください

2. **環境変数が設定されていない**
   - `.env.local` ファイルを確認してください
   - すべての `NEXT_PUBLIC_FIREBASE_*` 変数が設定されているか確認

3. **APIキーが無効**
   - Firebase Console → プロジェクトの設定 → 全般 から正しいAPIキーをコピー

4. **認証プロバイダーが有効化されていない**
   - Firebase Console → Authentication → Sign-in method で必要なプロバイダーを有効化

### 開発サーバーの再起動

環境変数を変更した後は、必ず開発サーバーを再起動してください：

```bash
# Ctrl+C で停止後
npm run dev
```

## ✅ 動作確認

1. http://localhost:3000/signin にアクセス
2. 以下の認証方法をテスト：
   - メール/パスワードでアカウント作成
   - メール/パスワードでログイン
   - Googleでログイン

## 🔒 Security Best Practices

- Never commit service account files to Git
- Rotate service account keys periodically
- Use least-privilege access for service accounts
- Monitor service account usage in Firebase Console

## 📚 参考リンク

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
