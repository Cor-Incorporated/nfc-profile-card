import { PLAN_LIMITS, type UserPlan } from "@/lib/constants/plans";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export interface ScanQuota {
  used: number; // 今月の使用数
  limit: number; // 上限（無料:10、Pro:無制限）
  daysRemaining: number; // 月末まで
  resetDate: Date; // 次回リセット日
  plan: UserPlan; // ユーザーのプラン
}

// 月初めの日付を取得
function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// 月末の日付を取得
function getMonthEnd(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
}

// 月末までの残り日数を計算
function getDaysRemaining(): number {
  const now = new Date();
  const monthEnd = getMonthEnd();
  const diffTime = Math.abs(monthEnd.getTime() - now.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// 今月のスキャン数を取得（Admin SDK版）
export async function getMonthlyScansCount(userId: string): Promise<number> {
  try {
    console.log("[scanQuotaService.server] Getting monthly scans count for user:", userId);
    const monthStart = getMonthStart();
    console.log("[scanQuotaService.server] Month start:", monthStart);

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

// ユーザーのプラン情報を取得（Admin SDK版）
async function getUserPlan(userId: string): Promise<UserPlan> {
  try {
    console.log("[scanQuotaService.server] Getting user plan for:", userId);
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      const userData = userSnap.data();
      const plan = userData?.plan || "free";
      console.log("[scanQuotaService.server] User plan:", plan);
      return plan;
    }

    console.log("[scanQuotaService.server] User document not found, defaulting to free");
    return "free";
  } catch (error) {
    console.error("[scanQuotaService.server] Error fetching user plan:", error);
    throw error;
  }
}

// スキャン上限を取得
async function getScanLimit(userId: string): Promise<number> {
  const plan = await getUserPlan(userId);
  return PLAN_LIMITS[plan].scansPerMonth;
}

// スキャン上限情報を取得（Admin SDK版）
export async function getScanQuota(userId: string): Promise<ScanQuota> {
  const plan = await getUserPlan(userId);
  const limit = PLAN_LIMITS[plan].scansPerMonth;

  const used = await getMonthlyScansCount(userId);
  const daysRemaining = getDaysRemaining();
  const resetDate = new Date(getMonthEnd());
  resetDate.setDate(resetDate.getDate() + 1); // 翌月1日

  return {
    used,
    limit,
    daysRemaining,
    resetDate,
    plan,
  };
}

// スキャンが可能かチェック（Admin SDK版）
export async function canScan(userId: string): Promise<boolean> {
  try {
    console.log("[scanQuotaService.server] Checking if user can scan:", userId);
    const quota = await getScanQuota(userId);
    const canPerformScan = quota.used < quota.limit;
    console.log("[scanQuotaService.server] Can scan:", canPerformScan, `(used: ${quota.used}, limit: ${quota.limit})`);
    return canPerformScan;
  } catch (error) {
    console.error("[scanQuotaService.server] Error checking if user can scan:", error);
    throw error;
  }
}

// スキャン履歴を追加（Admin SDK版・上限チェック付き）
export async function recordScan(
  userId: string,
  contactInfo: any,
): Promise<{ success: boolean; error?: string; docId?: string }> {
  console.log("[scanQuotaService.server] Recording scan for user:", userId);
  
  // 上限チェック
  const canPerformScan = await canScan(userId);
  if (!canPerformScan) {
    const quota = await getScanQuota(userId);
    console.log("[scanQuotaService.server] Scan quota exceeded");
    return {
      success: false,
      error: `今月のスキャン上限（${quota.limit}枚）に達しました。プロプランへのアップグレードをご検討ください。`,
    };
  }

  // Firestoreに保存（Admin SDK使用）
  try {
    console.log("[scanQuotaService.server] Saving business card to Firestore...");
    const businessCardsRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("businessCards");

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
      error:
        error instanceof Error ? error.message : "保存中にエラーが発生しました",
    };
  }
}


