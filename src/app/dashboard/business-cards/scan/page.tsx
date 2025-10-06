"use client";

import ContactForm from "@/components/business-card/ContactForm";
import ImageSelector from "@/components/business-card/ImageSelector";
import LoadingSpinner from "@/components/business-card/LoadingSpinner";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "@/lib/constants/error-messages";
import { db } from "@/lib/firebase";
import { Crown } from "lucide-react";
import {
  getScanQuota,
  recordScan,
  type ScanQuota,
} from "@/services/business-card/scanQuotaService";
import { downloadVCard } from "@/services/business-card/vcardService";
import { AppStatus, ContactInfo } from "@/types/business-card";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function BusinessCardScanPage() {
  const router = useRouter();
  const { user, getIdToken } = useAuth();
  const { t } = useLanguage();
  const [appStatus, setAppStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [scanQuota, setScanQuota] = useState<ScanQuota | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // スキャン上限情報を取得
  useEffect(() => {
    const fetchQuota = async () => {
      if (user?.uid) {
        const quota = await getScanQuota(user.uid);
        setScanQuota(quota);
      }
    };
    fetchQuota();
  }, [user]);

  // ユーザープロファイルを取得
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.uid) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserProfile(userSnap.data());
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  const handleImageSelected = useCallback(
    async (file: File) => {
      setAppStatus(AppStatus.PROCESSING);
      setError(null);
      setContactInfo(null);

      // Log HEIC format detection for monitoring
      if (file.type === "image/heic" || file.type === "image/heif") {
        console.log("📱 HEIC format detected from mobile device");
        console.log("Proceeding with Gemini Flash Latest processing");
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        if (typeof reader.result !== "string") {
          setError(ERROR_MESSAGES.IMAGE_READ_FAILED);
          setAppStatus(AppStatus.IDLE);
          return;
        }

        const base64Data = reader.result;
        const base64Image = base64Data.split(",")[1];
        setImageBase64(base64Image);
        setImageMimeType(file.type);

        try {
          // Get ID token for authentication
          const idToken = await getIdToken();
          if (!idToken) {
            throw new Error(ERROR_MESSAGES.AUTH_LOGIN_REQUIRED);
          }

          // Call API route to process the image
          const response = await fetch("/api/business-card/scan", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              image: base64Data,
              mimeType: file.type,
            }),
          });

          // Check if response is ok before parsing JSON
          if (!response.ok) {
            // Try to get error details from response
            let errorMessage = `Server error: ${response.status}`;
            try {
              const errorText = await response.text();
              console.error("Server error response:", errorText);

              // Check if it's an HTML error page
              if (
                errorText.includes("Request Entity Too Large") ||
                errorText.includes("Request En")
              ) {
                errorMessage =
                  "画像サイズが大きすぎます。4MB以下の画像をご利用ください。";
              } else if (
                errorText.includes("<!DOCTYPE") ||
                errorText.includes("<html")
              ) {
                errorMessage =
                  "サーバーエラーが発生しました。しばらく時間をおいてから再試行してください。";
              } else {
                // Try to parse as JSON for structured error
                try {
                  const errorJson = JSON.parse(errorText);
                  errorMessage =
                    errorJson.error || errorJson.details || errorMessage;
                } catch {
                  // Keep the default error message
                }
              }
            } catch (textError) {
              console.error("Failed to read error response:", textError);
            }

            throw new Error(errorMessage);
          }

          // Parse JSON response only if response is ok
          const result = await response.json();

          if (result.success) {
            setContactInfo(result.data);
            setAppStatus(AppStatus.EDITING);

            // 処理時間をログに記録
            if (result.processingTime) {
              console.log(`OCR completed in ${result.processingTime}ms`);
              const seconds = (result.processingTime / 1000).toFixed(1);
              toast({
                title: t("success"),
                description: SUCCESS_MESSAGES.OCR_SUCCESS_WITH_TIME(seconds),
              });
            } else {
              toast({
                title: t("success"),
                description: SUCCESS_MESSAGES.OCR_SUCCESS,
              });
            }
          } else {
            throw new Error(result.error || "Failed to extract information");
          }
        } catch (e) {
          console.error("OCR Processing Error:", e);
          const errorMessage =
            e instanceof Error
              ? e.message
              : ERROR_MESSAGES.OCR_EXTRACTION_FAILED;
          setError(errorMessage);
          setAppStatus(AppStatus.IDLE);
          toast({
            title: t("error"),
            description: errorMessage,
            variant: "destructive",
          });
        }
      };
      reader.onerror = () => {
        setError(ERROR_MESSAGES.IMAGE_READ_FAILED);
        setAppStatus(AppStatus.IDLE);
      };
    },
    [getIdToken, t],
  );

  const handleSaveContact = async (updatedContactInfo: ContactInfo) => {
    try {
      // Download vCard
      downloadVCard(updatedContactInfo, imageBase64, imageMimeType);

      // Save to Firestore with quota check
      if (user?.uid) {
        const result = await recordScan(user.uid, updatedContactInfo);
        if (!result.success) {
          toast({
            title: t("error"),
            description: result.error,
            variant: "destructive",
          });
          return;
        }
        console.log("Business card saved with ID:", result.docId);
      }

      toast({
        title: t("success"),
        description: SUCCESS_MESSAGES.VCARD_DOWNLOAD_SUCCESS,
      });

      // Reset to initial state
      handleReset();
    } catch (e) {
      console.error(e);
      setError(ERROR_MESSAGES.VCARD_GENERATION_FAILED);
      toast({
        title: t("error"),
        description: ERROR_MESSAGES.VCARD_GENERATION_FAILED,
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setAppStatus(AppStatus.IDLE);
    setContactInfo(null);
    setError(null);
    setImageBase64(null);
    setImageMimeType(null);
  };

  const renderContent = () => {
    switch (appStatus) {
      case AppStatus.PROCESSING:
        return <LoadingSpinner />;
      case AppStatus.EDITING:
        if (contactInfo) {
          return (
            <ContactForm
              initialData={contactInfo}
              onSave={handleSaveContact}
              onCancel={handleReset}
              imageBase64={imageBase64}
              imageMimeType={imageMimeType}
            />
          );
        }
      // Fallthrough to idle if contactInfo is somehow null
      case AppStatus.IDLE:
      default:
        return (
          <ImageSelector onImageSelected={handleImageSelected} error={error} />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="w-full px-4 py-4 bg-white border-b">
        <div className="flex justify-between items-center">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 touch-manipulation"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t("backToDashboard")}
          </button>

          {userProfile?.username && (
            <button
              onClick={() => router.push(`/p/${userProfile.username}`)}
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 touch-manipulation"
            >
              <svg
                className="w-5 h-5 mr-2"
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
              {t("viewPublicProfile")}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {t("businessCardScanner")}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-2">
              {t("scanBusinessCardDescription")}
            </p>

            {/* スキャン上限表示 */}
            {scanQuota && (
              <div
                className={`mt-4 p-4 rounded-lg border ${
                  scanQuota.plan === "pro"
                    ? "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300"
                    : "bg-blue-50 border-blue-200"
                }`}
              >
                {/* Plan Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {scanQuota.plan === "pro" && (
                      <Crown className="w-4 h-4 text-yellow-600" />
                    )}
                    <span
                      className={`text-xs font-semibold ${
                        scanQuota.plan === "pro"
                          ? "text-yellow-700"
                          : "text-blue-700"
                      }`}
                    >
                      {scanQuota.plan === "pro" ? t("proPlan") : t("freePlan")}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {t("reset")}: {scanQuota.daysRemaining} {t("daysRemaining")}
                  </span>
                </div>

                {/* Scan Count */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm ${
                      scanQuota.plan === "pro"
                        ? "text-yellow-800"
                        : "text-blue-800"
                    }`}
                  >
                    {t("scansThisMonth")}
                  </span>
                  <span
                    className={`text-lg font-bold ${
                      scanQuota.plan === "pro"
                        ? "text-yellow-900"
                        : "text-blue-900"
                    }`}
                  >
                    {scanQuota.used}
                    {scanQuota.plan === "pro" ? (
                      <span className="text-sm font-normal ml-1">
                        ({t("unlimited")})
                      </span>
                    ) : (
                      <span className="text-sm font-normal ml-1">
                        / {scanQuota.limit}
                      </span>
                    )}
                  </span>
                </div>

                {/* Warning for free users approaching limit */}
                {scanQuota.plan === "free" &&
                  scanQuota.used >= scanQuota.limit - 3 &&
                  scanQuota.used < scanQuota.limit && (
                    <p className="text-xs text-orange-600 mt-2">
                      ⚠️ {t("approachingMonthlyLimit")}
                    </p>
                  )}

                {/* Limit reached message */}
                {scanQuota.plan === "free" &&
                  scanQuota.used >= scanQuota.limit && (
                    <div className="mt-3 p-2 bg-orange-100 border border-orange-300 rounded">
                      <p className="text-xs text-orange-800 font-medium">
                        {t("scanLimitReached")}
                      </p>
                      <p className="text-xs text-orange-700 mt-1">
                        {t("upgradeForUnlimited")}
                      </p>
                    </div>
                  )}
              </div>
            )}
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
