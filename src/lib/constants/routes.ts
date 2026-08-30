/**
 * アプリケーション内で使用するルート定数
 * タイポ防止と型安全性のために定義
 */
export const ROUTES = {
  // 認証関連
  SIGNIN: "/signin",
  SIGNUP: "/signup",

  // ダッシュボード
  DASHBOARD: "/dashboard",
  DASHBOARD_EDIT: "/dashboard/edit",
  DASHBOARD_EDIT_DESIGN: "/dashboard/edit/design",
  DASHBOARD_BUSINESS_CARDS: "/dashboard/business-cards",
  DASHBOARD_BUSINESS_CARDS_SCAN: "/dashboard/business-cards/scan",

  // 公開プロフィール
  PUBLIC_PROFILE: (username: string) => `/p/${username}`,

  // ホーム
  HOME: "/",
} as const;

const INTERNAL_REDIRECT_ORIGIN = "https://tapforge.invalid";

type SearchParamsReader = Pick<URLSearchParams, "get">;

/**
 * Normalize a post-authentication redirect to an app-internal path.
 * Protocol-relative URLs, absolute URLs, backslashes, and malformed values
 * fall back to the dashboard.
 */
export function getSafeRedirectPath(
  redirect: string | null | undefined,
): string {
  if (!redirect || redirect !== redirect.trim()) {
    return ROUTES.DASHBOARD;
  }

  try {
    const decodedRedirect = decodeURIComponent(redirect);
    if (
      !redirect.startsWith("/") ||
      redirect.startsWith("//") ||
      decodedRedirect.startsWith("//") ||
      /[\\\u0000-\u001f\u007f]/.test(decodedRedirect)
    ) {
      return ROUTES.DASHBOARD;
    }

    const parsed = new URL(redirect, INTERNAL_REDIRECT_ORIGIN);
    if (
      parsed.origin !== INTERNAL_REDIRECT_ORIGIN ||
      parsed.pathname.startsWith("//")
    ) {
      return ROUTES.DASHBOARD;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return ROUTES.DASHBOARD;
  }
}

/**
 * 認証後のリダイレクトURLを生成
 * @param redirect リダイレクト先のパス
 * @returns 認証画面へのURLクエリパラメータ付き
 */
export function createAuthRedirectUrl(redirect: string): string {
  const encodedRedirect = encodeURIComponent(getSafeRedirectPath(redirect));
  return `${ROUTES.SIGNIN}?redirect=${encodedRedirect}`;
}

/**
 * URLからリダイレクトパラメータを取得
 * @param url URLまたはURLSearchParams
 * @returns リダイレクト先のパス（デフォルト: ダッシュボード）
 */
export function getRedirectUrl(
  url: string | SearchParamsReader | null,
): string {
  if (!url) return ROUTES.DASHBOARD;

  try {
    const searchParams =
      typeof url === "string"
        ? new URL(url, INTERNAL_REDIRECT_ORIGIN).searchParams
        : url;

    return getSafeRedirectPath(searchParams.get("redirect"));
  } catch {
    return ROUTES.DASHBOARD;
  }
}
