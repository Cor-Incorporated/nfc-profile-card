import { adminDb } from "@/lib/firebase-admin";
import {
  fetchPublicProfileByUsername,
  resolvePublicProfileOwner,
} from "./publicProfileData";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn(), getAll: jest.fn() },
}));

type TestDoc = {
  id: string;
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
};

function doc(id: string, data?: Record<string, unknown>): TestDoc {
  return { id, exists: Boolean(data), data: () => data };
}

const mockCollection = adminDb.collection as jest.Mock;
const mockGetAll = adminDb.getAll as jest.Mock;

function installFirestoreFixture({
  reservations = {},
  aliases = {},
  users = {},
  profiles = {},
}: {
  reservations?: Record<string, Record<string, unknown>>;
  aliases?: Record<string, Record<string, unknown>>;
  users?: Record<string, Record<string, unknown>>;
  profiles?: Record<string, Record<string, unknown>>;
}) {
  const userQuery = jest.fn((username: string) =>
    Object.entries(users)
      .filter(([, data]) => data.username === username)
      .map(([uid, data]) => doc(uid, data)),
  );

  mockCollection.mockImplementation((collection: string) => {
    if (collection === "users") {
      return {
        doc: (uid: string) => ({
          path: `users/${uid}`,
          collection: (name: string) => {
            if (name !== "profile")
              throw new Error(`Unexpected collection ${name}`);
            return {
              doc: (id: string) => ({ path: `users/${uid}/profile/${id}` }),
            };
          },
        }),
        where: (_field: string, _operator: string, username: string) => ({
          select: (..._fields: string[]) => ({
            limit: (_count: number) => ({
              get: async () => ({ docs: userQuery(username) }),
            }),
          }),
        }),
      };
    }

    const values = collection === "usernames" ? reservations : aliases;
    return {
      doc: (id: string) => ({
        get: async () => doc(id, values[id]),
      }),
    };
  });

  mockGetAll.mockImplementation(async (reference: { path: string }) => {
    const parts = reference.path.split("/");
    if (parts.length === 2) return [doc(parts[1], users[parts[1]])];
    return [doc("data", profiles[parts[1]])];
  });

  return { userQuery };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("reserved usernames read only public fields and load user and design concurrently", async () => {
  installFirestoreFixture({
    reservations: { alice: { uid: "uid-1" } },
    users: {
      "uid-1": {
        name: "Alice",
        username: "alice",
        privateNote: "must stay server side",
      },
    },
    profiles: { "uid-1": { components: [{ id: "intro", type: "text" }] } },
  });

  let finishUserRead!: (value: TestDoc[]) => void;
  mockGetAll.mockImplementation((reference: { path: string }) => {
    if (reference.path === "users/uid-1") {
      return new Promise<TestDoc[]>((resolve) => {
        finishUserRead = resolve;
      });
    }
    return Promise.resolve([doc("data", { components: [{ id: "intro" }] })]);
  });

  const pending = fetchPublicProfileByUsername("Alice");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mockGetAll).toHaveBeenCalledTimes(2);
  expect(mockGetAll.mock.calls.map(([reference]) => reference.path)).toEqual([
    "users/uid-1",
    "users/uid-1/profile/data",
  ]);

  finishUserRead([doc("uid-1", { name: "Alice", username: "alice" })]);
  const result = await pending;
  expect(result.user?.name).toBe("Alice");
  expect(result.user).not.toHaveProperty("privateNote");
  expect(result.profileData?.components).toEqual([{ id: "intro" }]);
  expect(mockGetAll.mock.calls[0][1].fieldMask).not.toContain("privateNote");
});

test("legacy username lookup still loads its design document", async () => {
  const { userQuery } = installFirestoreFixture({
    users: { "legacy-uid": { name: "Legacy", username: "legacy" } },
    profiles: { "legacy-uid": { background: { type: "solid" } } },
  });

  const result = await fetchPublicProfileByUsername("legacy");
  expect(result.user?.username).toBe("legacy");
  expect(result.profileData?.background).toEqual({ type: "solid" });
  expect(userQuery).toHaveBeenCalledWith("legacy");
});

test("an old URL redirects without reading unused design data", async () => {
  installFirestoreFixture({
    reservations: { newname: { uid: "uid-2" } },
    aliases: { oldname: { uid: "uid-2", status: "redirect" } },
    users: { "uid-2": { name: "Renamed", username: "newname" } },
    profiles: { "uid-2": { components: [{ id: "unused" }] } },
  });

  const result = await fetchPublicProfileByUsername("oldname");
  expect(result.redirectUsername).toBe("newname");
  expect(result.profileData).toBeNull();
  expect(mockGetAll).toHaveBeenCalledTimes(1);
});

