import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { getDoc } from "firebase/firestore";
import DashboardPage from "./page";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
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
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: "fictitious-uid",
        displayName: "Login Name",
        email: "login@example.test",
        getIdToken: jest.fn().mockResolvedValue("test-token"),
      },
      loading: false,
      signOut: jest.fn(),
    });
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

  it("shows the exact mixed-case UID path and sends UID mode", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: "MixCase",
        displayName: "Login Name",
        email: "login@example.test",
        getIdToken: jest.fn().mockResolvedValue("test-token"),
      },
      loading: false,
      signOut: jest.fn(),
    });
    jest.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ username: "", usernameConfirmed: false }),
    } as never);

    render(<DashboardPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: /profileIdUidTitle/ }),
    );
    expect(screen.getByText(/\/p\/u_MixCase/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "profileIdSetupAction" }),
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
      const body = JSON.parse(
        (jest.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.usernameMode).toBe("uid");
    });
  });

  it("does not offer UID mode when the UID must be sanitized", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: "a:b",
        displayName: "Login Name",
        email: "login@example.test",
        getIdToken: jest.fn().mockResolvedValue("test-token"),
      },
      loading: false,
      signOut: jest.fn(),
    });
    jest.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ username: "", usernameConfirmed: false }),
    } as never);

    render(<DashboardPage />);
    await screen.findByRole("button", { name: "profileIdSetupAction" });

    expect(
      screen.queryByRole("button", { name: /profileIdUidTitle/ }),
    ).toBeNull();
    expect(screen.queryByText(/\/p\/u_ab/)).toBeNull();
  });

  it("opens the verified profile path when a legacy ID contains a fragment", async () => {
    jest.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ username: "foo#bar", usernameConfirmed: true }),
    } as never);

    render(<DashboardPage />);

    expect(
      await screen.findByRole("link", { name: "publicProfile" }),
    ).toHaveAttribute("href", "/p/foo%23bar");
  });
});
