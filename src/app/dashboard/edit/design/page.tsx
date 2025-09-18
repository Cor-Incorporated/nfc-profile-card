"use client";

import { PageEditor } from "@/components/editor/PageEditor";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function DesignEditorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profileId');
  const [isLoading, setIsLoading] = useState(true);
  const [initialData, setInitialData] = useState(null);
  const [username, setUsername] = useState("");
  const [socialLinks, setSocialLinks] = useState<any[]>([]);
  const [background, setBackground] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/signin");
    } else if (user) {
      loadUserData();
    }
  }, [user, loading]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      // プロファイルIDが指定されている場合
      if (profileId) {
        const profileDoc = await getDoc(
          doc(db, "users", user.uid, "profiles", profileId)
        );

        if (profileDoc.exists()) {
          const data = profileDoc.data();
          // データ形式の検証
          const content = data.editorContent;
          if (content && (typeof content === 'string' || typeof content === 'object')) {
            setInitialData(content);
          } else {
            setInitialData(null);
          }
          setSocialLinks(data.socialLinks || []);
          setBackground(data.background || null);

          // ユーザーの基本情報も取得
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUsername(userData.username || "");
            setProfileData({
              name: userData.name || user.displayName || "",
              company: userData.company || "",
              position: userData.position || "",
              bio: userData.bio || "",
              email: userData.email || user.email || "",
              phone: userData.phone || "",
              website: userData.website || "",
              address: userData.address || "",
              links: userData.links || [],
            });
          }
        }
      } else {
        // 既存の処理（後方互換性のため）- profileサブコレクションからも読み込み試行
        try {
          // まずprofileサブコレクションから読み込み
          const profileDoc = await getDoc(doc(db, "users", user.uid, "profile", "data"));
          if (profileDoc.exists()) {
            const profileData = profileDoc.data();
            // データ形式の検証
            const content = profileData.editorContent;
            if (content && (typeof content === 'string' || typeof content === 'object')) {
              setInitialData(content);
            } else {
              setInitialData(null);
            }
            setSocialLinks(profileData.socialLinks || []);
            setBackground(profileData.background || null);
          }
        } catch (error) {
          console.log("Profile subcollection not found, trying user document");
        }

        // ユーザードキュメントから読み込み（フォールバック）
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();

          setUsername(data.username || "");

          // プロファイルデータがprofileサブコレクションから読み込まれていない場合のみ設定
          if (initialData === null) {
            const content = data.profile?.editorContent;
            if (content && (typeof content === 'string' || typeof content === 'object')) {
              setInitialData(content);
            } else {
              setInitialData(null);
            }
            setSocialLinks(data.profile?.socialLinks || []);
            setBackground(data.profile?.background || null);
          }

          // 従来のプロフィール情報を取得
          setProfileData({
            name: data.name || user.displayName || "",
            company: data.company || "",
            position: data.position || "",
            bio: data.bio || "",
            email: data.email || user.email || "",
            phone: data.phone || "",
            website: data.website || "",
            address: data.address || "",
            links: data.links || [],
          });
        }
      }
    } catch (error) {
      console.error("データ読み込みエラー:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <PageEditor
      userId={user.uid}
      username={username}
      initialData={initialData}
      socialLinks={socialLinks}
      initialBackground={background}
      profileData={profileData}
    />
  );
}
