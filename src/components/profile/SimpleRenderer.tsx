"use client";

import React, { memo, useMemo } from "react";
import type { ProfileComponent } from "../simple-editor/utils/dataStructure";
import { SocialLinkButton } from "../simple-editor/SocialLinkButton";
import { ReadOnlyProfileInfo } from "./ReadOnlyProfileInfo";
import type { PageBackground } from "./ReadOnlyProfileInfo";
import { getBackgroundStyle } from "@/lib/profile/backgroundStyle";
import Image from "next/image";

// 各コンポーネントタイプの表示コンポーネント（memo化）
const TextComponent = memo(({ component }: { component: ProfileComponent }) => {
  const content = component.content as any;
  return (
    <div className="w-[90%] max-w-[600px] mx-auto bg-white bg-opacity-90 rounded-lg shadow-md p-4 mb-4">
      <p className="text-gray-800">{content?.text || "テキストコンテンツ"}</p>
    </div>
  );
});
TextComponent.displayName = "TextComponent";

const ImageComponent = memo(
  ({
    component,
    priority = false,
  }: {
    component: ProfileComponent;
    priority?: boolean;
  }) => {
    const content = component.content as any;
    return (
      <div className="w-[90%] max-w-[600px] mx-auto bg-white bg-opacity-90 rounded-lg shadow-md p-4 mb-4">
        {content?.src ? (
          <Image
            src={content.src}
            alt={content?.alt || "画像"}
            width={500}
            height={300}
            className="w-full h-auto rounded"
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            sizes="(max-width: 640px) 90vw, 600px"
          />
        ) : (
          <div className="bg-gray-200 h-32 rounded flex items-center justify-center">
            <span className="text-gray-500">画像がありません</span>
          </div>
        )}
      </div>
    );
  },
);
ImageComponent.displayName = "ImageComponent";

const LinkComponent = memo(({ component }: { component: ProfileComponent }) => {
  const content = component.content as any;
  const { url, label } = content || {};

  // ソーシャルリンクの自動認識
  return (
    <div className="w-[90%] max-w-[600px] mx-auto mb-4">
      <SocialLinkButton url={url || "#"} label={label} />
    </div>
  );
});
LinkComponent.displayName = "LinkComponent";

const ProfileComponentView = memo(
  ({
    component,
    background,
  }: {
    component: ProfileComponent;
    background?: PageBackground | null;
  }) => {
    // ReadOnlyProfileInfoを使用して拡充されたプロフィールを表示
    return (
      <ReadOnlyProfileInfo component={component} pageBackground={background} />
    );
  },
);
ProfileComponentView.displayName = "ProfileComponentView";

// メインのSimpleRendererコンポーネント（memo化）
export const SimpleRenderer = memo(function SimpleRenderer({
  components = [],
  background = null,
}: {
  components: ProfileComponent[];
  background?: PageBackground | null;
}) {
  // componentsが配列でない場合の対応
  const safeComponents = useMemo(
    () =>
      Array.isArray(components)
        ? [...components].sort((a, b) => (a.order || 0) - (b.order || 0))
        : [],
    [components],
  );

  return (
    <div className="relative min-h-screen">
      {/* 背景レイヤー（独立したdivとして実装） */}
      <div
        className="absolute inset-0 bg-gray-50"
        style={getBackgroundStyle(background)}
      />

      {/* コンテンツレイヤー（相対位置で背景の上に配置） */}
      <div className="relative z-10 min-h-screen py-8">
        <div className="max-w-md mx-auto px-4">
          {safeComponents.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <p>プロフィールコンテンツがありません</p>
            </div>
          ) : (
            safeComponents.map((component, index) => {
              switch (component.type) {
                case "text":
                  return (
                    <TextComponent key={component.id} component={component} />
                  );
                case "image":
                  return (
                    <ImageComponent
                      key={component.id}
                      component={component}
                      priority={index === 0}
                    />
                  );
                case "link":
                  return (
                    <LinkComponent key={component.id} component={component} />
                  );
                case "profile":
                  return (
                    <ProfileComponentView
                      key={component.id}
                      component={component}
                      background={background}
                    />
                  );
                default:
                  return (
                    <div
                      key={component.id}
                      className="w-[90%] max-w-[600px] mx-auto bg-red-100 p-4 mb-4 rounded"
                    >
                      未対応のコンポーネントタイプ: {component.type}
                    </div>
                  );
              }
            })
          )}
        </div>
      </div>
    </div>
  );
});
