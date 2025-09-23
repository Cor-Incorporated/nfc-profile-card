"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Smartphone, Monitor, X } from 'lucide-react';

export type DeviceType = 'mobile' | 'desktop';

interface DeviceConfig {
  width: number;
  height: number;
  scale: number;
  label: string;
}

const DEVICE_CONFIGS: Record<DeviceType, DeviceConfig> = {
  mobile: {
    width: 375,
    height: 667,
    scale: 0.8,
    label: 'スマホ'
  },
  desktop: {
    width: 1440,
    height: 900,
    scale: 0.5,
    label: 'PC'
  }
};

interface DevicePreviewProps {
  profileUrl: string;
  onClose: () => void;
}

export function DevicePreview({ profileUrl, onClose }: DevicePreviewProps) {
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>('mobile');
  const config = DEVICE_CONFIGS[selectedDevice];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold">プレビュー</h3>

          {/* デバイス切り替えボタン */}
          <div className="flex gap-2">
            <Button
              variant={selectedDevice === 'mobile' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDevice('mobile')}
            >
              <Smartphone className="h-4 w-4 mr-1" />
              スマホ
            </Button>
            <Button
              variant={selectedDevice === 'desktop' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedDevice('desktop')}
            >
              <Monitor className="h-4 w-4 mr-1" />
              PC
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* プレビューエリア */}
        <div className="p-8 bg-gray-100 flex items-center justify-center overflow-auto" style={{ height: 'calc(100% - 80px)' }}>
          <div className="relative">
            {/* デバイスフレーム */}
            <div
              className="bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
              style={{
                width: `${config.width}px`,
                height: `${config.height}px`,
                transform: `scale(${config.scale})`,
                transformOrigin: 'top center'
              }}
            >
              {/* デバイスヘッダー（スマホ・タブレット用） */}
              {selectedDevice !== 'desktop' && (
                <div className="bg-gray-900 h-6 flex items-center justify-center">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                  </div>
                </div>
              )}

              {/* iframe でプロフィールページを表示 */}
              <iframe
                src={profileUrl}
                className="w-full h-full border-0"
                style={{
                  height: selectedDevice !== 'desktop' ? 'calc(100% - 24px)' : '100%'
                }}
                title="Profile Preview"
              />
            </div>

            {/* デバイス情報 */}
            <div className="text-center mt-4 text-sm text-gray-600">
              {config.label} - {config.width} × {config.height}px
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// インラインプレビューコンポーネント（編集画面用）
interface InlineDevicePreviewProps {
  children: React.ReactNode;
  deviceType: DeviceType;
}

export function InlineDevicePreview({ children, deviceType }: InlineDevicePreviewProps) {
  const config = DEVICE_CONFIGS[deviceType];

  return (
    <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg">
      <div
        className="relative bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300"
        style={{
          width: `${config.width * 0.5}px`,
          height: `${config.height * 0.5}px`,
          transform: `scale(${Math.min(1, 300 / config.width)})`,
          transformOrigin: 'center'
        }}
      >
        {/* デバイスヘッダー */}
        {deviceType !== 'desktop' && (
          <div className="bg-gray-900 h-4 flex items-center justify-center">
            <div className="flex gap-0.5">
              <div className="w-0.5 h-0.5 bg-gray-600 rounded-full"></div>
              <div className="w-0.5 h-0.5 bg-gray-600 rounded-full"></div>
              <div className="w-0.5 h-0.5 bg-gray-600 rounded-full"></div>
            </div>
          </div>
        )}

        {/* コンテンツエリア */}
        <div
          className="overflow-auto"
          style={{
            height: deviceType !== 'desktop' ? 'calc(100% - 16px)' : '100%'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}