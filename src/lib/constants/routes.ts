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

/**
 * 認証後のリダイレクトURLを生成
 * @param redirect リダイレクト先のパス
 * @returns 認証画面へのURLクエリパラメータ付き
 */
export function createAuthRedirectUrl(redirect: string): string {
  const encodedRedirect = encodeURIComponent(redirect);
  return `${ROUTES.SIGNIN}?redirect=${encodedRedirect}`;
}

/**
 * URLからリダイレクトパラメータを取得
 * @param url URLまたはURLSearchParams
 * @returns リダイレクト先のパス（デフォルト: ダッシュボード）
 */
export function getRedirectUrl(url: string | URLSearchParams | null): string {
  if (!url) return ROUTES.DASHBOARD;

  const searchParams =
    typeof url === "string" ? new URLSearchParams(new URL(url).search) : url;

  return searchParams.get("redirect") || ROUTES.DASHBOARD;
}
