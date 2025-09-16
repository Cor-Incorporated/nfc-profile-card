import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 認証が必要なパス
const protectedPaths = ['/dashboard', '/api/ocr', '/api/vcard'];

// 認証済みユーザーがアクセスすべきでないパス
const authPaths = ['/signin', '/sign-in', '/sign-up'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静的アセットやAPIルートは除外
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('.') ||
    pathname === '/'
  ) {
    return NextResponse.next();
  }

  // Firebase Authのトークンをクッキーから取得（クライアントサイドで設定）
  const token = request.cookies.get('auth-token');

  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isAuthPath = authPaths.some(path => pathname.startsWith(path));

  // Google OAuth リダイレクトの処理中はスキップ
  const isRedirectCallback = pathname === '/signin' && request.nextUrl.searchParams.has('__firebase_request_key');
  if (isRedirectCallback) {
    return NextResponse.next();
  }

  // 未認証でprotectedパスにアクセスしようとした場合
  if (isProtectedPath && !token) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // 認証済みでauthパスにアクセスしようとした場合
  if (isAuthPath && token) {
    const url = request.nextUrl.clone();
    const callbackUrl = request.nextUrl.searchParams.get('callbackUrl');
    url.pathname = callbackUrl || '/dashboard';
    url.searchParams.delete('callbackUrl');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};