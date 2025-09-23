import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    // プロファイルサブコレクションから読み込み
    const profileDoc = await getDoc(
      doc(db, "users", userId, "profile", "data"),
    );
    const userDoc = await getDoc(doc(db, "users", userId));

    const profileData = profileDoc.exists() ? profileDoc.data() : null;
    const userData = userDoc.exists() ? userDoc.data() : null;

    // editorContentの詳細を確認
    let editorContent = null;
    if (profileData?.editorContent) {
      editorContent =
        typeof profileData.editorContent === "string"
          ? JSON.parse(profileData.editorContent)
          : profileData.editorContent;
    } else if (userData?.profile?.editorContent) {
      editorContent =
        typeof userData.profile.editorContent === "string"
          ? JSON.parse(userData.profile.editorContent)
          : userData.profile.editorContent;
    }

    return NextResponse.json({
      profileData,
      userData: userData
        ? {
            ...userData,
            profile: userData.profile || {},
          }
        : null,
      editorContentParsed: editorContent,
      editorContentNodes: editorContent ? Object.keys(editorContent) : [],
      nodeDetails: editorContent
        ? Object.entries(editorContent).map(([key, node]: [string, any]) => ({
            key,
            type: node?.type?.resolvedName || node?.type || "unknown",
            displayName: node?.displayName,
            nodes: node?.nodes,
          }))
        : [],
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
