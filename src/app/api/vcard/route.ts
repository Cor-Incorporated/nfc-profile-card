import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import vCardsJS from "vcards-js";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { standardRateLimit } from "@/lib/rateLimit";

export interface VCardData {
  firstName?: string;
  lastName?: string;
  phoneticFirstName?: string;
  phoneticLastName?: string;
  organization?: string;
  title?: string;
  email?: string;
  workPhone?: string;
  cellPhone?: string;
  url?: string;
  workAddress?: {
    street?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    countryRegion?: string;
  };
  socialUrls?: {
    facebook?: string;
    linkedIn?: string;
    twitter?: string;
    instagram?: string;
  };
  photo?: string;
  note?: string;
}

const MAX_INLINE_PHOTO_BYTES = 1024 * 1024;
const MAX_PHOTO_URL_LENGTH = 2048;
const PRIVATE_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".test",
  ".invalid",
  ".onion",
  ".arpa",
];

/** Return a safe vCard 3.0 PHOTO property without dereferencing the image. */
function photoProperty(value: unknown): string | null {
  if (typeof value !== "string" || /[\s\\\x00-\x1f\x7f-\x9f]/u.test(value)) {
    return null;
  }

  if (value.startsWith("data:")) {
    const match =
      /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
    if (
      !match ||
      match[2].length > Math.ceil((MAX_INLINE_PHOTO_BYTES * 4) / 3) + 4
    ) {
      return null;
    }

    const bytes = Buffer.from(match[2], "base64");
    const canonical = bytes.toString("base64");
    if (
      bytes.length === 0 ||
      bytes.length > MAX_INLINE_PHOTO_BYTES ||
      (match[2] !== canonical && match[2] !== canonical.replace(/=+$/, ""))
    ) {
      return null;
    }

    const isJpeg =
      bytes.length >= 4 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff &&
      bytes[bytes.length - 2] === 0xff &&
      bytes[bytes.length - 1] === 0xd9;
    const isPng =
      bytes.length >= 45 &&
      bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) &&
      bytes.toString("ascii", 12, 16) === "IHDR" &&
      bytes.readUInt32BE(bytes.length - 12) === 0 &&
      bytes.toString("ascii", bytes.length - 8, bytes.length - 4) === "IEND";
    if (match[1].toLowerCase() === "jpeg" && isJpeg) {
      return `PHOTO;ENCODING=b;TYPE=JPEG:${canonical}`;
    }
    if (match[1].toLowerCase() === "png" && isPng) {
      return `PHOTO;ENCODING=b;TYPE=PNG:${canonical}`;
    }
    return null;
  }

  if (value.length > MAX_PHOTO_URL_LENGTH || !/^https:\/\//i.test(value)) {
    return null;
  }
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.href.length > MAX_PHOTO_URL_LENGTH ||
      !host.includes(".") ||
      host.endsWith(".") ||
      isIP(host.replace(/^\[|\]$/g, "")) !== 0 ||
      PRIVATE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
    ) {
      return null;
    }
    return `PHOTO;VALUE=uri:${url.href}`;
  } catch {
    return null;
  }
}

/** vCard content lines are limited to 75 octets; PHOTO is ASCII after parsing. */
function foldPhotoProperty(property: string): string {
  const lines = [property.slice(0, 75)];
  for (let index = 75; index < property.length; index += 74) {
    lines.push(` ${property.slice(index, index + 74)}`);
  }
  return lines.join("\r\n");
}

