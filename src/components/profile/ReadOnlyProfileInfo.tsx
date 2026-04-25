import React, { useState } from "react";
import { VCardButton } from "./VCardButton";
import {
  Mail,
  Phone,
  Building,
  MapPin,
  Globe,
  User,
  Smartphone,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ProfileComponent } from "../simple-editor/utils/dataStructure";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface ReadOnlyProfileInfoProps {
  component: ProfileComponent;
  pageBackground?: any;
}

function getCardBackgroundStyle(
  color?: string,
  opacity?: number,
): React.CSSProperties | undefined {
  if (!color) return undefined;

  const { red, green, blue } = getRgbColor(color);
  if (red === null || green === null || blue === null) {
    return { backgroundColor: color };
  }

  const alpha = getAlpha(opacity);

  return { backgroundColor: `rgba(${red}, ${green}, ${blue}, ${alpha})` };
}

function getAlpha(opacity?: number) {
  return typeof opacity === "number"
    ? Math.min(100, Math.max(0, opacity)) / 100
    : 1;
}

function blendRgb(
  foreground: RgbColor,
  alpha: number,
  background: RgbColor,
): RgbColor {
  return {
    red: Math.round(foreground.red * alpha + background.red * (1 - alpha)),
    green: Math.round(
      foreground.green * alpha + background.green * (1 - alpha),
    ),
    blue: Math.round(foreground.blue * alpha + background.blue * (1 - alpha)),
  };
}

type RgbColor = { red: number; green: number; blue: number };

function getPageBackgroundRgb(pageBackground?: any): RgbColor {
  if (pageBackground?.type === "solid") {
    const solid = getRgbColor(pageBackground.color || "#ffffff");
    if (solid.red !== null && solid.green !== null && solid.blue !== null) {
      return solid;
    }
  }

  if (pageBackground?.type === "gradient") {
    const from = getRgbColor(pageBackground.from || "#ffffff");
    const to = getRgbColor(pageBackground.to || "#ffffff");
    if (
      from.red !== null &&
      from.green !== null &&
      from.blue !== null &&
      to.red !== null &&
      to.green !== null &&
      to.blue !== null
    ) {
      return {
        red: Math.round((from.red + to.red) / 2),
        green: Math.round((from.green + to.green) / 2),
        blue: Math.round((from.blue + to.blue) / 2),
      };
    }
  }

  return { red: 255, green: 255, blue: 255 };
}

function getRgbColor(color: string) {
  const hex = color.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return { red: null, green: null, blue: null };
  }

  return {
    red: parseInt(hex.slice(0, 2), 16),
    green: parseInt(hex.slice(2, 4), 16),
    blue: parseInt(hex.slice(4, 6), 16),
  };
}

function isDarkBackground(
  color?: string,
  opacity?: number,
  pageBackground?: any,
) {
  if (!color) return false;

  const foreground = getRgbColor(color);
  if (
    foreground.red === null ||
    foreground.green === null ||
    foreground.blue === null
  ) {
    return false;
  }

  const effective = blendRgb(
    foreground,
    getAlpha(opacity),
    getPageBackgroundRgb(pageBackground),
  );
  const luminance =
    0.299 * effective.red + 0.587 * effective.green + 0.114 * effective.blue;

  return luminance < 140;
}

