import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { resolvePublicProfileOwner } from "@/lib/profile/publicProfileData";
import { PATCH } from "./route";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn(), runTransaction: jest.fn() },
  verifyIdToken: jest.fn(),
}));
jest.mock("@/lib/profile/publicProfileData", () => ({
  resolvePublicProfileOwner: jest.fn(),
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
  options: {
    addConflictingUidBeforeTransaction?: string;
    rotateToBeforeTransaction?: string;
  } = {},
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
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValue(uid);
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
    if (options.rotateToBeforeTransaction) {
      userDocs.set(uid, {
        ...userDocs.get(uid),
        username: options.rotateToBeforeTransaction,
      });
      reservations.set(options.rotateToBeforeTransaction, { uid });
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
  expectedUsername?: string,
) {
  return {
    headers: { get: () => "Bearer synthetic-token" },
    json: async () => ({
      usernameMode,
      username,
      legacyUrlAction,
      expectedUsername,
    }),
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

  const response = await PATCH(request("uid", undefined, "disable"));

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

test("a verified old URL keeps a disabled ownership record", async () => {
  const store = setupStore("owner", { owner: { username: "oldname" } });
  store.reservations.set("oldname", { uid: "owner" });

  const response = await PATCH(request("custom", "newname", "disable"));

  expect(response.status).toBe(200);
  expect(store.aliases.get("oldname")).toMatchObject({
    uid: "owner",
    status: "disabled",
  });
});

test("an unreserved legacy field becomes an ownerless quarantine tombstone", async () => {
  const store = setupStore("owner", { owner: { username: "oldname" } });

  const response = await PATCH(request("custom", "newname", "disable"));

  expect(response.status).toBe(200);
  expect(store.aliases.get("oldname")).toMatchObject({
    uid: null,
    status: "disabled",
    quarantined: true,
  });
  expect(store.userDocs.get("owner")?.username).toBe("newname");
});

test("another user's UID URL is not quarantined by a forged legacy field", async () => {
  const store = setupStore("owner", {
    owner: { username: "u_victim" },
    victim: { username: "u_victim" },
  });
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValueOnce("victim");

  const response = await PATCH(request("custom", "newname", "disable"));

  expect(response.status).toBe(200);
  expect(store.aliases.has("u_victim")).toBe(false);
  expect(store.userDocs.get("victim")?.username).toBe("u_victim");
});

test("redirect rejects an unreserved legacy field even when it is unique", async () => {
  const store = setupStore("owner", { owner: { username: "oldname" } });

  const response = await PATCH(request("custom", "newname"));

  expect(response.status).toBe(409);
  expect(store.writes).toHaveLength(0);
});

test("a forged old public URL cannot become a redirect", async () => {
  const store = setupStore("owner", { owner: { username: "victim" } });
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValueOnce("victim-uid");

  const response = await PATCH(request("custom", "newname"));

  expect(response.status).toBe(409);
  expect(store.writes).toHaveLength(0);
});

test("a competing old alias is retained when the caller disables redirects", async () => {
  const store = setupStore("owner", { owner: { username: "oldname" } });
  store.aliases.set("oldname", { uid: "other", status: "redirect" });
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValueOnce(null);

  const response = await PATCH({
    headers: { get: () => "Bearer synthetic-token" },
    json: async () => ({
      usernameMode: "custom",
      username: "newname",
      legacyUrlAction: "disable",
    }),
  } as never);

  expect(response.status).toBe(200);
  expect(store.aliases.get("oldname")).toEqual({
    uid: "other",
    status: "redirect",
  });
});

test("renaming cannot reveal another user's alias behind an own reservation", async () => {
  const store = setupStore("owner", { owner: { username: "oldname" } });
  store.reservations.set("oldname", { uid: "owner" });
  store.aliases.set("oldname", { uid: "victim", status: "redirect" });

  const response = await PATCH(request("custom", "newname", "disable"));

  expect(response.status).toBe(409);
  expect(store.writes).toHaveLength(0);
  expect(store.reservations.get("oldname")?.uid).toBe("owner");
});

test("another owner's disabled alias cannot be claimed as a new username", async () => {
  const store = setupStore("owner", { owner: { username: "oldname" } });
  store.aliases.set("newname", { uid: "victim", status: "disabled" });

  const response = await PATCH(request("custom", "newname", "disable"));

  expect(response.status).toBe(409);
  expect(store.writes).toHaveLength(0);
  expect(store.aliases.get("newname")).toMatchObject({ uid: "victim" });
});

test("a forged expected username cannot skip ownership checks on first save", async () => {
  const store = setupStore("owner", {
    owner: { username: "" },
    victim: { username: "victimlegacy" },
  });

  const response = await PATCH(
    request("custom", "victimlegacy", "disable", "victimlegacy"),
  );

  expect(response.status).toBe(409);
  expect(store.writes).toHaveLength(0);
  expect(store.userDocs.get("owner")?.username).toBe("");
});

test("a stale basic save preserves a concurrent username rotation", async () => {
  const store = setupStore(
    "owner",
    { owner: { username: "oldname" } },
    { rotateToBeforeTransaction: "newname" },
  );

  const response = await PATCH(request("custom", "oldname"));

  expect(response.status).toBe(200);
  expect(store.userDocs.get("owner")?.username).toBe("newname");
  expect(store.reservations.get("newname")?.uid).toBe("owner");
  expect(store.aliases.has("newname")).toBe(false);
  expect((await response.json()).profile.username).toBe("newname");
});

test("a stale editor also preserves a rotation completed before preflight", async () => {
  const store = setupStore("owner", { owner: { username: "newname" } });
  store.reservations.set("newname", { uid: "owner" });

  const response = await PATCH(
    request("custom", "oldname", "redirect", "oldname"),
  );

  expect(response.status).toBe(200);
  expect(store.userDocs.get("owner")?.username).toBe("newname");
  expect(store.aliases.has("newname")).toBe(false);
  expect((await response.json()).profile.username).toBe("newname");
});

test("an explicit stale rename cannot overwrite a concurrent rotation", async () => {
  const store = setupStore(
    "owner",
    { owner: { username: "oldname" } },
    { rotateToBeforeTransaction: "newname" },
  );

  const response = await PATCH(request("custom", "anothername"));

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "username_stale" });
  expect(store.writes).toHaveLength(0);
  expect(store.userDocs.get("owner")?.username).toBe("newname");
  expect(store.reservations.get("newname")?.uid).toBe("owner");
});

test("an explicit stale rename is rejected when rotation finished before preflight", async () => {
  const store = setupStore("owner", { owner: { username: "newname" } });
  store.reservations.set("newname", { uid: "owner" });

  const response = await PATCH(
    request("custom", "anothername", "redirect", "oldname"),
  );

  expect(response.status).toBe(409);
  expect(store.writes).toHaveLength(0);
  expect(store.userDocs.get("owner")?.username).toBe("newname");
});
