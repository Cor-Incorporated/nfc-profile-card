import { render, screen } from "@testing-library/react";
import { fetchPublicProfileByUsername } from "@/lib/profile/publicProfileData";
import ProfilePage, { generateMetadata } from "./page";

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: (callback: unknown) => callback,
}));
jest.mock("@/lib/profile/publicProfileData", () => ({
  fetchPublicProfileByUsername: jest.fn(),
}));
jest.mock("@/components/profile/ProfileAnalyticsTracker", () => ({
  ProfileAnalyticsTracker: ({ username }: { username: string }) => (
    <span data-testid="analytics-identifier" data-username={username} />
  ),
}));
jest.mock("@/components/profile/SimpleRenderer", () => ({
  SimpleRenderer: () => null,
}));
jest.mock("@/components/profile/TraditionalProfile", () => ({
  TraditionalProfile: () => null,
}));
jest.mock("@/components/profile/ProfileFloatingActions", () => ({
  ProfileFloatingActions: ({
    photoURL,
    username,
  }: {
    photoURL?: string;
    username: string;
  }) => (
    <span
      data-testid="qr-logo-source"
      data-photo-url={photoURL}
      data-username={username}
    />
  ),
}));

const mockFetch = fetchPublicProfileByUsername as jest.Mock;

const user = {
  name: "Stale Name",
  username: "synthetic-user",
  bio: "Stale biography",
  company: "Stale Company",
  position: "Stale Position",
  photoURL: "https://example.invalid/old.png",
  email: "",
  phone: "",
  website: "",
  address: "",
  links: [],
};

beforeEach(() => mockFetch.mockReset());

test("metadata and QR logo use the edited card instead of stale root data", async () => {
  mockFetch.mockResolvedValue({
    user,
    profileData: {
      components: [
        {
          type: "profile",
          order: 0,
          content: {
            name: "Current Name",
            bio: "Current biography",
            photoURL: "https://example.invalid/current.png",
          },
        },
      ],
    },
    redirectUsername: null,
  });

  const params = { username: "synthetic-user" };
  const metadata = await generateMetadata({ params });
  expect(metadata.title).toBe("Current Name - TapForge");
  expect(metadata.description).toBe("Current biography");
  expect(metadata.openGraph).toEqual({
    title: "Current Name",
    description: "Current biography",
    images: [{ url: "https://example.invalid/current.png" }],
  });

  render(await ProfilePage({ params }));
  expect(screen.getByTestId("qr-logo-source")).toHaveAttribute(
    "data-photo-url",
    "https://example.invalid/current.png",
  );
});

test("cleared card fields do not reappear in metadata or QR logo", async () => {
  mockFetch.mockResolvedValue({
    user,
    profileData: {
      components: [
        { type: "profile", order: 0, content: { name: "Current Name" } },
      ],
    },
    redirectUsername: null,
  });

  const params = { username: "synthetic-user" };
  const metadata = await generateMetadata({ params });
  expect(metadata.description).toBe("Current Name");
  expect(metadata.openGraph).toEqual({
    title: "Current Name",
    description: undefined,
    images: undefined,
  });

  render(await ProfilePage({ params }));
  expect(screen.getByTestId("qr-logo-source")).toHaveAttribute(
    "data-photo-url",
    "",
  );
});

test("QR and analytics use the verified path instead of an editable user field", async () => {
  mockFetch.mockResolvedValue({
    user: { ...user, username: "untrusted-name" },
    profileData: null,
    redirectUsername: null,
  });

  render(await ProfilePage({ params: { username: "u_verified" } }));
  expect(screen.getByTestId("qr-logo-source")).toHaveAttribute(
    "data-username",
    "u_verified",
  );
  expect(screen.getByTestId("analytics-identifier")).toHaveAttribute(
    "data-username",
    "u_verified",
  );
});
