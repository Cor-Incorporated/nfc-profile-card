"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Copy, Download } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import Image from "next/image";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  logoUrl?: string;
  username: string;
}

export function QRCodeModal({
  isOpen,
  onClose,
  url,
  logoUrl,
  username,
}: QRCodeModalProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const generateQRCode = async () => {
      setIsGenerating(true);
      try {
        // QRコードをDataURLとして生成
        const dataUrl = await QRCode.toDataURL(url, {
          width: 300,
          margin: 2,
          color: {
            dark: "#2563eb",
            light: "#ffffff",
          },
        });
        setQrCodeUrl(dataUrl);
      } catch (error) {
        console.error("Failed to generate QR code:", error);
        toast({
          title: t("error"),
          description:
            t("qrCodeGenerationFailed") || "Failed to generate QR code",
          variant: "destructive",
        });
      } finally {
        setIsGenerating(false);
      }
    };

    generateQRCode();
  }, [url, isOpen, toast, t]);

  const handleDownload = () => {
    if (qrCodeUrl) {
      // DataURLから画像をダウンロード
      const link = document.createElement("a");
      link.download = `qrcode_${username}.png`;
      link.href = qrCodeUrl;
      link.click();

      toast({
        title: t("saved"),
        description: t("qrCodeDownloaded") || "QR code downloaded",
      });
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: t("linkCopied"),
        description: t("urlCopiedToClipboard") || "URL copied to clipboard",
      });
    } catch (error) {
      toast({
        title: t("error"),
        description: t("copyFailed") || "Failed to copy",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("shareProfile")}</DialogTitle>
          <DialogDescription>
            {t("qrCodeDescription") ||
              "Use this QR code on business cards and printed materials"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-lg min-h-[300px] min-w-[300px] flex items-center justify-center">
            {isGenerating ? (
              <div className="text-gray-400 animate-pulse">
                {t("generatingQRCode") || "Generating QR code..."}
              </div>
            ) : qrCodeUrl ? (
              <Image
                src={qrCodeUrl}
                alt="QR Code"
                width={300}
                height={300}
                className="w-[300px] h-[300px]"
              />
            ) : null}
          </div>

          <div className="flex flex-col w-full space-y-2">
            <Button
              onClick={handleDownload}
              className="w-full"
              disabled={!qrCodeUrl || isGenerating}
            >
              <Download className="mr-2 h-4 w-4" />
              {t("downloadQR")}
            </Button>

            <Button
              onClick={handleCopyUrl}
              variant="outline"
              className="w-full"
            >
              <Copy className="mr-2 h-4 w-4" />
              {t("copyLink")}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">{url}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
