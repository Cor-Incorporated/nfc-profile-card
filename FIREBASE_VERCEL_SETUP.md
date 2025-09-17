# Firebase Authentication on Vercel - トラブルシューティングガイド

## 🚨 `auth/unauthorized-domain`エラーの解決方法

### 問題
Vercelでデプロイした際に「認証エラーが発生しました: Firebase: Error (auth/unauthorized-domain)」が表示される

### 原因
Firebase AuthenticationがVercelドメインからのアクセスを承認していない

## 📝 解決手順

### 1. Firebase Consoleで承認済みドメインを追加

1. [Firebase Console](https://console.firebase.google.com)にアクセス
2. プロジェクトを選択
3. **Authentication** → **Settings** → **Authorized domains**タブへ
4. 以下のドメインを追加：

```
# 本番ドメイン
nfc-profile-card-eight.vercel.app

# プレビューデプロイ用（ブランチ名が含まれる）
nfc-profile-card-git-*.vercel.app
nfc-profile-card-*.vercel.app

# カスタムドメイン（もし設定する場合）
yourdomain.com
www.yourdomain.com

# 開発環境（デフォルトで含まれているはず）
localhost
127.0.0.1
```

### 2. Vercelの環境変数を確認

Vercelダッシュボードで以下の環境変数が正しく設定されているか確認：

```env
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=nfc-profile-card.firebaseapp.com
```

⚠️ **注意**: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`は**Vercelのドメインではなく**、`[PROJECT_ID].firebaseapp.com`形式である必要があります。

### 3. 環境変数の適用範囲を確認

Vercelの環境変数設定で、各変数が以下の環境で有効になっているか確認：
- ✅ Production
- ✅ Preview
- ✅ Development

### 4. デプロイメントの再実行

変更後、Vercelで再デプロイ：
```bash
vercel --prod
```

## 🔍 デバッグ方法

ブラウザのコンソールで以下を確認：

```javascript
// 現在のドメイン
console.log('Current domain:', window.location.hostname);

// Firebase設定
console.log('Auth domain:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
```

## 📚 Firebase Consoleでの承認済みドメイン管理

### プレビューデプロイメントへの対応
Vercelのプレビューデプロイは動的にURLが生成されるため、ワイルドカードパターンを使用：

1. `nfc-profile-card-*.vercel.app`を追加することで、すべてのプレビューデプロイをカバー
2. セキュリティ上の懸念がある場合は、特定のブランチ名のみを許可

### セキュリティベストプラクティス
- 本番環境では具体的なドメイン名のみを許可
- 開発中は必要最小限のドメインのみを追加
- 不要になったドメインは削除

## ⚡ よくある問題

### 1. 変更が反映されない
- Firebase Consoleでの変更は即座に反映されるはず
- ブラウザのキャッシュをクリア（Cmd+Shift+R / Ctrl+Shift+R）
- シークレットウィンドウで確認

### 2. Googleサインインが動作しない
- ポップアップブロッカーを無効化
- サードパーティCookieを許可
- コンソールでエラーメッセージを確認

### 3. 環境変数が読み込まれない
- Vercelダッシュボードで環境変数を確認
- `NEXT_PUBLIC_`プレフィックスが付いているか確認
- デプロイメント後にページをハードリフレッシュ

## 🔗 参考リンク

- [Firebase Authentication ドキュメント](https://firebase.google.com/docs/auth/web/start)
- [Vercel 環境変数ドキュメント](https://vercel.com/docs/environment-variables)
- [Next.js 環境変数](https://nextjs.org/docs/basic-features/environment-variables)