export function ReadOnlyProfileInfo({
  component,
  pageBackground,
}: ReadOnlyProfileInfoProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const content = (component.content as any) || {};
  const {
    firstName,
    lastName,
    phoneticFirstName,
    phoneticLastName,
    name,
    email,
    phone,
    cellPhone,
    company,
    position,
    department,
    address,
    city,
    postalCode,
    website,
    bio,
    photoURL,
    cardBackgroundColor,
    cardBackgroundOpacity,
  } = content;
  const cardStyle = getCardBackgroundStyle(
    cardBackgroundColor,
    cardBackgroundOpacity,
  );
  const useLightText = isDarkBackground(
    cardBackgroundColor,
    cardBackgroundOpacity,
    pageBackground,
  );
  const primaryTextClass = useLightText ? "text-white" : "text-gray-800";
  const secondaryTextClass = useLightText ? "text-gray-100" : "text-gray-600";
  const bodyTextClass = useLightText ? "text-gray-100" : "text-gray-700";
  const borderClass = useLightText ? "border-white/30" : "border-gray-200";
  const iconClass = useLightText ? "text-gray-100" : "text-gray-400";
  const linkClass = useLightText
    ? "text-blue-100 hover:underline"
    : "text-blue-600 hover:underline";
  const detailButtonClass = useLightText
    ? "text-gray-100 hover:text-white hover:bg-white/10"
    : "text-gray-600 hover:text-gray-900";

  // 表示名の決定
  const displayName =
    name || `${lastName || ""} ${firstName || ""}`.trim() || "名前未設定";

  // VCard用データの準備
  const vCardData = {
    firstName: firstName || "",
    lastName: lastName || "",
    phoneticFirstName: phoneticFirstName || "",
    phoneticLastName: phoneticLastName || "",
    organization: company || "",
    title: position || "",
    email: email || "",
    workPhone: phone || "",
    cellPhone: cellPhone || "",
    url: website || "",
    workAddress: {
      street: address || "",
      city: city || "",
      postalCode: postalCode || "",
      countryRegion: "日本",
    },
    photo: photoURL || "",
    note: bio || "",
  };

  // 詳細情報があるかチェック
  const hasDetails =
    email ||
    phone ||
    cellPhone ||
    website ||
    company ||
    department ||
    address ||
    city ||
    postalCode;

  // レスポンシブ対応のコンテナー幅
  const getContainerClass = () => {
    return "w-[90%] max-w-[600px] mx-auto mb-6";
  };

  return (
    <div className={getContainerClass()}>
      {/* アイコンを独立要素として中央配置 */}
      <div className="flex justify-center mb-3">
        {photoURL ? (
          <Image
            src={photoURL}
            alt={displayName}
            width={80}
            height={80}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white shadow-lg object-cover"
          />
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-300 flex items-center justify-center shadow-lg">
            <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
        )}
      </div>

      {/* プロフィール情報カード */}
      <div className="bg-white rounded-lg shadow-md p-4" style={cardStyle}>
        {/* 名前・役職・会社 */}
        <div className="text-center mb-3">
          <h2 className={`text-base sm:text-lg font-bold ${primaryTextClass}`}>
            {displayName}
          </h2>
          {position && (
            <p className={`text-sm mt-0.5 ${secondaryTextClass}`}>{position}</p>
          )}
          {company && (
            <p className={`text-sm ${secondaryTextClass}`}>{company}</p>
          )}
        </div>

        {/* 自己紹介（3行制限と展開機能） */}
        {bio && (
          <div className={`pb-3 border-b ${borderClass}`}>
            <p
              className={`${bodyTextClass} text-sm ${!isProfileExpanded ? "line-clamp-3" : ""}`}
            >
              {bio}
            </p>
            {bio.length > 150 && (
              <button
                onClick={() => setIsProfileExpanded(!isProfileExpanded)}
                className={`${linkClass} text-sm mt-1`}
              >
                {isProfileExpanded ? "閉じる" : "...続きを読む"}
              </button>
            )}
          </div>
        )}

        {/* VCardダウンロードボタン（常に表示） */}
        <div className="flex justify-center">
          <VCardButton
            username={displayName}
            profileData={vCardData}
            className="w-full max-w-xs"
            variant="default"
            size="lg"
          />
        </div>

        {/* 詳細情報の展開ボタン */}
        {hasDetails && (
          <Button
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`w-full h-8 flex items-center justify-center gap-2 text-sm ${detailButtonClass}`}
          >
            <span>詳細情報を{isExpanded ? "非表示" : "表示"}</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* 折りたたみ可能な詳細情報 */}
        <div
          className={`space-y-3 overflow-hidden transition-all duration-300 ${
            isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {email && (
            <div className="flex items-center space-x-3">
              <Mail className={`w-5 h-5 ${iconClass}`} />
              <a href={`mailto:${email}`} className={linkClass}>
                {email}
              </a>
            </div>
          )}

          {phone && (
            <div className="flex items-center space-x-3">
              <Phone className={`w-5 h-5 ${iconClass}`} />
              <a href={`tel:${phone}`} className={linkClass}>
                {phone}
              </a>
            </div>
          )}

          {cellPhone && (
            <div className="flex items-center space-x-3">
              <Smartphone className={`w-5 h-5 ${iconClass}`} />
              <a href={`tel:${cellPhone}`} className={linkClass}>
                {cellPhone}
              </a>
            </div>
          )}

          {website && (
            <div className="flex items-center space-x-3">
              <Globe className={`w-5 h-5 ${iconClass}`} />
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {website}
              </a>
            </div>
          )}

          {(company || department) && (
            <div className="flex items-center space-x-3">
              <Building className={`w-5 h-5 ${iconClass}`} />
              <span className={bodyTextClass}>
                {company}
                {department && ` - ${department}`}
              </span>
            </div>
          )}

          {(address || city || postalCode) && (
            <div className="flex items-center space-x-3">
              <MapPin className={`w-5 h-5 ${iconClass}`} />
              <span className={bodyTextClass}>
                {postalCode && `〒${postalCode} `}
                {city} {address}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