test("a reservation wins over a forged user username", async () => {
  installFirestoreFixture({
    reservations: { alice: { uid: "owner" } },
    users: {
      owner: { name: "Alice", username: "alice" },
      attacker: { name: "Attacker", username: "alice" },
    },
  });

  expect((await fetchPublicProfileByUsername("alice")).user?.name).toBe(
    "Alice",
  );
  expect(await resolvePublicProfileOwner("alice")).toBe("owner");
});

test("a lowercase reservation cannot show a different owner at an exact mixed-case legacy URL", async () => {
  installFirestoreFixture({
    reservations: { foo: { uid: "new-owner" } },
    users: {
      "new-owner": { name: "New", username: "foo" },
      "legacy-owner": { name: "Legacy", username: "Foo" },
    },
  });

  expect(await resolvePublicProfileOwner("foo")).toBe("new-owner");
  expect(await resolvePublicProfileOwner("Foo")).toBeNull();
  expect((await fetchPublicProfileByUsername("Foo")).user).toBeNull();
});

test("a lowercase alias cannot redirect a different owner's exact mixed-case legacy URL", async () => {
  installFirestoreFixture({
    reservations: { newname: { uid: "new-owner" } },
    aliases: {
      foo: {
        uid: "new-owner",
        status: "redirect",
        targetUsername: "newname",
      },
    },
    users: {
      "new-owner": { name: "New", username: "newname" },
      "legacy-owner": { name: "Legacy", username: "Foo" },
    },
  });

  expect(await resolvePublicProfileOwner("Foo")).toBeNull();
  expect((await fetchPublicProfileByUsername("Foo")).user).toBeNull();
});

test("an alias wins over a forged user username and redirects only to its owner's reservation", async () => {
  installFirestoreFixture({
    reservations: { newname: { uid: "owner" } },
    aliases: {
      oldname: { uid: "owner", status: "redirect", targetUsername: "newname" },
    },
    users: {
      owner: { name: "Alice", username: "newname" },
      attacker: { name: "Attacker", username: "oldname" },
    },
  });

  const result = await fetchPublicProfileByUsername("oldname");
  expect(result.user?.name).toBe("Alice");
  expect(result.redirectUsername).toBe("newname");
  expect(await resolvePublicProfileOwner("oldname")).toBe("owner");
});

test("a client-edited alias target cannot redirect to another user's profile", async () => {
  installFirestoreFixture({
    reservations: { stolen: { uid: "attacker" } },
    aliases: {
      oldname: { uid: "owner", status: "redirect", targetUsername: "stolen" },
    },
    users: {
      owner: { name: "Alice", username: "stolen" },
      attacker: { name: "Attacker", username: "stolen" },
    },
  });

  const result = await fetchPublicProfileByUsername("oldname");
  expect(result.user).toBeNull();
  expect(result.redirectUsername).toBeNull();
  expect(await resolvePublicProfileOwner("oldname")).toBeNull();
});

test("an unproven redirect alias does not expose a profile at its old URL", async () => {
  installFirestoreFixture({
    aliases: { oldname: { uid: "owner", status: "redirect" } },
    users: { owner: { name: "Alice", username: "unreserved" } },
  });

  expect((await fetchPublicProfileByUsername("oldname")).user).toBeNull();
  expect(await resolvePublicProfileOwner("oldname")).toBeNull();
});

test("an alias may redirect to its owner's exact UID URL without a reservation", async () => {
  installFirestoreFixture({
    aliases: {
      oldname: {
        uid: "MixCase",
        status: "redirect",
        targetUsername: "u_MixCase",
      },
    },
    users: { MixCase: { name: "Alice", username: "u_MixCase" } },
  });

  const result = await fetchPublicProfileByUsername("oldname");
  expect(result.user?.name).toBe("Alice");
  expect(result.redirectUsername).toBe("u_MixCase");
});

test("an alias cannot redirect to a case-folded UID target even with an own reservation", async () => {
  installFirestoreFixture({
    reservations: { u_mixcase: { uid: "MixCase" } },
    aliases: {
      oldname: {
        uid: "MixCase",
        status: "redirect",
        targetUsername: "u_mixcase",
      },
    },
    users: { MixCase: { name: "Alice", username: "u_mixcase" } },
  });

  expect((await fetchPublicProfileByUsername("oldname")).user).toBeNull();
});

