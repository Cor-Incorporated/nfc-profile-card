"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAnalyticsSummary } from "@/lib/analytics";
import { db } from "@/lib/firebase";
import { getUidFallbackUsername } from "@/lib/username";
import { doc, getDoc } from "firebase/firestore";
import {
  AlertCircle,
  Crown,
  ExternalLink,
  Eye,
  Globe,
  LogOut,
  Palette,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [analytics, setAnalytics] = useState<{
    totalViews: number;
    lastViewedAt: Date | null;
    todayViews: number;
    weekViews: number;
  } | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoCodeLoading, setPromoCodeLoading] = useState(false);
  const [promoCodeError, setPromoCodeError] = useState("");
  const [promoCodeSuccess, setPromoCodeSuccess] = useState("");
  const [idSetupMode, setIdSetupMode] = useState<"random" | "uid" | "custom">(
    "random",
  );
  const [customUsername, setCustomUsername] = useState("");
  const [idSetupLoading, setIdSetupLoading] = useState(false);
  const [idSetupError, setIdSetupError] = useState("");
  const [idSetupSuccess, setIdSetupSuccess] = useState("");

  const fetchUserProfile = useCallback(async () => {
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
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/signin");
    } else if (user) {
      fetchUserProfile();
    }
  }, [user, loading, router, fetchUserProfile]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleLanguageChange = async (lang: "ja" | "en") => {
    setLanguage(lang);
    setShowLangSelector(false);
  };

  const handlePromoCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoCodeError("");
    setPromoCodeSuccess("");

    if (!promoCode.trim()) {
      setPromoCodeError(t("enterPromoCode"));
      return;
    }

    setPromoCodeLoading(true);

    try {
      const idToken = await user?.getIdToken();
      const response = await fetch("/api/promo-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ code: promoCode }),
      });

      const data = await response.json();

      if (data.success) {
        // Translate success message using translation key
        setPromoCodeSuccess(t(data.message || "promoCodeSuccess"));
        setPromoCode("");
        // Refresh user profile to get updated plan
        await fetchUserProfile();
      } else {
        // Translate error using translation key
        setPromoCodeError(t(data.error || "promoCodeInvalid"));
      }
    } catch (error) {
      console.error("Error applying promo code:", error);
      setPromoCodeError(t("error"));
    } finally {
      setPromoCodeLoading(false);
    }
  };

  const handleProfileIdSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIdSetupError("");
    setIdSetupSuccess("");

    if (idSetupMode === "custom" && !customUsername.trim()) {
      setIdSetupError(t("usernameRequired"));
      return;
    }

    setIdSetupLoading(true);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          usernameMode: idSetupMode,
          username: customUsername,
          name: userProfile?.name || user.displayName || "",
          bio: userProfile?.bio || "",
          company: userProfile?.company || "",
          position: userProfile?.position || "",
          email: userProfile?.email || user.email || "",
          phone: userProfile?.phone || "",
          website: userProfile?.website || "",
          address: userProfile?.address || "",
          ...(userProfile?.photoURL ? { photoURL: userProfile.photoURL } : {}),
        }),
      });

      const data = await response.json();
      if (response.status === 409 && data.error === "username_taken") {
        setIdSetupError(t("usernameUnavailable"));
        return;
      }

      if (response.status === 400 && data.error === "username_invalid") {
        setIdSetupError(t("usernameInvalid"));
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to set profile ID");
      }

      setIdSetupSuccess(t("profileIdSetupSuccess"));
      setCustomUsername("");
      await fetchUserProfile();
    } catch (error) {
      console.error("Error setting profile ID:", error);
      setIdSetupError(t("profileSaveError"));
    } finally {
      setIdSetupLoading(false);
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
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
              <p className="text-sm text-gray-600 mt-1 truncate max-w-[200px]">
                {t("welcome")}, {user?.displayName || t("profile")}
              </p>
            </div>

            {/* Language Selector Button */}
            <div className="relative">
              <button
                onClick={() => setShowLangSelector(!showLangSelector)}
                className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                <Globe className="w-5 h-5 text-gray-600" />
              </button>

              {showLangSelector && (
                <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                  <button
                    onClick={() => handleLanguageChange("ja")}
                    className={`block w-full px-4 py-2 text-left hover:bg-gray-100 ${
                      language === "ja" ? "bg-blue-50 text-blue-600" : ""
                    }`}
                  >
                    日本語
                  </button>
                  <button
                    onClick={() => handleLanguageChange("en")}
                    className={`block w-full px-4 py-2 text-left hover:bg-gray-100 ${
                      language === "en" ? "bg-blue-50 text-blue-600" : ""
                    }`}
                  >
                    English
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile setup notice */}
        {!profileLoading && !userProfile?.username && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">📝 {t("profileSetup")}</p>
          </div>
        )}

        {!profileLoading && userProfile?.usernameConfirmed !== true && (
          <form
            onSubmit={handleProfileIdSetup}
            className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-blue-200"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">
                  {t("profileIdSetupTitle")}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {t("profileIdSetupDescription")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                {
                  mode: "random" as const,
                  title: t("profileIdRandomTitle"),
                  description: t("profileIdRandomDescription"),
                  badge: t("recommended"),
                },
                {
                  mode: "custom" as const,
                  title: t("profileIdCustomTitle"),
                  description: t("profileIdCustomDescription"),
                  badge: "",
                },
                {
                  mode: "uid" as const,
                  title: t("profileIdUidTitle"),
                  description: `${t("profileIdUidDescription")} /p/${getUidFallbackUsername(user.uid).toLowerCase()}`,
                  badge: "",
                },
              ].map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => setIdSetupMode(option.mode)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    idSetupMode === option.mode
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {option.title}
                    </span>
                    {option.badge && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {option.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>

            {idSetupMode === "custom" && (
              <div className="mt-3">
                <input
                  type="text"
                  value={customUsername}
                  onChange={(e) => setCustomUsername(e.target.value)}
                  placeholder={t("usernamePlaceholder")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={idSetupLoading}
                />
              </div>
            )}

            <div className="mt-4 rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-600">{t("profileIdHelpText")}</p>
            </div>

            {idSetupError && (
              <p className="mt-3 text-xs text-red-600">{idSetupError}</p>
            )}
            {idSetupSuccess && (
              <p className="mt-3 text-xs text-green-600">{idSetupSuccess}</p>
            )}

            <button
              type="submit"
              disabled={idSetupLoading}
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {idSetupLoading ? t("loading") : t("profileIdSetupAction")}
            </button>
          </form>
        )}

        {/* Analytics Summary */}
        {analytics && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-3">
              {t("analytics")}
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.totalViews}
                </p>
                <p className="text-xs text-gray-500">{t("totalViews")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.todayViews}
                </p>
                <p className="text-xs text-gray-500">{t("todayViews")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.weekViews}
                </p>
                <p className="text-xs text-gray-500">{t("weekViews")}</p>
              </div>
            </div>
          </div>
        )}

        {/* Plan & Promo Code Section */}
        {!profileLoading && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500">
                {t("currentPlan")}
              </h3>
              {userProfile?.plan === "pro" && (
                <Crown className="w-5 h-5 text-yellow-500" />
              )}
            </div>

            {userProfile?.plan === "pro" ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-yellow-600">
                  {t("proPlan")}
                </span>
                <span className="text-sm text-gray-500">
                  • {t("unlimited")}
                </span>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg font-bold text-gray-700">
                    {t("freePlan")}
                  </span>
                  <span className="text-xs text-gray-500">
                    (10 {t("scansThisMonth")})
                  </span>
                </div>

                {/* Promo Code Input Form */}
                <form onSubmit={handlePromoCodeSubmit} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder={t("promoCodePlaceholder")}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={promoCodeLoading}
                    />
                    <button
                      type="submit"
                      disabled={promoCodeLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {promoCodeLoading ? t("loading") : t("applyPromoCode")}
                    </button>
                  </div>

                  {promoCodeError && (
                    <p className="text-xs text-red-600">{promoCodeError}</p>
                  )}
                  {promoCodeSuccess && (
                    <p className="text-xs text-green-600">{promoCodeSuccess}</p>
                  )}
                </form>
              </div>
            )}
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
                  <span className="font-medium text-gray-900">
                    {t("publicProfile")}
                  </span>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </div>
            </Link>
          )}

          {/* プロフィール基本情報編集 */}
          <Link
            href="/dashboard/edit"
            className="block w-full p-4 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 bg-opacity-30 rounded-lg">
                <User className="w-5 h-5 text-white" />
              </div>
              <span className="font-medium">{t("editProfile")}</span>
            </div>
          </Link>

          {/* デザイン編集 */}
          <Link
            href="/dashboard/edit/design"
            className="block w-full p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Palette className="w-5 h-5 text-blue-600" />
              </div>
              <span className="font-medium text-gray-900">
                {t("designCustomization")}
              </span>
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
              <span className="font-medium text-gray-900">{t("scanCard")}</span>
            </div>
          </Link>

          {/* ログアウト */}
          <button
            onClick={handleSignOut}
            className="w-full p-4 bg-white rounded-lg shadow-sm border border-red-200 hover:bg-red-50 transition-colors"
          >
            <div className="flex items-center justify-center gap-3">
              <LogOut className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-600">{t("logout")}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
