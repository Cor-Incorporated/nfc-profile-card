// Plan types
export type UserPlan = "free" | "pro";

// Valid promo codes
export const VALID_PROMO_CODES = ["TapForgeβTestUser"];

// Plan limits
export const PLAN_LIMITS = {
  free: {
    scansPerMonth: 10,
  },
  pro: {
    scansPerMonth: 999999, // Effectively unlimited
  },
} as const;

// Plan features
export const PLAN_FEATURES = {
  free: {
    name: "Free Plan",
    scanLimit: PLAN_LIMITS.free.scansPerMonth,
    features: [
      "10 business card scans per month",
      "Basic profile customization",
      "QR code generation",
    ],
  },
  pro: {
    name: "Pro Plan",
    scanLimit: "Unlimited",
    features: [
      "Unlimited business card scans",
      "Advanced profile customization",
      "QR code generation",
      "Priority support",
    ],
  },
} as const;
