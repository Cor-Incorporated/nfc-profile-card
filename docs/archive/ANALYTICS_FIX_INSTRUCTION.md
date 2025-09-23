# 🔧 アナリティクス機能修正 - 実装指示書

**担当**: 開発チーム
**作成日**: 2025-09-19
**優先度**: Critical（即時対応）
**推定工数**: 4-6時間

## 問題の概要

現在のアナリティクス実装には以下の重大な欠陥があります：

1. `recentViews`配列を最新10件に制限しているが、今日・今週の閲覧数もこの配列から計算している
2. 10回以上の閲覧があると、古いデータが削除され、統計が不正確になる
3. `arrayUnion`の無制限使用によるパフォーマンス問題のリスク

## 実装指示

### Phase 1: データ構造の再設計（1-2時間）

#### 新しいFirestoreデータ構造

```typescript
interface AnalyticsData {
  // 基本統計
  totalViews: number;
  lastViewedAt: Timestamp;
  
  // 日別カウンタ（新規追加）
  dailyViews: {
    [dateKey: string]: number; // "2025-09-19": 5
  };
  
  // 詳細ログ（最新10件のみ保持）
  recentViews: Array<{
    timestamp: Timestamp;
    referrer: string;
    userAgent: string;
  }>;
}
```

### Phase 2: analytics.ts の修正（2-3時間）

#### 1. trackPageView関数の修正

```typescript
export async function trackPageView(username: string) {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const userId = snapshot.docs[0].id;
      const today = new Date().toISOString().split('T')[0]; // "2025-09-19"
      
      const userDoc = await getDoc(doc(db, "users", userId));
      const currentData = userDoc.data();
      
      // 既存のrecentViewsを取得して最新10件に制限
      const currentRecentViews = currentData?.analytics?.recentViews || [];
      const newView = {
        timestamp: new Date(),
        referrer: typeof document !== 'undefined' ? document.referrer || "direct" : "direct",
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : "unknown"
      };
      
      // 最新10件のみ保持
      const updatedRecentViews = [newView, ...currentRecentViews].slice(0, 10);
      
      // 日別カウンタを更新
      await updateDoc(doc(db, "users", userId), {
        "analytics.totalViews": increment(1),
        "analytics.lastViewedAt": serverTimestamp(),
        [`analytics.dailyViews.${today}`]: increment(1),
        "analytics.recentViews": updatedRecentViews
      });
    }
  } catch (error) {
    console.error("Analytics tracking error:", error);
  }
}
```

#### 2. getAnalyticsSummary関数の修正

```typescript
export async function getAnalyticsSummary(userId: string) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    
    if (!userDoc.exists()) {
      return {
        totalViews: 0,
        lastViewedAt: null,
        todayViews: 0,
        weekViews: 0
      };
    }
    
    const data = userDoc.data();
    const analytics = data.analytics || {};
    
    // 日付の計算
    const today = new Date().toISOString().split('T')[0];
    const dates = [];
    
    // 過去7日分の日付を生成
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    // 日別カウンタから集計
    const todayViews = analytics.dailyViews?.[today] || 0;
    const weekViews = dates.reduce((sum, date) => {
      return sum + (analytics.dailyViews?.[date] || 0);
    }, 0);
    
    return {
      totalViews: analytics.totalViews || 0,
      lastViewedAt: analytics.lastViewedAt?.toDate?.() || null,
      todayViews,
      weekViews
    };
  } catch (error) {
    console.error("Analytics summary error:", error);
    return {
      totalViews: 0,
      lastViewedAt: null,
      todayViews: 0,
      weekViews: 0
    };
  }
}
```

### Phase 3: データマイグレーション（1時間）

#### migration/fixAnalytics.ts の作成

```typescript
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function migrateAnalyticsData() {
  const usersRef = collection(db, "users");
  const snapshot = await getDocs(usersRef);
  
  for (const userDoc of snapshot.docs) {
    const data = userDoc.data();
    
    if (data.analytics?.recentViews) {
      const dailyViews: Record<string, number> = {};
      
      // 既存のrecentViewsから日別カウントを生成
      data.analytics.recentViews.forEach((view: any) => {
        const date = new Date(view.timestamp).toISOString().split('T')[0];
        dailyViews[date] = (dailyViews[date] || 0) + 1;
      });
      
      await updateDoc(doc(db, "users", userDoc.id), {
        "analytics.dailyViews": dailyViews
      });
    }
  }
  
  console.log("Migration completed");
}
```

### Phase 4: クリーンアップタスク（オプション）

#### 古いデータの自動削除（30日以上前のデータ）

```typescript
export async function cleanupOldAnalytics() {
  // Cloud Functionsで定期実行
  // 30日以上前のdailyViewsエントリを削除
}
```

## テスト項目

### 必須テスト

1. **基本動作テスト**
   - [ ] 閲覧時にtotalViewsが増加する
   - [ ] 閲覧時に該当日のdailyViewsが増加する
   - [ ] todayViewsが正しく表示される
   - [ ] weekViewsが正しく集計される

2. **境界値テスト**
   - [ ] 日付が変わった時の動作
   - [ ] 10回以上の閲覧後も正しく集計される
   - [ ] 初回閲覧時の動作

3. **パフォーマンステスト**
   - [ ] 大量アクセス時のレスポンス時間
   - [ ] Firestoreの読み書き回数の確認

## デプロイ手順

1. ローカルでの動作確認
2. 開発環境でのテスト
3. 既存データのバックアップ
4. マイグレーションスクリプトの実行
5. 本番環境へのデプロイ
6. 動作確認とモニタリング

## 注意事項

- Firestoreの料金に影響するため、必要以上の読み書きは避ける
- 既存ユーザーのデータを破壊しないよう、マイグレーション前にバックアップを取る
- エラーハンドリングを適切に行い、ユーザー体験を損なわない

## 完了条件

- [ ] 全テストがPASS
- [ ] コードレビュー完了
- [ ] ドキュメント更新
- [ ] 本番環境での動作確認

---

**承認**: PdM
**質問・相談**: Slackの#dev-nfc-profileチャンネルまで
