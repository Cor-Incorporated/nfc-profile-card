import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { processBusinessCardImage } from "@/services/business-card/ocrService";
import {
  BusinessCardScanRequest,
  BusinessCardScanResponse,
  ApiErrorResponse,
} from "@/types/api";
import { strictRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  console.log("=== Business Card Scan API Called ===");
  console.log("Time:", new Date().toISOString());
  console.log("Method:", request.method);

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
