"use client";

import { usePublicLanguage } from "@/contexts/PublicLanguageContext";
import { ROUTES, createAuthRedirectUrl } from "@/lib/constants/routes";
import { Camera, Globe, QrCode } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ProfileFloatingActionsProps {
  username: string;
  photoURL?: string;
  variant?: "full" | "minimal";
}

const QRCodeModal = dynamic(
  () =>
    import("@/components/profile/QRCodeModal").then((mod) => mod.QRCodeModal),
  { ssr: false },
);

export function ProfileFloatingActions({
  username,
  photoURL,
  variant = "full",
}: ProfileFloatingActionsProps) {
  const router = useRouter();
  const { language, setLanguage, t } = usePublicLanguage();
  const [showQRCode, setShowQRCode] = useState(false);
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [origin, setOrigin] = useState("");

  const handleCameraClick = () => {
    // Public profile no longer hydrates Firebase Auth. Send visitors through
    // sign-in with a return URL; the scan page will keep them if already signed in.
    router.push(createAuthRedirectUrl(ROUTES.DASHBOARD_BUSINESS_CARDS_SCAN));
  };

  const handleOpenQR = () => {
    setOrigin(window.location.origin);
    setShowQRCode(true);
  };

  return (
    <>
      <div
        className="fixed bottom-6 right-6 z-50 space-y-3"
        style={{
          bottom: "max(1.5rem, env(safe-area-inset-bottom))",
          right: "max(1.5rem, env(safe-area-inset-right))",
        }}
      >
        <div className="relative">
          <button
            onClick={() => setShowLangSelector(!showLangSelector)}
            className="p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
            aria-label={t("language")}
            title={t("language")}
          >
            <Globe className="h-6 w-6 text-gray-700" />
          </button>
          {showLangSelector && (
            <div className="absolute right-0 bottom-full mb-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => {
                  setLanguage("ja");
                  setShowLangSelector(false);
                }}
                className={`block w-full px-4 py-2 text-left hover:bg-gray-100 ${
                  language === "ja" ? "bg-blue-50 text-blue-600" : ""
                }`}
              >
                日本語
              </button>
              <button
                onClick={() => {
                  setLanguage("en");
                  setShowLangSelector(false);
                }}
                className={`block w-full px-4 py-2 text-left hover:bg-gray-100 ${
                  language === "en" ? "bg-blue-50 text-blue-600" : ""
                }`}
              >
                English
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleCameraClick}
          className="p-3 rounded-full shadow-lg transition-all flex items-center justify-center bg-blue-600 hover:bg-blue-700 hover:shadow-xl text-white"
          aria-label={t("loginToScanCard")}
          title={t("loginToScanCard")}
        >
          <Camera className="h-6 w-6" />
        </button>

        {variant === "full" && (
          <button
            onClick={() => handleOpenQR()}
            className="p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
            aria-label={t("showQRCode")}
            title={t("showQRCode")}
          >
            <QrCode className="h-6 w-6 text-gray-700" />
          </button>
        )}
      </div>

      {showQRCode && (
        <QRCodeModal
          isOpen={showQRCode}
          onClose={() => setShowQRCode(false)}
          url={`${origin}/p/${username}`}
          username={username}
          logoUrl={photoURL}
        />
      )}
    </>
  );
}
