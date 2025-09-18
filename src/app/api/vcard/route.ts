import { NextRequest, NextResponse } from "next/server";
import vCardsJS from "vcards-js";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export interface VCardData {
  firstName?: string;
  lastName?: string;
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

export async function POST(request: NextRequest) {
  try {
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

    if (data.photo && vCard.photo && vCard.photo.embedFromString) {
      vCard.photo.embedFromString(data.photo, "image/jpeg");
    }

    if (data.note) vCard.note = data.note;

    vCard.version = "3.0";

    const vcardString = vCard.getFormattedString();

    // ファイル名をASCII文字のみに変換
    const safeFileName = `${data.firstName || "contact"}_${data.lastName || "card"}`
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
    console.error("VCard generation error:", error);
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
    console.log("Fetching profile for username:", username);

    // Firebaseから直接ユーザープロファイルを取得
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.error("Profile not found for username:", username);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const profile = snapshot.docs[0].data();
    console.log("Profile data:", profile);

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

    // ノート
    if (profile.bio) {
      vcardLines.push(`NOTE:${profile.bio.replace(/\n/g, "\\n")}`);
    }

    vcardLines.push("END:VCARD");

    const vcardString = vcardLines.join("\r\n");
    console.log("Generated VCard:", vcardString);

    // ファイル名をASCII文字のみに変換
    const safeFileName = username.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 50) || "profile";

    return new NextResponse(vcardString, {
      status: 200,
      headers: {
        "Content-Type": "text/vcard;charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFileName}.vcf"`,
      },
    });
  } catch (error) {
    console.error("VCard generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate VCard", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
