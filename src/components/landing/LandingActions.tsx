"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

type LandingLanguage = "ja" | "en";

const LANGUAGE_STORAGE_KEY = "userLanguage";
const DEFAULT_LANGUAGE: LandingLanguage = "ja";

const LABELS: Record<LandingLanguage, { getStarted: string; signIn: string }> =
  {
    ja: {
      getStarted: "Get Started",
      signIn: "ログイン",
    },
    en: {
      getStarted: "Get Started",
      signIn: "Sign In",
    },
  };

function readStoredLanguage(): LandingLanguage {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en"
      ? "en"
      : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function subscribeToLanguagePreference(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

export function LandingActions() {
  const language = useSyncExternalStore(
    subscribeToLanguagePreference,
    readStoredLanguage,
    () => DEFAULT_LANGUAGE,
  );
  const labels = LABELS[language];

  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      <Link
        href="/signin?tab=signup"
        className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-semibold text-center shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
      >
        {labels.getStarted}
      </Link>
      <Link
        href="/signin?tab=signin"
        className="w-full py-4 bg-white/80 backdrop-blur text-gray-700 rounded-2xl font-semibold text-center shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
      >
        {labels.signIn}
      </Link>
    </div>
  );
}
