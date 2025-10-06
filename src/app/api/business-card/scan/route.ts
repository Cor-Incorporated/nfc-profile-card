import { ERROR_MESSAGES, API_ERROR_CODES } from "@/lib/constants/error-messages";
import { verifyIdToken } from "@/lib/firebase-admin";
import { strictRateLimit } from "@/lib/rateLimit";
import { processBusinessCardImage } from "@/services/business-card/ocrService";
import { canScan, recordScan } from "@/services/business-card/scanQuotaService";
import {
  ApiErrorResponse,
  BusinessCardScanRequest,
  BusinessCardScanResponse,
} from "@/types/api";
import { NextRequest, NextResponse } from "next/server";

// Configure API route settings
export const maxDuration = 30; // 30 seconds timeout
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  console.log("=== Business Card Scan API Called ===");
  console.log("Time:", new Date().toISOString());
  console.log("Method:", request.method);

  // Check request body size
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const sizeInMB = parseInt(contentLength) / (1024 * 1024);
    console.log("Request body size:", sizeInMB.toFixed(2), "MB");

    if (parseInt(contentLength) > 10 * 1024 * 1024) {
      // 10MB limit
      console.error("❌ Request body too large:", sizeInMB.toFixed(2), "MB");
      const errorResponse: ApiErrorResponse = {
        success: false,
        error:
          "リクエストサイズが大きすぎます。10MB以下の画像をご利用ください。",
      };
      return NextResponse.json(errorResponse, { status: 413 });
    }
  }

  try {
    // Apply rate limiting (5 requests per minute for OCR)
    const rateLimitResponse = await strictRateLimit(request);
    if (rateLimitResponse) {
      console.log("❌ Rate limit exceeded");
      return rateLimitResponse;
    }

    // Check for authorization header
    const authorization = request.headers.get("authorization");
    if (!authorization || !authorization.startsWith("Bearer ")) {
      console.error("❌ No authorization header");
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: ERROR_MESSAGES.AUTH_REQUIRED,
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Verify Firebase ID token
    const idToken = authorization.split("Bearer ")[1];
    console.log("Verifying Firebase token...");
    const tokenVerification = await verifyIdToken(idToken);

    if (!tokenVerification.success) {
      console.error("❌ Invalid Firebase token");
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: ERROR_MESSAGES.AUTH_INVALID_TOKEN,
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }
    console.log("✅ Token verified, user:", tokenVerification.uid);

    const userId = tokenVerification.uid!;

    // Check scan quota before processing
    console.log("Checking scan quota...");
    const canPerformScan = await canScan(userId);
    if (!canPerformScan) {
      console.error("❌ Monthly scan limit exceeded");
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: API_ERROR_CODES.SCAN_QUOTA_EXCEEDED,
      };
      return NextResponse.json(errorResponse, { status: 429 });
    }
    console.log("✅ Scan quota check passed");

    // Get the image data from request body
    const body: BusinessCardScanRequest = await request.json();
    const { image, mimeType } = body;

    console.log("Request body received:");
    console.log("- Image size:", image?.length || 0, "characters");
    console.log("- MIME type:", mimeType);

    if (!image || !mimeType) {
      console.error("❌ Missing image or mimeType");
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: ERROR_MESSAGES.IMAGE_REQUIRED,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Process the business card image using OCR service
    console.log("Starting OCR processing...");
    const ocrResult = await processBusinessCardImage(image, mimeType);

    if (!ocrResult.success) {
      console.error("❌ OCR processing failed");
      console.error("OCR Error:", ocrResult.error);
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: ERROR_MESSAGES.IMAGE_PROCESSING_FAILED,
        details: ocrResult.error,
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    console.log("✅ OCR processing succeeded");
    console.log("Processing time:", ocrResult.processingTime, "ms");

    // Record the scan to Firestore and update quota
    console.log("Recording scan to database...");
    const recordResult = await recordScan(userId, ocrResult.contactInfo);
    if (!recordResult.success) {
      console.error("❌ Failed to record scan:", recordResult.error);
      // DB保存失敗時は上限カウントされないため、エラーを返す
      // これにより無限スキャンの抜け穴を防ぐ
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: API_ERROR_CODES.SCAN_SAVE_FAILED,
        details: recordResult.error,
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }
    console.log("✅ Scan recorded successfully, docId:", recordResult.docId);

    const successResponse: BusinessCardScanResponse = {
      success: true,
      data: ocrResult.contactInfo!,
      processingTime: ocrResult.processingTime,
    };

    console.log("=== API Response Success ===");
    return NextResponse.json(successResponse, { status: 200 });
  } catch (error) {
    console.error("❌ Unexpected error in business card scan API");
    console.error("Error:", error);

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: ERROR_MESSAGES.IMAGE_PROCESSING_FAILED,
      details:
        error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
