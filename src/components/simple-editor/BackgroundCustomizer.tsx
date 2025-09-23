import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUploader } from "./ImageUploader";
import { Palette, Sparkles, Image } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface BackgroundCustomizerProps {
  currentBackground: any;
  userId: string;
  onBackgroundChange: (background: any) => void;
}

// カラープリセット
const COLOR_PRESETS = [
  "#ffffff", // 白
  "#f3f4f6", // グレー
  "#dbeafe", // 青
  "#dcfce7", // 緑
  "#fef3c7", // 黄
  "#fce7f3", // ピンク
  "#e9d5ff", // 紫
  "#1f2937", // ダークグレー
];

// グラデーションプリセット
function getGradientPresets(t: (key: string) => string) {
  return [
    { from: "#667eea", to: "#764ba2", name: t("purpleGradient") },
    { from: "#f093fb", to: "#f5576c", name: t("pinkGradient") },
    { from: "#4facfe", to: "#00f2fe", name: t("blueGradient") },
    { from: "#43e97b", to: "#38f9d7", name: t("greenGradient") },
    { from: "#fa709a", to: "#fee140", name: t("sunset") },
    { from: "#30cfd0", to: "#330867", name: t("deepSea") },
  ];
}

export function BackgroundCustomizer({
  currentBackground,
  userId,
  onBackgroundChange,
}: BackgroundCustomizerProps) {
  const { t } = useLanguage();
  // patternタイプの場合はsolidに自動変換
  const initialBackground =
    currentBackground?.type === "pattern"
      ? { type: "solid", color: "#ffffff" }
      : currentBackground || { type: "solid", color: "#ffffff" };

  const [background, setBackground] = useState(initialBackground);

  const handleChange = (newBackground: any) => {
    setBackground(newBackground);
    onBackgroundChange(newBackground);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t("backgroundCustomize")}</h3>

      <Tabs defaultValue={background.type || "solid"} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="solid" className="text-xs">
            <Palette className="w-4 h-4 mr-1" />
            {t("solidColor")}
          </TabsTrigger>
          <TabsTrigger value="gradient" className="text-xs">
            <Sparkles className="w-4 h-4 mr-1" />
            {t("gradientShort")}
          </TabsTrigger>
          <TabsTrigger value="image" className="text-xs">
            <Image className="w-4 h-4 mr-1" />
            {t("backgroundImageTab")}
          </TabsTrigger>
        </TabsList>

        {/* 単色タブ */}
        <TabsContent value="solid" className="space-y-3">
          <div>
            <Label className="text-sm">{t("selectColor")}</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleChange({ type: "solid", color })}
                  className={`w-full h-12 rounded border-2 ${
                    background.type === "solid" && background.color === color
                      ? "border-blue-500"
                      : "border-gray-300"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* カスタムカラー */}
          <div>
            <Label htmlFor="custom-color" className="text-sm">
              {t("customColor")}
            </Label>
            <div className="flex gap-2 mt-1">
              <input
                id="custom-color"
                type="color"
                value={background.color || "#ffffff"}
                onChange={(e) =>
                  handleChange({ type: "solid", color: e.target.value })
                }
                className="h-10 w-20"
              />
              <input
                type="text"
                value={background.color || "#ffffff"}
                onChange={(e) =>
                  handleChange({ type: "solid", color: e.target.value })
                }
                className="flex-1 px-2 border rounded"
                placeholder="#ffffff"
              />
            </div>
          </div>
        </TabsContent>

        {/* グラデーションタブ */}
        <TabsContent value="gradient" className="space-y-3">
          <div>
            <Label className="text-sm">{t("preset")}</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {getGradientPresets(t).map((gradient) => (
                <button
                  key={gradient.name}
                  onClick={() =>
                    handleChange({
                      type: "gradient",
                      from: gradient.from,
                      to: gradient.to,
                    })
                  }
                  className={`h-12 rounded border-2 ${
                    background.type === "gradient" &&
                    background.from === gradient.from &&
                    background.to === gradient.to
                      ? "border-blue-500"
                      : "border-gray-300"
                  }`}
                  style={{
                    background: `linear-gradient(90deg, ${gradient.from}, ${gradient.to})`,
                  }}
                >
                  <span className="text-white text-xs drop-shadow">
                    {gradient.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* カスタムグラデーション */}
          <div className="space-y-2">
            <Label className="text-sm">{t("customSettings")}</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="from-color" className="text-xs">
                  {t("startColor")}
                </Label>
                <input
                  id="from-color"
                  type="color"
                  value={background.from || "#667eea"}
                  onChange={(e) =>
                    handleChange({
                      type: "gradient",
                      from: e.target.value,
                      to: background.to || "#764ba2",
                    })
                  }
                  className="w-full h-10"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="to-color" className="text-xs">
                  {t("endColor")}
                </Label>
                <input
                  id="to-color"
                  type="color"
                  value={background.to || "#764ba2"}
                  onChange={(e) =>
                    handleChange({
                      type: "gradient",
                      from: background.from || "#667eea",
                      to: e.target.value,
                    })
                  }
                  className="w-full h-10"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 画像タブ */}
        <TabsContent value="image" className="space-y-3">
          <ImageUploader
            userId={userId}
            onImageUploaded={(url) =>
              handleChange({
                type: "image",
                url,
                opacity: 0.7, // デフォルトは70%の不透明度
              })
            }
            currentImageUrl={background.url}
          />

          {background.type === "image" && background.url && (
            <div>
              <Label htmlFor="image-opacity" className="text-sm">
                {t("backgroundOpacity")}:{" "}
                {Math.round((background.opacity || 0.7) * 100)}%
              </Label>
              <input
                id="image-opacity"
                type="range"
                min="0"
                max="100"
                value={(background.opacity || 0.7) * 100}
                onChange={(e) =>
                  handleChange({
                    ...background,
                    opacity: parseInt(e.target.value) / 100,
                  })
                }
                className="w-full mt-1"
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* プレビュー */}
      <div>
        <Label className="text-sm">{t("previewMobile")}</Label>
        <div className="flex justify-center mt-2">
          {/* スマホフレーム */}
          <div className="relative" style={{ width: "180px" }}>
            {/* スマホの枠 */}
            <div className="absolute inset-0 bg-black rounded-3xl shadow-xl"></div>
            {/* スクリーン部分 */}
            <div
              className="relative rounded-2xl overflow-hidden mx-2 my-2"
              style={{
                height: "320px",
                ...getBackgroundStyle(background),
              }}
            >
              {/* コンテンツのプレビュー */}
              <div className="p-4 space-y-2">
                <div className="bg-white bg-opacity-90 rounded-lg p-3 shadow-sm">
                  <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded w-2/3 mx-auto mb-1"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/2 mx-auto"></div>
                </div>
                <div className="bg-white bg-opacity-90 rounded-lg p-3 shadow-sm">
                  <div className="h-2 bg-gray-200 rounded mb-1"></div>
                  <div className="h-2 bg-gray-200 rounded w-4/5"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 背景スタイル生成関数（export して他のコンポーネントでも使用可能）
export function getBackgroundStyle(background: any) {
  if (!background) return {};

  switch (background.type) {
    case "solid":
      return { backgroundColor: background.color };

    case "gradient":
      return {
        background: `linear-gradient(135deg, ${background.from || "#667eea"}, ${background.to || "#764ba2"})`,
      };

    case "image":
      // 不透明度を背景画像に適用するためにlinear-gradientを使用
      const opacity = background.opacity ?? 0.5;
      return {
        backgroundImage: `linear-gradient(rgba(255, 255, 255, ${1 - opacity}), rgba(255, 255, 255, ${1 - opacity})), url(${background.url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundBlendMode: "normal",
      };

    default:
      return {};
  }
}
