type StoredDocument = Record<string, unknown>;
type FakeDocumentReference = {
  path: string;
  collection(name: string): {
    doc(id: string): FakeDocumentReference;
  };
};
type FakeSnapshot = {
  exists: boolean;
  data(): StoredDocument | undefined;
};

const mockStore = new Map<string, StoredDocument>();
const mockVersions = new Map<string, number>();
const mockWrites: Array<{ path: string; data: StoredDocument }> = [];
let mockTransactionAttempts = 0;

function mockDocument(path: string): FakeDocumentReference {
  return {
    path,
    collection: (name: string) => ({
      doc: (id: string) => mockDocument(`${path}/${name}/${id}`),
    }),
  };
}

const mockRunTransaction = jest.fn(
  async <T>(
    callback: (transaction: {
      getAll(...refs: FakeDocumentReference[]): Promise<FakeSnapshot[]>;
      set(ref: FakeDocumentReference, data: StoredDocument): void;
    }) => Promise<T>,
  ): Promise<T> => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      mockTransactionAttempts += 1;
      const readVersions = new Map<string, number>();
      const pending: Array<{ path: string; data: StoredDocument }> = [];
      const result = await callback({
        getAll: async (...refs) => {
          return refs.map((ref) => {
            const data = mockStore.get(ref.path);
            readVersions.set(ref.path, mockVersions.get(ref.path) ?? 0);
            return {
              exists: data !== undefined,
              data: () => data,
            };
          });
        },
        set: (ref, data) => {
          pending.push({ path: ref.path, data });
        },
      });

      await Promise.resolve();
      const conflicted = [...readVersions].some(
        ([path, version]) => (mockVersions.get(path) ?? 0) !== version,
      );
      if (conflicted) continue;

      for (const write of pending) {
        mockStore.set(write.path, write.data);
        mockVersions.set(write.path, (mockVersions.get(write.path) ?? 0) + 1);
        mockWrites.push(write);
      }
      return result;
    }

    throw new Error("transaction contention retries exhausted");
  },
);

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: (name: string) => ({
      doc: (id: string) => mockDocument(`${name}/${id}`),
    }),
    runTransaction: (...args: Parameters<typeof mockRunTransaction>) =>
      mockRunTransaction(...args),
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => "server-timestamp"),
  },
}));

import {
  getGeminiBudgetCaps,
  reserveGeminiFallbackBudget,
} from "./geminiBudgetService.server";

