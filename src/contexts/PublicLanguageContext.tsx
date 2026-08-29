"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Language = "ja" | "en";

type PublicLabelKey =
  | "language"
  | "loginToScanCard"
  | "scanBusinessCardButton"
  | "showQRCode"
  | "contactInfo"
  | "socialLinks"
  | "linkText"
  | "success"
  | "error"
  | "loading"
  | "saved"
  | "saveContact"
  | "vcardDownloaded"
  | "vcardDownloadFailed"
  | "qrCodeGenerationFailed"
  | "qrCodeDownloaded"
  | "linkCopied"
  | "urlCopiedToClipboard"
  | "copyFailed"
  | "shareProfile"
  | "qrCodeDescription"
  | "generatingQRCode"
  | "downloadQR"
  | "copyLink";

const LABELS: Record<Language, Record<PublicLabelKey, string>> = {
  ja: {
    language: "言語",
    loginToScanCard: "ログインして名刺をスキャン",
    scanBusinessCardButton: "名刺をスキャン",
    showQRCode: "QRコード表示",
    contactInfo: "連絡先",
    socialLinks: "ソーシャルリンク",
    linkText: "リンク",
    success: "成功",
    error: "エラー",
    loading: "読み込み中...",
    saved: "保存しました",
    saveContact: "連絡先を保存",
    vcardDownloaded: "VCardをダウンロードしました",
    vcardDownloadFailed: "VCardのダウンロードに失敗しました",
    qrCodeGenerationFailed: "QRコードの生成に失敗しました",
    qrCodeDownloaded: "QRコードをダウンロードしました",
    linkCopied: "リンクをコピーしました",
    urlCopiedToClipboard: "URLをクリップボードにコピーしました",
    copyFailed: "コピーに失敗しました",
    shareProfile: "プロフィールを共有",
    qrCodeDescription: "名刺や印刷物にこのQRコードをご利用ください",
    generatingQRCode: "QRコードを生成中...",
    downloadQR: "QRコードをダウンロード",
    copyLink: "リンクをコピー",
  },
  en: {
    language: "Language",
    loginToScanCard: "Login to Scan Business Card",
    scanBusinessCardButton: "Scan Business Card",
    showQRCode: "Show QR Code",
    contactInfo: "Contact Information",
    socialLinks: "Social Links",
    linkText: "Link",
    success: "Success",
    error: "Error",
    loading: "Loading...",
    saved: "Saved",
    saveContact: "Save Contact",
    vcardDownloaded: "VCard downloaded",
    vcardDownloadFailed: "Failed to download VCard",
    qrCodeGenerationFailed: "Failed to generate QR code",
    qrCodeDownloaded: "QR code downloaded",
    linkCopied: "Link copied",
    urlCopiedToClipboard: "URL copied to clipboard",
    copyFailed: "Failed to copy",
    shareProfile: "Share Profile",
    qrCodeDescription:
      "Use this QR code on business cards and printed materials",
    generatingQRCode: "Generating QR code...",
    downloadQR: "Download QR",
    copyLink: "Copy Link",
  },
};

interface PublicLanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const PublicLanguageContext = createContext<
  PublicLanguageContextType | undefined
>(undefined);

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "ja";
  const saved = window.localStorage.getItem("userLanguage");
  return saved === "en" ? "en" : "ja";
}

export function PublicLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    window.localStorage.setItem("userLanguage", lang);
  }, []);

  const t = useCallback(
    (key: string) => {
      const table = LABELS[language];
      return table[key as PublicLabelKey] ?? key;
    },
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <PublicLanguageContext.Provider value={value}>
      {children}
    </PublicLanguageContext.Provider>
  );
}

export function usePublicLanguage() {
  const context = useContext(PublicLanguageContext);
  if (!context) {
    throw new Error(
      "usePublicLanguage must be used within a PublicLanguageProvider",
    );
  }
  return context;
}
