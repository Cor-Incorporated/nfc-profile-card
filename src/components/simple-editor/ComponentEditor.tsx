"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { ProfileComponent } from "./utils/dataStructure";
import { ImageUploader } from "./ImageUploader";
import { getSocialServiceInfo } from "@/utils/socialLinks";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";

interface ComponentEditorProps {
  component: ProfileComponent;
  onSave: (updatedComponent: ProfileComponent) => void;
  onClose: () => void;
  userId?: string;
}

export function ComponentEditor({
  component,
  onSave,
  onClose,
  userId,
}: ComponentEditorProps) {
  const { t } = useLanguage();
  const renderEditor = () => {
    switch (component.type) {
      case "text":
        return (
          <TextEditor component={component} onSave={onSave} onClose={onClose} />
        );
      case "image":
        return (
          <ImageEditor
            component={component}
            onSave={onSave}
            onClose={onClose}
            userId={userId}
          />
        );
      case "link":
        return (
          <LinkEditor component={component} onSave={onSave} onClose={onClose} />
        );
      case "profile":
        return (
          <ProfileEditor
            component={component}
            onSave={onSave}
            onClose={onClose}
            userId={userId}
          />
        );
      default:
        return <div>{t("unsupportedComponent")}</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center p-3 sm:p-4 border-b">
          <h3 className="text-base sm:text-lg font-semibold">
            {component.type === "text" && t("editText")}
            {component.type === "image" && t("editImage")}
            {component.type === "link" && t("editLink")}
            {component.type === "profile" && t("editProfileComponent")}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-3 sm:p-4">{renderEditor()}</div>
      </div>
    </div>
  );
}

// テキストエディタ
function TextEditor({
  component,
  onSave,
  onClose,
}: Omit<ComponentEditorProps, "userId">) {
  const content = component.content as any;
  const [text, setText] = useState(content?.text || "");
  const { t } = useLanguage();

  const handleSave = () => {
    const cleanContent = { text: text.trim() };

    onSave({
      ...component,
      content: cleanContent,
    });
    onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="text-content">{t("textContent")}</Label>
        <Textarea
          id="text-content"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full mt-1"
          rows={4}
          placeholder={t("textPlaceholderInput")}
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSave} className="flex-1">
          {t("save")}
        </Button>
        <Button variant="outline" onClick={onClose} className="flex-1">
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}

// 画像エディタ
function ImageEditor({
  component,
  onSave,
  onClose,
  userId,
}: ComponentEditorProps) {
  const content = component.content as any;
  const [imageUrl, setImageUrl] = useState(content?.src || "");
  const [alt, setAlt] = useState(content?.alt || "");
  const [useUpload, setUseUpload] = useState(true);
  const { t } = useLanguage();

  const handleSave = () => {
    const cleanContent = {
      src: imageUrl.trim(),
      alt: alt.trim(),
    };

    onSave({
      ...component,
      content: cleanContent,
    });
    onClose();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t("editImage")}</h3>

      {/* タブ切り替え */}
      <div className="flex space-x-2">
        <Button
          size="sm"
          variant={useUpload ? "default" : "outline"}
          onClick={() => setUseUpload(true)}
        >
          {t("upload")}
        </Button>
        <Button
          size="sm"
          variant={!useUpload ? "default" : "outline"}
          onClick={() => setUseUpload(false)}
        >
          {t("urlInput")}
        </Button>
      </div>

      {useUpload && userId ? (
        <ImageUploader
          userId={userId}
          onImageUploaded={setImageUrl}
          currentImageUrl={imageUrl}
        />
      ) : (
        <div>
          <Label htmlFor="image-url" className="block text-sm font-medium mb-2">
            {t("imageUrl")}
          </Label>
          <Input
            id="image-url"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full"
            placeholder="https://example.com/image.jpg"
          />
        </div>
      )}

      <div>
        <Label htmlFor="image-alt" className="block text-sm font-medium mb-2">
          {t("imageAlt")}
        </Label>
        <Input
          id="image-alt"
          type="text"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          className="w-full"
          placeholder={t("imageAltPlaceholder")}
        />
      </div>

      <div className="flex space-x-2">
        <Button onClick={handleSave} className="flex-1">
          {t("save")}
        </Button>
        <Button onClick={onClose} variant="outline" className="flex-1">
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}

// リンクエディタ
function LinkEditor({
  component,
  onSave,
  onClose,
}: Omit<ComponentEditorProps, "userId">) {
  const content = component.content as any;
  const [url, setUrl] = useState(content?.url || "");
  const [label, setLabel] = useState(content?.label || "");
  const [useAutoLabel, setUseAutoLabel] = useState(true);
  const { t } = useLanguage();

  // URLが変更されたら自動的にラベルを設定
  useEffect(() => {
    if (useAutoLabel && url) {
      const serviceInfo = getSocialServiceInfo(url);
      setLabel(serviceInfo.name);
    }
  }, [url, useAutoLabel]);

  const handleSave = () => {
    const cleanContent = {
      url: url.trim(),
      label: label.trim(),
    };

    onSave({
      ...component,
      content: cleanContent,
    });
    onClose();
  };

  // プレビュー用のサービス情報
  const serviceInfo = getSocialServiceInfo(url);
  const Icon = serviceInfo.icon;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t("editLink")}</h3>

      <div>
        <Label htmlFor="link-url" className="block text-sm font-medium mb-2">
          URL
        </Label>
        <Input
          id="link-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full"
          placeholder="https://github.com/username"
        />
      </div>

      <div>
        <Label htmlFor="link-label" className="block text-sm font-medium mb-2">
          {t("linkLabel")}
        </Label>
        <div className="flex space-x-2">
          <Input
            id="link-label"
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setUseAutoLabel(false);
            }}
            className="flex-1"
            placeholder={t("linkLabelPlaceholder")}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setUseAutoLabel(true);
              const info = getSocialServiceInfo(url);
              setLabel(info.name);
            }}
          >
            {t("autoSet")}
          </Button>
        </div>
      </div>

      {/* プレビュー */}
      <div>
        <Label className="block text-sm font-medium mb-2">
          {t("linkPreview")}
        </Label>
        <div
          className="p-3 border rounded flex items-center space-x-3"
          style={{
            backgroundColor: serviceInfo.color,
            color: "#FFFFFF",
          }}
        >
          <Icon className="h-5 w-5" />
          <span>{label || serviceInfo.name}</span>
        </div>
      </div>

      <div className="flex space-x-2">
        <Button onClick={handleSave} className="flex-1">
          {t("save")}
        </Button>
        <Button onClick={onClose} variant="outline" className="flex-1">
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}

