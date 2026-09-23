import { verifyAdminRequest } from "@/lib/admin";
import { adminDb } from "@/lib/firebase-admin";
import { resolvePublicProfileOwner } from "@/lib/profile/publicProfileData";
import { generateDefaultUsername } from "@/lib/username";
import { POST } from "./route";

jest.mock("@/lib/admin", () => ({ verifyAdminRequest: jest.fn() }));
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn(), runTransaction: jest.fn() },
}));
jest.mock("@/lib/profile/publicProfileData", () => ({
  resolvePublicProfileOwner: jest.fn(),
}));
jest.mock("@/lib/username", () => ({ generateDefaultUsername: jest.fn() }));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    arrayUnion: (value: string) => ({ arrayUnion: value }),
    serverTimestamp: () => "server-timestamp",
  },
}));
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, options?: { status?: number }) => ({
      body,
      status: options?.status || 200,
    }),
  },
}));

type Data = Record<string, unknown>;
type Ref = { path: string };
type Query = { usernameQuery: string };
type Write = { type: "set" | "update" | "delete"; path: string; value?: Data };

const docs = new Map<string, Data>();
const transactions: Array<{ events: string[]; writes: Write[] }> = [];
let beforeTransaction: (() => void) | null = null;

function installFirestoreFixture() {
  (adminDb.collection as jest.Mock).mockImplementation(
    (collection: string) => ({
      doc: (id: string): Ref => ({ path: `${collection}/${id}` }),
      where: (_field: string, _operator: string, username: string) => ({
        limit: (_count: number): Query => ({ usernameQuery: username }),
      }),
    }),
  );

  (adminDb.runTransaction as jest.Mock).mockImplementation(
    async (callback: (transaction: unknown) => Promise<unknown>) => {
      beforeTransaction?.();
      beforeTransaction = null;
      const run = { events: [] as string[], writes: [] as Write[] };
      transactions.push(run);
      const transaction = {
        get: async (input: Ref | Query) => {
          run.events.push("read");
          if ("usernameQuery" in input) {
            return {
              empty: !Array.from(docs.entries()).some(
                ([path, data]) =>
                  path.startsWith("users/") &&
                  data.username === input.usernameQuery,
              ),
            };
          }
          const data = docs.get(input.path);
          return { exists: Boolean(data), data: () => data };
        },
        set: (ref: Ref, value: Data) => {
          run.events.push("write");
          run.writes.push({ type: "set", path: ref.path, value });
        },
        update: (ref: Ref, value: Data) => {
          run.events.push("write");
          run.writes.push({ type: "update", path: ref.path, value });
        },
        delete: (ref: Ref) => {
          run.events.push("write");
          run.writes.push({ type: "delete", path: ref.path });
        },
      };

      const result = await callback(transaction);
      for (const write of run.writes) {
        if (write.type === "delete") {
          docs.delete(write.path);
        } else {
          docs.set(write.path, {
            ...(write.type === "update" ? docs.get(write.path) : {}),
            ...write.value,
          });
        }
      }
      return result;
    },
  );
}

function request(body?: Data) {
  return {
    json: async () => {
      if (!body) throw new Error("No request body");
      return body;
    },
  } as unknown as Parameters<typeof POST>[0];
}

function rotate(body?: Data) {
  return POST(request(body), { params: { uid: "uid-a" } });
}

beforeEach(() => {
  jest.clearAllMocks();
  docs.clear();
  transactions.length = 0;
  beforeTransaction = null;
  installFirestoreFixture();
  (verifyAdminRequest as jest.Mock).mockResolvedValue({
    ok: true,
    decodedToken: { uid: "admin-1" },
  });
  (generateDefaultUsername as jest.Mock).mockReturnValue("731826405219");
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValue("uid-a");
  docs.set("users/uid-a", { username: "oldname1" });
  docs.set("usernames/oldname1", { uid: "uid-a" });
});

test("body-free admin rotation disables the old URL and reserves the new one atomically", async () => {
  docs.set("usernameAliases/oldname1", {
    uid: "uid-a",
    status: "redirect",
  });

  const response = await rotate();

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    uid: "uid-a",
    previousUsername: "oldname1",
    username: "731826405219",
  });
  expect(docs.has("usernames/oldname1")).toBe(false);
  expect(docs.get("usernameAliases/oldname1")).toMatchObject({
    uid: "uid-a",
    status: "disabled",
  });
  expect(docs.get("usernames/731826405219")?.uid).toBe("uid-a");
  expect(docs.get("users/uid-a")).toMatchObject({
    username: "731826405219",
    usernameConfirmed: true,
    usernameRotatedBy: "admin-1",
    usernameRotatedBySelf: false,
    previousUsernames: { arrayUnion: "oldname1" },
  });
  const { events } = transactions[0];
  expect(events.lastIndexOf("read")).toBeLessThan(events.indexOf("write"));
});

