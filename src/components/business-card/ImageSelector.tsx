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

// HEIC変換関数
const convertHEICToJPEG = async (file: File): Promise<File> => {
  // HEIC/HEIF形式の検出
  const isHEIC =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif");

  // PCブラウザの自動変換を検出
  const isBrowserConvertedHEIC =
    (file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif")) &&
    file.type === "image/jpeg";

  const shouldConvertHEIC = isHEIC || isBrowserConvertedHEIC;

  console.log("🔍 HEIC detection:", {
    isHEIC,
    isBrowserConvertedHEIC,
    shouldConvertHEIC,
    fileType: file.type,
    fileName: file.name,
  });

  if (!shouldConvertHEIC) {
    console.log("📱 Not a HEIC file, skipping conversion");
    return file;
  }

  console.log("📱 HEIC format detected. Starting conversion to JPEG...");

  try {
    const heic2any = (await import("heic2any")).default;
    const convertedBlob = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.7,
    });

    const convertedFile = new File(
      [convertedBlob as Blob],
      file.name.replace(/\.[^/.]+$/, ".jpeg"),
      { type: "image/jpeg" },
    );
    console.log("✅ HEIC converted to JPEG successfully.");
    console.log(
      "📏 Converted file size:",
      `${(convertedFile.size / (1024 * 1024)).toFixed(1)}MB`,
    );

    return convertedFile;
  } catch (conversionError) {
    console.error("HEIC conversion failed:", conversionError);

    if (isBrowserConvertedHEIC) {
      console.log("📱 Browser already converted HEIC to JPEG, using as-is");
      return file;
    } else {
      alert("HEIC画像の変換に失敗しました。別の画像をお試しください。");
      throw conversionError;
    }
  }
};

// 画像リサイズ関数
const resizeImageFile = async (
  file: File,
  maxSizeBytes: number,
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      const originalWidth = img.width;
      const originalHeight = img.height;
      const maxDimension = 1600; // 最大解像度を1600pxに制限

      // リサイズ比率を計算
      const ratio = Math.min(
        1,
        maxDimension / originalWidth,
        maxDimension / originalHeight,
      );

      console.log(
        `📏 Original size: ${originalWidth}x${originalHeight}, ratio: ${ratio.toFixed(2)}`,
      );

      const newWidth = Math.floor(originalWidth * ratio);
      const newHeight = Math.floor(originalHeight * ratio);

      // Canvasサイズを設定して画像を描画
      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx?.drawImage(img, 0, 0, newWidth, newHeight);

      // 品質を段階的に下げてファイルサイズを制御
      const tryCompress = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to create blob"));
              return;
            }

            console.log(
              `📏 Trying quality ${quality.toFixed(1)}, size: ${(blob.size / (1024 * 1024)).toFixed(1)}MB`,
            );

            if (blob.size <= maxSizeBytes || quality <= 0.2) {
              const resizedFile = new File([blob], file.name, {
                type: "image/jpeg",
              });
              console.log(
                `✅ Final size: ${(blob.size / (1024 * 1024)).toFixed(1)}MB with quality ${quality.toFixed(1)}`,
              );
              resolve(resizedFile);
            } else {
              tryCompress(quality - 0.15);
            }
          },
          "image/jpeg",
          quality,
        );
      };

      tryCompress(0.8); // 初期品質
    };

    img.onerror = () => reject(new Error("Failed to load image"));
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

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    let file = event.target.files?.[0];
    if (!file) return;

    console.log("📁 File selected:", {
      name: file.name,
      type: file.type,
      size: `${(file.size / (1024 * 1024)).toFixed(1)}MB`,
      extension: file.name.split(".").pop()?.toLowerCase(),
    });

    // HEIC変換処理
    file = await convertHEICToJPEG(file);

    if (file.type.startsWith("image/")) {
      const maxFileSize = 4 * 1024 * 1024; // 4MB for all formats after conversion
      const resizeThreshold = 2 * 1024 * 1024; // 2MB以上でリサイズを実行（より積極的に）

      console.log(
        "📏 File size check:",
        `${(file.size / (1024 * 1024)).toFixed(1)}MB (limit: 4MB, resize threshold: 2MB)`,
      );

      // ファイルサイズが大きい場合はリサイズを試行（より積極的に）
      if (file.size > resizeThreshold) {
        console.log("📏 File size exceeds threshold, attempting to resize...");
        console.log(
          "📏 Current size:",
          `${(file.size / (1024 * 1024)).toFixed(1)}MB`,
        );
        try {
          file = await resizeImageFile(file, maxFileSize);
          console.log("✅ Image resized successfully");
          console.log(
            "📏 Resized file size:",
            `${(file.size / (1024 * 1024)).toFixed(1)}MB`,
          );
        } catch (resizeError) {
          console.error("❌ Image resize failed:", resizeError);
          const maxSizeMB = maxFileSize / (1024 * 1024);
          alert(
            `ファイルサイズが大きすぎます。${maxSizeMB}MB以下の画像を選択してください。\n\n現在のファイルサイズ: ${(file.size / (1024 * 1024)).toFixed(1)}MB`,
          );
          return;
        }
      } else {
        console.log(
          "📏 File size is within limit:",
          `${(file.size / (1024 * 1024)).toFixed(1)}MB`,
        );
      }

      // 最終的なファイルサイズを確認
      console.log(
        "📏 Final file size before upload:",
        `${(file.size / (1024 * 1024)).toFixed(1)}MB`,
      );

      const supportedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
      ];
      if (!supportedTypes.includes(file.type.toLowerCase())) {
        alert(
          `サポートされていない画像形式です: ${file.type}。JPEG、PNG、WebP、GIF形式をご利用ください。`,
        );
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
