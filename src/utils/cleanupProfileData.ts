// /src/utils/cleanupProfileData.ts
// DBクリーンアップユーティリティ

import { doc, updateDoc, deleteField, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * プロファイルデータのクリーンアップ
 * 古いCraft.jsデータを削除し、新形式に移行
 */
export async function cleanupProfileData(userId: string, username: string) {
  console.log(`🧹 Starting cleanup for user: ${userId}`);

  try {
    const profileRef = doc(db, "users", userId, "profile", "data");

    // Step 1: 古いデータを削除
    await updateDoc(profileRef, {
      editorContent: deleteField(),    // Craft.jsの巨大JSONを削除
      socialLinks: deleteField(),      // 古い形式のソーシャルリンクを削除
    });

    console.log('✅ Old data fields deleted');

    // Step 2: 新しい初期データを設定
    const cleanData = {
      components: [
        {
          id: `profile-${Date.now()}`,
          type: 'profile',
          order: 0,
          content: {
            name: '',
            bio: '自己紹介を入力してください',
            email: '',
            phone: '',
            company: '',
            position: '',
            website: '',
            address: ''
          }
        }
      ],
      background: {
        type: 'solid',
        color: '#f9fafb'
      },
      updatedAt: new Date(),
      version: '2.0.0'  // バージョン管理
    };

    // Step 3: クリーンなデータで上書き
    await setDoc(profileRef, cleanData);

    console.log('✅ Profile data cleaned and reset');
    return { success: true, message: 'Cleanup completed' };

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return { success: false, error };
  }
}