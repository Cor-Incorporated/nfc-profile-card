"use client";

import { QRCodeModal } from "@/components/profile/QRCodeModal";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ROUTES, createAuthRedirectUrl } from "@/lib/constants/routes";
import { Camera, Globe, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ProfileFloatingActionsProps {
  username: string;
  photoURL?: string;
  variant?: "full" | "minimal";
}

export function ProfileFloatingActions({
  username,
  photoURL,
  variant = "full",
}: ProfileFloatingActionsProps) {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [showQRCode, setShowQRCode] = useState(false);
  const [showLangSelector, setShowLangSelector] = useState(false);

  const handleCameraClick = () => {
    if (!authUser) {
      const redirectUrl = createAuthRedirectUrl(
        ROUTES.DASHBOARD_BUSINESS_CARDS_SCAN,
      );
      router.push(redirectUrl);
    } else {
      router.push(ROUTES.DASHBOARD_BUSINESS_CARDS_SCAN);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 space-y-3">
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
          className={`p-3 rounded-full shadow-lg transition-all flex items-center justify-center ${
            !authUser
              ? "bg-gray-400 hover:bg-blue-600 hover:shadow-xl text-white"
              : "bg-blue-600 hover:bg-blue-700 hover:shadow-xl text-white"
          }`}
          aria-label={
            !authUser ? t("loginToScanCard") : t("scanBusinessCardButton")
          }
          title={!authUser ? t("loginToScanCard") : t("scanBusinessCardButton")}
        >
          <Camera className="h-6 w-6" />
        </button>

        {variant === "full" && (
          <button
            onClick={() => setShowQRCode(true)}
            className="p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
            aria-label={t("showQRCode")}
            title={t("showQRCode")}
          >
            <QrCode className="h-6 w-6 text-gray-700" />
          </button>
        )}
      </div>

      <QRCodeModal
        isOpen={showQRCode}
        onClose={() => setShowQRCode(false)}
        url={`${typeof window !== "undefined" ? window.location.origin : ""}/p/${username}`}
        username={username}
        logoUrl={photoURL}
      />
    </>
  );
}
