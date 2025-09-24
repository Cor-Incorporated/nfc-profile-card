"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { Camera, Upload } from "lucide-react";
import React, { useRef } from "react";
// heic2any is imported dynamically to avoid SSR issues

interface ImageSelectorProps {
  onImageSelected: (file: File) => void;
  error: string | null;
}

// 画像リサイズ関数
const resizeImageFile = async (file: File, maxSizeBytes: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // 元のサイズを取得
      const originalWidth = img.width;
      const originalHeight = img.height;
      
      // リサイズ比率を計算（最大サイズに収まるように）
      let ratio = 1;
      const maxDimension = 2048; // 最大解像度を2048pxに制限
      
      if (originalWidth > maxDimension || originalHeight > maxDimension) {
        ratio = Math.min(maxDimension / originalWidth, maxDimension / originalHeight);
      }
      
      const newWidth = Math.floor(originalWidth * ratio);
      const newHeight = Math.floor(originalHeight * ratio);
      
      // Canvasサイズを設定
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      // 画像を描画
      ctx?.drawImage(img, 0, 0, newWidth, newHeight);
      
      // 品質を調整してファイルサイズを制御
      let quality = 0.9;
      const tryCompress = (q: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }
            
            if (blob.size <= maxSizeBytes || q <= 0.3) {
              // ファイルサイズが制限内になるか、品質が最低まで下がったら完了
              const resizedFile = new File([blob], file.name, { type: 'image/jpeg' });
              resolve(resizedFile);
            } else {
              // 品質を下げて再試行
              tryCompress(q - 0.1);
            }
          },
          'image/jpeg',
          q
        );
      };
      
      tryCompress(quality);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    // 画像を読み込み
    img.src = URL.createObjectURL(file);
  });
};

const ImageSelector: React.FC<ImageSelectorProps> = ({
  onImageSelected,
  error,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    let file = event.target.files?.[0];
    if (!file) return;

    // HEIC/HEIF形式の場合はJPEGに変換
    if (file.type === 'image/heic' || file.type === 'image/heif') {
      console.log("📱 HEIC format detected. Starting conversion to JPEG...");
      try {
        // Dynamic import to avoid SSR issues
        const heic2any = (await import("heic2any")).default;
        const convertedBlob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9, // 品質の調整 (0 to 1)
        });
        // 変換後のBlobをFileオブジェクトに変換
        file = new File([convertedBlob as Blob], file.name.replace(/\.[^/.]+$/, ".jpeg"), { type: "image/jpeg" });
        console.log("✅ HEIC converted to JPEG successfully.");
      } catch (conversionError) {
        console.error("HEIC conversion failed:", conversionError);
        alert("HEIC画像の変換に失敗しました。別の画像をお試しください。");
        return;
      }
    }

    if (file.type.startsWith("image/")) {
      const maxFileSize = 4 * 1024 * 1024; // 4MB for all formats after conversion
      
      // ファイルサイズが大きい場合はリサイズを試行
      if (file.size > maxFileSize) {
        console.log("📏 File too large, attempting to resize...");
        try {
          file = await resizeImageFile(file, maxFileSize);
          console.log("✅ Image resized successfully");
        } catch (resizeError) {
          console.error("❌ Image resize failed:", resizeError);
          const maxSizeMB = maxFileSize / (1024 * 1024);
          alert(`ファイルサイズが大きすぎます。${maxSizeMB}MB以下の画像を選択してください。\n\n現在のファイルサイズ: ${(file.size / (1024 * 1024)).toFixed(1)}MB`);
          return;
        }
      }
      
      const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!supportedTypes.includes(file.type.toLowerCase())) {
        alert(`サポートされていない画像形式です: ${file.type}。JPEG、PNG、WebP、GIF形式をご利用ください。`);
        return;
      }
      
      console.log("📁 File selected:", {
        name: file.name,
        type: file.type,
        size: `${(file.size / (1024 * 1024)).toFixed(1)}MB`,
      });
      
      onImageSelected(file);
    } else {
      alert(t("selectImageFile"));
    }
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="w-full shadow-lg">
      <div className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col gap-4">
          <Button
            onClick={handleCameraClick}
            size="lg"
            className="w-full h-28 sm:h-32 flex flex-col gap-2 text-base sm:text-lg touch-manipulation"
          >
            <Camera className="h-10 w-10" />
            <span>📷 {t("takePhoto")}</span>
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-gray-500">{t("or")}</span>
            </div>
          </div>

          <Button
            onClick={handleGalleryClick}
            variant="outline"
            size="lg"
            className="w-full h-28 sm:h-32 flex flex-col gap-2 text-base sm:text-lg touch-manipulation"
          >
            <Upload className="h-10 w-10" />
            <span>📁 {t("selectImage")}</span>
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="text-sm text-center">{error}</p>
          </div>
        )}

        {/* カメラ用のinput */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* ギャラリー用のinput */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-center text-xs sm:text-sm text-blue-800 space-y-1">
            <p className="font-semibold">📌 {t("photoTips")}</p>
            <p>• {t("photoTipBrightArea")}</p>
            <p>• {t("photoTipCaptureEntire")}</p>
            <p>• {t("photoTipFocus")}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ImageSelector;
