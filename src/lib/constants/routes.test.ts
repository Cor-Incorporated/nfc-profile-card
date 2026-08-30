import { ROUTES, createAuthRedirectUrl, getRedirectUrl } from "./routes";

describe("authentication redirect routes", () => {
  it("preserves an internal redirect path", () => {
    const searchParams = new URLSearchParams({
      redirect: ROUTES.DASHBOARD_BUSINESS_CARDS_SCAN,
    });

    expect(getRedirectUrl(searchParams)).toBe(
      ROUTES.DASHBOARD_BUSINESS_CARDS_SCAN,
    );
    expect(createAuthRedirectUrl(ROUTES.DASHBOARD_BUSINESS_CARDS_SCAN)).toBe(
      "/signin?redirect=%2Fdashboard%2Fbusiness-cards%2Fscan",
    );
  });

  it.each([
    "//evil.example/steal",
    "https://evil.example/steal",
    "javascript:alert(1)",
    "/\\evil.example/steal",
    "/safe/..//evil.example/steal",
    "/%2e%2e//evil.example/steal",
  ])("rejects an unsafe redirect target: %s", (redirect) => {
    const searchParams = new URLSearchParams({ redirect });

    expect(getRedirectUrl(searchParams)).toBe(ROUTES.DASHBOARD);
    expect(createAuthRedirectUrl(redirect)).toBe(
      "/signin?redirect=%2Fdashboard",
    );
  });
});
