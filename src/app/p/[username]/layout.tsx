import { PublicLanguageProvider } from "@/contexts/PublicLanguageContext";
import type { ReactNode } from "react";

export default function PublicProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <PublicLanguageProvider>{children}</PublicLanguageProvider>;
}
