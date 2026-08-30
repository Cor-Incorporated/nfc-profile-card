"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Landing-page island: hydrate the static shell first, then lazily check
 * Firebase Auth so a signed-in user is sent to the dashboard without
 * blocking first paint on the marketing page.
 */
export function AuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const [{ auth }, { onAuthStateChanged }] = await Promise.all([
        import("@/lib/firebase"),
        import("firebase/auth"),
      ]);

      if (cancelled) return;

      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!cancelled && user) {
          router.replace("/dashboard");
        }
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router]);

  return null;
}
