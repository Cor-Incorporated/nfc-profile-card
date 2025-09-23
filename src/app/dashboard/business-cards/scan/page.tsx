"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AppStatus, ContactInfo } from "@/types/business-card";
import ImageSelector from "@/components/business-card/ImageSelector";
import LoadingSpinner from "@/components/business-card/LoadingSpinner";
import ContactForm from "@/components/business-card/ContactForm";
import { downloadVCard } from "@/services/business-card/vcardService";
import { toast } from "@/components/ui/use-toast";
import {
  recordScan,
  getScanQuota,
  type ScanQuota,
} from "@/services/business-card/scanQuotaService";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from "@/lib/constants/error-messages";
import { useLanguage } from "@/contexts/LanguageContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

          const result = await response.json();

          if (!response.ok) {
            console.error("OCR API Error:", result);
            throw new Error(
              result.error || result.details || "Failed to process business card",
            );
          }

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
            e instanceof Error ? e.message : ERROR_MESSAGES.OCR_EXTRACTION_FAILED;
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
    [getIdToken],
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
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700">{t("scansThisMonth")}</span>
                  <span className="font-semibold text-blue-900">
                    {scanQuota.used} /{" "}
                    {scanQuota.limit === 999999
                      ? t("unlimited")
                      : scanQuota.limit}
                  </span>
                </div>
                {scanQuota.limit !== 999999 &&
                  scanQuota.used >= scanQuota.limit - 5 && (
                    <p className="text-xs text-orange-600 mt-2">
                      ⚠️ {t("approachingMonthlyLimit")}
                    </p>
                  )}
                <p className="text-xs text-gray-500 mt-1">
                  {t("reset")}: {scanQuota.daysRemaining} {t("daysRemaining")}
                </p>
              </div>
            )}
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
