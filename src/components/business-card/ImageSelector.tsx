"use client";

import React, { useRef } from "react";
import { Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ImageSelectorProps {
  onImageSelected: (file: File) => void;
  error: string | null;
}

const ImageSelector: React.FC<ImageSelectorProps> = ({ onImageSelected, error }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onImageSelected(file);
    } else {
      alert('画像ファイルを選択してください');
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="w-full shadow-lg">
      <div className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col gap-4">
          <Button
            onClick={handleButtonClick}
            size="lg"
            className="w-full h-28 sm:h-32 flex flex-col gap-2 text-base sm:text-lg touch-manipulation"
          >
            <Camera className="h-10 w-10" />
            <span>📷 写真を撮影</span>
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-gray-500">または</span>
            </div>
          </div>

          <Button
            onClick={handleButtonClick}
            variant="outline"
            size="lg"
            className="w-full h-28 sm:h-32 flex flex-col gap-2 text-base sm:text-lg touch-manipulation"
          >
            <Upload className="h-10 w-10" />
            <span>📁 画像を選択</span>
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="text-sm text-center">{error}</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-center text-xs sm:text-sm text-blue-800 space-y-1">
            <p className="font-semibold">📌 撮影のコツ</p>
            <p>• 明るい場所で撮影</p>
            <p>• 名刺全体を画面に収める</p>
            <p>• ピントを合わせて撮影</p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ImageSelector;