function insertPhotoProperty(vcard: string, property: string): string {
  const normalized = vcard.replace(/\r?\n/g, "\r\n");
  return normalized.replace(
    /\r\nEND:VCARD(\r\n)?$/,
    (_match, trailingNewline: string | undefined) =>
      `\r\n${foldPhotoProperty(property)}\r\nEND:VCARD${trailingNewline || ""}`,
  );
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting (30 requests per minute)
    const rateLimitResponse = await standardRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // ミドルウェアで認証チェック済み

    const data: VCardData = await request.json();

    const vCard = vCardsJS();

    if (data.firstName) vCard.firstName = data.firstName;
    if (data.lastName) vCard.lastName = data.lastName;
    if (data.organization) vCard.organization = data.organization;
    if (data.title) vCard.title = data.title;
    if (data.email) vCard.email = data.email;
    if (data.workPhone) vCard.workPhone = data.workPhone;
    if (data.cellPhone) vCard.cellPhone = data.cellPhone;
    if (data.url) vCard.url = data.url;

    if (data.workAddress) {
      vCard.workAddress = {
        street: data.workAddress.street || "",
        city: data.workAddress.city || "",
        stateProvince: data.workAddress.stateProvince || "",
        postalCode: data.workAddress.postalCode || "",
        countryRegion: data.workAddress.countryRegion || "",
      };
    }

    if (data.socialUrls) {
      if (!vCard.socialUrls) {
        vCard.socialUrls = {};
      }
      if (data.socialUrls.facebook)
        vCard.socialUrls.facebook = data.socialUrls.facebook;
      if (data.socialUrls.linkedIn)
        vCard.socialUrls.linkedIn = data.socialUrls.linkedIn;
      if (data.socialUrls.twitter)
        vCard.socialUrls.twitter = data.socialUrls.twitter;
      if (data.socialUrls.instagram)
        vCard.socialUrls.instagram = data.socialUrls.instagram;
    }

    if (data.note) vCard.note = data.note;

    vCard.version = "3.0";

    let vcardString = vCard.getFormattedString();
    const photo = photoProperty(data.photo);
    if (photo) vcardString = insertPhotoProperty(vcardString, photo);

    // Add phonetic fields (furigana) as custom X-PHONETIC fields
    if (data.phoneticFirstName || data.phoneticLastName) {
      const phoneticFields = [];
      if (data.phoneticLastName) {
        phoneticFields.push(`X-PHONETIC-LAST-NAME:${data.phoneticLastName}`);
      }
      if (data.phoneticFirstName) {
        phoneticFields.push(`X-PHONETIC-FIRST-NAME:${data.phoneticFirstName}`);
      }

      // Insert phonetic fields after the name fields
      const lines = vcardString.split("\n");
      const insertIndex = lines.findIndex((line) => line.startsWith("FN:")) + 1;
      if (insertIndex > 0) {
        lines.splice(insertIndex, 0, ...phoneticFields);
        vcardString = lines.join("\n");
      }
    }

    // ファイル名をASCII文字のみに変換
    const safeFileName =
      `${data.firstName || "contact"}_${data.lastName || "card"}`
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .substring(0, 50) || "contact";

    return new NextResponse(vcardString, {
      status: 200,
      headers: {
        "Content-Type": "text/vcard;charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFileName}.vcf"`,
      },
    });
  } catch (error) {
    console.error("VCard generation failed");
    return NextResponse.json(
      { error: "Failed to generate VCard" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  try {
    // Firebaseから直接ユーザープロファイルを取得
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const snapshot = await getDocs(q);

    let profile = snapshot.docs[0]?.data();

    if (!profile && username.startsWith("u_")) {
      const userDoc = await getDoc(doc(db, "users", username.slice(2)));
      if (userDoc.exists()) {
        profile = userDoc.data();
      }
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // シンプルなVCardフォーマットで直接生成
    const vcardLines = [];
    vcardLines.push("BEGIN:VCARD");
    vcardLines.push("VERSION:3.0");

    // 名前
    const nameParts = profile.name?.split(" ") || [];
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    if (firstName || lastName) {
      vcardLines.push(`FN:${profile.name || ""}`);
      vcardLines.push(`N:${lastName};${firstName};;;`);
    }

    // 組織情報
    if (profile.company) {
      vcardLines.push(`ORG:${profile.company}`);
    }
    if (profile.position) {
      vcardLines.push(`TITLE:${profile.position}`);
    }

    // 連絡先
    if (profile.email) {
      vcardLines.push(`EMAIL:${profile.email}`);
    }
    if (profile.phone) {
      vcardLines.push(`TEL;TYPE=WORK,VOICE:${profile.phone}`);
    }
    if (profile.mobile) {
      vcardLines.push(`TEL;TYPE=CELL:${profile.mobile}`);
    }
    if (profile.website) {
      vcardLines.push(`URL:${profile.website}`);
    }

    // 住所
    if (profile.address) {
      vcardLines.push(`ADR;TYPE=WORK:;;${profile.address};;;;`);
    }

    // 写真
    const photo = photoProperty(
      profile.photoURL || profile.avatarUrl || profile.image,
    );
    if (photo) vcardLines.push(foldPhotoProperty(photo));

    // ノート
    if (profile.bio) {
      vcardLines.push(`NOTE:${profile.bio.replace(/\n/g, "\\n")}`);
    }

    vcardLines.push("END:VCARD");

    const vcardString = vcardLines.join("\r\n");

    // ファイル名をASCII文字のみに変換
    const safeFileName =
      username.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 50) || "profile";

    return new NextResponse(vcardString, {
      status: 200,
      headers: {
        "Content-Type": "text/vcard;charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFileName}.vcf"`,
      },
    });
  } catch (error) {
    console.error("VCard generation failed");
    return NextResponse.json(
      {
        error: "Failed to generate VCard",
      },
      { status: 500 },
    );
  }
}