test("a disabled alias cannot fall through to a forged legacy username", async () => {
  installFirestoreFixture({
    aliases: { oldname: { uid: "owner", status: "disabled" } },
    users: { attacker: { name: "Attacker", username: "oldname" } },
  });

  expect((await fetchPublicProfileByUsername("oldname")).user).toBeNull();
});

test("a UID fallback resolves its own document before a forged legacy username", async () => {
  installFirestoreFixture({
    users: {
      owner: { name: "Alice", username: "alice" },
      attacker: { name: "Attacker", username: "u_owner" },
    },
  });

  expect((await fetchPublicProfileByUsername("u_owner")).user?.name).toBe(
    "Alice",
  );
  expect(await resolvePublicProfileOwner("u_owner")).toBe("owner");
});

test("a UID document and a different reserved owner fail closed", async () => {
  installFirestoreFixture({
    reservations: { u_owner: { uid: "attacker" } },
    users: {
      owner: { name: "Alice", username: "alice" },
      attacker: { name: "Attacker", username: "u_owner" },
    },
  });

  expect((await fetchPublicProfileByUsername("u_owner")).user).toBeNull();
  expect(await resolvePublicProfileOwner("u_owner")).toBeNull();
});

test("a missing UID document cannot fall through to another user's reservation", async () => {
  installFirestoreFixture({
    reservations: { u_owner: { uid: "attacker" } },
    users: { attacker: { name: "Attacker", username: "u_owner" } },
  });

  expect((await fetchPublicProfileByUsername("u_owner")).user).toBeNull();
  expect(await resolvePublicProfileOwner("u_owner")).toBeNull();
});

test("a missing UID document cannot be replaced by another user's alias", async () => {
  installFirestoreFixture({
    aliases: { u_owner: { uid: "attacker", status: "redirect" } },
    users: { attacker: { name: "Attacker", username: "elsewhere" } },
  });

  expect((await fetchPublicProfileByUsername("u_owner")).user).toBeNull();
});

test("a missing UID document cannot be replaced by a legacy username", async () => {
  installFirestoreFixture({
    users: { attacker: { name: "Attacker", username: "u_owner" } },
  });

  expect((await fetchPublicProfileByUsername("u_owner")).user).toBeNull();
});

test("mixed-case UID resolves only its exact fixed path", async () => {
  installFirestoreFixture({
    reservations: { u_mixcase: { uid: "MixCase" } },
    users: { MixCase: { name: "Alice", username: "u_mixcase" } },
  });

  expect(await resolvePublicProfileOwner("u_MixCase")).toBe("MixCase");
  expect(await resolvePublicProfileOwner("u_mixcase")).toBeNull();
});

test("a rotated mixed-case UID cannot redirect a case-folded fixed path", async () => {
  installFirestoreFixture({
    reservations: { newname: { uid: "MixCase" } },
    aliases: {
      u_mixcase: {
        uid: "MixCase",
        status: "redirect",
        targetUsername: "newname",
      },
    },
    users: { MixCase: { name: "Alice", username: "newname" } },
  });

  const result = await fetchPublicProfileByUsername("u_mixcase");
  expect(result.user).toBeNull();
  expect(result.redirectUsername).toBeNull();
  expect(await resolvePublicProfileOwner("u_mixcase")).toBeNull();
});

test("a deleted UID's fixed URL cannot be inherited by a differently cased reservation", async () => {
  installFirestoreFixture({
    reservations: { u_foo: { uid: "Foo" } },
    users: { Foo: { name: "Other", username: "u_Foo" } },
  });

  expect(await resolvePublicProfileOwner("u_foo")).toBeNull();
  expect(await resolvePublicProfileOwner("u_Foo")).toBe("Foo");
});

test("a later lowercase UID cannot inherit a different owner's redirect alias", async () => {
  installFirestoreFixture({
    reservations: { newname: { uid: "MixCase" } },
    aliases: {
      u_mixcase: {
        uid: "MixCase",
        status: "redirect",
        targetUsername: "newname",
      },
    },
    users: {
      MixCase: { name: "Alice", username: "newname" },
      mixcase: { name: "Other", username: "u_mixcase" },
    },
  });

  expect(await resolvePublicProfileOwner("u_mixcase")).toBeNull();
});

