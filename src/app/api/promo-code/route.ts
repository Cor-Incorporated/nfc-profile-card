import { API_ERROR_CODES, ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { VALID_PROMO_CODES } from "@/lib/constants/plans";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { strictRateLimit } from "@/lib/rateLimit";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PromoCodeRequest {
  code: string;
}

interface PromoCodeResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting (3 requests per minute for promo code attempts)
    const rateLimitResponse = await strictRateLimit(request);
    if (rateLimitResponse) {
      console.log("❌ Rate limit exceeded for promo code");
      return rateLimitResponse;
    }

    // Check for authorization header
    const authorization = request.headers.get("authorization");
    if (!authorization || !authorization.startsWith("Bearer ")) {
      const errorResponse: PromoCodeResponse = {
        success: false,
        error: ERROR_MESSAGES.AUTH_REQUIRED,
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Verify Firebase ID token
    const idToken = authorization.split("Bearer ")[1];
    const tokenVerification = await verifyIdToken(idToken);

    if (!tokenVerification.success || !tokenVerification.uid) {
      const errorResponse: PromoCodeResponse = {
        success: false,
        error: ERROR_MESSAGES.AUTH_INVALID_TOKEN,
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    const userId = tokenVerification.uid;

    // Get the promo code from request body
    const body: PromoCodeRequest = await request.json();
    const { code } = body;

    if (!code) {
      const errorResponse: PromoCodeResponse = {
        success: false,
        error: API_ERROR_CODES.PROMO_CODE_INVALID,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate promo code
    if (!VALID_PROMO_CODES.includes(code)) {
      const errorResponse: PromoCodeResponse = {
        success: false,
        error: API_ERROR_CODES.PROMO_CODE_INVALID,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Check if user already has Pro plan or already used a promo code
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      const userData = userSnap.data() as any;

      // Check if already Pro
      if (userData.plan === "pro") {
        const errorResponse: PromoCodeResponse = {
          success: false,
          error: API_ERROR_CODES.PROMO_CODE_ALREADY_PRO,
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }

      // Check if already used a promo code
      if (userData.promoCode) {
        const errorResponse: PromoCodeResponse = {
          success: false,
          error: API_ERROR_CODES.PROMO_CODE_ALREADY_USED,
        };
        return NextResponse.json(errorResponse, { status: 400 });
      }
    }

    // Update (or create) user plan to pro using Admin SDK (bypasses Firestore rules)
    await userRef.set(
      {
        plan: "pro",
        planUpgradedAt: FieldValue.serverTimestamp(),
        promoCode: code,
        subscription: {
          plan: "pro",
          upgradedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );

    const successResponse: PromoCodeResponse = {
      success: true,
      message: "promoCodeSuccess",
    };

    return NextResponse.json(successResponse, { status: 200 });
  } catch (error) {
    console.error("Error in promo code API:", error);

    const errorResponse: PromoCodeResponse = {
      success: false,
      error: "プロモーションコードの処理中にエラーが発生しました。",
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
