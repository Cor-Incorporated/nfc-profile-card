import { spawnSync } from "node:child_process";
import path from "node:path";

const auditScript = path.resolve(
  process.cwd(),
  "scripts/audit-profile-ownership.cjs",
);
const fixturePath = path.resolve(
  process.cwd(),
  "scripts/fixtures/profile-ownership-audit.json",
);
const falseGreenFixturePath = path.resolve(
  process.cwd(),
  "scripts/fixtures/profile-ownership-audit-false-green.json",
);
const { auditProfileOwnership } = require(auditScript);

test("audit counts ownership conflicts without logging identifiers", () => {
  const result = spawnSync(
    process.execPath,
    [auditScript, "--fixture", fixturePath],
    {
      encoding: "utf8",
    },
  );

  expect(result.status).toBe(2);
  expect(result.stderr).toBe("");
  expect(result.stdout).not.toMatch(/Foo|alice|uid-a|MixCase/);
  expect(JSON.parse(result.stdout)).toEqual({
    scanned: { users: 6, reservations: 3, aliases: 5 },
    counts: {
      noncanonicalReservationIds: 0,
      noncanonicalAliasIds: 0,
      orphanedReservations: 1,
      staleReservations: 0,
      invalidAliasStatuses: 0,
      casefoldMultiUidGroups: 1,
      reservationLegacyConflicts: 1,
      reservationAliasConflicts: 0,
      maskedDisabledAliases: 0,
      maskedRedirectAliases: 0,
      aliasLegacyConflicts: 1,
      unreservedLegacyProfiles: 4,
      invalidRedirectAliases: 1,
      uidFallbackConflicts: 1,
      uidAliasConflicts: 0,
      maskedUidDisabledAliases: 0,
      uidCasefoldReservations: 1,
      noncanonicalUidProfileUrls: 0,
      unsafeUidAliases: 1,
      ownerlessQuarantines: 1,
      unverifiedHistoryEntries: 1,
    },
    blockers: 13,
    canRelease: false,
  });
});

test("running without an explicit data source never starts a live scan", () => {
  const result = spawnSync(process.execPath, [auditScript], {
    encoding: "utf8",
  });

  expect(result.status).toBe(64);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("--fixture");
});

test("CLI blocks previously missed masked redirects and fixed UID conflicts", () => {
  const result = spawnSync(
    process.execPath,
    [auditScript, "--fixture", falseGreenFixturePath],
    { encoding: "utf8" },
  );

  expect(result.status).toBe(2);
  expect(result.stderr).toBe("");
  expect(result.stdout).not.toMatch(/oldname|newname|Old-C|u_B/);
  const summary = JSON.parse(result.stdout);
  expect(summary.counts.maskedRedirectAliases).toBe(1);
  expect(summary.counts.invalidRedirectAliases).toBeGreaterThan(0);
  expect(summary.counts.uidAliasConflicts).toBe(1);
  expect(summary.counts.noncanonicalAliasIds).toBe(1);
  expect(summary.canRelease).toBe(false);
});

test("a reservation that masks a disabled alias blocks release", () => {
  const summary = auditProfileOwnership({
    users: [{ id: "owner", username: "newname" }],
    reservations: [
      { id: "newname", uid: "owner" },
      { id: "oldname", uid: "owner" },
    ],
    aliases: [{ id: "oldname", uid: "owner", status: "disabled" }],
  });

  expect(summary.counts.maskedDisabledAliases).toBe(1);
  expect(summary.canRelease).toBe(false);
});

test("a reservation and alias with different owners block release", () => {
  const summary = auditProfileOwnership({
    users: [
      { id: "owner", username: "newname" },
      { id: "other", username: "othername" },
    ],
    reservations: [
      { id: "newname", uid: "owner" },
      { id: "othername", uid: "other" },
      { id: "oldname", uid: "other" },
    ],
    aliases: [
      {
        id: "oldname",
        uid: "owner",
        status: "redirect",
        targetUsername: "newname",
      },
    ],
  });

  expect(summary.counts.reservationAliasConflicts).toBe(1);
  expect(summary.canRelease).toBe(false);
});

test("a reservation that masks a redirect alias blocks release", () => {
  const summary = auditProfileOwnership({
    users: [{ id: "owner", username: "newname" }],
    reservations: [
      { id: "newname", uid: "owner" },
      { id: "oldname", uid: "owner" },
    ],
    aliases: [
      {
        id: "oldname",
        uid: "owner",
        status: "redirect",
        targetUsername: "newname",
      },
    ],
  });

  expect(summary.counts.maskedRedirectAliases).toBe(1);
  expect(summary.canRelease).toBe(false);
});

