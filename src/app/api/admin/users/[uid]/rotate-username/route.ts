import { verifyAdminRequest } from "@/lib/admin";
import { adminDb } from "@/lib/firebase-admin";
import { resolvePublicProfileOwner } from "@/lib/profile/publicProfileData";
import { generateDefaultUsername } from "@/lib/username";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: {
    uid: string;
  };
}

const MAX_USERNAME_ATTEMPTS = 8;

class UsernameCollisionError extends Error {}
class LegacyAliasConflictError extends Error {}

function normalizeLegacyUrlAction(value: unknown) {
  return value === "redirect" ? "redirect" : "disable";
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
      return NextResponse.json(
        { error: admin.error },
        { status: admin.status },
      );
    }

    let body: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed;
      }
    } catch {
      // The admin UI sends no body and disables the old URL by default.
    }
    const legacyUrlAction = normalizeLegacyUrlAction(body.legacyUrlAction);
    const userRef = adminDb.collection("users").doc(params.uid);

    for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt += 1) {
      const username = generateDefaultUsername();
      const usernameKey = username.toLowerCase();

      try {
        const result = await adminDb.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists) return null;

          const userData = userDoc.data() || {};
          const previousUsername =
            typeof userData.username === "string"
              ? userData.username.trim()
              : "";
          const previousKey = previousUsername.includes("/")
            ? ""
            : previousUsername.toLowerCase();
          const usernameRef = adminDb.collection("usernames").doc(usernameKey);
          const requestedAliasRef = adminDb
            .collection("usernameAliases")
            .doc(usernameKey);
          const usernameDoc = await transaction.get(usernameRef);
          const requestedAliasDoc = await transaction.get(requestedAliasRef);
          const existingUsers = await transaction.get(
            adminDb
              .collection("users")
              .where("username", "==", username)
              .limit(1),
          );

          // All ownership checks must happen inside the transaction so a
          // concurrent reservation cannot be silently overwritten.
          if (
            usernameKey === previousKey ||
            usernameDoc.exists ||
            requestedAliasDoc.exists ||
            !existingUsers.empty
          ) {
            throw new UsernameCollisionError();
          }

          const previousRef = previousKey
            ? adminDb.collection("usernames").doc(previousKey)
            : null;
          const previousAliasRef = previousKey
            ? adminDb.collection("usernameAliases").doc(previousKey)
            : null;
          const previousDoc = previousRef
            ? await transaction.get(previousRef)
            : null;
          const previousAliasDoc = previousAliasRef
            ? await transaction.get(previousAliasRef)
            : null;
          if (
            previousDoc?.exists &&
            previousDoc.data()?.uid === params.uid &&
            previousAliasDoc?.exists &&
            previousAliasDoc.data()?.uid !== params.uid
          ) {
            throw new LegacyAliasConflictError();
          }
          const hasPreviousOwnershipRecord =
            (previousDoc?.exists && previousDoc.data()?.uid === params.uid) ||
            (previousAliasDoc?.exists &&
              previousAliasDoc.data()?.uid === params.uid) ||
            previousUsername === `u_${params.uid}`;
          const publicOwner = previousUsername
            ? await resolvePublicProfileOwner(previousUsername)
            : null;
          const ownsPreviousUrl =
            hasPreviousOwnershipRecord && publicOwner === params.uid;
          const needsQuarantine =
            !hasPreviousOwnershipRecord && publicOwner === params.uid;
          const previousUrlWasOwned = ownsPreviousUrl || needsQuarantine;

          if (
            legacyUrlAction === "redirect" &&
            previousUsername &&
            (!ownsPreviousUrl ||
              (previousDoc?.exists && previousDoc.data()?.uid !== params.uid) ||
              (previousAliasDoc?.exists &&
                previousAliasDoc.data()?.uid !== params.uid))
          ) {
            throw new LegacyAliasConflictError();
          }

          const updateData: Record<string, unknown> = {
            username,
            usernameConfirmed: true,
            usernameRotatedAt: FieldValue.serverTimestamp(),
            usernameRotatedBy: admin.decodedToken.uid,
            usernameRotatedBySelf: false,
            updatedAt: FieldValue.serverTimestamp(),
          };

          if (previousUsername && previousRef && previousAliasRef) {
            updateData.previousUsernames =
              FieldValue.arrayUnion(previousUsername);

            if (previousDoc?.exists && previousDoc.data()?.uid === params.uid) {
              transaction.delete(previousRef);
            }

            if (legacyUrlAction === "redirect") {
              transaction.set(previousAliasRef, {
                uid: params.uid,
                username: previousUsername,
                targetUsername: username,
                status: "redirect",
                createdAt:
                  previousAliasDoc?.data()?.createdAt ||
                  FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              });
            } else if (
              (ownsPreviousUrl || needsQuarantine) &&
              (!previousDoc?.exists ||
                previousDoc.data()?.uid === params.uid) &&
              (!previousAliasDoc?.exists ||
                previousAliasDoc.data()?.uid === params.uid)
            ) {
              transaction.set(previousAliasRef, {
                uid: ownsPreviousUrl ? params.uid : null,
                username: previousUsername,
                status: "disabled",
                ...(needsQuarantine ? { quarantined: true } : {}),
                createdAt:
                  previousAliasDoc?.data()?.createdAt ||
                  FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              });
            }
          }

          transaction.set(usernameRef, {
            uid: params.uid,
            username,
            updatedAt: FieldValue.serverTimestamp(),
          });
          transaction.update(userRef, updateData);

          return {
            uid: params.uid,
            previousUsername,
            username,
            previousUrlWasOwned,
          };
        });

        if (!result) {
          return NextResponse.json(
            { error: "User not found" },
            { status: 404 },
          );
        }
        return NextResponse.json({
          uid: result.uid,
          previousUsername: result.previousUsername,
          username: result.username,
        });
      } catch (error) {
        if (error instanceof UsernameCollisionError) continue;
        throw error;
      }
    }

    return NextResponse.json(
      { error: "username_generation_failed" },
      { status: 409 },
    );
  } catch (error) {
    if (error instanceof LegacyAliasConflictError) {
      return NextResponse.json({ error: "alias_conflict" }, { status: 409 });
    }

    console.error("Admin username rotation failed:", error);
    return NextResponse.json(
      { error: "Failed to rotate username" },
      { status: 500 },
    );
  }
}
