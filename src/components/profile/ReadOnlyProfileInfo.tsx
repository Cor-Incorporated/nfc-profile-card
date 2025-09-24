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
}

export function ReadOnlyProfileInfo({ component }: ReadOnlyProfileInfoProps) {
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
  } = content;

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
    return "w-[90%] sm:w-3/4 md:w-[600px] lg:w-[500px] mx-auto mb-6";
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
      <div className="bg-white rounded-lg shadow-md p-4">
        {/* 名前・役職・会社 */}
        <div className="text-center mb-3">
          <h2 className="text-base sm:text-lg font-bold text-gray-800">{displayName}</h2>
          {position && <p className="text-sm text-gray-600 mt-0.5">{position}</p>}
          {company && <p className="text-sm text-gray-600">{company}</p>}
        </div>

        {/* 自己紹介（3行制限と展開機能） */}
        {bio && (
          <div className="pb-3 border-b border-gray-200">
            <p
              className={`text-gray-700 text-sm ${!isProfileExpanded ? "line-clamp-3" : ""}`}
            >
              {bio}
            </p>
            {bio.length > 150 && (
              <button
                onClick={() => setIsProfileExpanded(!isProfileExpanded)}
                className="text-blue-600 hover:text-blue-700 text-sm mt-1"
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
              className="w-full h-8 flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900 text-sm"
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
                <Mail className="w-5 h-5 text-gray-400" />
                <a
                  href={`mailto:${email}`}
                  className="text-blue-600 hover:underline"
                >
                  {email}
                </a>
              </div>
            )}

            {phone && (
              <div className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <a
                  href={`tel:${phone}`}
                  className="text-blue-600 hover:underline"
                >
                  {phone}
                </a>
              </div>
            )}

            {cellPhone && (
              <div className="flex items-center space-x-3">
                <Smartphone className="w-5 h-5 text-gray-400" />
                <a
                  href={`tel:${cellPhone}`}
                  className="text-blue-600 hover:underline"
                >
                  {cellPhone}
                </a>
              </div>
            )}

            {website && (
              <div className="flex items-center space-x-3">
                <Globe className="w-5 h-5 text-gray-400" />
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {website}
                </a>
              </div>
            )}

            {(company || department) && (
              <div className="flex items-center space-x-3">
                <Building className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700">
                  {company}
                  {department && ` - ${department}`}
                </span>
              </div>
            )}

            {(address || city || postalCode) && (
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700">
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
