"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, User, FileText, Image, Link } from 'lucide-react';
import { ProfileComponent } from './utils/dataStructure';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  isMainSection?: boolean;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function CollapsibleSection({
  title,
  icon,
  isMainSection = false,
  children,
  defaultExpanded = false
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`border rounded-lg ${isMainSection ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        <div className="transition-transform duration-300">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* アニメーション付き展開エリア */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 pt-0">
          {children}
        </div>
      </div>
    </div>
  );
}

interface GroupedComponents {
  profile: ProfileComponent[];
  text: ProfileComponent[];
  image: ProfileComponent[];
  link: ProfileComponent[];
}

interface CollapsibleComponentListProps {
  components: ProfileComponent[];
  renderComponent: (component: ProfileComponent) => React.ReactNode;
}

export function CollapsibleComponentList({
  components,
  renderComponent
}: CollapsibleComponentListProps) {
  const { t } = useLanguage();
  // コンポーネントをタイプごとにグループ化
  const groupedComponents = components.reduce<GroupedComponents>(
    (acc, component) => {
      const type = component.type as keyof GroupedComponents;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(component);
      return acc;
    },
    {
      profile: [],
      text: [],
      image: [],
      link: []
    }
  );

  // 各セクションの表示順序を保持
  const sortComponents = (components: ProfileComponent[]) => {
    return components.sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  return (
    <div className="space-y-3">
      {/* プロフィールセクション（メイン・デフォルト展開） */}
      {groupedComponents.profile.length > 0 && (
        <CollapsibleSection
          title={`${t('profileSection')} (${groupedComponents.profile.length})`}
          icon={<User className="h-5 w-5 text-blue-600" />}
          isMainSection={true}
          defaultExpanded={true}
        >
          <div className="space-y-2">
            {sortComponents(groupedComponents.profile).map(component => (
              <div key={component.id}>
                {renderComponent(component)}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* テキストセクション */}
      {groupedComponents.text.length > 0 && (
        <CollapsibleSection
          title={`${t('textSection')} (${groupedComponents.text.length})`}
          icon={<FileText className="h-5 w-5 text-gray-600" />}
          defaultExpanded={false}
        >
          <div className="space-y-2">
            {sortComponents(groupedComponents.text).map(component => (
              <div key={component.id}>
                {renderComponent(component)}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* 画像セクション */}
      {groupedComponents.image.length > 0 && (
        <CollapsibleSection
          title={`${t('imageSection')} (${groupedComponents.image.length})`}
          icon={<Image className="h-5 w-5 text-gray-600" />}
          defaultExpanded={false}
        >
          <div className="space-y-2">
            {sortComponents(groupedComponents.image).map(component => (
              <div key={component.id}>
                {renderComponent(component)}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* リンクセクション */}
      {groupedComponents.link.length > 0 && (
        <CollapsibleSection
          title={`${t('linkSection')} (${groupedComponents.link.length})`}
          icon={<Link className="h-5 w-5 text-gray-600" />}
          defaultExpanded={false}
        >
          <div className="space-y-2">
            {sortComponents(groupedComponents.link).map(component => (
              <div key={component.id}>
                {renderComponent(component)}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* コンポーネントがない場合 */}
      {components.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>{t('noComponents')}</p>
          <p className="text-sm mt-1">{t('addComponentMessage')}</p>
        </div>
      )}
    </div>
  );
}