"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

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
          title: "エラー",
          description: "QRコードの生成に失敗しました",
          variant: "destructive",
        });
      } finally {
        setIsGenerating(false);
      }
    };

    generateQRCode();
  }, [url, isOpen, toast]);

  const handleDownload = () => {
    if (qrCodeUrl) {
      // DataURLから画像をダウンロード
      const link = document.createElement("a");
      link.download = `qrcode_${username}.png`;
      link.href = qrCodeUrl;
      link.click();

      toast({
        title: "成功",
        description: "QRコードをダウンロードしました",
      });
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "コピーしました",
        description: "URLをクリップボードにコピーしました",
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "コピーに失敗しました",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QRコードを共有</DialogTitle>
          <DialogDescription>
            このQRコードを名刺や印刷物に使用できます
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-lg min-h-[300px] min-w-[300px] flex items-center justify-center">
            {isGenerating ? (
              <div className="text-gray-400 animate-pulse">
                QRコード生成中...
              </div>
            ) : qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="QR Code"
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
              QRコードをダウンロード
            </Button>

            <Button
              onClick={handleCopyUrl}
              variant="outline"
              className="w-full"
            >
              <Copy className="mr-2 h-4 w-4" />
              URLをコピー
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            {url}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}