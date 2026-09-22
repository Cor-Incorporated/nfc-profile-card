import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { revalidatePublicProfiles } from "@/lib/profile/revalidatePublicProfiles";
import { getOwnedRedirectAliases } from "@/lib/profile/getOwnedRedirectAliases";
import { getUidFallbackUsername } from "@/lib/username";
import { POST } from "./route";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn(), runTransaction: jest.fn() },
  verifyIdToken: jest.fn(),
}));
jest.mock("@/lib/profile/revalidatePublicProfiles", () => ({
  revalidatePublicProfiles: jest.fn(),
}));
jest.mock("@/lib/profile/getOwnedRedirectAliases", () => ({
  getOwnedRedirectAliases: jest.fn(),
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
  (verifyIdToken as jest.Mock).mockResolvedValue({
    success: true,
    uid: "owner",
  });
  (adminDb.collection as jest.Mock).mockImplementation((collection: string) => {
    if (collection === "users") {
      return {
        doc: (id: string) => ({ id, kind: "user" }),
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
