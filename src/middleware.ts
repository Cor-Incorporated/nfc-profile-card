// Simplified middleware - no internationalization for public pages
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Simply pass through all requests
  // Authentication is handled by useAuth hook in components
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip all internal paths (_next)
    '/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon.png).*)',
  ],
};