"use client";

import React from 'react';
import type { ProfileComponent } from '../simple-editor/utils/dataStructure';
import { SocialLinkButton } from '../simple-editor/SocialLinkButton';
import { ReadOnlyProfileInfo } from './ReadOnlyProfileInfo';
import { getBackgroundStyle } from '../simple-editor/BackgroundCustomizer';

// 各コンポーネントタイプの表示コンポーネント
function TextComponent({ component }: { component: ProfileComponent }) {
  return (
    <div
      className="w-3/4 mx-auto bg-white bg-opacity-90 rounded-lg shadow-md p-4 mb-4"
      style={{ width: '75%' }}
    >
      <p className="text-gray-800">
        {component.content?.text || 'テキストコンテンツ'}
      </p>
    </div>
  );
}

function ImageComponent({ component }: { component: ProfileComponent }) {
  return (
    <div
      className="w-3/4 mx-auto bg-white bg-opacity-90 rounded-lg shadow-md p-4 mb-4"
      style={{ width: '75%' }}
    >
      {component.content?.src ? (
        <img
          src={component.content.src}
          alt={component.content?.alt || '画像'}
          className="w-full h-auto rounded"
        />
      ) : (
        <div className="bg-gray-200 h-32 rounded flex items-center justify-center">
          <span className="text-gray-500">画像がありません</span>
        </div>
      )}
    </div>
  );
}

function LinkComponent({ component }: { component: ProfileComponent }) {
  const { url, label } = component.content || {};

  // ソーシャルリンクの自動認識
  return (
    <div
      className="w-3/4 mx-auto mb-4"
      style={{ width: '75%' }}
    >
      <SocialLinkButton
        url={url || '#'}
        label={label}
      />
    </div>
  );
}

function ProfileComponent({ component }: { component: ProfileComponent }) {
  // ReadOnlyProfileInfoを使用して拡充されたプロフィールを表示
  return <ReadOnlyProfileInfo component={component} />;
}

// メインのSimpleRendererコンポーネント
export function SimpleRenderer({
  components = [],
  background = null
}: {
  components: ProfileComponent[];
  background?: any;
}) {
  // componentsが配列でない場合の対応
  const safeComponents = Array.isArray(components) ? components : [];

  return (
    <div className="min-h-screen bg-gray-50 py-8" style={getBackgroundStyle(background)}>
      <div className="max-w-md mx-auto px-4">
        {safeComponents.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <p>プロフィールコンテンツがありません</p>
          </div>
        ) : (
          safeComponents
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((component) => {
              switch (component.type) {
                case 'text':
                  return <TextComponent key={component.id} component={component} />;
                case 'image':
                  return <ImageComponent key={component.id} component={component} />;
                case 'link':
                  return <LinkComponent key={component.id} component={component} />;
                case 'profile':
                  return <ProfileComponent key={component.id} component={component} />;
                default:
                  return (
                    <div key={component.id} className="w-3/4 mx-auto bg-red-100 p-4 mb-4 rounded">
                      未対応のコンポーネントタイプ: {component.type}
                    </div>
                  );
              }
            })
        )}
      </div>
    </div>
  );
}