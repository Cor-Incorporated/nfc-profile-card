// /src/components/simple-editor/SocialLinkButton.tsx
// ソーシャルリンクボタンコンポーネント

import React from "react";
import { getSocialServiceInfo } from "@/utils/socialLinks";
import { Button } from "@/components/ui/button";

interface SocialLinkButtonProps {
  url: string;
  label?: string;
  className?: string;
}

export function SocialLinkButton({
  url,
  label,
  className = "",
}: SocialLinkButtonProps) {
  const serviceInfo = getSocialServiceInfo(url);
  const Icon = serviceInfo.icon;

  // ラベルが未設定の場合はサービス名を使用
  const displayLabel = label || serviceInfo.name;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block ${className}`}
    >
      <Button
        className="w-full justify-start space-x-3"
        style={{
          backgroundColor: serviceInfo.color,
          color: "#FFFFFF",
          borderColor: serviceInfo.color,
        }}
      >
        <Icon className="h-5 w-5" />
        <span className="flex-1 text-left">{displayLabel}</span>
      </Button>
    </a>
  );
}
