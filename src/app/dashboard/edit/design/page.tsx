"use client";

import { SimplePageEditor } from "@/components/simple-editor/SimplePageEditor";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function DesignEditorContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profileId');
  const [isLoading, setIsLoading] = useState(true);
  const [initialData, setInitialData] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/signin");
    } else if (user) {
      loadUserData();
    }
  }, [user, loading]);

  const loadUserData = async () => {
    if (!user) return;

    console.log('[DesignEditorPage] Loading user data for user:', user.uid);
    try {
      // プロファイルサブコレクションから読み込み
      const profileDoc = await getDoc(doc(db, "users", user.uid, "profile", "data"));
      if (profileDoc.exists()) {
        const profileData = profileDoc.data();
        console.log('[DesignEditorPage] Profile data loaded:', profileData);

        // 新しいSimpleEditor形式のデータ構造で初期化
        setInitialData({
          components: profileData.components || [],
          background: profileData.background || null,
          updatedAt: profileData.updatedAt || new Date(),
        });
      } else {
        console.log('[DesignEditorPage] No profile data found, starting fresh');
        setInitialData({
          components: [],
          background: null,
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error("データ読み込みエラー:", error);
      setInitialData({
        components: [],
        background: null,
        updatedAt: new Date(),
      });
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

  console.log('[DesignEditorPage] Rendering SimplePageEditor with:', {
    userId: user.uid,
    hasInitialData: !!initialData,
  });

  return (
    <SimplePageEditor
      userId={user.uid}
      initialData={initialData}
      user={user}
    />
  );
}

export default function DesignEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <DesignEditorContent />
    </Suspense>
  );
}