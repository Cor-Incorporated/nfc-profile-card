#!/usr/bin/env node

const fs = require("node:fs/promises");

function normalized(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function verifiedTarget(uid, alias, user, reservations, aliases) {
  if (!user) return false;
  for (const value of [user?.username, alias.targetUsername]) {
    if (typeof value !== "string") continue;
    const raw = value.trim();
    const key = normalized(value);
    if (!key || key === alias.id || key.includes("/") || key.length > 150) {
      continue;
    }
    const reservation = reservations.get(key);
    if (raw === `u_${uid}`) {
      const targetAlias = aliases.get(key);
      if (
        (!reservation || reservation.uid === uid) &&
        (!targetAlias || targetAlias.uid === uid)
      ) {
        return true;
      }
      continue;
    }
    if (
      /^[a-z0-9_-]{3,150}$/.test(key) &&
      !key.startsWith("u_") &&
      reservation?.uid === uid
    ) {
      return true;
    }
  }
  return false;
}

function auditProfileOwnership(input) {
  const users = new Map(input.users.map((item) => [item.id, item]));
  const reservations = new Map(
    input.reservations.map((item) => [item.id, item]),
  );
  const aliases = new Map(input.aliases.map((item) => [item.id, item]));
  const usersByKey = new Map();

  for (const user of users.values()) {
    const key = normalized(user.username);
    if (!key) continue;
    if (!usersByKey.has(key)) usersByKey.set(key, new Set());
    usersByKey.get(key).add(user.id);
  }

  const counts = {
    noncanonicalReservationIds: 0,
    noncanonicalAliasIds: 0,
    orphanedReservations: 0,
    staleReservations: 0,
    invalidAliasStatuses: 0,
    casefoldMultiUidGroups: 0,
    reservationLegacyConflicts: 0,
    reservationAliasConflicts: 0,
    maskedDisabledAliases: 0,
    maskedRedirectAliases: 0,
    aliasLegacyConflicts: 0,
    unreservedLegacyProfiles: 0,
    invalidRedirectAliases: 0,
    uidFallbackConflicts: 0,
    uidAliasConflicts: 0,
    maskedUidDisabledAliases: 0,
    uidCasefoldReservations: 0,
    noncanonicalUidProfileUrls: 0,
    unsafeUidAliases: 0,
    ownerlessQuarantines: 0,
    unverifiedHistoryEntries: 0,
  };

  for (const owners of usersByKey.values()) {
    if (owners.size > 1) counts.casefoldMultiUidGroups += 1;
  }

  for (const user of users.values()) {
    const key = normalized(user.username);
    const fixedUidKey = normalized(`u_${user.id}`);
    const fixedUidReservation = reservations.get(fixedUidKey);
    const fixedUidAlias = aliases.get(fixedUidKey);
    if (fixedUidReservation && fixedUidReservation.uid !== user.id) {
      counts.uidFallbackConflicts += 1;
    }
    if (fixedUidAlias && fixedUidAlias.uid !== user.id) {
      counts.uidAliasConflicts += 1;
    }
    if (fixedUidAlias?.uid === user.id && fixedUidAlias.status === "disabled") {
      counts.maskedUidDisabledAliases += 1;
    }
    if (key.startsWith("u_") && user.username !== `u_${user.id}`) {
      counts.noncanonicalUidProfileUrls += 1;
    }
    if (!key || user.username === `u_${user.id}`) continue;
    if (reservations.get(key)?.uid !== user.id) {
      counts.unreservedLegacyProfiles += 1;
    }
  }

  for (const user of users.values()) {
    const current = normalized(user.username);
    const previous = Array.isArray(user.previousUsernames)
      ? user.previousUsernames
      : [];
    for (const key of new Set(previous.map(normalized).filter(Boolean))) {
      if (key === current) continue;
      if (
        reservations.get(key)?.uid !== user.id &&
        aliases.get(key)?.uid !== user.id
      ) {
        counts.unverifiedHistoryEntries += 1;
      }
    }
  }

  for (const reservation of reservations.values()) {
    if (reservation.id !== normalized(reservation.id)) {
      counts.noncanonicalReservationIds += 1;
    }
    if (typeof reservation.uid !== "string" || !users.has(reservation.uid)) {
      counts.orphanedReservations += 1;
    } else if (
      reservation.id !== normalized(users.get(reservation.uid).username)
    ) {
      counts.staleReservations += 1;
    }
    const owners = usersByKey.get(reservation.id);
    if (owners && [...owners].some((uid) => uid !== reservation.uid)) {
      counts.reservationLegacyConflicts += 1;
    }
    if (reservation.id.startsWith("u_")) {
      const suffix = reservation.id.slice(2);
      if (reservation.uid !== suffix) {
        counts.uidCasefoldReservations += 1;
      }
    }
  }

  for (const alias of aliases.values()) {
    if (alias.id !== normalized(alias.id)) {
      counts.noncanonicalAliasIds += 1;
    }
    if (alias.status !== "disabled" && alias.status !== "redirect") {
      counts.invalidAliasStatuses += 1;
    }
    const reservation = reservations.get(alias.id);
    if (reservation && reservation.uid !== alias.uid) {
      counts.reservationAliasConflicts += 1;
    } else if (reservation && alias.status === "disabled") {
      counts.maskedDisabledAliases += 1;
    } else if (reservation && alias.status === "redirect") {
      counts.maskedRedirectAliases += 1;
    }
    if (alias.status === "disabled" && alias.uid == null) {
      counts.ownerlessQuarantines += 1;
    }
    const owners = usersByKey.get(alias.id);
    if (owners && [...owners].some((uid) => uid !== alias.uid)) {
      counts.aliasLegacyConflicts += 1;
    }
    if (alias.id.startsWith("u_") && alias.id.slice(2) !== alias.uid) {
      counts.unsafeUidAliases += 1;
    }
    if (alias.status !== "redirect") continue;
    if (
      !verifiedTarget(
        alias.uid,
        alias,
        users.get(alias.uid),
        reservations,
        aliases,
      )
    ) {
      counts.invalidRedirectAliases += 1;
    }
  }

  const blockers = Object.entries(counts)
    .filter(([name]) => name !== "ownerlessQuarantines")
    .reduce((sum, [, count]) => sum + count, 0);

  return {
    scanned: {
      users: users.size,
      reservations: reservations.size,
      aliases: aliases.size,
    },
    counts,
    blockers,
    canRelease: blockers === 0,
  };
}

function parseArgs(argv) {
  const [mode, value, acknowledgement] = argv;
  if (mode === "--fixture" && value && argv.length === 2) {
    return { mode: "fixture", value };
  }
  if (
    mode === "--live" &&
    value &&
    acknowledgement === "--acknowledge-read-cost" &&
    argv.length === 3
  ) {
    return { mode: "live", value };
  }
  throw new Error("USAGE");
}

async function loadLive(projectId) {
  const admin = require("firebase-admin");
  const app = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
  try {
    const db = app.firestore();
    const [users, reservations, aliases] = await Promise.all([
      db.collection("users").select("username", "previousUsernames").get(),
      db.collection("usernames").select("uid").get(),
      db
        .collection("usernameAliases")
        .select("uid", "status", "targetUsername")
        .get(),
    ]);
    return {
      users: users.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      reservations: reservations.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })),
      aliases: aliases.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    };
  } finally {
    await app.delete();
  }
}

async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch {
    process.stderr.write(
      "Usage: node scripts/audit-profile-ownership.cjs --fixture <synthetic-json>\n" +
        "   or: node scripts/audit-profile-ownership.cjs --live <project-id> --acknowledge-read-cost\n",
    );
    return 64;
  }

  try {
    const input =
      args.mode === "fixture"
        ? JSON.parse(await fs.readFile(args.value, "utf8"))
        : await loadLive(args.value);
    const summary = auditProfileOwnership(input);
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    return summary.canRelease ? 0 : 2;
  } catch {
    // Firestore errors can contain document paths. Keep the output numeric-only.
    process.stderr.write(
      "Audit failed before a complete count was produced.\n",
    );
    return 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

module.exports = { auditProfileOwnership, main };
