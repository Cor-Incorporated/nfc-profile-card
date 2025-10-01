"use client";

import { QRCodeModal } from "@/components/profile/QRCodeModal";
import { SimpleRenderer } from "@/components/profile/SimpleRenderer";
import { VCardButton } from "@/components/profile/VCardButton";
import { useAuth } from "@/contexts/AuthContext";
import { trackPageView } from "@/lib/analytics";
import { db } from "@/lib/firebase";
import { SUPPORTED_SERVICES } from "@/types";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { Camera, QrCode } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface UserProfile {
  name: string;
  username: string;
  bio: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  photoURL?: string;
  links: Array<{
    id: string;
    title: string;
    url: string;
    service?: string;
  }>;
  profile?: {
    editorContent?: any;
    background?: any;
    socialLinks?: any[];
  };
}

function getServiceIcon(url: string) {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    return SUPPORTED_SERVICES[hostname] || SUPPORTED_SERVICES["default"];
  } catch {
    return SUPPORTED_SERVICES["default"];
  }
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showQRCode, setShowQRCode] = useState(false);
  const username = params.username as string;

  // 名刺スキャンボタンのクリックハンドラー
  const handleCameraClick = () => {
    if (!authUser) {
      // 未認証の場合は認証画面にリダイレクト
      router.push("/signin?redirect=/dashboard/business-cards/scan");
    } else {
      // 認証済みの場合は名刺スキャン画面へ
      router.push("/dashboard/business-cards/scan");
    }
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", username));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setUser(null);
          setProfileData(null);
        } else {
          const userData = snapshot.docs[0].data() as UserProfile;
          const userId = snapshot.docs[0].id;
          setUser(userData);

          // Load profile data from subcollection
          try {
            const profileDoc = await getDoc(
              doc(db, "users", userId, "profile", "data"),
            );
            if (profileDoc.exists()) {
              const profile = profileDoc.data();
              console.log("[ProfilePage] Profile data loaded:", profile);
              setProfileData(profile);
            } else {
              console.log("[ProfilePage] No profile data found");
              setProfileData(null);
            }
          } catch (profileError) {
            console.error("Error fetching profile data:", profileError);
            setProfileData(null);
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setUser(null);
        setProfileData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();

    // アナリティクストラッキングを追加
    if (username) {
      trackPageView(username).catch(console.error);
    }
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            プロフィールが見つかりません
          </h1>
          <Link href="/" className="text-primary hover:underline">
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  // VCardデータの準備（両方のテンプレートで使用）
  const vcardData = {
    firstName: user.name?.split(" ")[0] || "",
    lastName: user.name?.split(" ").slice(1).join(" ") || "",
    organization: user.company || "",
    title: user.position || "",
    email: user.email || "",
    workPhone: user.phone || "",
    url: user.website || "",
    workAddress: user.address
      ? {
          street: user.address,
        }
      : undefined,
  };

  // 新しいプロファイルデータが存在する場合はSimpleRendererを使用
  if (profileData?.components && Array.isArray(profileData.components)) {
    return (
      <>
        <SimpleRenderer
          components={profileData.components}
          background={profileData.background}
        />
        {/* フローティングボタン - QRコードと名刺スキャン */}
        <div className="fixed bottom-6 right-6 z-50 space-y-3">
          {/* 名刺スキャンボタン */}
          <button
            onClick={handleCameraClick}
            className={`p-3 rounded-full shadow-lg transition-all flex items-center justify-center ${
              !authUser
                ? "bg-gray-400 hover:bg-blue-600 hover:shadow-xl text-white"
                : "bg-blue-600 hover:bg-blue-700 hover:shadow-xl text-white"
            }`}
            aria-label={
              !authUser ? "ログインして名刺をスキャン" : "名刺をスキャン"
            }
            title={!authUser ? "ログインして名刺をスキャン" : "名刺をスキャン"}
          >
            <Camera className="h-6 w-6" />
          </button>

          {/* QRコードボタン */}
          <button
            onClick={() => setShowQRCode(true)}
            className="p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
            aria-label="QRコード表示"
            title="QRコード表示"
          >
            <QrCode className="h-6 w-6 text-gray-700" />
          </button>
        </div>
        {/* QRコードモーダル */}
        {user && (
          <QRCodeModal
            isOpen={showQRCode}
            onClose={() => setShowQRCode(false)}
            url={`${typeof window !== "undefined" ? window.location.origin : ""}/p/${username}`}
            username={user.username}
            logoUrl={user.photoURL}
          />
        )}
      </>
    );
  }

  // 従来の静的テンプレート
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="text-center">
            {user.photoURL && (
              <Image
                src={user.photoURL}
                alt={user.name}
                width={128}
                height={128}
                className="w-32 h-32 rounded-full mx-auto mb-4 object-cover"
              />
            )}
            <h1 className="text-3xl font-bold mb-2">{user.name}</h1>
            {user.position && (
              <p className="text-lg text-gray-600 mb-1">{user.position}</p>
            )}
            {user.company && (
              <p className="text-lg text-gray-600 mb-4">{user.company}</p>
            )}
            {user.bio && (
              <p className="text-gray-700 mb-6 max-w-md mx-auto">{user.bio}</p>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h2 className="text-xl font-semibold mb-4">連絡先</h2>
          <div className="space-y-3">
            {user.email && (
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <a
                  href={`mailto:${user.email}`}
                  className="text-primary hover:underline"
                >
                  {user.email}
                </a>
              </div>
            )}
            {user.phone && (
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                <a
                  href={`tel:${user.phone}`}
                  className="text-primary hover:underline"
                >
                  {user.phone}
                </a>
              </div>
            )}
            {user.website && (
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
                <a
                  href={user.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {user.website}
                </a>
              </div>
            )}
            {user.address && (
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="text-gray-700">{user.address}</span>
              </div>
            )}
          </div>
          <div className="mt-6 flex gap-3">
            <VCardButton
              username={username}
              profileData={vcardData}
              variant="default"
              className="flex-1"
            />
            <button
              onClick={() => setShowQRCode(true)}
              className="p-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center"
              aria-label="QRコード表示"
            >
              <QrCode className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Social Links */}
        {user.links && user.links.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-xl font-semibold mb-4">ソーシャルリンク</h2>
            <div className="grid gap-3">
              {user.links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-300 bg-white hover:border-primary hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔗</span>
                    <span className="font-medium text-gray-800">
                      {link.title || link.url || "リンク"}
                    </span>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* QRコードモーダル */}
      {user && (
        <QRCodeModal
          isOpen={showQRCode}
          onClose={() => setShowQRCode(false)}
          url={`${typeof window !== "undefined" ? window.location.origin : ""}/p/${username}`}
          username={user.username}
          logoUrl={user.photoURL}
        />
      )}

      {/* フローティングボタン - 名刺スキャン */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={handleCameraClick}
          className={`p-3 rounded-full shadow-lg transition-all flex items-center justify-center ${
            !authUser
              ? "bg-gray-400 hover:bg-blue-600 hover:shadow-xl text-white"
              : "bg-blue-600 hover:bg-blue-700 hover:shadow-xl text-white"
          }`}
          aria-label={
            !authUser ? "ログインして名刺をスキャン" : "名刺をスキャン"
          }
          title={!authUser ? "ログインして名刺をスキャン" : "名刺をスキャン"}
        >
          <Camera className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
