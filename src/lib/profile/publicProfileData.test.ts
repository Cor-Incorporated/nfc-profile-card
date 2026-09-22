import { adminDb } from "@/lib/firebase-admin";
import { fetchPublicProfileByUsername } from "./publicProfileData";

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
    aliases: { oldname: { uid: "uid-2", status: "redirect" } },
    users: { "uid-2": { name: "Renamed", username: "newname" } },
    profiles: { "uid-2": { components: [{ id: "unused" }] } },
  });

  const result = await fetchPublicProfileByUsername("oldname");
  expect(result.redirectUsername).toBe("newname");
  expect(result.profileData).toBeNull();
  expect(mockGetAll).toHaveBeenCalledTimes(1);
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
