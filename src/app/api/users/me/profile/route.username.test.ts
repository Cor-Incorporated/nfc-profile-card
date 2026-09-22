import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { PATCH } from "./route";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn(), runTransaction: jest.fn() },
  verifyIdToken: jest.fn(),
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "server-timestamp",
    arrayUnion: (value: string) => ({ arrayUnion: value }),
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

type User = { username?: string; [key: string]: unknown };

function setupStore(
  uid: string,
  users: Record<string, User>,
  options: { addConflictingUidBeforeTransaction?: string } = {},
) {
  const userDocs = new Map(Object.entries(users));
  const reservations = new Map<string, Record<string, unknown>>();
  const aliases = new Map<string, Record<string, unknown>>();
  const writes: Array<{ kind: string; path: string }> = [];

  const read = (reference: { path?: string; username?: string }) => {
    if (reference.username !== undefined) {
      const docs = [...userDocs.entries()]
        .filter(([, user]) => user.username === reference.username)
        .map(([id]) => ({ id }));
      return { empty: docs.length === 0, docs };
    }
    const [collection, id] = (reference.path || "").split("/");
    const data =
      collection === "users"
        ? userDocs.get(id)
        : collection === "usernames"
          ? reservations.get(id)
          : collection === "usernameAliases"
            ? aliases.get(id)
            : undefined;
    return { id, exists: !!data, data: () => data };
  };

  (verifyIdToken as jest.Mock).mockResolvedValue({ success: true, uid });
  (adminDb.collection as jest.Mock).mockImplementation(
    (collection: string) => ({
      doc: (id: string) => ({
        path: `${collection}/${id}`,
        get: async () => read({ path: `${collection}/${id}` }),
        collection: (subcollection: string) => ({
          doc: (subId: string) => ({
            path: `${collection}/${id}/${subcollection}/${subId}`,
          }),
        }),
      }),
      where: (_field: string, _op: string, username: string) => ({
        limit: () => ({
          username,
          get: async () => read({ username }),
        }),
      }),
    }),
  );
  (adminDb.runTransaction as jest.Mock).mockImplementation(async (callback) => {
    if (options.addConflictingUidBeforeTransaction) {
      userDocs.set(options.addConflictingUidBeforeTransaction, {});
    }
    const pending: Array<() => void> = [];
    const result = await callback({
      get: async (reference: { path?: string; username?: string }) =>
        read(reference),
      set: (reference: { path: string }, data: User) => {
        pending.push(() => {
          writes.push({ kind: "set", path: reference.path });
          if (reference.path.startsWith("users/")) {
            userDocs.set(uid, { ...userDocs.get(uid), ...data });
          } else if (reference.path.startsWith("usernames/")) {
            reservations.set(reference.path.slice(10), data);
          } else {
            aliases.set(reference.path.slice(16), data);
          }
        });
      },
      delete: (reference: { path: string }) => {
        pending.push(() => {
          writes.push({ kind: "delete", path: reference.path });
          if (reference.path.startsWith("usernames/")) {
            reservations.delete(reference.path.slice(10));
          } else {
            aliases.delete(reference.path.slice(16));
          }
        });
      },
    });
    pending.forEach((write) => write());
    return result;
  });
  return { userDocs, reservations, aliases, writes };
}

function request(
  usernameMode: string,
  username?: string,
  legacyUrlAction = "redirect",
) {
  return {
    headers: { get: () => "Bearer synthetic-token" },
    json: async () => ({ usernameMode, username, legacyUrlAction }),
  } as never;
}

beforeEach(() => jest.clearAllMocks());

test("UID with removed characters cannot claim another UID's URL", async () => {
  const store = setupStore("a:b", { "a:b": { username: "oldname" } });

  const response = await PATCH(request("uid"));

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "username_invalid" });
  expect(adminDb.runTransaction).not.toHaveBeenCalled();
  expect(store.userDocs.get("a:b")?.username).toBe("oldname");
});

test("mixed-case UID keeps its exact public URL", async () => {
  const store = setupStore("MixCase", {
    MixCase: { username: "oldname" },
  });

  const response = await PATCH(request("uid"));

  expect(response.status).toBe(200);
  expect(store.userDocs.get("MixCase")?.username).toBe("u_MixCase");
  expect(store.reservations.get("u_mixcase")?.uid).toBe("MixCase");
});

test("mixed-case UID refuses a lower-case direct UID collision", async () => {
  const store = setupStore("MixCase", {
    MixCase: { username: "oldname" },
    mixcase: { username: "other" },
  });

  const response = await PATCH(request("uid"));

  expect(response.status).toBe(409);
  expect(store.writes).toHaveLength(0);
  expect(store.userDocs.get("MixCase")?.username).toBe("oldname");
});

test("a direct UID appearing during the transaction aborts the rename", async () => {
  const store = setupStore(
    "MixCase",
    { MixCase: { username: "oldname" } },
    { addConflictingUidBeforeTransaction: "mixcase" },
  );

  const response = await PATCH(request("uid"));

  expect(response.status).toBe(409);
  expect(store.writes).toHaveLength(0);
});

test("correcting case of a UID URL keeps its reservation and history", async () => {
  const store = setupStore("MixCase", {
    MixCase: { username: "u_mixcase", previousUsernames: ["first-name"] },
  });

  const response = await PATCH(request("uid"));

  expect(response.status).toBe(200);
  expect(store.userDocs.get("MixCase")?.username).toBe("u_MixCase");
  expect(store.userDocs.get("MixCase")?.previousUsernames).toEqual([
    "first-name",
  ]);
  expect(store.reservations.get("u_mixcase")?.uid).toBe("MixCase");
  expect(store.aliases.has("u_mixcase")).toBe(false);
});
