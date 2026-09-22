import { adminDb } from "@/lib/firebase-admin";
import { ownsPublicUsername } from "./ownsPublicUsername";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn() },
}));

function setup({
  reservationUid,
  usernames = {},
  aliases = {},
}: {
  reservationUid?: string;
  usernames?: Record<string, string[]>;
  aliases?: Record<string, string>;
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
    if (collection === "usernameAliases") {
      return {
        doc: (name: string) => ({
          get: async () => ({
            exists: Boolean(aliases[name]),
            data: () => ({ uid: aliases[name], status: "redirect" }),
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

test("rejects another user's UID fallback even when its username field is forged", async () => {
  setup({ usernames: { u_victim: ["owner"] } });
  expect(await ownsPublicUsername("owner", "u_victim")).toBe(false);
});

test("rejects a legacy username that belongs to another user's redirect alias", async () => {
  setup({ aliases: { oldname: "victim" }, usernames: { oldname: ["owner"] } });
  expect(await ownsPublicUsername("owner", "oldname")).toBe(false);
});
