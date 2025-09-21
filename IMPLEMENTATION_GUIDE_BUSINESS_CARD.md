# 🔧 名刺スキャナー統合 - 開発チーム実装指示書

**作成日**: 2025-09-21
**優先度**: High
**推定工数**: 8-10日

## 📌 実装方針

**Option A（マイクロフロントエンド）を採用** します。理由：
- 既存の名刺スキャナーコードを最大限活用
- リスクを最小化
- 段階的なリリースが可能

## 🚀 Quick Start - 今すぐ始められるタスク

### Step 1: Gemini API統合（担当：バックエンドチーム）

#### 1.1 環境変数追加
```bash
# .env.localに追加
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

#### 1.2 API Routeの作成
```typescript
// /src/app/api/business-card/scan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { auth } from '@/lib/firebase-admin';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY! 
});

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // リクエストボディから画像データ取得
    const { imageBase64, mimeType } = await request.json();

    // Gemini APIコール（既存のロジックを流用）
    const prompt = `[既存のプロンプトをコピー]`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: prompt }
        ]
      }],
      config: {
        responseMimeType: "application/json",
      }
    });

    const contactInfo = JSON.parse(response.text.trim());
    
    // Firestoreに保存
    const docRef = await db.collection('users')
      .doc(userId)
      .collection('scannedContacts')
      .add({
        ...contactInfo,
        scannedAt: admin.firestore.FieldValue.serverTimestamp(),
        userId
      });

    return NextResponse.json({ 
      success: true, 
      contactId: docRef.id,
      data: contactInfo 
    });

  } catch (error) {
    console.error('Business card scan error:', error);
    return NextResponse.json(
      { error: 'Failed to process business card' },
      { status: 500 }
    );
  }
}
```

### Step 2: UIコンポーネント作成（担当：フロントエンドチーム）

#### 2.1 スキャンページコンポーネント
```typescript
// /src/app/dashboard/business-cards/scan/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Loader2 } from 'lucide-react';

export default function BusinessCardScanPage() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [contactData, setContactData] = useState(null);
  
  const handleImageUpload = async (file: File) => {
    setIsProcessing(true);
    
    // ファイルをBase64に変換
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result?.split(',')[1];
      
      // APIコール
      const response = await fetch('/api/business-card/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`
        },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type
        })
      });
      
      const result = await response.json();
      setContactData(result.data);
      setIsProcessing(false);
    };
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">名刺スキャン</h1>
      
      {!contactData ? (
        <div className="bg-white rounded-lg shadow p-8">
          {/* アップロード UI */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
            {isProcessing ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <p className="mt-4">名刺を解析中...</p>
              </div>
            ) : (
              <>
                <Camera className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2">名刺の写真をアップロード</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button className="mt-4" asChild>
                    <span>
                      <Upload className="mr-2 h-4 w-4" />
                      画像を選択
                    </span>
                  </Button>
                </label>
              </>
            )}
          </div>
        </div>
      ) : (
        <ContactEditForm 
          data={contactData}
          onSave={handleSave}
          onCancel={() => setContactData(null)}
        />
      )}
    </div>
  );
}
```

#### 2.2 連絡先編集フォーム（既存コードを移植）
```typescript
// /src/components/business-card/ContactEditForm.tsx
// 名刺スキャナーの ContactForm.tsx を移植・改修
```

### Step 3: データベース設計（担当：バックエンドチーム）

#### 3.1 Firestoreルール更新
```javascript
// firestore.rules に追加
match /users/{userId}/scannedContacts/{contactId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

#### 3.2 TypeScript型定義
```typescript
// /src/types/contact.ts
export interface ScannedContact {
  id?: string;
  userId: string;
  
  // 基本情報
  lastName: string;
  firstName: string;
  phoneticLastName?: string;
  phoneticFirstName?: string;
  
  // 会社情報
  company?: string;
  department?: string;
  title?: string;
  
  // 連絡先
  email?: string;
  website?: string;
  phoneNumbers: PhoneNumber[];
  addresses: Address[];
  
  // メタデータ
  scannedAt: Date;
  lastUpdated?: Date;
  imageUrl?: string;
  tags?: string[];
  notes?: string;
  
  // 連携
  linkedProfileId?: string; // NFCプロファイルとのリンク
}
```

## 📝 チェックリスト

### Week 1（9/23-9/27）

#### 月曜日（9/23）
- [ ] Gemini API キーの取得と設定
- [ ] API Route基本実装
- [ ] 型定義の作成

#### 火曜日（9/24）
- [ ] スキャンページUI実装
- [ ] 画像アップロード機能
- [ ] ローディング状態の実装

#### 水曜日（9/25）
- [ ] Gemini API統合テスト
- [ ] エラーハンドリング実装
- [ ] Firestore保存機能

#### 木曜日（9/26）
- [ ] 連絡先編集フォーム移植
- [ ] バリデーション実装
- [ ] 保存処理実装

#### 金曜日（9/27）
- [ ] 統合テスト
- [ ] バグ修正
- [ ] コードレビュー

### Week 2（9/30-10/4）
- [ ] 連絡先一覧ページ
- [ ] 検索・フィルター機能
- [ ] 詳細表示ページ
- [ ] vCardエクスポート機能

## ⚠️ 注意事項

### セキュリティ
1. **Gemini API Keyは絶対にクライアントサイドに露出させない**
2. 画像アップロードは10MB制限を実装
3. レート制限: ユーザーあたり50スキャン/日

### パフォーマンス
1. 画像は圧縮してからAPIに送信
2. スキャン結果はキャッシュする
3. 大量の連絡先に対してはページネーション実装

### UX
1. スキャン中は明確なローディング表示
2. エラー時は再試行ボタンを表示
3. 編集画面では変更箇所をハイライト

## 🧪 テスト項目

### 必須テスト
```typescript
// /src/__tests__/business-card/scan.test.ts
describe('Business Card Scanner', () => {
  it('should successfully scan a business card image', async () => {
    // テスト画像でスキャン成功を確認
  });
  
  it('should handle API errors gracefully', async () => {
    // エラーハンドリングの確認
  });
  
  it('should save contact to Firestore', async () => {
    // データベース保存の確認
  });
});
```

## 🚦 デプロイ前チェック

- [ ] 環境変数が本番環境に設定されている
- [ ] Firestoreルールがデプロイされている
- [ ] エラーログが適切に設定されている
- [ ] レート制限が機能している
- [ ] すべてのテストがPASS

## 💡 Tips & トラブルシューティング

### よくある問題と解決方法

**Q: Gemini APIがタイムアウトする**
```typescript
// タイムアウト時間を延長
const response = await fetch('/api/business-card/scan', {
  method: 'POST',
  // ...
  signal: AbortSignal.timeout(30000) // 30秒
});
```

**Q: 画像が大きすぎてエラーになる**
```typescript
// 画像を圧縮してから送信
import { compressImage } from '@/lib/image-utils';

const compressed = await compressImage(file, {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.8
});
```

**Q: 日本語の名前が正しく認識されない**
```typescript
// プロンプトを調整
const prompt = `
  特に日本語の姓名は注意深く読み取ってください。
  漢字とふりがなの両方を抽出してください。
`;
```

## 📞 サポート

質問や問題が発生した場合：
1. Slack: #dev-nfc-profile チャンネル
2. 緊急時: PdMに直接連絡
3. ドキュメント: このファイルを参照

---

**開発チームの皆さん、頑張ってください！** 💪

進捗は毎日のスタンドアップで共有してください。
ブロッカーがあれば即座に相談を！
