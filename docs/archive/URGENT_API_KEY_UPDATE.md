# ⚠️ 緊急更新：API Key管理の修正指示

**作成日**: 2025-09-21
**更新日**: 2025-09-21 15:30
**重要度**: High

## 📌 重要な変更点

**GEMINI_API_KEY は既にメインプロジェクトの `.env.local` に設定済みです！**

```env
# /Users/teradakousuke/Developer/nfc-profile-card/.env.local
GEMINI_API_KEY=AIzaSyD2mRqSsY-DMurxjGu8AWt7EZgmy_SzKEs
```

## 🔧 修正された実装方針

### ❌ やらないこと

- 名刺スキャナーディレクトリに別の`.env.local`を作成
- API Keyの重複管理
- 環境変数の分散

### ✅ 正しい実装方法

#### 1. API Route での環境変数の使用

```typescript
// /src/app/api/business-card/scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// メインプロジェクトの.env.localから直接取得
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!, // 既に設定済み！
});

export async function POST(request: NextRequest) {
  // 既存のAPIキーを使用してGemini APIを呼び出し
  // ...
}
```

#### 2. 名刺スキャナーコードの移植方法

**Step 1: 必要なパッケージをメインプロジェクトに追加**

```bash
cd /Users/teradakousuke/Developer/nfc-profile-card
npm install @google/genai
```

**Step 2: サービスファイルの移植**

```typescript
// /src/services/business-card/geminiService.ts
// 名刺スキャナーのgeminiService.tsをコピーして修正

import { GoogleGenAI } from "@google/genai";
import { ContactInfo } from "@/types/contact";

// ブラウザからは直接APIキーにアクセスできないので、
// API Route経由で処理する
export const extractContactInfoFromImage = async (
  base64Image: string,
  mimeType: string,
): Promise<ContactInfo> => {
  // API Routeを呼び出し
  const response = await fetch("/api/business-card/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ base64Image, mimeType }),
  });

  const result = await response.json();
  return result.data;
};
```

**Step 3: API Route側でGemini処理**

```typescript
// /src/app/api/business-card/scan/route.ts
import { GoogleGenAI } from "@google/genai";

// サーバーサイドでのみAPIキーを使用
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(request: NextRequest) {
  const { base64Image, mimeType } = await request.json();

  // 名刺スキャナーのプロンプトをそのまま使用
  const prompt = `[名刺スキャナーのプロンプト]`;

  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: [
      {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  // 結果を返す
  return NextResponse.json({
    success: true,
    data: JSON.parse(response.text.trim()),
  });
}
```

## 📁 ディレクトリ構造の整理

```
/Users/teradakousuke/Developer/nfc-profile-card/
├── .env.local                          # ← ここにGEMINI_API_KEY（既存）
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── business-card/
│   │   │       └── scan/
│   │   │           └── route.ts        # ← APIエンドポイント（新規）
│   │   └── dashboard/
│   │       └── business-cards/
│   │           ├── scan/
│   │           │   └── page.tsx        # ← スキャンUI（新規）
│   │           └── page.tsx            # ← 一覧画面（新規）
│   ├── components/
│   │   └── business-card/              # ← 名刺関連コンポーネント（新規）
│   │       ├── ImageSelector.tsx
│   │       ├── ContactForm.tsx
│   │       └── LoadingSpinner.tsx
│   └── services/
│       └── business-card/              # ← ビジネスロジック（新規）
│           ├── geminiService.ts
│           └── vcardService.ts
│
└── 名刺スキャナー-&-vcard保存/          # ← 参照用（統合後は不要）
```

## ⚠️ セキュリティ上の重要事項

### 絶対にやってはいけないこと

```typescript
// ❌ 危険：クライアントサイドでAPIキーを使用
const ai = new GoogleGenAI({
  apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY, // 絶対NG！
});
```

### 正しいアプローチ

```typescript
// ✅ 安全：サーバーサイドのみでAPIキー使用
// API Route内でのみ
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY, // NEXT_PUBLIC_なし
});
```

## 📝 開発チームへの修正タスク

### 月曜日（9/23）の作業

1. **環境確認**（10分）

   ```bash
   # APIキーが設定されているか確認
   grep "GEMINI_API_KEY" .env.local
   ```

2. **パッケージインストール**（10分）

   ```bash
   npm install @google/genai
   ```

3. **API Route作成**（1時間）
   - `/src/app/api/business-card/scan/route.ts`を作成
   - 既存のGEMINI_API_KEYを使用

4. **コンポーネント移植**（2時間）
   - 名刺スキャナーのコンポーネントをコピー
   - インポートパスを修正
   - API呼び出しをfetch経由に変更

5. **テスト**（1時間）
   - ローカルでスキャン機能をテスト
   - エラーハンドリングの確認

## 🎯 利点

この修正により：

1. **API Key管理の一元化** - セキュリティリスク減少
2. **環境変数の統一** - 設定ミスの防止
3. **デプロイの簡略化** - 環境変数は1箇所のみ
4. **コスト管理の改善** - APIキー使用量の統合管理

## 💡 Tips

### 開発時のデバッグ

```typescript
// API Route内でログ出力
console.log("GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);
console.log("API Key prefix:", process.env.GEMINI_API_KEY?.substring(0, 10));
```

### エラー処理

```typescript
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set in environment variables");
  return NextResponse.json(
    { error: "Server configuration error" },
    { status: 500 },
  );
}
```

## ✅ チェックリスト

- [ ] `.env.local`にGEMINI_API_KEYが存在することを確認
- [ ] API Route作成時、`process.env.GEMINI_API_KEY`を使用
- [ ] クライアントサイドコードにAPIキーが露出していないことを確認
- [ ] 名刺スキャナーの既存コードを参照用として保持
- [ ] デプロイ前に環境変数が本番環境に設定されているか確認

---

**重要**: この修正により、より安全で管理しやすい実装となります。
開発チームは既存のAPIキーを活用して実装を進めてください。

質問があれば Slack #dev-nfc-profile まで！
