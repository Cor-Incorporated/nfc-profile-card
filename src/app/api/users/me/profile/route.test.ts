import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { PATCH } from "./route";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn(), runTransaction: jest.fn() },
  verifyIdToken: jest.fn(),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, options?: { status?: number }) => ({
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

const request = {
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
    const response = await PATCH(request);
    expect(response.status).toBe(200);
    expect(state.user.address).toBe("100-0001 東京都千代田区千代田2-2");
    expect((state.profile.components as any[])[0].content).toMatchObject({
      postalCode: "100-0001",
      city: "東京都千代田区",
      address: "千代田2-2",
    });
  });

  it("keeps both documents unchanged when profile update fails", async () => {
    const state = setupStore(true);
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await PATCH(request);
      expect(response.status).toBe(500);
      expect(state.user.address).toBe("Old address");
      expect((state.profile.components as any[])[0].content.address).toBe(
        "千代田1-1",
      );
    } finally {
      log.mockRestore();
    }
  });
});