test("case-sensitive UID collisions with a different normalized reservation fail closed", async () => {
  installFirestoreFixture({
    reservations: { u_mixcase: { uid: "MixCase" } },
    users: {
      MixCase: { name: "Alice", username: "u_mixcase" },
      mixcase: { name: "Other", username: "u_mixcase" },
    },
  });

  expect(await resolvePublicProfileOwner("u_MixCase")).toBe("MixCase");
  expect(await resolvePublicProfileOwner("u_mixcase")).toBeNull();
});

test("a UID fallback alias redirects only to an owned reservation", async () => {
  installFirestoreFixture({
    reservations: { newname: { uid: "owner" } },
    aliases: {
      u_owner: { uid: "owner", status: "redirect", targetUsername: "newname" },
    },
    users: { owner: { name: "Alice", username: "newname" } },
  });

  const result = await fetchPublicProfileByUsername("u_owner");
  expect(result.user?.name).toBe("Alice");
  expect(result.redirectUsername).toBe("newname");
});

test("an alias cannot redirect to a reserved UID path owned directly by another document", async () => {
  installFirestoreFixture({
    reservations: { u_mixcase: { uid: "MixCase" } },
    aliases: {
      oldname: {
        uid: "MixCase",
        status: "redirect",
        targetUsername: "u_mixcase",
      },
    },
    users: {
      MixCase: { name: "Alice", username: "u_mixcase" },
      mixcase: { name: "Other", username: "u_mixcase" },
    },
  });

  const result = await fetchPublicProfileByUsername("oldname");
  expect(result.user).toBeNull();
  expect(result.redirectUsername).toBeNull();
});

test("UID fallback reads its alias without adding a serial lookup", async () => {
  installFirestoreFixture({
    users: { owner: { name: "Alice", username: "u_owner" } },
  });
  let finishUserRead!: (value: TestDoc[]) => void;
  mockGetAll.mockImplementation((reference: { path: string }) =>
    reference.path === "users/owner"
      ? new Promise<TestDoc[]>((resolve) => {
          finishUserRead = resolve;
        })
      : Promise.resolve([doc("data")]),
  );

  const pending = fetchPublicProfileByUsername("u_owner");
  await Promise.resolve();
  expect(mockCollection.mock.calls.map(([name]) => name)).toContain(
    "usernameAliases",
  );
  expect(mockCollection.mock.calls.map(([name]) => name)).toContain(
    "usernames",
  );
  finishUserRead([doc("owner", { name: "Alice", username: "u_owner" })]);
  expect((await pending).user?.name).toBe("Alice");
});

test("ambiguous legacy usernames fail closed", async () => {
  installFirestoreFixture({
    users: {
      first: { name: "First", username: "legacy" },
      second: { name: "Second", username: "legacy" },
    },
  });

  expect((await fetchPublicProfileByUsername("legacy")).user).toBeNull();
  expect(await resolvePublicProfileOwner("legacy")).toBeNull();
});

test("normalized and exact legacy owners must agree", async () => {
  installFirestoreFixture({
    users: {
      first: { name: "First", username: "legacy" },
      second: { name: "Second", username: "Legacy" },
    },
  });

  expect((await fetchPublicProfileByUsername("Legacy")).user).toBeNull();
  expect((await fetchPublicProfileByUsername("LEGACY")).user).toBeNull();
});

test("a stale reservation cannot fall through to a client-edited username", async () => {
  installFirestoreFixture({
    reservations: { alice: { uid: "deleted" } },
    users: { attacker: { name: "Attacker", username: "alice" } },
  });

  expect((await fetchPublicProfileByUsername("alice")).user).toBeNull();
});

test("a design read failure still returns the basic user profile", async () => {
  installFirestoreFixture({
    reservations: { alice: { uid: "uid-1" } },
    users: { "uid-1": { name: "Alice", username: "alice" } },
  });
  mockGetAll.mockImplementation((reference: { path: string }) =>
    reference.path.endsWith("/profile/data")
      ? Promise.reject(new Error("profile unavailable"))
      : Promise.resolve([doc("uid-1", { name: "Alice", username: "alice" })]),
  );
  const log = jest.spyOn(console, "error").mockImplementation(() => {});

  try {
    const result = await fetchPublicProfileByUsername("alice");
    expect(result.user?.name).toBe("Alice");
    expect(result.profileData).toBeNull();
    expect(mockGetAll).toHaveBeenCalledTimes(2);
  } finally {
    log.mockRestore();
  }
});
