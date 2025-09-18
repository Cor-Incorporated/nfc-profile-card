'use client';

import React, { useState, useCallback } from 'react';
import { useNode, useEditor } from '@craftjs/core';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { uploadCompressedImage } from '@/lib/storage';
import { Upload, Crop, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Point, Area } from 'react-easy-crop';
import { useAuth } from '@/contexts/AuthContext';

interface ImageUploadProps {
  src?: string;
  alt?: string;
  width?: string;
  height?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  userId?: string;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', error => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: Area
): Promise<string> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Canvas is empty');
        return;
      }
      const fileUrl = URL.createObjectURL(blob);
      resolve(fileUrl);
    }, 'image/jpeg');
  });
};

export const ImageUpload = ({
  src = '',
  alt = '画像',
  width = '100%',
  height = 'auto',
  objectFit = 'cover',
  userId: propUserId
}: ImageUploadProps) => {
  const { user } = useAuth();
  const userId = propUserId || user?.uid || 'temp';

  const {
    connectors: { connect, drag },
    actions: { setProp },
    selected,
    id
  } = useNode((state) => ({
    selected: state.events.selected,
    id: state.id
  }));

  const { actions } = useEditor();

  const [isHovered, setIsHovered] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState<string>('');
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (actions && id) {
      actions.delete(id);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setTempImageUrl(reader.result as string);
      setIsCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = async () => {
    if (!croppedAreaPixels || !tempImageUrl) return;

    setIsUploading(true);
    try {
      // 切り抜いた画像を取得
      const croppedImage = await getCroppedImg(tempImageUrl, croppedAreaPixels);
      
      // Blob URLをBlobに変換
      const response = await fetch(croppedImage);
      const blob = await response.blob();
      
      // FileオブジェクトとしてFirebase Storageにアップロード
      const file = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });
      const uploadedUrl = await uploadCompressedImage(userId, file, 'content');
      
      // コンポーネントのプロパティを更新
      setProp((props: any) => {
        props.src = uploadedUrl;
      });
      
      // クリーンアップ
      URL.revokeObjectURL(croppedImage);
      setIsCropperOpen(false);
      setTempImageUrl('');
    } catch (error) {
      console.error('画像のアップロードに失敗しました:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCropCancel = () => {
    setIsCropperOpen(false);
    setTempImageUrl('');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <>
      <div
        ref={(ref) => connect(drag(ref as any))}
        className="relative"
        style={{
          width,
          height,
          border: selected ? '2px solid #3B82F6' : 'none',
          borderRadius: '8px',
          overflow: 'hidden',
          cursor: 'pointer',
          minHeight: '200px',
          backgroundColor: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* ホバー時の削除ボタン */}
        {selected && isHovered && (
          <div className="absolute -top-10 right-0 z-50">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-background border shadow-lg hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleDelete}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {src ? (
          <img
            src={src}
            alt={alt}
            style={{
              width: '100%',
              height: '100%',
              objectFit
            }}
          />
        ) : (
          <label className="w-full h-full flex items-center justify-center cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
            <div className="text-center p-4">
              <Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">画像をアップロード</p>
            </div>
          </label>
        )}
      </div>

      {/* クロップダイアログ */}
      <Dialog open={isCropperOpen} onOpenChange={setIsCropperOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>画像を切り抜き</DialogTitle>
            <DialogDescription>
              画像をドラッグして位置を調整し、スライダーでズームを変更できます
            </DialogDescription>
          </DialogHeader>
          
          <div className="relative h-96 bg-gray-100">
            {tempImageUrl && (
              <Cropper
                image={tempImageUrl}
                crop={crop}
                zoom={zoom}
                aspect={4 / 3}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>

          <div className="space-y-4 mt-4">
            <div>
              <Label>ズーム</Label>
              <Slider
                value={[zoom]}
                onValueChange={(value: number[]) => setZoom(value[0])}
                min={1}
                max={3}
                step={0.1}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCropCancel}
                disabled={isUploading}
              >
                <X className="mr-2 h-4 w-4" />
                キャンセル
              </Button>
              <Button
                onClick={handleCropConfirm}
                disabled={isUploading}
              >
                <Crop className="mr-2 h-4 w-4" />
                切り抜きを確定
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// 設定パネルコンポーネント
const ImageUploadSettings = () => {
  const {
    actions: { setProp },
    src,
    alt,
    width,
    height,
    objectFit
  } = useNode((node) => ({
    src: node.data.props.src,
    alt: node.data.props.alt,
    width: node.data.props.width,
    height: node.data.props.height,
    objectFit: node.data.props.objectFit,
  }));

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="image-upload">画像を選択</Label>
        <Input
          id="image-upload"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
              // 直接設定パネルから画像を変更する場合
              // TODO: ここにもクロップ機能を追加
            };
            reader.readAsDataURL(file);
          }}
        />
      </div>

      <div>
        <Label htmlFor="alt">代替テキスト</Label>
        <Input
          id="alt"
          value={alt || ''}
          onChange={(e) => {
            setProp((props: any) => {
              props.alt = e.target.value;
            });
          }}
          placeholder="画像の説明"
        />
      </div>

      <div>
        <Label htmlFor="width">幅</Label>
        <Input
          id="width"
          value={width || ''}
          onChange={(e) => {
            setProp((props: any) => {
              props.width = e.target.value;
            });
          }}
          placeholder="例: 100%, 300px"
        />
      </div>

      <div>
        <Label htmlFor="height">高さ</Label>
        <Input
          id="height"
          value={height || ''}
          onChange={(e) => {
            setProp((props: any) => {
              props.height = e.target.value;
            });
          }}
          placeholder="例: auto, 200px"
        />
      </div>

      <div>
        <Label htmlFor="objectFit">表示方法</Label>
        <select
          id="objectFit"
          value={objectFit || 'cover'}
          onChange={(e) => {
            setProp((props: any) => {
              props.objectFit = e.target.value;
            });
          }}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="contain">全体を表示</option>
          <option value="cover">領域を埋める</option>
          <option value="fill">引き伸ばす</option>
          <option value="none">原寸大</option>
          <option value="scale-down">縮小のみ</option>
        </select>
      </div>

      {src && (
        <div className="mt-4">
          <Label>現在の画像</Label>
          <img 
            src={src} 
            alt={alt || '現在の画像'}
            className="mt-2 w-full rounded border"
          />
        </div>
      )}
    </div>
  );
};

// Craft.jsの設定
ImageUpload.craft = {
  displayName: '画像',
  props: {
    src: '',
    alt: '画像',
    width: '100%',
    height: 'auto',
    objectFit: 'cover'
  },
  related: {
    settings: ImageUploadSettings
  }
};