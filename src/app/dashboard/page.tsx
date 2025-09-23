"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { LogOut, ExternalLink, Eye } from "lucide-react";
import { getAnalyticsSummary } from "@/lib/analytics";

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [analytics, setAnalytics] = useState<{
    totalViews: number;
    lastViewedAt: Date | null;
    todayViews: number;
    weekViews: number;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/signin");
    } else if (user) {
      fetchUserProfile();
    }
  }, [user, loading, router]);

  const fetchUserProfile = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserProfile(userSnap.data());
      }


      // Fetch analytics data
      const analyticsData = await getAnalyticsSummary(user.uid);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* モバイル向けヘッダー */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-sm text-gray-600 mt-1">
            {user?.displayName || user?.email?.split("@")[0] || "ユーザー"}さん
          </p>
        </div>

        {/* Profile setup notice */}
        {!profileLoading && !userProfile?.username && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              📝 プロフィール設定が必要です
            </p>
          </div>
        )}

        {/* モバイル向けナビゲーションボタン */}
        <div className="space-y-3">
          {/* 公開プロファイルを見る */}
          {!profileLoading && userProfile?.username && (
            <Link
              href={`/p/${userProfile.username}`}
              target="_blank"
              className="block w-full p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Eye className="w-5 h-5 text-gray-600" />
                  </div>
                  <span className="font-medium text-gray-900">公開プロファイル</span>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </div>
            </Link>
          )}

          {/* プロフィール編集 */}
          <Link
            href="/dashboard/edit/design"
            className="block w-full p-4 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 bg-opacity-30 rounded-lg">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
              <span className="font-medium">プロフィールを編集</span>
            </div>
          </Link>

          {/* 名刺スキャン */}
          <Link
            href="/dashboard/business-cards/scan"
            className="block w-full p-4 bg-white rounded-lg shadow-sm border-2 border-pink-500 hover:shadow-md transition-shadow relative"
          >
            <div className="absolute -top-2 right-4 bg-pink-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">
              NEW
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-100 rounded-lg">
                <svg
                  className="w-5 h-5 text-pink-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <span className="font-medium text-gray-900">名刺をスキャン</span>
            </div>
          </Link>



          {/* アナリティクス簡易表示 */}
          {analytics && (
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">アナリティクス</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-gray-900">{analytics.totalViews}</div>
                  <div className="text-xs text-gray-500">総閲覧</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{analytics.todayViews}</div>
                  <div className="text-xs text-gray-500">今日</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{analytics.weekViews}</div>
                  <div className="text-xs text-gray-500">今週</div>
                </div>
              </div>
            </div>
          )}

          {/* ログアウトボタン */}
          <button
            onClick={handleSignOut}
            className="w-full p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-center gap-3">
              <LogOut className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-600">ログアウト</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
