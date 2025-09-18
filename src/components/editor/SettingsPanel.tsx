import React from 'react';
import { BackgroundCustomizer } from './BackgroundCustomizer';

interface SettingsPanelProps {
  userId?: string;
  background?: any;
  onBackgroundChange?: (background: any) => void;
}

export function SettingsPanel({ userId, background, onBackgroundChange }: SettingsPanelProps) {
  return (
    <div className="space-y-4">
      {userId && onBackgroundChange ? (
        <BackgroundCustomizer
          userId={userId}
          currentBackground={background}
          onBackgroundChange={onBackgroundChange}
        />
      ) : (
        <div className="text-sm text-muted-foreground">
          背景設定を利用するには保存が必要です
        </div>
      )}
      <div className="border-t pt-4">
        <h4 className="text-xs font-semibold mb-2">ヒント</h4>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>・左サイドバーの「選択中」タブで要素を編集</p>
          <p>・ドラッグ&ドロップで要素を配置</p>
          <p>・モバイル表示で実際の見え方を確認</p>
        </div>
      </div>
    </div>
  );
}