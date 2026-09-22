import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { getDoc } from "firebase/firestore";
import EditProfilePage from "./page";

jest.mock("@/contexts/AuthContext", () => {
  return { useAuth: jest.fn() };
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

const emptyProfileContent = Object.fromEntries(
  [
    "firstName",
    "lastName",
    "phoneticFirstName",
    "phoneticLastName",
    "name",
    "email",
    "phone",
    "cellPhone",
    "company",
    "position",
    "department",
    "address",
    "city",
    "postalCode",
    "website",
    "bio",
    "photoURL",
  ].map((field) => [field, ""]),
);

describe("basic profile edit source", () => {
  beforeEach(() => {
    jest.mocked(getDoc).mockReset();
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: "test-uid",
        displayName: "Login Name",
        email: "login@example.test",
      },
      loading: false,
      getIdToken: jest.fn().mockResolvedValue(null),
    });
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

  it("uses basic values for a newly created untouched placeholder", async () => {
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce(
        snapshot({
          username: "test-name",
          name: "Basic Name",
          email: "basic@example.test",
          address: "Fiction Street 5",
        }) as never,
      )
      .mockResolvedValueOnce(
        snapshot({
          components: [
            {
              type: "profile",
              content: { ...emptyProfileContent, isInitialPlaceholder: true },
            },
          ],
        }) as never,
      );

    render(<EditProfilePage />);
    await waitFor(() =>
      expect(screen.getByLabelText("name *")).toHaveValue("Basic Name"),
    );
    expect(screen.getByLabelText("email")).toHaveValue("basic@example.test");
    expect(screen.getByLabelText("address")).toHaveValue("Fiction Street 5");
  });

  it("does not restore basic values after all public fields were cleared", async () => {
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce(
        snapshot({
          username: "test-name",
          name: "Former Name",
          email: "former@example.test",
        }) as never,
      )
      .mockResolvedValueOnce(
        snapshot({
          components: [
            {
              type: "profile",
              content: {
                cardBackgroundColor: "#ffffff",
                cardBackgroundOpacity: 95,
              },
            },
          ],
        }) as never,
      );

    render(<EditProfilePage />);
    await waitFor(() =>
      expect(screen.getByLabelText("username *")).toHaveValue("test-name"),
    );
    expect(screen.getByLabelText("name *")).toHaveValue("");
    expect(screen.getByLabelText("email")).toHaveValue("");
  });

  it("keeps all cleared public fields empty after login restores root email", async () => {
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce(
        snapshot({
          username: "test-name",
          email: "login@example.test",
          name: "Former Name",
        }) as never,
      )
      .mockResolvedValueOnce(
        snapshot({
          components: [{ type: "profile", content: emptyProfileContent }],
        }) as never,
      );

    render(<EditProfilePage />);
    await waitFor(() =>
      expect(screen.getByLabelText("username *")).toHaveValue("test-name"),
    );
    expect(screen.getByLabelText("name *")).toHaveValue("");
    expect(screen.getByLabelText("email")).toHaveValue("");
  });

  it("sends the exact mixed-case UID mode selected in the editor", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: "MixCase",
        displayName: "Login Name",
        email: "login@example.test",
      },
      loading: false,
      getIdToken: jest.fn().mockResolvedValue("synthetic-token"),
    });
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce(snapshot({ username: "oldname" }) as never)
      .mockResolvedValueOnce({ exists: () => false } as never);
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ aliases: [], profile: { username: "u_MixCase" } }),
    } as Response);
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);

    try {
      render(<EditProfilePage />);
      await waitFor(() =>
        expect(screen.getByLabelText("username *")).toHaveValue("oldname"),
      );
      fireEvent.click(screen.getByRole("button", { name: "useUidUsername" }));
      expect(screen.getByLabelText("username *")).toHaveValue("u_MixCase");
      fireEvent.click(screen.getByRole("button", { name: "save" }));

      await waitFor(() => {
        const patch = jest
          .mocked(fetch)
          .mock.calls.find(
            ([url, options]) =>
              url === "/api/users/me/profile" && options?.method === "PATCH",
          );
        expect(patch).toBeDefined();
        expect(JSON.parse(patch?.[1]?.body as string)).toMatchObject({
          username: "u_MixCase",
          usernameMode: "uid",
        });
      });
    } finally {
      confirm.mockRestore();
    }
  });

  it("disables UID selection when the UID cannot form its exact URL", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: "a:b",
        displayName: "Login Name",
        email: "login@example.test",
      },
      loading: false,
      getIdToken: jest.fn().mockResolvedValue(null),
    });
    jest
      .mocked(getDoc)
      .mockResolvedValueOnce(snapshot({ username: "" }) as never)
      .mockResolvedValueOnce({ exists: () => false } as never);

    render(<EditProfilePage />);

    expect(
      await screen.findByRole("button", { name: "useUidUsername" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("username *")).toHaveValue("");
  });
});
