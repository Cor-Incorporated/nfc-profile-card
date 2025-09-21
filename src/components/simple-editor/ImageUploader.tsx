// /src/components/simple-editor/ImageUploader.tsx
// Firebase Storage を使用した画像アップロード機能

import { useState, useRef } from 'react';
import { storage, auth } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Upload, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ImageUploaderProps {
  userId: string;
  onImageUploaded: (url: string) => void;
  currentImageUrl?: string;
}

export function ImageUploader({ userId, onImageUploaded, currentImageUrl }: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 認証チェック
    if (!user || user.uid !== userId) {
      const errorMsg = `認証エラー: ${user ? 'ユーザーIDが一致しません' : 'ログインが必要です'}`;
      setError(errorMsg);
      alert(errorMsg);
      return;
    }

    // ファイルサイズチェック（5MB以下）
    if (file.size > 5 * 1024 * 1024) {
      const errorMsg = '画像サイズは5MB以下にしてください';
      setError(errorMsg);
      alert(errorMsg);
      return;
    }

    // ファイルタイプチェック
    if (!file.type.startsWith('image/')) {
      const errorMsg = '画像ファイルを選択してください';
      setError(errorMsg);
      alert(errorMsg);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      // プレビュー表示
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Firebase Storageにアップロード
      const timestamp = Date.now();
      const fileName = `profiles/${userId}/images/${timestamp}-${file.name}`;
      const storageRef = ref(storage, fileName);

      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      onImageUploaded(downloadUrl);
      console.log('✅ Image uploaded successfully:', downloadUrl);

    } catch (error: any) {
      console.error('❌ Upload failed:', error);

      let errorMessage = '画像のアップロードに失敗しました';

      if (error.code === 'storage/unauthorized') {
        errorMessage = 'アップロード権限がありません。ログインし直してください。';
      } else if (error.code === 'storage/quota-exceeded') {
        errorMessage = 'ストレージ容量が不足しています。';
      } else if (error.code === 'storage/invalid-format') {
        errorMessage = 'サポートされていないファイル形式です。';
      } else if (error.message) {
        errorMessage += `\n詳細: ${error.message}`;
      }

      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* エラー表示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* プレビューエリア - モバイルファースト */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4">
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="w-full h-32 sm:h-40 object-cover rounded"
          />
        ) : (
          <div className="flex flex-col items-center py-6 sm:py-8">
            <ImageIcon className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
            <p className="mt-2 text-xs sm:text-sm text-gray-500">画像がありません</p>
          </div>
        )}
      </div>

      {/* アップロードボタン - モバイルファースト */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />

      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full py-3 text-sm sm:text-base"
        variant="outline"
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            アップロード中...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            画像を選択
          </>
        )}
      </Button>

      {/* URL入力（オプション） - モバイルファースト */}
      <div className="text-center text-xs text-gray-500">
        または URL を直接入力することもできます
      </div>
    </div>
  );
}