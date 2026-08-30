import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const USER_BUDGET_COLLECTION = "geminiFallbackBudgets";
const GLOBAL_BUDGET_COLLECTION = "geminiFallbackGlobalBudgets";

export type GeminiBudgetDenialReason =
  | "disabled"
  | "user_monthly_cap"
  | "global_daily_cap";

export type GeminiBudgetReservation =
  | {
      allowed: true;
      userMonthlyCount: number;
      globalDailyCount: number;
    }
  | { allowed: false; reason: GeminiBudgetDenialReason };

export interface GeminiBudgetReservationOptions {
  now?: Date;
  deadlineAtMs?: number;
}

function parseCap(value: string | undefined): number {
  if (!value || !/^(0|[1-9]\d*)$/.test(value)) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

export function getGeminiBudgetCaps(): {
  userMonthly: number;
  globalDaily: number;
} {
  return {
    userMonthly: parseCap(process.env.OCR_GEMINI_USER_MONTHLY_CAP),
    globalDaily: parseCap(process.env.OCR_GEMINI_GLOBAL_DAILY_CAP),
  };
}

function getStoredCount(snapshot: {
  exists: boolean;
  data(): { count?: unknown } | undefined;
}): number {
  if (!snapshot.exists) return 0;
  const count = snapshot.data()?.count;
  if (!Number.isSafeInteger(count) || (count as number) < 0) {
    throw new Error("Gemini budget counter is invalid");
  }
  return count as number;
}

function getUtcPeriods(now: Date): { month: string; day: string } {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Gemini budget timestamp is invalid");
  }
  const day = now.toISOString().slice(0, 10);
  return { day, month: day.slice(0, 7) };
}

function assertWithinDeadline(deadlineAtMs: number | undefined): void {
  if (deadlineAtMs !== undefined && Date.now() >= deadlineAtMs) {
    throw new Error("Gemini budget reservation deadline exceeded");
  }
}

/**
 * Atomically reserves one Gemini API attempt.
 * Period boundaries are UTC so every server instance resolves the same docs.
 * Only counters and period identifiers are persisted; card data is never stored.
 */
export async function reserveGeminiFallbackBudget(
  userId: string,
  options: GeminiBudgetReservationOptions = {},
): Promise<GeminiBudgetReservation> {
  if (!userId.trim()) {
    throw new Error("Gemini budget user is missing");
  }

  const caps = getGeminiBudgetCaps();
  if (caps.userMonthly <= 0 || caps.globalDaily <= 0) {
    return { allowed: false, reason: "disabled" };
  }

  assertWithinDeadline(options.deadlineAtMs);
  const periods = getUtcPeriods(options.now ?? new Date());
  const userRef = adminDb
    .collection("users")
    .doc(userId)
    .collection(USER_BUDGET_COLLECTION)
    .doc(periods.month);
  const globalRef = adminDb
    .collection(GLOBAL_BUDGET_COLLECTION)
    .doc(periods.day);

  return adminDb.runTransaction(async (transaction) => {
    const [userSnapshot, globalSnapshot] = await transaction.getAll(
      userRef,
      globalRef,
    );
    assertWithinDeadline(options.deadlineAtMs);
    const userCount = getStoredCount(userSnapshot);
    const globalCount = getStoredCount(globalSnapshot);

    if (userCount >= caps.userMonthly) {
      return { allowed: false, reason: "user_monthly_cap" } as const;
    }
    if (globalCount >= caps.globalDaily) {
      return { allowed: false, reason: "global_daily_cap" } as const;
    }

    const updatedAt = FieldValue.serverTimestamp();
    transaction.set(userRef, {
      count: userCount + 1,
      period: periods.month,
      updatedAt,
    });
    transaction.set(globalRef, {
      count: globalCount + 1,
      period: periods.day,
      updatedAt,
    });

    return {
      allowed: true,
      userMonthlyCount: userCount + 1,
      globalDailyCount: globalCount + 1,
    } as const;
  });
}