describe("Gemini fallback budget reservation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OCR_GEMINI_USER_MONTHLY_CAP;
    delete process.env.OCR_GEMINI_GLOBAL_DAILY_CAP;
    mockStore.clear();
    mockVersions.clear();
    mockWrites.length = 0;
    mockTransactionAttempts = 0;
    mockRunTransaction.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function setCaps(userMonthly: string, globalDaily: string) {
    process.env.OCR_GEMINI_USER_MONTHLY_CAP = userMonthly;
    process.env.OCR_GEMINI_GLOBAL_DAILY_CAP = globalDaily;
  }

  it("defaults both caps to zero and does not open a transaction", async () => {
    expect(getGeminiBudgetCaps()).toEqual({
      userMonthly: 0,
      globalDaily: 0,
    });

    await expect(
      reserveGeminiFallbackBudget("uid-1", {
        now: new Date("2026-08-31T12:00:00Z"),
      }),
    ).resolves.toEqual({ allowed: false, reason: "disabled" });
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("allows only one concurrent reservation at the user monthly cap", async () => {
    setCaps("1", "10");
    const now = new Date("2026-08-31T12:00:00Z");

    const results = await Promise.all([
      reserveGeminiFallbackBudget("uid-1", { now }),
      reserveGeminiFallbackBudget("uid-1", { now }),
    ]);

    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    expect(results.filter((result) => !result.allowed)).toEqual([
      { allowed: false, reason: "user_monthly_cap" },
    ]);
    expect(
      mockStore.get("users/uid-1/geminiFallbackBudgets/2026-08"),
    ).toMatchObject({ count: 1 });
    expect(
      mockStore.get("geminiFallbackGlobalBudgets/2026-08-31"),
    ).toMatchObject({ count: 1 });
    expect(mockTransactionAttempts).toBeGreaterThan(2);
    expect(mockWrites).toHaveLength(2);
  });

  it("allows only one concurrent reservation at the global daily cap", async () => {
    setCaps("10", "1");
    const now = new Date("2026-08-31T12:00:00Z");

    const results = await Promise.all([
      reserveGeminiFallbackBudget("uid-1", { now }),
      reserveGeminiFallbackBudget("uid-2", { now }),
    ]);

    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    expect(results.filter((result) => !result.allowed)).toEqual([
      { allowed: false, reason: "global_daily_cap" },
    ]);
    expect(
      mockStore.get("geminiFallbackGlobalBudgets/2026-08-31"),
    ).toMatchObject({ count: 1 });
    expect(mockTransactionAttempts).toBeGreaterThan(2);
    expect(mockWrites).toHaveLength(2);
  });

  it("fails closed when the transaction fails", async () => {
    setCaps("10", "10");
    mockRunTransaction.mockRejectedValueOnce(
      new Error("firestore unavailable"),
    );

    await expect(
      reserveGeminiFallbackBudget("uid-1", {
        now: new Date("2026-08-31T12:00:00Z"),
      }),
    ).rejects.toThrow("firestore unavailable");
    expect(mockWrites).toHaveLength(0);
  });

  it("does not commit a reservation when the deadline expires during reads", async () => {
    setCaps("10", "10");
    const now = jest
      .spyOn(Date, "now")
      .mockReturnValueOnce(900)
      .mockReturnValue(1000);

    await expect(
      reserveGeminiFallbackBudget("uid-1", {
        now: new Date("2026-08-31T12:00:00Z"),
        deadlineAtMs: 1000,
      }),
    ).rejects.toThrow("deadline exceeded");
    expect(mockWrites).toHaveLength(0);
    expect(mockStore.size).toBe(0);
    now.mockRestore();
  });

  it("stores counters and periods without card or user fields", async () => {
    setCaps("10", "10");

    await reserveGeminiFallbackBudget("uid-without-card-data", {
      now: new Date("2026-08-31T12:00:00Z"),
    });

    expect(mockWrites).toHaveLength(2);
    for (const write of mockWrites) {
      expect(Object.keys(write.data).sort()).toEqual([
        "count",
        "period",
        "updatedAt",
      ]);
      expect(JSON.stringify(write.data)).not.toMatch(
        /image|contact|email|phone|address|userId/i,
      );
    }
  });

  it("uses distinct UTC documents across the month and day boundary", async () => {
    setCaps("1", "1");

    const before = await reserveGeminiFallbackBudget("uid-1", {
      now: new Date("2026-08-31T23:59:59.999Z"),
    });
    const after = await reserveGeminiFallbackBudget("uid-1", {
      now: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(before.allowed).toBe(true);
    expect(after.allowed).toBe(true);
    expect(mockStore.has("users/uid-1/geminiFallbackBudgets/2026-08")).toBe(
      true,
    );
    expect(mockStore.has("users/uid-1/geminiFallbackBudgets/2026-09")).toBe(
      true,
    );
    expect(mockStore.has("geminiFallbackGlobalBudgets/2026-08-31")).toBe(true);
    expect(mockStore.has("geminiFallbackGlobalBudgets/2026-09-01")).toBe(true);
  });

  it("fails closed on corrupt counters or invalid cap values", async () => {
    setCaps("invalid", "10");
    expect(getGeminiBudgetCaps()).toEqual({
      userMonthly: 0,
      globalDaily: 10,
    });
    await expect(
      reserveGeminiFallbackBudget("uid-1", {
        now: new Date("2026-08-31T12:00:00Z"),
      }),
    ).resolves.toEqual({ allowed: false, reason: "disabled" });

    setCaps("10", "10");
    mockStore.set("users/uid-1/geminiFallbackBudgets/2026-08", {
      count: "corrupt",
    });
    await expect(
      reserveGeminiFallbackBudget("uid-1", {
        now: new Date("2026-08-31T12:00:00Z"),
      }),
    ).rejects.toThrow("counter is invalid");
  });
});
