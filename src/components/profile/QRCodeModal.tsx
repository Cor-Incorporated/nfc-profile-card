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
  contactVCard?: string;
}

export function QRCodeModal({
  isOpen,
  onClose,
  url,
  logoUrl,
  username,
  contactVCard,
}: QRCodeModalProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [mode, setMode] = useState<"url" | "contact">("url");
  const [qrError, setQrError] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    const generateQRCode = async () => {
      setIsGenerating(true);
      setQrCodeUrl("");
      setQrError(false);
      try {
        // QRコードをDataURLとして生成
        const dataUrl = await QRCode.toDataURL(
          mode === "contact" ? contactVCard! : url,
          {
            width: 900,
            margin: 4,
            errorCorrectionLevel: "M",
            color: {
              dark: "#000000",
              light: "#ffffff",
            },
          },
        );
        if (active) setQrCodeUrl(dataUrl);
      } catch (error) {
        if (!active) return;
        setQrError(true);
        console.error("Failed to generate QR code:", error);
        toast({
          title: t("error"),
          description:
            t("qrCodeGenerationFailed") || "Failed to generate QR code",
          variant: "destructive",
        });
      } finally {
        if (active) setIsGenerating(false);
      }
    };

    generateQRCode();
    return () => {
      active = false;
    };
  }, [url, contactVCard, mode, isOpen, toast, t]);

  const handleDownload = () => {
    if (qrCodeUrl) {
      // DataURLから画像をダウンロード
      const link = document.createElement("a");
      link.download = `qrcode_${mode}_${username}.png`;
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
          {contactVCard && (
            <div className="w-full space-y-2">
              <label htmlFor="qr-content" className="text-sm">
                QRの内容 / QR content
              </label>
              <select
                id="qr-content"
                value={mode}
                onChange={(event) =>
                  setMode(event.target.value as "url" | "contact")
                }
                className="w-full rounded-md border p-2"
              >
                <option value="url">プロフィールURL / Profile URL</option>
                <option value="contact">
                  連絡先・通信不要 / Offline contact
                </option>
              </select>
              {mode === "contact" && (
                <p className="text-sm text-pretty">
                  連絡先を直接含むQRです。画像を保存すれば、交換時にWeb接続は不要です。対応するカメラ・連絡先アプリで読み取ってください。公開プロフィール変更後は保存し直してください。
                  <br />
                  Save this image before going offline. A compatible contact
                  scanner is required.
                </p>
              )}
            </div>
          )}
          {qrError && (
            <p role="alert" className="text-sm text-red-600">
              QRを生成できませんでした。情報量を減らすか、連絡先ファイルを保存してください。
            </p>
          )}
          <div className="bg-white p-4 rounded-lg shadow-lg min-h-[250px] sm:min-h-[300px] w-full max-w-[300px] flex items-center justify-center">
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
                className="w-full h-auto max-w-[300px]"
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

          {mode === "contact" && contactVCard ? (
            <a
              className="text-sm underline"
              href={`data:text/vcard;charset=utf-8,${encodeURIComponent(contactVCard)}`}
              download={`contact_${username}.vcf`}
            >
              連絡先ファイルを保存 / Save contact file
            </a>
          ) : (
            <div className="text-xs text-muted-foreground text-center">
              {url}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