test("an alias whose user document is missing has no verified target", () => {
  const summary = auditProfileOwnership({
    users: [],
    reservations: [],
    aliases: [
      {
        id: "oldname",
        uid: "missing",
        status: "redirect",
        targetUsername: "u_missing",
      },
    ],
  });

  expect(summary.counts.invalidRedirectAliases).toBe(1);
  expect(summary.canRelease).toBe(false);
});

test("a legacy lowercase UID value that now resolves to 404 blocks release", () => {
  const summary = auditProfileOwnership({
    users: [{ id: "MixCase", username: "u_mixcase" }],
    reservations: [{ id: "u_mixcase", uid: "MixCase" }],
    aliases: [],
  });

  expect(summary.counts.noncanonicalUidProfileUrls).toBe(1);
  expect(summary.canRelease).toBe(false);
});

test("a case-folded UID reservation requires migration even when the exact UID URL works", () => {
  const summary = auditProfileOwnership({
    users: [
      { id: "owner", username: "alice" },
      { id: "MixCase", username: "u_MixCase" },
    ],
    reservations: [
      { id: "alice", uid: "owner" },
      { id: "u_mixcase", uid: "MixCase" },
    ],
    aliases: [
      {
        id: "oldname",
        uid: "owner",
        status: "redirect",
        targetUsername: "alice",
      },
    ],
  });

  expect(summary.canRelease).toBe(false);
  expect(summary.counts.uidCasefoldReservations).toBe(1);
});

test("an exact UID redirect target is invalid when a foreign alias masks its path", () => {
  const summary = auditProfileOwnership({
    users: [
      { id: "A", username: "u_A" },
      { id: "B", username: "bee" },
    ],
    reservations: [{ id: "bee", uid: "B" }],
    aliases: [
      {
        id: "oldname",
        uid: "A",
        status: "redirect",
        targetUsername: "u_A",
      },
      { id: "u_a", uid: "B", status: "disabled" },
    ],
  });

  expect(summary.counts.invalidRedirectAliases).toBe(1);
  expect(summary.counts.uidAliasConflicts).toBe(1);
  expect(summary.canRelease).toBe(false);
});

test("a disabled alias from another owner cannot mask a mixed-case UID path", () => {
  const summary = auditProfileOwnership({
    users: [{ id: "A", username: "u_A" }],
    reservations: [],
    aliases: [{ id: "u_a", uid: "B", status: "disabled" }],
  });

  expect(summary.counts.uidAliasConflicts).toBe(1);
  expect(summary.canRelease).toBe(false);
});

test("noncanonical record IDs and stale reservations cannot produce a green audit", () => {
  const summary = auditProfileOwnership({
    users: [{ id: "owner", username: "newname" }],
    reservations: [
      { id: "newname", uid: "owner" },
      { id: "Oldname", uid: "owner" },
    ],
    aliases: [
      {
        id: "Oldname",
        uid: "owner",
        status: "redirect",
        targetUsername: "newname",
      },
    ],
  });

  expect(summary.counts.noncanonicalReservationIds).toBe(1);
  expect(summary.counts.noncanonicalAliasIds).toBe(1);
  expect(summary.counts.staleReservations).toBe(1);
  expect(summary.canRelease).toBe(false);
});

test("an unknown alias status and unverified history block the release gate", () => {
  const summary = auditProfileOwnership({
    users: [
      { id: "owner", username: "newname", previousUsernames: ["oldname"] },
    ],
    reservations: [{ id: "newname", uid: "owner" }],
    aliases: [{ id: "unknown", uid: "owner", status: "pending" }],
  });

  expect(summary.counts.invalidAliasStatuses).toBe(1);
  expect(summary.counts.unverifiedHistoryEntries).toBe(1);
  expect(summary.canRelease).toBe(false);
});

test("a neutral quarantine without a competing owner is informational", () => {
  const summary = auditProfileOwnership({
    users: [],
    reservations: [],
    aliases: [{ id: "oldname", uid: null, status: "disabled" }],
  });

  expect(summary.counts.ownerlessQuarantines).toBe(1);
  expect(summary.canRelease).toBe(true);
});