test("admin rotation uses the actual previous URL after a concurrent earlier rotation", async () => {
  beforeTransaction = () => {
    docs.set("users/uid-a", { username: "middle-name" });
    docs.delete("usernames/oldname1");
    docs.set("usernameAliases/oldname1", {
      uid: "uid-a",
      status: "disabled",
    });
    docs.set("usernames/middle-name", { uid: "uid-a" });
  };

  const response = await rotate();

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    previousUsername: "middle-name",
    username: "731826405219",
  });
  expect(docs.get("usernameAliases/middle-name")).toMatchObject({
    uid: "uid-a",
    status: "disabled",
  });
  expect(docs.has("usernames/middle-name")).toBe(false);
});

test("UID形式の旧URLは回転後も利用されるため予約と別名だけを解除する", async () => {
  docs.set("users/uid-a", { username: "u_uid-a" });
  docs.delete("usernames/oldname1");
  docs.set("usernames/u_uid-a", { uid: "uid-a" });
  docs.set("usernameAliases/u_uid-a", {
    uid: "uid-a",
    status: "redirect",
  });

  const response = await rotate();

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ previousUsername: "u_uid-a" });
  expect(docs.has("usernames/u_uid-a")).toBe(false);
  expect(docs.get("usernameAliases/u_uid-a")).toMatchObject({
    uid: "uid-a",
    status: "disabled",
  });
  expect(docs.get("users/uid-a")?.username).toBe("731826405219");
});

test("redirect mode points the old URL at the new username", async () => {
  docs.set("usernameAliases/oldname1", {
    uid: "uid-a",
    status: "redirect",
    createdAt: "original-created-at",
  });

  const response = await rotate({ legacyUrlAction: "redirect" });

  expect(response.status).toBe(200);
  expect(docs.has("usernames/oldname1")).toBe(false);
  expect(docs.get("usernameAliases/oldname1")).toMatchObject({
    uid: "uid-a",
    targetUsername: "731826405219",
    status: "redirect",
    createdAt: "original-created-at",
  });
});

test.each([
  ["reservation", "usernames/731826405219", { uid: "uid-b" }],
  ["alias", "usernameAliases/731826405219", { uid: "uid-b" }],
  ["legacy user", "users/uid-b", { username: "731826405219" }],
])(
  "retries after a new username %s collision without writing the first attempt",
  async (_kind, path, data) => {
    docs.set(path, data);
    (generateDefaultUsername as jest.Mock)
      .mockReturnValueOnce("731826405219")
      .mockReturnValueOnce("640517382964");

    const response = await rotate();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ username: "640517382964" });
    expect(transactions).toHaveLength(2);
    expect(transactions[0].writes).toHaveLength(0);
    expect(docs.get(path)).toEqual(data);
    expect(docs.get("usernames/640517382964")?.uid).toBe("uid-a");
  },
);

test("does not delete a reservation or alias owned by another user", async () => {
  docs.set("usernames/oldname1", { uid: "uid-b" });
  docs.set("usernameAliases/oldname1", { uid: "uid-b" });

  const response = await rotate();

  expect(response.status).toBe(200);
  expect(docs.get("usernames/oldname1")?.uid).toBe("uid-b");
  expect(docs.get("usernameAliases/oldname1")?.uid).toBe("uid-b");
  expect(docs.get("usernames/731826405219")?.uid).toBe("uid-a");
});

test("admin rotation refuses to expose another user's alias behind an own reservation", async () => {
  docs.set("usernameAliases/oldname1", { uid: "uid-b", status: "redirect" });

  const response = await rotate();

  expect(response.status).toBe(409);
  expect(transactions[0].writes).toHaveLength(0);
  expect(docs.get("usernames/oldname1")?.uid).toBe("uid-a");
});

test.each(["usernames", "usernameAliases"])(
  "redirect refuses to overwrite another user's old %s document",
  async (collection) => {
    const path = `${collection}/oldname1`;
    docs.set(path, { uid: "uid-b" });

    const response = await rotate({ legacyUrlAction: "redirect" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "alias_conflict" });
    expect(transactions[0].writes).toHaveLength(0);
    expect(docs.get(path)?.uid).toBe("uid-b");
  },
);

test("redirect refuses a forged previous username with another public owner", async () => {
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValueOnce("uid-b");

  const response = await rotate({ legacyUrlAction: "redirect" });

  expect(response.status).toBe(409);
  expect(transactions[0].writes).toHaveLength(0);
  expect(docs.get("usernameAliases/oldname1")).toBeUndefined();
});

test("unreserved legacy history cannot become a redirect", async () => {
  docs.delete("usernames/oldname1");

  const response = await rotate({ legacyUrlAction: "redirect" });

  expect(response.status).toBe(409);
  expect(transactions[0].writes).toHaveLength(0);
});

test("an unreserved legacy URL is quarantined without assigning ownership", async () => {
  docs.delete("usernames/oldname1");

  const response = await rotate();

  expect(response.status).toBe(200);
  expect(docs.get("usernameAliases/oldname1")).toMatchObject({
    uid: null,
    status: "disabled",
    quarantined: true,
  });
});

test("admin rotation never quarantines another user's direct UID URL", async () => {
  docs.set("users/uid-a", { username: "u_uid-b" });
  docs.set("users/uid-b", { username: "u_uid-b" });
  docs.delete("usernames/oldname1");
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValueOnce("uid-b");

  const response = await rotate();

  expect(response.status).toBe(200);
  expect(docs.has("usernameAliases/u_uid-b")).toBe(false);
});
