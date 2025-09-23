// src/lib/rateLimit.ts
import { NextRequest, NextResponse } from 'next/server';

// In-memory store for rate limiting (for production, use Redis or similar)
const rateLimit = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  limit: number;         // Maximum requests allowed
  windowMs: number;      // Time window in milliseconds
  identifier?: (req: NextRequest) => string; // Function to identify client
}

/**
 * Simple in-memory rate limiting middleware
 * For production, consider using Redis-based solution
 */
export function createRateLimiter(config: RateLimitConfig) {
  const { limit, windowMs, identifier } = config;

  return async function rateLimitMiddleware(req: NextRequest) {
    // Get client identifier (IP address or custom identifier)
    const clientId = identifier ? identifier(req) : getClientIp(req);

    if (!clientId) {
      console.warn('Unable to identify client for rate limiting');
      return null; // Allow request if we can't identify client
    }

    const now = Date.now();
    const clientData = rateLimit.get(clientId);

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      cleanupExpiredEntries(now);
    }

    if (!clientData || now > clientData.resetTime) {
      // First request or window expired
      rateLimit.set(clientId, {
        count: 1,
        resetTime: now + windowMs,
      });
      return null; // Allow request
    }

    if (clientData.count >= limit) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((clientData.resetTime - now) / 1000);
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(clientData.resetTime).toISOString(),
          },
        }
      );
    }

    // Increment counter
    clientData.count++;
    rateLimit.set(clientId, clientData);

    return null; // Allow request
  };
}

/**
 * Get client IP address from request
 */
function getClientIp(req: NextRequest): string {
  // Try various headers that might contain the real IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Vercel-specific headers
  const vercelForwardedFor = req.headers.get('x-vercel-forwarded-for');
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(',')[0].trim();
  }

  // Fallback to a generic identifier
  return 'unknown';
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(now: number) {
  for (const [key, value] of rateLimit.entries()) {
    if (now > value.resetTime) {
      rateLimit.delete(key);
    }
  }
}

// Pre-configured rate limiters for common use cases

/**
 * Strict rate limit for sensitive endpoints (e.g., OCR API)
 * 5 requests per minute
 */
export const strictRateLimit = createRateLimiter({
  limit: 5,
  windowMs: 60 * 1000, // 1 minute
});

/**
 * Standard rate limit for authenticated API endpoints
 * 30 requests per minute
 */
export const standardRateLimit = createRateLimiter({
  limit: 30,
  windowMs: 60 * 1000, // 1 minute
});

/**
 * Relaxed rate limit for public endpoints
 * 100 requests per minute
 */
export const relaxedRateLimit = createRateLimiter({
  limit: 100,
  windowMs: 60 * 1000, // 1 minute
});