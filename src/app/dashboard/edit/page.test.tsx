import { render, screen, waitFor } from "@testing-library/react";
import { getDoc } from "firebase/firestore";
import EditProfilePage from "./page";

jest.mock("@/contexts/AuthContext", () => {
  const auth = {
    user: {
      uid: "test-uid",
      displayName: "Login Name",
      email: "login@example.test",
    },
    loading: false,
    getIdToken: jest.fn().mockResolvedValue(null),
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

describe("basic profile edit source", () => {
  beforeEach(() => {
    jest.mocked(getDoc).mockReset();
  });

  it("keeps an explicitly empty public email empty on re-entry", async () => {
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce(
        snapshot({ username: "test-name", email: "" }) as never,
      )
      .mockResolvedValueOnce(
        snapshot({
          components: [
            { type: "profile", content: { name: "Public Name", email: "" } },
          ],
        }) as never,
      );

    render(<EditProfilePage />);
    await waitFor(() =>
      expect(screen.getByLabelText("name *")).toHaveValue("Public Name"),
    );
    expect(screen.getByLabelText("email")).toHaveValue("");
  });

  it("respects an empty user document email without a component", async () => {
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce(
        snapshot({
          username: "test-name",
          name: "Basic Name",
          email: "",
        }) as never,
      )
      .mockResolvedValueOnce({ exists: () => false } as never);

    render(<EditProfilePage />);
    await waitFor(() =>
      expect(screen.getByLabelText("name *")).toHaveValue("Basic Name"),
    );
    expect(screen.getByLabelText("email")).toHaveValue("");
  });
});
