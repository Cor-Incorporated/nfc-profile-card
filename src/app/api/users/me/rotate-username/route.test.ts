import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { resolvePublicProfileOwner } from "@/lib/profile/publicProfileData";
import { generateDefaultUsername } from "@/lib/username";
import { POST } from "./route";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn(), runTransaction: jest.fn() },
  verifyIdToken: jest.fn(),
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
      status: options?.status || 200,
      json: async () => body,
    }),
  },
}));

type Data = Record<string, unknown>;
type Ref = { path: string };
type Query = { usernameQuery: string };
const docs = new Map<string, Data>();
const writes: string[] = [];
let beforeTransaction: (() => void) | null = null;

function read(input: Ref | Query) {
  if ("usernameQuery" in input) {
    const matches = [...docs.entries()]
      .filter(
        ([path, data]) =>
          path.startsWith("users/") && data.username === input.usernameQuery,
      )
      .map(([path]) => ({ id: path.slice(6) }));
    return { empty: matches.length === 0, docs: matches };
  }
  const data = docs.get(input.path);
  return {
    id: input.path.split("/")[1],
    exists: Boolean(data),
    data: () => data,
  };
}

function installFirestoreFixture() {
  (adminDb.collection as jest.Mock).mockImplementation(
    (collection: string) => ({
      doc: (id: string) => ({
        path: `${collection}/${id}`,
        get: async () => read({ path: `${collection}/${id}` }),
      }),
      where: (_field: string, _operator: string, username: string) => ({
        limit: () => ({
          usernameQuery: username,
          get: async () => read({ usernameQuery: username }),
        }),
      }),
    }),
  );
  (adminDb.runTransaction as jest.Mock).mockImplementation(async (callback) => {
    beforeTransaction?.();
    beforeTransaction = null;
    const pending: Array<() => void> = [];
    const result = await callback({
      get: async (input: Ref | Query) => read(input),
      set: (ref: Ref, value: Data) =>
        pending.push(() => {
          docs.set(ref.path, value);
          writes.push(`set:${ref.path}`);
        }),
      update: (ref: Ref, value: Data) =>
        pending.push(() => {
          docs.set(ref.path, { ...docs.get(ref.path), ...value });
          writes.push(`update:${ref.path}`);
        }),
      delete: (ref: Ref) =>
        pending.push(() => {
          docs.delete(ref.path);
          writes.push(`delete:${ref.path}`);
        }),
    });
    pending.forEach((write) => write());
    return result;
  });
}

function request(legacyUrlAction?: string) {
  return {
    headers: { get: () => "Bearer synthetic-token" },
    json: async () => ({ legacyUrlAction }),
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  docs.clear();
  writes.length = 0;
  beforeTransaction = null;
  docs.set("users/owner", { username: "oldname" });
  docs.set("usernames/oldname", { uid: "owner" });
  (verifyIdToken as jest.Mock).mockResolvedValue({
    success: true,
    uid: "owner",
  });
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValue("owner");
  (generateDefaultUsername as jest.Mock).mockReturnValue("newname123");
  installFirestoreFixture();
});

test("the default rotation keeps a disabled alias ownership record", async () => {
  const response = await POST(request());

  expect(response.status).toBe(200);
  expect(docs.get("users/owner")?.username).toBe("newname123");
  expect(docs.get("usernameAliases/oldname")).toMatchObject({
    uid: "owner",
    status: "disabled",
  });
  expect(docs.get("usernames/oldname")).toBeUndefined();
});

test("a concurrent earlier rotation invalidates the transaction's actual previous URL", async () => {
  beforeTransaction = () => {
    docs.set("users/owner", { username: "middle-name" });
    docs.delete("usernames/oldname");
    docs.set("usernameAliases/oldname", {
      uid: "owner",
      status: "disabled",
    });
    docs.set("usernames/middle-name", { uid: "owner" });
  };

  const response = await POST(request());

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    previousUsername: "middle-name",
    username: "newname123",
  });
  expect(docs.get("usernameAliases/middle-name")).toMatchObject({
    uid: "owner",
    status: "disabled",
  });
  expect(docs.has("usernames/middle-name")).toBe(false);
});

test("a forged previous URL cannot be redirected during self rotation", async () => {
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValue("victim");

  const response = await POST(request("redirect"));

  expect(response.status).toBe(409);
  expect(writes).toHaveLength(0);
  expect(docs.get("users/owner")?.username).toBe("oldname");
});

test("an unreserved legacy username cannot create a redirect", async () => {
  docs.delete("usernames/oldname");

  const response = await POST(request("redirect"));

  expect(response.status).toBe(409);
  expect(writes).toHaveLength(0);
});

test("disabling an unreserved legacy username quarantines it without an owner", async () => {
  docs.delete("usernames/oldname");

  const response = await POST(request());

  expect(response.status).toBe(200);
  expect(docs.get("usernameAliases/oldname")).toMatchObject({
    uid: null,
    status: "disabled",
    quarantined: true,
  });
});

test("a forged UID fallback belonging to another user is not quarantined", async () => {
  docs.set("users/owner", { username: "u_victim" });
  docs.set("users/victim", { username: "u_victim" });
  docs.delete("usernames/oldname");
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValueOnce("victim");

  const response = await POST(request());

  expect(response.status).toBe(200);
  expect(docs.has("usernameAliases/u_victim")).toBe(false);
  expect(docs.get("users/victim")?.username).toBe("u_victim");
});

test("rotation skips a generated username already used by an alias", async () => {
  docs.set("usernameAliases/newname123", { uid: "other", status: "redirect" });
  (generateDefaultUsername as jest.Mock)
    .mockReturnValueOnce("newname123")
    .mockReturnValueOnce("another123");

  const response = await POST(request());

  expect(response.status).toBe(200);
  expect(docs.get("users/owner")?.username).toBe("another123");
  expect(docs.get("usernameAliases/newname123")?.uid).toBe("other");
});

test("rotation refuses to reveal another owner's alias after removing its reservation", async () => {
  docs.set("usernameAliases/oldname", { uid: "victim", status: "redirect" });
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValue("victim");

  const response = await POST(request());

  expect(response.status).toBe(409);
  expect(writes).toHaveLength(0);
  expect(docs.get("usernames/oldname")?.uid).toBe("owner");
  expect(docs.get("usernameAliases/oldname")?.uid).toBe("victim");
});
