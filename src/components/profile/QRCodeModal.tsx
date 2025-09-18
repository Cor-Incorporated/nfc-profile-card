"use client";

import { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
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
  const qrRef = useRef<HTMLDivElement>(null);
  const [qrCode, setQrCode] = useState<QRCodeStyling | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const qr = new QRCodeStyling({
      width: 300,
      height: 300,
      type: "svg",
      data: url,
      image: logoUrl,
      dotsOptions: {
        color: "#000000",
        type: "rounded",
      },
      backgroundOptions: {
        color: "#ffffff",
      },
      cornersSquareOptions: {
        type: "extra-rounded",
      },
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 10,
      },
    });

    setQrCode(qr);
  }, [url, logoUrl]);

  useEffect(() => {
    if (qrCode && qrRef.current) {
      qrRef.current.innerHTML = "";
      qrCode.append(qrRef.current);
    }
  }, [qrCode]);

  const handleDownload = () => {
    if (qrCode) {
      qrCode.download({
        name: `qrcode_${username}`,
        extension: "png",
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
          <div ref={qrRef} className="bg-white p-4 rounded-lg shadow-lg" />

          <div className="flex flex-col w-full space-y-2">
            <Button onClick={handleDownload} className="w-full">
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

          <div className="text-xs text-muted-foreground text-center">{url}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
