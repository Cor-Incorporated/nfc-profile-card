import { AppProviders } from "@/components/providers/AppProviders";
import type { ReactNode } from "react";

export default function SignInLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
