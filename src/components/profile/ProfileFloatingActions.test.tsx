import { fireEvent, render, screen } from "@testing-library/react";
import { PublicLanguageProvider } from "@/contexts/PublicLanguageContext";
import { ProfileFloatingActions } from "./ProfileFloatingActions";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("ProfileFloatingActions", () => {
  beforeEach(() => {
    mockPush.mockClear();
    window.localStorage.clear();
  });

  it("routes the scan action through sign-in with the internal scan target", () => {
    render(
      <PublicLanguageProvider>
        <ProfileFloatingActions username="preview-user" variant="minimal" />
      </PublicLanguageProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "ログインして名刺をスキャン",
      }),
    );

    expect(mockPush).toHaveBeenCalledWith(
      "/signin?redirect=%2Fdashboard%2Fbusiness-cards%2Fscan",
    );
  });
});
