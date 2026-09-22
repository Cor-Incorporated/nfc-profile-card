import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { revalidatePublicProfiles } from "@/lib/profile/revalidatePublicProfiles";
import { getOwnedRedirectAliases } from "@/lib/profile/getOwnedRedirectAliases";
import { ownsPublicUsername } from "@/lib/profile/ownsPublicUsername";
import { getUidFallbackUsername } from "@/lib/username";
import { POST } from "./route";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn(), runTransaction: jest.fn() },
  verifyIdToken: jest.fn(),
}));
jest.mock("@/lib/profile/revalidatePublicProfiles", () => ({
  ...jest.requireActual("@/lib/profile/revalidatePublicProfiles"),
  revalidatePublicProfiles: jest.fn(),
}));
jest.mock("@/lib/profile/getOwnedRedirectAliases", () => ({
  getOwnedRedirectAliases: jest.fn(),
}));
jest.mock("@/lib/profile/ownsPublicUsername", () => ({
  ownsPublicUsername: jest.fn(),
}));
jest.mock("@/lib/username", () => ({
  generateDefaultUsername: () => "newname",
  getUidFallbackUsername: (uid: string) => `u_${uid}`,
}));
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, options?: { status?: number }) => ({
      body,
      status: options?.status || 200,
    }),
  },
}));

test("rotation invalidates the old, new, and UID fallback paths", async () => {
  (getOwnedRedirectAliases as jest.Mock).mockResolvedValue(["very-old"]);
  (ownsPublicUsername as jest.Mock).mockResolvedValue(true);
  (verifyIdToken as jest.Mock).mockResolvedValue({
    success: true,
    uid: "owner",
  });
  (adminDb.collection as jest.Mock).mockImplementation((collection: string) => {
    if (collection === "users") {
      return {
        doc: (id: string) => ({
          id,
          kind: "user",
          get: async () => ({ data: () => ({ username: "oldname" }) }),
        }),
        where: () => ({
          limit: () => ({ get: async () => ({ empty: true }) }),
        }),
      };
    }
    return {
      doc: (id: string) => ({
        id,
        kind: collection,
        get: async () => ({ exists: false }),
      }),
    };
  });
  (adminDb.runTransaction as jest.Mock).mockImplementation(async (callback) =>
    callback({
      get: async (ref: { kind: string }) =>
        ref.kind === "user"
          ? { exists: true, data: () => ({ username: "oldname" }) }
          : { exists: false },
      delete: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
    }),
  );

  const request = {
    headers: { get: () => "Bearer valid-token" },
    json: async () => ({ legacyUrlAction: "disable" }),
  } as unknown as Parameters<typeof POST>[0];
  const result = await POST(request);

  expect(result.status).toBe(200);
  expect(revalidatePublicProfiles).toHaveBeenCalledWith(
    "oldname",
    "newname",
    getUidFallbackUsername("owner"),
    "very-old",
  );
});

test("rotation does not purge an unowned old username", async () => {
  (getOwnedRedirectAliases as jest.Mock).mockResolvedValue(["owned-alias"]);
  (ownsPublicUsername as jest.Mock).mockResolvedValue(false);
  (verifyIdToken as jest.Mock).mockResolvedValue({
    success: true,
    uid: "owner",
  });
  (adminDb.collection as jest.Mock).mockImplementation((collection: string) =>
    collection === "users"
      ? {
          doc: () => ({
            kind: "user",
            get: async () => ({ data: () => ({ username: "victim" }) }),
          }),
          where: () => ({
            limit: () => ({ get: async () => ({ empty: true }) }),
          }),
        }
      : { doc: () => ({ get: async () => ({ exists: false }) }) },
  );
  (adminDb.runTransaction as jest.Mock).mockImplementation(async (callback) =>
    callback({
      get: async (ref: { kind?: string }) =>
        ref.kind === "user"
          ? { exists: true, data: () => ({ username: "victim" }) }
          : { exists: false },
      delete: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
    }),
  );

  const response = await POST({
    headers: { get: () => "Bearer valid-token" },
    json: async () => ({ legacyUrlAction: "disable" }),
  } as never);
  expect(response.status).toBe(200);
  expect(revalidatePublicProfiles).toHaveBeenCalledWith(
    null,
    "newname",
    "u_owner",
    "owned-alias",
  );
});
