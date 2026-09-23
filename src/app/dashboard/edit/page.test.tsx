import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getDoc } from "firebase/firestore";
import EditProfilePage from "./page";

jest.mock("@/contexts/AuthContext", () => {
  const auth = {
    user: {
      uid: "test-uid",
      displayName: "Test Person",
      email: "login@example.test",
    },
    loading: false,
    getIdToken: jest.fn().mockResolvedValue("test-token"),
  };
  return { useAuth: () => auth };
});

jest.mock("@/contexts/LanguageContext", () => {
  const language = { t: (key: string) => key };
  return { useLanguage: () => language };
});

jest.mock("next/navigation", () => {
  const router = { push: jest.fn() };
  return { useRouter: () => router };
});

jest.mock("@/components/simple-editor/ImageUploader", () => ({
  ImageUploader: () => null,
}));

const snapshot = (data: Record<string, unknown>) => ({
  exists: () => true,
  data: () => data,
});

it("loads one address and sends the same value on repeated basic edits", async () => {
  const user = snapshot({ username: "test-name", name: "Test Person" });
  const profile = snapshot({
    components: [
      {
        type: "profile",
        content: {
          name: "Test Person",
          email: "public@example.test",
          postalCode: "100-0001",
          city: "東京都千代田区",
          address: "100-0001 東京都千代田区 千代田1-1",
        },
      },
    ],
  });
  let reads = 0;
  jest.mocked(getDoc).mockImplementation(async () => {
    reads += 1;
    return (reads % 2 ? user : profile) as never;
  });
  jest.mocked(fetch).mockImplementation(
    async (input) =>
      ({
        ok: true,
        status: 200,
        json: async () =>
          input === "/api/users/me/profile"
            ? { profile: { username: "test-name" } }
            : { aliases: [] },
      }) as Response,
  );

  for (let save = 0; save < 2; save += 1) {
    const view = render(<EditProfilePage />);
    await waitFor(() =>
      expect(screen.getByLabelText("address")).toHaveValue(
        "100-0001 東京都千代田区 千代田1-1",
      ),
    );
    expect(screen.getByLabelText("email")).toHaveValue("public@example.test");
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(
        jest
          .mocked(fetch)
          .mock.calls.filter(([url]) => url === "/api/users/me/profile"),
      ).toHaveLength(save + 1),
    );
    const [, options] = jest
      .mocked(fetch)
      .mock.calls.filter(([url]) => url === "/api/users/me/profile")[save];
    const body = JSON.parse(String(options?.body));
    expect(body.address).toBe("100-0001 東京都千代田区 千代田1-1");
    expect(body.replaceComponentAddress).toBe(true);
    expect(body.email).toBe("public@example.test");
    view.unmount();
  }
});
