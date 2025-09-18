'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Save, Loader2, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface ProfileData {
  name: string;
  username: string;
  bio: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  website: string;
  address: string;
}

export default function EditProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    username: '',
    bio: '',
    company: '',
    position: '',
    email: '',
    phone: '',
    website: '',
    address: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    } else if (user) {
      loadProfile();
    }
  }, [user, loading, router]);

  const loadProfile = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setProfile({
          name: data.name || user.displayName || '',
          username: data.username || user.email?.split('@')[0] || '',
          bio: data.bio || '',
          company: data.company || '',
          position: data.position || '',
          email: data.email || user.email || '',
          phone: data.phone || '',
          website: data.website || '',
          address: data.address || '',
        });
      } else {
        setProfile(prev => ({
          ...prev,
          name: user.displayName || '',
          username: user.email?.split('@')[0] || '',
          email: user.email || '',
        }));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: 'エラー',
        description: 'プロフィールの読み込みに失敗しました',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfile(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!user) return;

    if (!profile.username) {
      toast({
        title: 'エラー',
        description: 'ユーザー名は必須です',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...profile,
        uid: user.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast({
        title: '成功',
        description: 'プロフィールを保存しました',
      });

      router.push('/dashboard');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'エラー',
        description: 'プロフィールの保存に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:p-6 max-w-4xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">プロフィール編集</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          あなたのプロフィール情報を編集できます
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
            <CardDescription>
              公開プロフィールに表示される基本的な情報を設定します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">名前 *</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="山田 太郎"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">ユーザー名 *</Label>
                <Input
                  id="username"
                  value={profile.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  placeholder="yamada_taro"
                />
                <p className="text-xs text-muted-foreground">
                  プロフィールURL: /p/{profile.username || 'username'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">会社名</Label>
                <Input
                  id="company"
                  value={profile.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  placeholder="株式会社Example"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">役職</Label>
                <Input
                  id="position"
                  value={profile.position}
                  onChange={(e) => handleInputChange('position', e.target.value)}
                  placeholder="営業部長"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="example@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">電話番号</Label>
                <Input
                  id="phone"
                  value={profile.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="03-1234-5678"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">ウェブサイト</Label>
                <Input
                  id="website"
                  value={profile.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  placeholder="https://example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">住所</Label>
                <Input
                  id="address"
                  value={profile.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="東京都渋谷区..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">自己紹介</Label>
              <Textarea
                id="bio"
                value={profile.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="あなたについて教えてください..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>デザインカスタマイズ</CardTitle>
            <CardDescription>
              プロフィールページのデザインをカスタマイズできます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push('/dashboard/edit/design')}
              variant="outline"
              className="w-full"
            >
              <Palette className="mr-2 h-4 w-4" />
              デザインエディターを開く
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 justify-end">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard')}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                保存
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}