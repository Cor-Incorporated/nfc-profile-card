import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { getOwnedRedirectAliases } from "@/lib/profile/getOwnedRedirectAliases";
import { resolvePublicProfileOwner } from "@/lib/profile/publicProfileData";
import { revalidatePublicProfiles } from "@/lib/profile/revalidatePublicProfiles";
import { Timestamp } from "firebase-admin/firestore";
import { PUT } from "./route";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn(), runTransaction: jest.fn() },
  verifyIdToken: jest.fn(),
}));
jest.mock("@/lib/profile/getOwnedRedirectAliases", () => ({
  getOwnedRedirectAliases: jest.fn(),
}));
jest.mock("@/lib/profile/publicProfileData", () => ({
  resolvePublicProfileOwner: jest.fn(),
}));
jest.mock("@/lib/profile/revalidatePublicProfiles", () => ({
  getOwnedUidFallbackUsername: (uid: string) => `u_${uid}`,
  revalidatePublicProfiles: jest.fn(),
}));
jest.mock("firebase-admin/firestore", () => ({
  Timestamp: { now: jest.fn() },
}));
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, options?: { status?: number }) => ({
      body,
      status: options?.status || 200,
    }),
  },
}));

const userRef = { key: "user", collection: () => ({ doc: () => designRef }) };
const designRef = { key: "design" };
const payload = {
  revision: "1:000000010",
  components: [
    {
      id: "profile-1",
      type: "profile",
      order: 0,
      content: { name: "Sample", email: "", isInitialPlaceholder: false },
    },
  ],
  background: { type: "solid", color: "#ffffff" },
};

function request(body: unknown = payload, token = "valid-token") {
  return {
    headers: { get: () => (token ? `Bearer ${token}` : null) },
    text: async () => JSON.stringify(body),
  } as never;
}

function setupTransaction(existingRevision = { seconds: 1, nanoseconds: 10 }) {
  const stored = { components: [], updatedAt: existingRevision };
  const set = jest.fn((_ref, value) => Object.assign(stored, value));
  (adminDb.collection as jest.Mock).mockReturnValue({ doc: () => userRef });
  (adminDb.runTransaction as jest.Mock).mockImplementation(async (callback) =>
    callback({
      get: async (ref: unknown) =>
        ref === userRef
          ? { exists: true, data: () => ({ username: "alice" }) }
          : { exists: true, data: () => stored },
      set,
    }),
  );
  return { stored, set };
}

beforeEach(() => {
  jest.clearAllMocks();
  (verifyIdToken as jest.Mock).mockResolvedValue({
    success: true,
    uid: "owner",
  });
  (Timestamp.now as jest.Mock).mockReturnValue({ seconds: 2, nanoseconds: 20 });
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValue("owner");
  (getOwnedRedirectAliases as jest.Mock).mockResolvedValue(["old-alias"]);
});

test("only an authenticated owner can save", async () => {
  const response = await PUT(request(payload, ""));
  expect(response.status).toBe(401);
  expect(adminDb.runTransaction).not.toHaveBeenCalled();
});

test("commits a validated design and then invalidates owned public URLs", async () => {
  const { stored } = setupTransaction();
  (revalidatePublicProfiles as jest.Mock).mockImplementation(() => {
    expect((stored.components as unknown[]).length).toBe(1);
  });

  const response = await PUT(request());
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ revision: "2:000000020" });
  expect((stored.components as any[])[0].content.email).toBe("");
  expect(revalidatePublicProfiles).toHaveBeenCalledWith(
    "alice",
    "u_owner",
    "old-alias",
  );
});

test("a stale tab receives a conflict without overwriting newer data", async () => {
  const { set } = setupTransaction({ seconds: 3, nanoseconds: 1 });
  const response = await PUT(request());
  expect(response.status).toBe(409);
  expect(set).not.toHaveBeenCalled();
  expect(revalidatePublicProfiles).not.toHaveBeenCalled();
});

test("malformed design is rejected before Firestore", async () => {
  const response = await PUT(
    request({ ...payload, components: [{ type: "text" }] }),
  );
  expect(response.status).toBe(400);
  expect(adminDb.runTransaction).not.toHaveBeenCalled();
});

test("invalidation failure reports the committed revision for a safe retry", async () => {
  const { set } = setupTransaction();
  (revalidatePublicProfiles as jest.Mock).mockImplementation(() => {
    throw new Error("cache unavailable");
  });
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await PUT(request());
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: "invalidation_failed",
      committedRevision: "2:000000020",
    });
    expect(set).toHaveBeenCalledTimes(1);
  } finally {
    log.mockRestore();
  }
});
