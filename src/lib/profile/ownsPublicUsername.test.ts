import { adminDb } from "@/lib/firebase-admin";
import { ownsPublicUsername } from "./ownsPublicUsername";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn() },
}));

function setup({
  reservationUid,
  usernames = {},
}: {
  reservationUid?: string;
  usernames?: Record<string, string[]>;
}) {
  (adminDb.collection as jest.Mock).mockImplementation((collection: string) => {
    if (collection === "usernames") {
      return {
        doc: () => ({
          get: async () => ({
            exists: Boolean(reservationUid),
            data: () => ({ uid: reservationUid }),
          }),
        }),
      };
    }
    return {
      where: (_field: string, _operator: string, name: string) => ({
        limit: () => ({
          get: async () => ({
            empty: !(usernames[name] || []).length,
            docs: (usernames[name] || []).map((id) => ({ id })),
          }),
        }),
      }),
    };
  });
}

beforeEach(() => jest.clearAllMocks());

test("accepts the current user's reserved username", async () => {
  setup({ reservationUid: "owner" });
  expect(await ownsPublicUsername("owner", "Alice")).toBe(true);
});

test("rejects a username reserved by another user", async () => {
  setup({ reservationUid: "victim" });
  expect(await ownsPublicUsername("owner", "victim")).toBe(false);
});

test("rejects a legacy username shared with another user", async () => {
  setup({ usernames: { victim: ["owner", "victim"] } });
  expect(await ownsPublicUsername("owner", "victim")).toBe(false);
});

test("accepts an unreserved legacy name that resolves to the owner", async () => {
  setup({ usernames: { alice: ["owner"] } });
  expect(await ownsPublicUsername("owner", "alice")).toBe(true);
});

test("rejects malformed path values", async () => {
  setup({});
  expect(await ownsPublicUsername("owner", "../victim")).toBe(false);
  expect(adminDb.collection).not.toHaveBeenCalled();
});
