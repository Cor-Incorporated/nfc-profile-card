/**
 * API Response Type Definitions
 * Type-safe API responses for all endpoints
 */

import { ContactInfo } from "./business-card";

// Base API Response structure
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

// Business Card Scan API Types
export interface BusinessCardScanRequest {
  image: string; // Base64 encoded image
  mimeType: string; // MIME type of the image
}

export interface BusinessCardScanResponse extends ApiResponse<ContactInfo> {
  processingTime?: number; // OCR processing time in milliseconds
}

// Error Response for failed requests
export interface ApiErrorResponse extends ApiResponse<never> {
  success: false;
  error: string;
  details?: string;
}

// Success Response for successful requests
export interface ApiSuccessResponse<T> extends ApiResponse<T> {
  success: true;
  data: T;
}

// Authentication Token Verification Response
export interface TokenVerificationResult {
  success: boolean;
  uid?: string;
  email?: string;
  error?: string;
}

// Generic API Handler types
export type ApiHandler<TRequest = unknown, TResponse = unknown> = (
  request: TRequest,
) => Promise<ApiResponse<TResponse>>;

// Next.js API Route Response helpers
export type NextApiResponse<T = unknown> = ApiResponse<T>;

export type ErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID_TOKEN"
  | "IMAGE_REQUIRED"
  | "IMAGE_PROCESSING_FAILED"
  | "OCR_TIMEOUT"
  | "UNKNOWN_ERROR";

export interface TypedApiError extends Error {
  code?: ErrorCode;
  statusCode?: number;
}
