import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { formatProfileAddress } from "@/lib/profile/address";
import { revalidatePublicProfiles } from "@/lib/profile/revalidatePublicProfiles";
import { ownsPublicUsername } from "@/lib/profile/ownsPublicUsername";
import { getUidFallbackUsername } from "@/lib/username";
import { PATCH, POST } from "./route";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn(), runTransaction: jest.fn() },
  verifyIdToken: jest.fn(),
}));
jest.mock("@/lib/profile/revalidatePublicProfiles", () => ({
  revalidatePublicProfiles: jest.fn(),
}));
jest.mock("@/lib/profile/ownsPublicUsername", () => ({
  ownsPublicUsername: jest.fn(),
}));
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, options?: { status?: number }) => ({
      body,
      status: options?.status || 200,
      json: async () => body,
    }),
  },
}));

type State = {
  user: Record<string, unknown>;
  profile: Record<string, unknown>;
};

function makeSnapshot(data: Record<string, unknown>) {
  return { exists: true, data: () => data };
}

function setupStore(failProfileWrite = false) {
  const state: State = {
    user: { username: "test-name", address: "Old address" },
    profile: {
      components: [
        {
          id: "profile",
          type: "profile",
          content: {
            postalCode: "100-0001",
            city: "東京都千代田区",
            address: "千代田1-1",
          },
        },
      ],
    },
  };
  const profileRef = { key: "profile" };
  const userRef = {
    key: "user",
    get: async () => makeSnapshot(state.user),
    collection: () => ({ doc: () => profileRef }),
  };
  (adminDb.collection as jest.Mock).mockReturnValue({ doc: () => userRef });
  (adminDb.runTransaction as jest.Mock).mockImplementation(
    async (callback: (transaction: unknown) => Promise<unknown>) => {
      const writes: Array<() => void> = [];
      const transaction = {
        get: async (ref: unknown) =>
          ref === userRef
            ? makeSnapshot(state.user)
            : makeSnapshot(state.profile),
        set: (_ref: unknown, value: Record<string, unknown>) => {
          writes.push(() => {
            state.user = { ...state.user, ...value };
          });
        },
        update: (_ref: unknown, value: Record<string, unknown>) => {
          if (failProfileWrite) throw new Error("profile write rejected");
          writes.push(() => {
            state.profile = { ...state.profile, ...value };
          });
        },
      };
      await callback(transaction);
      writes.forEach((write) => write());
    },
  );
  return state;
}

const patchRequest = {
  headers: { get: () => "Bearer test-token" },
  json: async () => ({
    username: "test-name",
    name: "Test Person",
    address: "100-0001 東京都千代田区千代田2-2",
    replaceComponentAddress: true,
  }),
} as never;

describe("PATCH basic profile atomic sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(verifyIdToken).mockResolvedValue({
      success: true,
      uid: "test-uid",
    } as never);
  });

  it("commits user and public profile address together", async () => {
    const state = setupStore();
    (revalidatePublicProfiles as jest.Mock).mockImplementation(() => {
      expect(state.user.address).toBe("100-0001 東京都千代田区千代田2-2");
      expect((state.profile.components as any[])[0].content.address).toBe(
        "100-0001 東京都千代田区千代田2-2",
      );
    });
    const response = await PATCH(patchRequest);
    expect(response.status).toBe(200);
    expect(revalidatePublicProfiles).toHaveBeenCalledWith(
      "test-name",
      "test-name",
      getUidFallbackUsername("test-uid"),
    );
    expect(state.user.address).toBe("100-0001 東京都千代田区千代田2-2");
    const content = (state.profile.components as any[])[0].content;
    expect(content).toMatchObject({
      postalCode: "100-0001",
      city: "東京都千代田区",
      address: "100-0001 東京都千代田区千代田2-2",
    });
    expect(formatProfileAddress(content)).toBe(
      "100-0001 東京都千代田区千代田2-2",
    );
  });

  it("keeps both documents unchanged when profile update fails", async () => {
    const state = setupStore(true);
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await PATCH(patchRequest);
      expect(response.status).toBe(500);
      expect(revalidatePublicProfiles).not.toHaveBeenCalled();
      expect(state.user.address).toBe("Old address");
      expect((state.profile.components as any[])[0].content.address).toBe(
        "千代田1-1",
      );
    } finally {
      log.mockRestore();
    }
  });
});

function request(token?: string) {
  return {
    headers: { get: () => (token ? `Bearer ${token}` : null) },
    // A client-supplied username must never determine which path is purged.
    json: async () => ({ username: "another-user" }),
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  (ownsPublicUsername as jest.Mock).mockResolvedValue(true);
});

test("anonymous callers cannot invalidate public pages", async () => {
  const response = await POST(request());
  expect(response.status).toBe(401);
  expect(verifyIdToken).not.toHaveBeenCalled();
  expect(revalidatePublicProfiles).not.toHaveBeenCalled();
});

test("only the authenticated owner's stored profile IDs are invalidated", async () => {
  (verifyIdToken as jest.Mock).mockResolvedValue({
    success: true,
    uid: "owner",
  });
  (adminDb.collection as jest.Mock).mockReturnValue({
    doc: (uid: string) => ({
      get: async () => ({
        exists: true,
        data: () => ({ username: uid === "owner" ? "alice" : "wrong" }),
      }),
    }),
  });

  const response = await POST(request("valid-token"));
  expect(response.status).toBe(200);
  expect(adminDb.collection).toHaveBeenCalledWith("users");
  expect(revalidatePublicProfiles).toHaveBeenCalledWith(
    "alice",
    getUidFallbackUsername("owner"),
  );
  expect(revalidatePublicProfiles).not.toHaveBeenCalledWith("another-user");
});

test("a forged stored username cannot purge another owner's page", async () => {
  (verifyIdToken as jest.Mock).mockResolvedValue({
    success: true,
    uid: "owner",
  });
  (adminDb.collection as jest.Mock).mockReturnValue({
    doc: () => ({
      get: async () => ({ exists: true, data: () => ({ username: "victim" }) }),
    }),
  });
  (ownsPublicUsername as jest.Mock).mockResolvedValue(false);

  const response = await POST(request("valid-token"));
  expect(response.status).toBe(403);
  expect(ownsPublicUsername).toHaveBeenCalledWith("owner", "victim");
  expect(revalidatePublicProfiles).not.toHaveBeenCalled();
});
