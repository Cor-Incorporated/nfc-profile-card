import { adminDb } from "@/lib/firebase-admin";
import { resolvePublicProfileOwner } from "@/lib/profile/publicProfileData";
import { standardRateLimit } from "@/lib/rateLimit";
import { POST } from "./route";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn(), runTransaction: jest.fn() },
}));
jest.mock("@/lib/profile/publicProfileData", () => ({
  resolvePublicProfileOwner: jest.fn(),
}));
jest.mock("@/lib/rateLimit", () => ({ standardRateLimit: jest.fn() }));
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, options?: { status?: number }) => ({
      status: options?.status || 200,
      json: async () => body,
    }),
  },
}));

function request(username: string) {
  return {
    headers: { get: () => null },
    json: async () => ({ username }),
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  (standardRateLimit as jest.Mock).mockResolvedValue(null);
});

test("analytics writes to the owner of the verified public path", async () => {
  const userRef = { id: "owner" };
  const update = jest.fn();
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValue("owner");
  (adminDb.collection as jest.Mock).mockReturnValue({
    doc: (uid: string) => ({ ...userRef, id: uid }),
  });
  (adminDb.runTransaction as jest.Mock).mockImplementation(
    async (callback: (transaction: unknown) => Promise<unknown>) =>
      callback({
        get: async () => ({ data: () => ({ analytics: { totalViews: 2 } }) }),
        update,
      }),
  );

  const response = await POST(request("u_owner"));

  expect(response.status).toBe(200);
  expect(resolvePublicProfileOwner).toHaveBeenCalledWith("u_owner");
  expect(adminDb.collection).toHaveBeenCalledWith("users");
  expect(update).toHaveBeenCalledWith(
    userRef,
    expect.objectContaining({ "analytics.totalViews": 3 }),
  );
});

test("an unresolved or ambiguous public path cannot receive analytics", async () => {
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValue(null);

  const response = await POST(request("unverified"));

  expect(response.status).toBe(404);
  expect(adminDb.runTransaction).not.toHaveBeenCalled();
});

test("a missing username is rejected before owner lookup", async () => {
  const response = await POST(request(""));

  expect(response.status).toBe(400);
  expect(resolvePublicProfileOwner).not.toHaveBeenCalled();
});
