# .env.localに追加する必要がある環境変数

# Clerk Webhook Secret
# Clerkダッシュボード → Webhooks → Endpoint Secretをコピー
CLERK_WEBHOOK_SECRET=

# Firebase Configuration (Public)
# Firebaseコンソール → プロジェクト設定 → 全般 → アプリ → Firebase SDK snippetからコピー
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=nfc-profile-card.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nfc-profile-card
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=nfc-profile-card.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# その他の設定
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# アプリ設定
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME="NFC Profile Card"

# NFC Card Pricing
NEXT_PUBLIC_CARD_PRICE_INITIAL=3000
NEXT_PUBLIC_CARD_PRICE_ADDITIONAL=500
