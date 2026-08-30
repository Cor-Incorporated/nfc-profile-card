import { render, screen } from "@testing-library/react";
import { LandingActions } from "./LandingActions";

describe("LandingActions", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("uses the Japanese labels when no language preference is saved", () => {
    render(<LandingActions />);

    expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute(
      "href",
      "/signin?tab=signup",
    );
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute(
      "href",
      "/signin?tab=signin",
    );
    expect(screen.queryByRole("link", { name: "Sign In" })).toBeNull();
  });

  it("uses the English labels from the existing language preference", () => {
    window.localStorage.setItem("userLanguage", "en");

    render(<LandingActions />);

    expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute(
      "href",
      "/signin?tab=signup",
    );
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute(
      "href",
      "/signin?tab=signin",
    );
    expect(screen.queryByRole("link", { name: "ログイン" })).toBeNull();
  });
});
