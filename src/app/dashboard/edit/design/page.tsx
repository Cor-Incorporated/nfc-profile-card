"use client";

import { SimplePageEditor } from "@/components/simple-editor/SimplePageEditor";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { db } from "@/lib/firebase";
import { getDesignRevision } from "@/lib/profile/designRevision";
import { doc, getDocFromServer } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

function DesignEditorContent() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams.get("profileId");
  const [isLoading, setIsLoading] = useState(true);
  const [initialData, setInitialData] = useState<any>(null);
  const [initialRevision, setInitialRevision] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadUserData = useCallback(async () => {
    if (!user) return;

    console.log("[DesignEditorPage] Loading user data for user:", user.uid);
    try {
      // プロファイルサブコレクションから読み込み
      const profileDoc = await getDocFromServer(
        doc(db, "users", user.uid, "profile", "data"),
      );
      if (profileDoc.exists()) {
        const profileData = profileDoc.data();
        setInitialRevision(getDesignRevision(profileData.updatedAt));

        // 新しいSimpleEditor形式のデータ構造で初期化
        setInitialData({
          components: profileData.components || [],
          background: profileData.background || null,
          updatedAt: profileData.updatedAt || new Date(),
        });
      } else {
        console.log("[DesignEditorPage] No profile data found, starting fresh");
        setInitialRevision(null);
        setInitialData({
          components: [],
          background: null,
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Design data loading failed:", error);
      // An empty editor on read failure could overwrite an existing profile.
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/signin");
    } else if (user) {
      loadUserData();
    }
  }, [user, loading, router, loadUserData]);

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

  if (loadFailed) {
    return (
      <div
        role="alert"
        className="mx-auto mt-16 max-w-md space-y-4 p-4 text-center"
      >
        <p>
          プロフィールを読み込めませんでした。再読み込みしてから編集してください。
        </p>
        <button
          type="button"
          className="rounded bg-blue-600 px-4 py-2 text-white"
          onClick={() => window.location.reload()}
        >
          再読み込み
        </button>
      </div>
    );
  }

  console.log("[DesignEditorPage] Rendering SimplePageEditor with:", {
    userId: user.uid,
    hasInitialData: !!initialData,
  });

  return (
    <SimplePageEditor
      userId={user.uid}
      initialData={initialData}
      initialRevision={initialRevision}
      user={{
        username: (user as any).username,
        email: user.email || undefined,
        displayName: user.displayName || undefined,
      }}
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
