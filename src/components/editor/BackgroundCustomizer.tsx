'use client';

import React, { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Palette, Sparkles, Grid3X3 } from 'lucide-react';
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
  const [gradientFrom, setGradientFrom] = useState('#667eea');
  const [gradientTo, setGradientTo] = useState('#764ba2');
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

  const patterns = [
    { id: 'dots', name: 'ドット', className: 'bg-dots-pattern' },
    { id: 'grid', name: 'グリッド', className: 'bg-grid-pattern' },
    { id: 'waves', name: '波', className: 'bg-waves-pattern' },
    { id: 'diagonal', name: '斜線', className: 'bg-diagonal-pattern' },
  ];

  return (
    <div className="space-y-4">
      <Label>背景設定</Label>

      <Tabs defaultValue="solid" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="solid">
            <Palette className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="gradient">
            <Sparkles className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="image">
            <Upload className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="pattern">
            <Grid3X3 className="h-4 w-4" />
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

        <TabsContent value="gradient" className="space-y-4">
          <div>
            <Label>開始色</Label>
            <HexColorPicker
              color={gradientFrom}
              onChange={setGradientFrom}
            />
          </div>
          <div>
            <Label>終了色</Label>
            <HexColorPicker
              color={gradientTo}
              onChange={setGradientTo}
            />
          </div>
          <Button
            onClick={() => {
              onBackgroundChange({
                type: 'gradient',
                from: gradientFrom,
                to: gradientTo,
                direction: 'to-br',
              });
            }}
          >
            グラデーションを適用
          </Button>
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
        </TabsContent>

        <TabsContent value="pattern" className="space-y-4">
          <Label>パターン選択</Label>
          <div className="grid grid-cols-2 gap-2">
            {patterns.map((pattern) => (
              <Button
                key={pattern.id}
                variant="outline"
                onClick={() => {
                  onBackgroundChange({
                    type: 'pattern',
                    patternId: pattern.id,
                  });
                }}
                className="h-20"
              >
                <div className={`w-full h-full ${pattern.className}`}>
                  <span className="text-xs">{pattern.name}</span>
                </div>
              </Button>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}