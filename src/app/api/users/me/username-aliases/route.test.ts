import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { GET, PATCH } from "./route";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn(),
    getAll: jest.fn(),
    runTransaction: jest.fn(),
  },
  verifyIdToken: jest.fn(),
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "server-timestamp" },
}));
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, options?: { status?: number }) => ({
      status: options?.status || 200,
      json: async () => body,
    }),
  },
}));

function request(aliasUsername = "oldname", action = "redirect") {
  return {
    headers: { get: () => "Bearer synthetic-token" },
    json: async () => ({ aliasUsername, action }),
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  (verifyIdToken as jest.Mock).mockResolvedValue({
    success: true,
    uid: "owner",
  });
  (adminDb.collection as jest.Mock).mockImplementation((name: string) => ({
    doc: (id: string) =>
      name === "users"
        ? {
            path: `${name}/${id}`,
            get: async () => ({
              exists: true,
              data: () => ({
                username: "newname",
                previousUsernames: ["oldname"],
              }),
            }),
          }
        : { path: `${name}/${id}` },
    where: (_field: string, _operator: string, username: string) => ({
      limit: () => ({ username }),
    }),
  }));
});

test("a quarantined old URL is shown as requiring ownership review", async () => {
  (adminDb.getAll as jest.Mock).mockImplementation(
    async (...references: Array<{ path: string }>) =>
      references.map((reference) => ({
        exists: reference.path === "usernameAliases/oldname",
        data: () => ({ uid: null, status: "disabled", quarantined: true }),
      })),
  );

  const response = await GET(request());

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    aliases: [{ username: "oldname", status: "disabled", canManage: false }],
  });
});

test("a mixed-case UID's lowercase old URL is not shown as manageable", async () => {
  (verifyIdToken as jest.Mock).mockResolvedValue({
    success: true,
    uid: "MixCase",
  });
  (adminDb.collection as jest.Mock).mockImplementation((name: string) => ({
    doc: (id: string) => ({
      path: `${name}/${id}`,
      get: async () => ({
        exists: true,
        data: () => ({
          username: "newname",
          previousUsernames: ["u_MixCase"],
        }),
      }),
    }),
  }));
  (adminDb.getAll as jest.Mock).mockImplementation(
    async (...references: Array<{ path: string }>) =>
      references.map((reference) => ({
        exists: reference.path === "usernameAliases/u_mixcase",
        data: () => ({ uid: "MixCase", status: "redirect" }),
      })),
  );

  const response = await GET(request());

  expect(await response.json()).toMatchObject({
    aliases: [{ username: "u_mixcase", status: "disabled", canManage: false }],
  });
});

function installOwners(
  legacyOwnerIds: string[],
  {
    aliasOwner,
    directUidOwner,
    reservationOwner,
    currentReservationOwner = "owner",
    uid = "owner",
  }: {
    aliasOwner?: string;
    directUidOwner?: string;
    reservationOwner?: string;
    currentReservationOwner?: string | null;
    uid?: string;
  } = {},
) {
  const set = jest.fn();
  const remove = jest.fn();
  (adminDb.runTransaction as jest.Mock).mockImplementation(
    async (callback: (transaction: unknown) => Promise<unknown>) =>
      callback({
        get: async (reference: { path?: string; username?: string }) => {
          if (reference.username) {
            return { docs: legacyOwnerIds.map((id) => ({ id })) };
          }
          if (reference.path === `users/${uid}`) {
            return {
              exists: true,
              data: () => ({
                username: "newname",
                previousUsernames: ["oldname", "u_victim", "u_mixcase"],
              }),
            };
          }
          if (reference.path?.startsWith("usernameAliases/") && aliasOwner) {
            return {
              exists: true,
              data: () => ({ uid: aliasOwner, status: "disabled" }),
            };
          }
          if (
            reference.path === "usernames/newname" &&
            currentReservationOwner
          ) {
            return {
              exists: true,
              data: () => ({ uid: currentReservationOwner }),
            };
          }
          if (reference.path?.startsWith("usernames/") && reservationOwner) {
            return {
              exists: true,
              data: () => ({ uid: reservationOwner }),
            };
          }
          if (reference.path === "users/victim" && directUidOwner) {
            return {
              id: directUidOwner,
              exists: true,
              data: () => ({ username: "someone" }),
            };
          }
          return { exists: false, data: () => undefined };
        },
        set,
        delete: remove,
      }),
  );
  return { set, remove };
}

test("a forged previous username cannot redirect another user's active legacy URL", async () => {
  const { set } = installOwners(["victim"], { aliasOwner: "owner" });

  const response = await PATCH(request());

  expect(response.status).toBe(409);
  expect(set).not.toHaveBeenCalled();
});

test("the original owner's previous URL may still redirect", async () => {
  const { set } = installOwners(["owner"], { aliasOwner: "owner" });

  const response = await PATCH(request());

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    alias: { username: "oldname", canManage: true },
  });
  expect(set).toHaveBeenCalledWith(
    { path: "usernameAliases/oldname" },
    expect.objectContaining({ uid: "owner", targetUsername: "newname" }),
  );
});

test("the owner's server reservation can prove an old URL", async () => {
  const { set, remove } = installOwners([], { reservationOwner: "owner" });

  const response = await PATCH(request());

  expect(response.status).toBe(200);
  expect(set).toHaveBeenCalledWith(
    { path: "usernameAliases/oldname" },
    expect.objectContaining({ uid: "owner", status: "redirect" }),
  );
  expect(remove).toHaveBeenCalledWith({ path: "usernames/oldname" });
});

test("unverified legacy history cannot create a new redirect", async () => {
  const { set } = installOwners([]);

  const response = await PATCH(request());

  expect(response.status).toBe(400);
  expect(set).not.toHaveBeenCalled();
});

test("disabling a trusted alias keeps an ownership tombstone", async () => {
  const { set } = installOwners([], { aliasOwner: "owner" });

  const response = await PATCH(request("oldname", "disable"));

  expect(response.status).toBe(200);
  expect(set).toHaveBeenCalledWith(
    { path: "usernameAliases/oldname" },
    expect.objectContaining({ uid: "owner", status: "disabled" }),
  );
});

test("a saved alias cannot claim another user's UID fallback path", async () => {
  const { set } = installOwners([], {
    aliasOwner: "owner",
    directUidOwner: "victim",
  });

  const response = await PATCH(request("u_victim"));

  expect(response.status).toBe(409);
  expect(set).not.toHaveBeenCalled();
});

test("a mixed-case UID cannot activate its lowercase fixed path as an alias", async () => {
  const { set } = installOwners([], {
    uid: "MixCase",
    aliasOwner: "MixCase",
  });
  (verifyIdToken as jest.Mock).mockResolvedValue({
    success: true,
    uid: "MixCase",
  });

  const response = await PATCH(request("u_mixcase"));

  expect(response.status).toBe(409);
  expect(set).not.toHaveBeenCalled();
});

test("redirect refuses a current URL without a trusted reservation", async () => {
  const { set, remove } = installOwners([], {
    aliasOwner: "owner",
    currentReservationOwner: null,
  });

  const response = await PATCH(request());

  expect(response.status).toBe(400);
  expect(set).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
