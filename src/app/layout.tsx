import { Inter } from "next/font/google";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TapForge | デジタル名刺ソリューション",
  description:
    "物理的なNFCカードとデジタルプロフィールを統合した、次世代のネットワーキングツール",
  keywords: "NFC, デジタル名刺, プロフィール, ネットワーキング, TapForge",
  openGraph: {
    title: "TapForge",
    description: "タップするだけでプロフィールを共有",
    type: "website",
    locale: "ja_JP",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
