'use client';

import React, { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Palette } from 'lucide-react';
import { uploadCompressedImage } from '@/lib/storage';
import { useToast } from '@/components/ui/use-toast';

interface BackgroundCustomizerProps {
  userId: string;
  currentBackground: any;
  onBackgroundChange: (background: any) => void;
}

export function BackgroundCustomizer({
  userId,
  currentBackground,
  onBackgroundChange
}: BackgroundCustomizerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [solidColor, setSolidColor] = useState(currentBackground?.color || '#ffffff');
  const [opacity, setOpacity] = useState(currentBackground?.opacity || 1);
  const { toast } = useToast();

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const imageUrl = await uploadCompressedImage(userId, file, 'background');
      onBackgroundChange({
        type: 'image',
        imageUrl,
      });
      toast({
        title: '成功',
        description: '背景画像をアップロードしました',
      });
    } catch (error: any) {
      toast({
        title: 'エラー',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Label>背景設定</Label>

      <Tabs defaultValue="solid" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="solid">
            <Palette className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="image">
            <Upload className="h-4 w-4" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="solid" className="space-y-4">
          <Label>単色</Label>
          <HexColorPicker
            color={solidColor}
            onChange={(color) => {
              setSolidColor(color);
              onBackgroundChange({ type: 'solid', color });
            }}
          />
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={solidColor}
              onChange={(e) => {
                setSolidColor(e.target.value);
                onBackgroundChange({ type: 'solid', color: e.target.value });
              }}
              className="flex-1 px-3 py-1 border rounded"
            />
          </div>
        </TabsContent>

        <TabsContent value="image" className="space-y-4">
          <Label>画像をアップロード</Label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={isUploading}
            className="w-full"
          />
          {isUploading && <p className="text-sm text-muted-foreground">アップロード中...</p>}

          {/* 画像設定（画像がアップロード済みの場合のみ表示） */}
          {currentBackground?.type === 'image' && currentBackground.imageUrl && (
            <>
              <div className="space-y-2">
                <Label>画像サイズ</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={currentBackground.backgroundSize === 'cover' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onBackgroundChange({
                      ...currentBackground,
                      backgroundSize: 'cover'
                    })}
                  >
                    カバー
                  </Button>
                  <Button
                    variant={currentBackground.backgroundSize === 'contain' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onBackgroundChange({
                      ...currentBackground,
                      backgroundSize: 'contain'
                    })}
                  >
                    フィット
                  </Button>
                  <Button
                    variant={currentBackground.backgroundSize === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onBackgroundChange({
                      ...currentBackground,
                      backgroundSize: 'custom',
                      scale: currentBackground.scale || 100
                    })}
                  >
                    カスタム
                  </Button>
                </div>
              </div>

              {/* カスタムサイズ選択時のスケール調整 */}
              {currentBackground.backgroundSize === 'custom' && (
                <div className="space-y-2">
                  <Label>スケール: {currentBackground.scale || 100}%</Label>
                  <Slider
                    value={[currentBackground.scale || 100]}
                    onValueChange={(value) => {
                      onBackgroundChange({
                        ...currentBackground,
                        scale: value[0]
                      });
                    }}
                    min={10}
                    max={300}
                    step={1}
                    className="w-full"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>画像位置 (横): {Math.round((currentBackground.positionX || 50))}%</Label>
                <Slider
                  value={[currentBackground.positionX || 50]}
                  onValueChange={(value) => {
                    onBackgroundChange({
                      ...currentBackground,
                      positionX: value[0]
                    });
                  }}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>画像位置 (縦): {Math.round((currentBackground.positionY || 50))}%</Label>
                <Slider
                  value={[currentBackground.positionY || 50]}
                  onValueChange={(value) => {
                    onBackgroundChange({
                      ...currentBackground,
                      positionY: value[0]
                    });
                  }}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* 透明度設定 */}
      <div className="space-y-2">
        <Label>背景の透明度: {Math.round(opacity * 100)}%</Label>
        <Slider
          value={[opacity]}
          onValueChange={(value) => {
            const newOpacity = value[0];
            setOpacity(newOpacity);
            const updatedBackground = {
              ...currentBackground,
              opacity: newOpacity
            };
            onBackgroundChange(updatedBackground);
          }}
          min={0}
          max={1}
          step={0.01}
          className="w-full"
        />
      </div>
    </div>
  );
}