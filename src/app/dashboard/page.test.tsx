import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getDoc } from "firebase/firestore";
import DashboardPage from "./page";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      uid: "fictitious-uid",
      displayName: "Login Name",
      email: "login@example.test",
      getIdToken: jest.fn().mockResolvedValue("test-token"),
    },
    loading: false,
    signOut: jest.fn(),
  }),
}));
jest.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "ja",
    setLanguage: jest.fn(),
    t: (key: string) => key,
  }),
}));
jest.mock("@/lib/analytics", () => ({
  getAnalyticsSummary: jest.fn().mockResolvedValue(null),
}));

describe("profile ID setup", () => {
  beforeEach(() => {
    jest.mocked(getDoc).mockReset();
    jest.mocked(fetch).mockReset();
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ profile: { username: "profile-name" } }),
    } as Response);
  });

  it.each([
    { publicEmail: "", expectedEmail: "" },
    {
      publicEmail: "public@example.test",
      expectedEmail: "public@example.test",
    },
    { publicEmail: undefined, expectedEmail: "login@example.test" },
  ])(
    "uses $expectedEmail when the public email is $publicEmail",
    async ({ publicEmail, expectedEmail }) => {
      jest.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          username: "profile-name",
          usernameConfirmed: false,
          email: publicEmail,
        }),
      } as never);

      render(<DashboardPage />);
      fireEvent.click(
        await screen.findByRole("button", { name: "profileIdSetupAction" }),
      );

      await waitFor(() => expect(fetch).toHaveBeenCalled());
      const body = JSON.parse(
        (jest.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.email).toBe(expectedEmail);
    },
  );
});
