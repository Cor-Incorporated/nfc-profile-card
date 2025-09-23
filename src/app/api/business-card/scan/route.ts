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
  try {
    // Apply rate limiting (5 requests per minute for OCR)
    const rateLimitResponse = await strictRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Check for authorization header
    const authorization = request.headers.get("authorization");
    if (!authorization || !authorization.startsWith("Bearer ")) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: ERROR_MESSAGES.AUTH_REQUIRED,
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Verify Firebase ID token
    const idToken = authorization.split("Bearer ")[1];
    const tokenVerification = await verifyIdToken(idToken);

    if (!tokenVerification.success) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: ERROR_MESSAGES.AUTH_INVALID_TOKEN,
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Get the image data from request body
    const body: BusinessCardScanRequest = await request.json();
    const { image, mimeType } = body;

    if (!image || !mimeType) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: ERROR_MESSAGES.IMAGE_REQUIRED,
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Process the business card image using OCR service
    const ocrResult = await processBusinessCardImage(image, mimeType);

    if (!ocrResult.success) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: ERROR_MESSAGES.IMAGE_PROCESSING_FAILED,
        details: ocrResult.error,
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    const successResponse: BusinessCardScanResponse = {
      success: true,
      data: ocrResult.contactInfo!,
      processingTime: ocrResult.processingTime,
    };

    return NextResponse.json(successResponse, { status: 200 });
  } catch (error) {
    console.error("Error in business card scan API:", error);

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: ERROR_MESSAGES.IMAGE_PROCESSING_FAILED,
      details:
        error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR,
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
