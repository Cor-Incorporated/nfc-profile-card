import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function uploadProfileImage(
  userId: string,
  file: File,
  type: 'avatar' | 'background' | 'content'
): Promise<string> {
  // ファイルバリデーション
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('ファイルサイズは5MB以下にしてください');
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('JPEG, PNG, GIF, WebP形式のみアップロード可能です');
  }

  // ユニークなファイル名を生成
  const timestamp = Date.now();
  const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const storagePath = `users/${userId}/${type}/${fileName}`;

  // アップロード
  const storageRef = ref(storage, storagePath);
  const snapshot = await uploadBytes(storageRef, file);

  // ダウンロードURLを取得
  const downloadUrl = await getDownloadURL(snapshot.ref);

  return downloadUrl;
}

export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    // URLからパスを抽出
    const decodedUrl = decodeURIComponent(imageUrl);
    const pathMatch = decodedUrl.match(/\/o\/(.*?)\?/);
    if (!pathMatch) return;

    const path = pathMatch[1].replace(/%2F/g, '/');
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('画像削除エラー:', error);
  }
}

// 画像を圧縮してからアップロード
export async function uploadCompressedImage(
  userId: string,
  file: File,
  type: 'avatar' | 'background' | 'content',
  maxWidth: number = 1920
): Promise<string> {
  // 画像を圧縮
  const compressedFile = await compressImage(file, maxWidth);
  return uploadProfileImage(userId, compressedFile, type);
}

async function compressImage(file: File, maxWidth: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        let { width, height } = img;

        // アスペクト比を維持しながらリサイズ
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              }));
            } else {
              reject(new Error('圧縮に失敗しました'));
            }
          },
          'image/jpeg',
          0.85 // 品質85%
        );
      };
    };
  });
}