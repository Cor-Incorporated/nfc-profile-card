import { AppProviders } from "@/components/providers/AppProviders";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
