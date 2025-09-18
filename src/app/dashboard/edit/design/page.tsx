'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageEditor } from '@/components/editor/PageEditor';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function DesignEditorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [initialData, setInitialData] = useState(null);
  const [username, setUsername] = useState('');

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
    />
  );
}