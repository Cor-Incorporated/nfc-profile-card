'use client';

import React from 'react';
import { ReadOnlyImageUpload } from './ReadOnlyImageUpload';
import { ReadOnlyLinkButton } from './ReadOnlyLinkButton';
import { ReadOnlyProfileInfo } from './ReadOnlyProfileInfo';
import { ReadOnlyText } from './ReadOnlyText';

interface CraftRendererProps {
  data: any;
  background?: any;
  className?: string;
}

// コンポーネントマッピング（読み取り専用版）
const componentMap = {
  'Text': ReadOnlyText,
  'ImageUpload': ReadOnlyImageUpload,
  'LinkButton': ReadOnlyLinkButton,
  'ProfileInfo': ReadOnlyProfileInfo,
};

// ノードをレンダリングする関数
const renderNode = (nodeId: string, nodeData: any, allNodes: any): React.ReactNode => {
  if (!nodeData || !nodeData.type) {
    return null;
  }

  const { type, props = {}, nodes = [] } = nodeData;
  const resolvedName = type.resolvedName || type;

  // 編集用コンポーネントはスキップ
  if (resolvedName === 'AddComponentPlaceholder') {
    return null;
  }

  // コンポーネントが見つからない場合はスキップ
  const Component = componentMap[resolvedName];
  if (!Component) {
    console.warn(`Unknown component: ${resolvedName}`);
    return null;
  }

  // 子ノードをレンダリング
  const children = nodes.map((childId: string) => 
    renderNode(childId, allNodes[childId], allNodes)
  ).filter(Boolean);

  // コンポーネントをレンダリング
  if (children.length > 0) {
    return React.createElement(Component, { key: nodeId, ...props }, children);
  } else {
    return React.createElement(Component, { key: nodeId, ...props });
  }
};

export function CraftRenderer({ data, background, className = '' }: CraftRendererProps) {
  
  // 背景スタイルの取得
  const getBackgroundStyle = () => {
    if (!background) return {};

    const opacity = background.opacity || 1;

    switch (background.type) {
      case 'solid':
        const color = background.color || '#ffffff';
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})` };
      case 'gradient':
        return {
          position: 'relative' as const,
        };
      case 'image':
        return {
          position: 'relative' as const,
        };
      case 'pattern':
        return {
          position: 'relative' as const,
        };
      default:
        return {};
    }
  };

  // 背景レイヤーの取得
  const getBackgroundLayer = () => {
    if (!background || background.type === 'solid') return null;

    const opacity = background.opacity || 1;

    let backgroundStyle = {};
    switch (background.type) {
      case 'gradient':
        backgroundStyle = {
          background: `linear-gradient(${background.direction || 'to bottom right'}, ${background.from}, ${background.to})`,
        };
        break;
      case 'image':
        const size = background.backgroundSize || 'cover';
        let backgroundSize = size;
        if (size === 'custom') {
          const scale = background.scale || 100;
          backgroundSize = `${scale}%`;
        }

        const positionX = background.positionX || 50;
        const positionY = background.positionY || 50;

        backgroundStyle = {
          backgroundImage: `url(${background.imageUrl})`,
          backgroundSize: backgroundSize,
          backgroundPosition: `${positionX}% ${positionY}%`,
          backgroundRepeat: 'no-repeat',
        };
        break;
      case 'pattern':
        backgroundStyle = {
          // パターンのスタイルをここに追加
        };
        break;
    }

    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          ...backgroundStyle,
          opacity: opacity,
          zIndex: 0,
        }}
      />
    );
  };

      // データの前処理（文字列の場合はパース）
      let processedData = data;
      if (typeof data === 'string') {
        try {
          processedData = JSON.parse(data);
        } catch (error) {
          console.error('Failed to parse data:', error);
          return (
            <div className={`min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 ${className}`}>
              <div className="container mx-auto px-4 py-8 max-w-2xl">
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                  <h1 className="text-2xl font-bold mb-4">プロフィール</h1>
                  <p className="text-gray-600">デザインデータの解析に失敗しました。</p>
                </div>
              </div>
            </div>
          );
        }
      }

  // データの検証
  if (!processedData || !processedData.ROOT) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 ${className}`}>
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">プロフィール</h1>
            <p className="text-gray-600">デザインデータの読み込みに失敗しました。</p>
          </div>
        </div>
      </div>
    );
  }

  // ROOTノードの子ノードをレンダリング
  const rootNode = processedData.ROOT;
  const childNodes = rootNode.nodes || [];
  
  // 編集用コンポーネントを除外
  const validChildNodes = childNodes.filter((nodeId: string) => {
    const nodeData = processedData[nodeId];
    if (!nodeData || !nodeData.type) return false;
    
    const resolvedName = nodeData.type.resolvedName || nodeData.type;
    return resolvedName !== 'AddComponentPlaceholder';
  });

  // 有効なコンテンツがない場合
  if (validChildNodes.length === 0) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 ${className}`}>
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">プロフィール</h1>
            <p className="text-gray-600">まだコンテンツが追加されていません。</p>
            <p className="text-sm text-gray-500 mt-2">デザインエディターでコンテンツを追加してください。</p>
          </div>
        </div>
      </div>
    );
  }

  // コンテンツをレンダリング
  const content = validChildNodes.map((nodeId: string) => 
    renderNode(nodeId, processedData[nodeId], processedData)
  ).filter(Boolean);

  return (
    <div 
      className={`min-h-screen ${className}`}
      style={getBackgroundStyle()}
    >
      {/* 背景レイヤー */}
      {getBackgroundLayer()}
      
      <div className="container mx-auto px-4 py-8 max-w-2xl relative" style={{ zIndex: 1 }}>
        <div 
          className="flex flex-col items-center gap-4 p-6 min-h-screen relative"
          style={{ zIndex: 1 }}
        >
          {content}
        </div>
      </div>
    </div>
  );
}