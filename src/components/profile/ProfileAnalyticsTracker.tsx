"use client";

import { useEffect } from "react";

interface ProfileAnalyticsTrackerProps {
  username: string;
}

export function ProfileAnalyticsTracker({
  username,
}: ProfileAnalyticsTrackerProps) {
  useEffect(() => {
    if (!username) return;

    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        referrer: document.referrer || "direct",
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {});
  }, [username]);

  return null;
}
