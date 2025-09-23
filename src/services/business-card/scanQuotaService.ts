import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ScanQuota {
  used: number; // 今月の使用数
  limit: number; // 上限（無料:50、Pro:無制限）
  daysRemaining: number; // 月末まで
  resetDate: Date; // 次回リセット日
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

// 今月のスキャン数を取得
export async function getMonthlyScansCount(userId: string): Promise<number> {
  const monthStart = getMonthStart();
  const monthStartTimestamp = Timestamp.fromDate(monthStart);

  const businessCardsRef = collection(db, "users", userId, "businessCards");
  const q = query(
    businessCardsRef,
    where("scannedAt", ">=", monthStartTimestamp),
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}

// ユーザーのプラン情報を取得（将来的に実装）
async function getUserPlan(userId: string): Promise<"free" | "pro" | "team"> {
  // TODO: ユーザーのサブスクリプション情報を取得
  // 現在は全員無料プランとして扱う
  return "free";
}

// スキャン上限を取得
async function getScanLimit(userId: string): Promise<number> {
  const plan = await getUserPlan(userId);
  switch (plan) {
    case "pro":
    case "team":
      return 999999; // 実質無制限
    case "free":
    default:
      return 50;
  }
}

// スキャン上限情報を取得
export async function getScanQuota(userId: string): Promise<ScanQuota> {
  const used = await getMonthlyScansCount(userId);
  const limit = await getScanLimit(userId);
  const daysRemaining = getDaysRemaining();
  const resetDate = new Date(getMonthEnd());
  resetDate.setDate(resetDate.getDate() + 1); // 翌月1日

  return {
    used,
    limit,
    daysRemaining,
    resetDate,
  };
}

// スキャンが可能かチェック
export async function canScan(userId: string): Promise<boolean> {
  const quota = await getScanQuota(userId);
  return quota.used < quota.limit;
}

// スキャン履歴を追加（上限チェック付き）
export async function recordScan(
  userId: string,
  contactInfo: any,
): Promise<{ success: boolean; error?: string; docId?: string }> {
  // 上限チェック
  const canPerformScan = await canScan(userId);
  if (!canPerformScan) {
    const quota = await getScanQuota(userId);
    return {
      success: false,
      error: `今月のスキャン上限（${quota.limit}枚）に達しました。プロプランへのアップグレードをご検討ください。`,
    };
  }

  // Firestoreに保存
  try {
    const { addDoc, serverTimestamp } = await import("firebase/firestore");
    const businessCardsRef = collection(db, "users", userId, "businessCards");
    const docRef = await addDoc(businessCardsRef, {
      contactInfo,
      scannedAt: serverTimestamp(),
      userId,
    });

    return {
      success: true,
      docId: docRef.id,
    };
  } catch (error) {
    console.error("Error saving business card:", error);
    return {
      success: false,
      error: "保存中にエラーが発生しました",
    };
  }
}
