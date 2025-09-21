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
      <div className="container mx-auto px-4 py-8">
        {/* Header with user info and actions */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ダッシュボード</h1>
            <p className="text-gray-600 mt-2">
              ようこそ、
              {user?.displayName || user?.email?.split("@")[0] || "ユーザー"}
              さん
            </p>
          </div>
          <div className="flex gap-3">
            {!profileLoading && userProfile?.username && (
              <Button
                variant="outline"
                asChild
                className="flex items-center gap-2"
              >
                <Link href={`/p/${userProfile.username}`} target="_blank">
                  <Eye className="w-4 h-4" />
                  公開ページを見る
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </Button>
          </div>
        </div>

        {/* Profile setup notice */}
        {!profileLoading && !userProfile?.username && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L3.098 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <div>
                <h3 className="font-semibold text-yellow-800">
                  プロフィール設定が必要です
                </h3>
                <p className="text-yellow-700 text-sm mt-1">
                  公開プロフィールページを作成するには、まずプロフィール情報を設定してください。
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* プロフィール編集（統合版） */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-blue-600"
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
              <h2 className="text-xl font-semibold ml-4">プロフィール編集</h2>
            </div>
            <p className="text-gray-600 mb-2">
              プロフィール情報とリンクを管理
            </p>
            <ul className="text-sm text-gray-600 mb-4 space-y-1">
              <li>✓ 基本情報の編集</li>
              <li>✓ SNSリンクの追加・編集</li>
              <li>✓ デザインのカスタマイズ</li>
            </ul>
            <Link
              href="/dashboard/edit/design"
              className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 transition-colors"
            >
              編集画面へ
            </Link>
          </div>



          {/* アナリティクスカード */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <svg
                  className="w-6 h-6 text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold ml-4">アナリティクス</h2>
            </div>
            {analytics ? (
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">総閲覧数</span>
                  <span className="font-semibold text-lg">{analytics.totalViews}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">今日の閲覧数</span>
                  <span className="font-semibold">{analytics.todayViews}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">今週の閲覧数</span>
                  <span className="font-semibold">{analytics.weekViews}</span>
                </div>
                {analytics.lastViewedAt && (
                  <div className="pt-2 border-t">
                    <span className="text-xs text-gray-500">
                      最終閲覧: {new Date(analytics.lastViewedAt).toLocaleString("ja-JP")}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-600 mb-4">
                プロフィールの閲覧数やリンククリック数を確認
              </p>
            )}
            <button
              className="w-full px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
              disabled
            >
              詳細を見る
            </button>
          </div>

          {/* NFCカード管理 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold ml-4">NFCカード</h2>
            </div>
            <p className="text-gray-600 mb-4">
              NFCカードの管理と新規購入ができます
            </p>
            <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              管理する
            </button>
          </div>


          {/* 名刺スキャン */}
          <div className="bg-white rounded-lg shadow p-6 relative border-2 border-pink-500">
            <div className="absolute -top-3 left-4 bg-pink-500 text-white px-3 py-1 rounded-full text-xs font-bold">
              新機能
            </div>
            <div className="flex items-center mb-4">
              <div className="p-3 bg-pink-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-pink-600"
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
              <h2 className="text-xl font-semibold ml-4">名刺スキャン</h2>
            </div>
            <p className="text-gray-600 mb-4">
              カメラで名刺を撮影してVCardで端末に保存
            </p>
            <Link
              href="/dashboard/business-cards/scan"
              className="block w-full px-4 py-3 bg-pink-600 text-white text-center rounded-lg hover:bg-pink-700 transition-colors text-base font-medium touch-manipulation"
            >
              📸 スキャンする
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
