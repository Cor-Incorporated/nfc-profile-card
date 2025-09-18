'use client';

import { PageEditor } from '@/components/editor/PageEditor';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DesignEditorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [initialData, setInitialData] = useState(null);
  const [username, setUsername] = useState('');
  const [socialLinks, setSocialLinks] = useState<any[]>([]);
  const [background, setBackground] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    } else if (user) {
      loadUserData();
    }
  }, [user, loading]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        
        setUsername(data.username || '');
        setInitialData(data.profile?.editorContent || null);
        setSocialLinks(data.profile?.socialLinks || []);
        setBackground(data.profile?.background || null);
        
        // 従来のプロフィール情報を取得
        setProfileData({
          name: data.name || user.displayName || '',
          company: data.company || '',
          position: data.position || '',
          bio: data.bio || '',
          email: data.email || user.email || '',
          phone: data.phone || '',
          website: data.website || '',
          address: data.address || '',
          links: data.links || [],
        });
      }
    } catch (error) {
      console.error('データ読み込みエラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <PageEditor
      userId={user.uid}
      username={username}
      initialData={initialData}
      socialLinks={socialLinks}
      initialBackground={background}
      profileData={profileData}
    />
  );
}