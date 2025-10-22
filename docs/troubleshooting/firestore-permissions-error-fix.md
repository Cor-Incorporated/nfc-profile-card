# Firestore権限エラーのトラブルシューティング

**発生日時**: 2025年10月16日  
**解決日時**: 2025年10月16日  
**影響範囲**: プロフィール表示・編集、名刺スキャン機能  
**深刻度**: 🔴 Critical（全機能停止）

## 📋 目次

1. [エラーの概要](#エラーの概要)
2. [発生したエラー](#発生したエラー)
3. [問題の特定プロセス](#問題の特定プロセス)
4. [根本原因の分析](#根本原因の分析)
5. [解決方法](#解決方法)
6. [予防策と学び](#予防策と学び)
7. [参考リソース](#参考リソース)

---

## エラーの概要

### 症状

本番環境（www.tapforge.org）にて、以下の機能で`Missing or insufficient permissions`エラーが発生：

- ✗ プロフィールページの表示
- ✗ プロフィールデータの保存
- ✗ 名刺スキャン機能（OCR）
- ✗ ユーザードキュメントの作成/更新
- ✗ アナリティクストラッキング

### 影響

- **ユーザー影響**: 全ての認証済みユーザー
- **機能影響**: コア機能の完全停止
- **データ影響**: 新規データの読み書き不可

---

## 発生したエラー

### クライアント側のエラーログ

```javascript
// コンソールエラー
117-bab865bd5094514b.js:1 Error fetching user profile: 
  FirebaseError: Missing or insufficient permissions.

117-bab865bd5094514b.js:1 Error creating/updating user document: 
  FirebaseError: Missing or insufficient permissions.

117-bab865bd5094514b.js:1 Analytics tracking error: 
  FirebaseError: Missing or insufficient permissions.

117-bab865bd5094514b.js:1 [SimplePageEditor] Error saving profile: 
  FirebaseError: Missing or insufficient permissions.

// API エラー
/api/business-card/scan:1 Failed to load resource: 
  the server responded with a status of 500 ()

Server error response: {
  "success": false,
  "error": "Failed to process business card",
  "details": "Missing or insufficient permissions."
}
```

### サーバー側のエラー（推測）

```
Error checking scan quota: Missing or insufficient permissions
Error saving business card: Missing or insufficient permissions
```

---

## 問題の特定プロセス

### Phase 1: エラーの発見

**時刻**: 2025-10-16 初回報告

```javascript
// 最初に気づいたエラー
FirebaseError: Missing or insufficient permissions.
```

**初期仮説**: Firestoreセキュリティルールの設定ミス

### Phase 2: Firestoreルールの確認

**確認内容**: `firebase/firestore.rules`を調査

```javascript
// 既存のルール（問題あり）
match /users/{userId} {
  allow read: if true;
  allow create: if isOwner(userId);
  allow update: if isOwner(userId) && isValidProfile();  // ← 問題1
  
  // サブコレクションの定義が不足 ← 問題2
  match /contacts/{contactId} {
    allow read, write: if isOwner(userId);
  }
  
  match /analytics/{analyticsId} {
    allow read: if isOwner(userId);
    allow write: if false;
  }
}

function isValidProfile() {
  // profile.linksが常に存在することを前提 ← 問題3
  return request.resource.data.profile.links.size() <= 10;
}
```

**発見した問題点**:

1. ❌ `profile`サブコレクションへのアクセス権限が未定義
2. ❌ `businessCards`サブコレクションへのアクセス権限が未定義
3. ❌ `isValidProfile()`が`profile.links`の存在を前提としている

### Phase 3: アーキテクチャの確認

**データ構造**:
```
users/{userId}/
  ├── (ユーザードキュメント)
  ├── profile/
  │   └── data (プロフィールコンポーネント)  ← アクセス権限なし！
  ├── businessCards/  ← アクセス権限なし！
  │   └── {cardId} (スキャン済み名刺)
  ├── contacts/
  │   └── {contactId} (連絡先)
  └── analytics/
      └── {analyticsId} (アナリティクス)
```

### Phase 4: サーバーサイドコードの確認

**問題箇所**: `src/services/business-card/scanQuotaService.ts`

```typescript
// 問題のあるコード
import { db } from "@/lib/firebase";  // ← クライアント側SDK！

// サーバーサイドAPIから呼ばれているのに
// クライアント側のFirebase SDKを使用
export async function getMonthlyScansCount(userId: string) {
  const businessCardsRef = collection(db, "users", userId, "businessCards");
  const snapshot = await getDocs(q);  // ← 権限エラー発生
  return snapshot.size;
}
```

**根本的な問題**: 
- APIルート（サーバーサイド）からクライアント側Firebase SDKを使用
- Firebase Admin SDKを使うべき箇所で通常SDKを使用

---

## 根本原因の分析

### 原因1: Firestoreセキュリティルールの不足

**問題点**:
```javascript
// profileサブコレクションのルールが存在しない
match /users/{userId} {
  // ここにprofileサブコレクションのmatchが無い
  
  match /contacts/{contactId} { ... }
  match /analytics/{analyticsId} { ... }
}
```

**影響**:
- `users/{userId}/profile/data`への読み書きが全て拒否される
- プロフィール表示・編集機能が完全に停止

### 原因2: isValidProfile()関数の前提条件

**問題点**:
```javascript
function isValidProfile() {
  // profile.linksが存在しない場合、エラーで停止
  return request.resource.data.profile.links.size() <= 10;
}
```

**影響**:
- 認証時のユーザードキュメント更新（`profile`フィールドを含まない）が失敗
- ログイン後の基本的な情報更新が不可能

### 原因3: クライアントSDKとサーバーSDKの混在

**問題点**:
```typescript
// サーバーサイドAPIルート
export async function POST(request: NextRequest) {
  // ...
  const canPerformScan = await canScan(userId);  // ← クライアントSDK使用
}
```

**影響**:
- サーバーサイドから実行されるため、Firestoreルールの権限チェックが厳格
- Firebase Admin SDKなら管理者権限で実行されるが、クライアントSDKでは通常ユーザー権限

---

## 解決方法

### 修正1: profileサブコレクションの権限追加

**ファイル**: `firebase/firestore.rules`

```javascript
match /users/{userId} {
  allow read: if true;
  allow create: if isOwner(userId);
  allow update: if isOwner(userId) && isValidProfile();
  allow delete: if isOwner(userId);
  
  // ✅ 追加: プロフィールサブコレクション
  match /profile/{docId} {
    // 誰でも読める（公開プロフィール表示用）
    allow read: if true;
    // 本人のみ作成・更新可能
    allow write: if isOwner(userId);
  }
  
  // ✅ 追加: スキャン済み名刺サブコレクション
  match /businessCards/{cardId} {
    allow read, write: if isOwner(userId);
  }
  
  // 既存のサブコレクション
  match /contacts/{contactId} {
    allow read, write: if isOwner(userId);
  }
  
  match /analytics/{analyticsId} {
    allow read: if isOwner(userId);
    allow write: if false;
  }
}
```

**変更内容**:
- ✅ `profile`サブコレクションに公開読み取り、所有者書き込み権限を付与
- ✅ `businessCards`サブコレクションに所有者のみ読み書き権限を付与

### 修正2: isValidProfile()関数の改善

**ファイル**: `firebase/firestore.rules`

```javascript
function isValidProfile() {
  // ✅ profile.linksが存在する場合のみ検証
  return !('profile' in request.resource.data) || 
         !('links' in request.resource.data.profile) || 
         request.resource.data.profile.links.size() <= 10;
}
```

**変更内容**:
- ✅ `profile`フィールドが存在しない場合は許可
- ✅ `profile.links`が存在しない場合は許可
- ✅ `profile.links`が存在する場合のみ10個以下をチェック

**効果**:
- 認証時のユーザードキュメント更新（emailVerified, updatedAtなど）が成功
- プロフィール情報の段階的な更新が可能

### 修正3: サーバーサイドスキャンサービスの作成

**新規ファイル**: `src/services/business-card/scanQuotaService.server.ts`

```typescript
import { adminDb } from "@/lib/firebase-admin";  // ✅ Admin SDK
import { FieldValue } from "firebase-admin/firestore";

// ✅ Admin SDKを使用した実装
export async function getMonthlyScansCount(userId: string): Promise<number> {
  try {
    console.log("[scanQuotaService.server] Getting monthly scans count for user:", userId);
    const monthStart = getMonthStart();

    // ✅ Admin SDKでFirestoreにアクセス（管理者権限）
    const businessCardsRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("businessCards");

    const snapshot = await businessCardsRef
      .where("scannedAt", ">=", monthStart)
      .get();

    console.log("[scanQuotaService.server] Monthly scans count:", snapshot.size);
    return snapshot.size;
  } catch (error) {
    console.error("[scanQuotaService.server] Error getting monthly scans count:", error);
    throw error;
  }
}

export async function recordScan(
  userId: string,
  contactInfo: any,
): Promise<{ success: boolean; error?: string; docId?: string }> {
  console.log("[scanQuotaService.server] Recording scan for user:", userId);
  
  const canPerformScan = await canScan(userId);
  if (!canPerformScan) {
    const quota = await getScanQuota(userId);
    console.log("[scanQuotaService.server] Scan quota exceeded");
    return {
      success: false,
      error: `今月のスキャン上限（${quota.limit}枚）に達しました。`,
    };
  }

  try {
    console.log("[scanQuotaService.server] Saving business card to Firestore...");
    const businessCardsRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("businessCards");

    // ✅ Admin SDKで保存（権限チェックなし）
    const docRef = await businessCardsRef.add({
      contactInfo,
      scannedAt: FieldValue.serverTimestamp(),
      userId,
    });

    console.log("[scanQuotaService.server] Business card saved successfully, docId:", docRef.id);
    return {
      success: true,
      docId: docRef.id,
    };
  } catch (error) {
    console.error("[scanQuotaService.server] Error saving business card:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "保存中にエラーが発生しました",
    };
  }
}
```

**変更内容**:
- ✅ Firebase Admin SDKを使用（`firebase-admin/firestore`）
- ✅ 管理者権限でFirestoreにアクセス（セキュリティルールをバイパス）
- ✅ 詳細なデバッグログの追加
- ✅ エラーハンドリングの改善

### 修正4: APIルートの更新

**ファイル**: `src/app/api/business-card/scan/route.ts`

```typescript
// ✅ サーバーサイドサービスをインポート
import { canScan, recordScan } from "@/services/business-card/scanQuotaService.server";

export async function POST(request: NextRequest) {
  // ...
  
  // ✅ Quota チェックにtry-catchを追加
  try {
    const canPerformScan = await canScan(userId);
    if (!canPerformScan) {
      console.error("❌ Monthly scan limit exceeded");
      return NextResponse.json(errorResponse, { status: 429 });
    }
    console.log("✅ Scan quota check passed");
  } catch (quotaError) {
    console.error("❌ Error checking scan quota:", quotaError);
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: ERROR_MESSAGES.IMAGE_PROCESSING_FAILED,
      details: quotaError instanceof Error ? quotaError.message : "Quota check failed",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
  
  // ...
}
```

**変更内容**:
- ✅ クライアントSDK版から.server版に切り替え
- ✅ エラーハンドリングの追加
- ✅ デバッグログの追加

### 修正5: Firebase Admin SDKの初期化ログ追加

**ファイル**: `src/lib/firebase-admin.ts`

```typescript
// Initialize Firebase Admin
if (!getApps().length) {
  try {
    if (
      process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL
    ) {
      console.log("[firebase-admin] Initializing with environment variables");
      const serviceAccount = {
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "nfc-profile-card",
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
      };

      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("[firebase-admin] Initialized successfully with environment variables");
    } else if (process.env.NODE_ENV === "development") {
      // ...
    }
  } catch (error) {
    console.error("[firebase-admin] Failed to initialize:", error);
    throw error;
  }
} else {
  console.log("[firebase-admin] Already initialized");
}
```

**変更内容**:
- ✅ 初期化ログの追加
- ✅ 成功/失敗の明確な表示
- ✅ デバッグの容易化

### デプロイ手順

```bash
# 1. Firestoreルールのデプロイ
firebase deploy --only firestore:rules

# 2. コードの変更をコミット
git add firebase/firestore.rules \
        src/app/api/business-card/scan/route.ts \
        src/services/business-card/scanQuotaService.server.ts \
        src/lib/firebase-admin.ts

git commit -m "fix: Firestoreセキュリティルールとサーバーサイドスキャンサービスの追加"

# 3. devブランチにプッシュ
git push origin dev

# 4. mainブランチへのPR作成
gh pr create --base main --head dev \
  --title "fix: Firestoreセキュリティルールとサーバーサイドスキャンサービスの追加"

# 5. PRをマージしてProductionにデプロイ
gh pr merge <PR番号> --squash
```

---

## 予防策と学び

### 1. セキュリティルールの設計原則

**チェックリスト**:
- [ ] すべてのサブコレクションに明示的なルールを定義
- [ ] 検証関数でフィールドの存在確認を行う
- [ ] 公開データと非公開データを明確に区別
- [ ] テストケースでルールを検証

**推奨ルールテンプレート**:
```javascript
match /users/{userId} {
  // ベースドキュメント
  allow read: if true;  // 公開プロフィール用
  allow create: if isOwner(userId);
  allow update: if isOwner(userId) && isValidUpdate();
  allow delete: if isOwner(userId);
  
  // サブコレクション（パターン別）
  
  // パターン1: 公開サブコレクション
  match /publicData/{docId} {
    allow read: if true;
    allow write: if isOwner(userId);
  }
  
  // パターン2: プライベートサブコレクション
  match /privateData/{docId} {
    allow read, write: if isOwner(userId);
  }
  
  // パターン3: 読み取り専用（Cloud Functions専用）
  match /systemData/{docId} {
    allow read: if isOwner(userId);
    allow write: if false;  // Cloud Functionsからのみ
  }
}

// 安全な検証関数
function isValidUpdate() {
  // フィールドの存在確認
  return !('restrictedField' in request.resource.data) ||
         isOwner(userId) && validateRestrictedField();
}
```

### 2. Firebase SDKの使い分け

**ルール**:

| 環境   | SDK              | 権限       | 使用箇所                   |
|--------|------------------|----------|----------------------------|
| クライアント | `firebase`       | ユーザー権限   | React コンポーネント、フック          |
| サーバー   | `firebase-admin` | 管理者権限 | API Routes、Cloud Functions |

**ファイル命名規則**:
- クライアント側: `serviceName.ts`
- サーバー側: `serviceName.server.ts`

**例**:
```
src/services/
├── business-card/
│   ├── scanQuotaService.ts        ← クライアント側
│   └── scanQuotaService.server.ts  ← サーバー側
```

### 3. デバッグログの活用

**推奨パターン**:
```typescript
// サービス関数
export async function criticalOperation(params) {
  console.log(`[serviceName] Starting operation with params:`, params);
  
  try {
    const result = await performOperation(params);
    console.log(`[serviceName] Operation succeeded:`, result);
    return result;
  } catch (error) {
    console.error(`[serviceName] Operation failed:`, error);
    throw error;
  }
}
```

**タグ形式**:
- `[firebase-admin]` - Admin SDK関連
- `[serviceName.server]` - サーバーサイドサービス
- `[ComponentName]` - Reactコンポーネント
- `[APIRoute]` - API エンドポイント

### 4. 環境変数の管理

**Vercel環境変数の確認方法**:
```bash
# 1. Vercelにログイン
vercel login

# 2. プロジェクトをリンク
vercel link

# 3. 環境変数を一覧表示
vercel env ls

# 4. 環境変数をローカルにプル（確認用）
vercel env pull .env.vercel
```

**必須環境変数**:
```bash
# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 5. テストの重要性

**推奨テストケース**:

```typescript
describe("Firestore Security Rules", () => {
  it("should allow reading public profile", async () => {
    const db = getFirestore(myAuth);
    const profileRef = doc(db, "users/testUser/profile/data");
    await expect(getDoc(profileRef)).resolves.toBeDefined();
  });

  it("should deny writing to other user's profile", async () => {
    const db = getFirestore(otherAuth);
    const profileRef = doc(db, "users/testUser/profile/data");
    await expect(setDoc(profileRef, {})).rejects.toThrow(/permission-denied/);
  });

  it("should allow owner to write profile", async () => {
    const db = getFirestore(ownerAuth);
    const profileRef = doc(db, "users/testUser/profile/data");
    await expect(setDoc(profileRef, { name: "Test" })).resolves.toBeDefined();
  });
});
```

### 6. デプロイ前チェックリスト

**Firebase関連**:
- [ ] Firestoreルールの変更を確認
- [ ] ルール変更をデプロイ (`firebase deploy --only firestore:rules`)
- [ ] ローカルでルールのテスト実行

**コード関連**:
- [ ] TypeScriptのコンパイルエラーがない
- [ ] リンターエラーがない
- [ ] 単体テストが通る
- [ ] E2Eテストが通る（該当する場合）

**環境変数関連**:
- [ ] 必要な環境変数がVercelに設定されている
- [ ] 環境変数の値が正しい
- [ ] Production/Preview/Development すべてに設定

**デプロイ関連**:
- [ ] 変更内容をdevブランチにコミット
- [ ] mainブランチへのPRを作成
- [ ] PRレビューを実施
- [ ] マージ後のProductionデプロイを確認

---

## 参考リソース

### 公式ドキュメント

- [Firebase Security Rules - Firestore](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Admin SDK - Node.js](https://firebase.google.com/docs/admin/setup)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

### 関連ファイル

- `firebase/firestore.rules` - Firestoreセキュリティルール
- `src/lib/firebase-admin.ts` - Firebase Admin SDK初期化
- `src/services/business-card/scanQuotaService.server.ts` - サーバーサイドスキャンサービス
- `src/app/api/business-card/scan/route.ts` - 名刺スキャンAPI

### トラブルシューティングコマンド

```bash
# Firestoreルールの検証
firebase deploy --only firestore:rules

# Vercel環境変数の確認
vercel env ls

# Vercelログのリアルタイム監視
vercel logs <deployment-url>

# ローカルでFirebase Emulatorを起動
firebase emulators:start
```

---

## まとめ

### 解決した問題

✅ **Firestoreセキュリティルールの不足**
- `profile`サブコレクションへのアクセス権限を追加
- `businessCards`サブコレクションへのアクセス権限を追加
- `isValidProfile()`関数の改善

✅ **クライアントSDKとサーバーSDKの混在**
- サーバーサイド用の`.server.ts`ファイルを作成
- Firebase Admin SDKを使用した実装に切り替え

✅ **デバッグログの追加**
- Admin SDK初期化ログ
- スキャンサービスのデバッグログ
- APIルートのエラーハンドリング改善

### 所要時間

- **問題発見**: 即時
- **原因特定**: 約30分
- **修正実装**: 約45分
- **テスト・デプロイ**: 約15分
- **合計**: 約90分

### 学んだこと

1. **セキュリティルールは明示的に**: すべてのサブコレクションに明示的なルールを定義する
2. **SDKの使い分けを明確に**: クライアント側とサーバー側で異なるSDKを使用
3. **検証関数は安全に**: フィールドの存在を前提としない
4. **デバッグログは重要**: 本番環境での問題特定に不可欠
5. **環境変数の確認**: デプロイ前に必ず確認

---

**作成者**: Claude (AI Assistant)  
**最終更新**: 2025年10月16日  
**ステータス**: ✅ 解決済み