// プロフィールエディタ（拡充版）
interface ProfileContent {
  // 基本情報
  firstName?: string;
  lastName?: string;
  phoneticFirstName?: string; // ふりがな（名）
  phoneticLastName?: string; // ふりがな（姓）
  name?: string; // 表示名（フルネーム）

  // 連絡先
  email?: string;
  phone?: string;
  cellPhone?: string;

  // 会社情報
  company?: string;
  position?: string;
  department?: string;

  // 住所
  address?: string;
  city?: string;
  postalCode?: string;

  // Web/SNS
  website?: string;

  // その他
  bio?: string;
  photoURL?: string;

  // カードデザイン
  cardBackgroundColor?: string;
  cardBackgroundOpacity?: number;
}

function ProfileEditor({
  component,
  onSave,
  onClose,
  userId,
}: ComponentEditorProps) {
  const content = component.content as any;
  const { t } = useLanguage();
  const router = useRouter();

  const [profileData, setProfileData] = useState<ProfileContent>({
    firstName: content?.firstName || "",
    lastName: content?.lastName || "",
    phoneticFirstName: content?.phoneticFirstName || "",
    phoneticLastName: content?.phoneticLastName || "",
    name: content?.name || "",
    email: content?.email || "",
    phone: content?.phone || "",
    cellPhone: content?.cellPhone || "",
    company: content?.company || "",
    position: content?.position || "",
    department: content?.department || "",
    address: content?.address || "",
    city: content?.city || "",
    postalCode: content?.postalCode || "",
    website: content?.website || "",
    bio: content?.bio || "",
    photoURL: content?.photoURL || "",
    cardBackgroundColor: content?.cardBackgroundColor || "#ffffff",
    cardBackgroundOpacity: content?.cardBackgroundOpacity || 95,
  });

  const handleSave = () => {
    const fullName =
      profileData.name ||
      `${profileData.lastName || ""} ${profileData.firstName || ""}`.trim();

    const cleanContent = Object.fromEntries(
      Object.entries({
        ...profileData,
        name: fullName,
      }).filter(
        ([_, value]) => value !== "" && value !== null && value !== undefined,
      ),
    );

    onSave({
      ...component,
      content: cleanContent,
    });
    onClose();
  };

  const COLOR_PRESETS = [
    { color: "#3b82f6", name: t("blue") },
    { color: "#10b981", name: t("green") },
    { color: "#f59e0b", name: t("orange") },
    { color: "#ef4444", name: t("red") },
    { color: "#8b5cf6", name: t("purple") },
    { color: "#ec4899", name: t("pink") },
    { color: "#6b7280", name: t("gray") },
    { color: "#000000", name: t("black") },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-sm text-blue-800 mb-2">
          {t("profileInfoEditMessage")}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/dashboard/edit")}
          className="w-full"
        >
          {t("goToProfileEdit")}
        </Button>
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-medium">
          {t("profileCardBackground")}
        </Label>
        <div className="grid grid-cols-4 gap-2">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.color}
              onClick={() =>
                setProfileData({
                  ...profileData,
                  cardBackgroundColor: preset.color,
                })
              }
              className={`h-10 rounded border-2 ${
                profileData.cardBackgroundColor === preset.color
                  ? "border-blue-500"
                  : "border-gray-300"
              }`}
              style={{ backgroundColor: preset.color }}
              title={preset.name}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="color"
            value={profileData.cardBackgroundColor || "#3b82f6"}
            onChange={(e) =>
              setProfileData({
                ...profileData,
                cardBackgroundColor: e.target.value,
              })
            }
            className="h-10 w-20"
          />
          <input
            type="text"
            value={profileData.cardBackgroundColor || "#3b82f6"}
            onChange={(e) =>
              setProfileData({
                ...profileData,
                cardBackgroundColor: e.target.value,
              })
            }
            className="flex-1 px-2 border rounded text-base"
            placeholder="#3b82f6"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="card-opacity" className="text-xs">
          {t("cardTransparency")}: {profileData.cardBackgroundOpacity || 95}%
        </Label>
        <input
          id="card-opacity"
          type="range"
          min="0"
          max="100"
          value={profileData.cardBackgroundOpacity || 95}
          onChange={(e) =>
            setProfileData({
              ...profileData,
              cardBackgroundOpacity: parseInt(e.target.value),
            })
          }
          className="w-full mt-1"
        />
        <div className="text-xs text-gray-500 mt-1">
          {t("transparencyDescription")}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} className="flex-1">
          {t("save")}
        </Button>
        <Button variant="outline" onClick={onClose} className="flex-1">
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
