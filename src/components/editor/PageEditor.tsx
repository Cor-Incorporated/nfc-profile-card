'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { db } from '@/lib/firebase';
import { Editor, Element, Frame, useEditor } from '@craftjs/core';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Eye, EyeOff, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { BackgroundSettingsButton } from './BackgroundSettingsButton';
import { AddComponentPlaceholder } from './editableComponents/AddComponentPlaceholder';
import { ImageUpload } from './editableComponents/ImageUpload';
import { LinkButton } from './editableComponents/LinkButton';
import { ProfileInfo } from './editableComponents/ProfileInfo';
import { Text } from './editableComponents/Text';
import { EditorErrorBoundary } from './ErrorBoundary';

interface PageEditorProps {
  userId: string;
  username: string;
  initialData?: any;
  profileId?: string;
  socialLinks?: any[];
  initialBackground?: any;
  profileData?: {
    name: string;
    company: string;
    position: string;
    bio: string;
    email: string;
    phone: string;
    website: string;
    address: string;
    links: any[];
  };
}

function EditorContent({ userId, username, initialData, profileId, socialLinks: initialSocialLinks = [], initialBackground = null, profileData }: PageEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const [viewMode, setViewMode] = useState<'mobile' | 'tablet' | 'desktop'>('mobile'); // デフォルトをmobileに
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [background, setBackground] = useState<any>(initialBackground);
  const [socialLinks, setSocialLinks] = useState<any[]>(initialSocialLinks);
  const [validInitialData, setValidInitialData] = useState<any>(null);
  const [dataLoadError, setDataLoadError] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();
  const { query, actions } = useEditor((state) => ({
    nodesLength: Object.keys(state.nodes).length
  }));
  const router = useRouter();

  // デフォルトのエディター構造を取得
  const getDefaultEditorContent = () => ({
    ROOT: {
      type: { resolvedName: 'Container' },
      nodes: [],
      props: {},
    }
  });

        // initialDataのバリデーションとクリーンアップ
        const validateAndCleanData = (data: any) => {
          if (!data) {
            return getDefaultEditorContent();
          }

    try {
      // データがすでにオブジェクトの場合はそのまま使用
      let cleanedData = data;

      // 文字列の場合はパース
      if (typeof data === 'string') {
        cleanedData = JSON.parse(data);
      }

      // 深いコピーを作成
      cleanedData = JSON.parse(JSON.stringify(cleanedData));

      if (cleanedData && typeof cleanedData === 'object') {
        // 有効なCraft.jsノード構造かチェック
        let hasValidContentNodes = false;
        let validContentNodeCount = 0;
        
        Object.keys(cleanedData).forEach(key => {
          const node = cleanedData[key];
          
          if (node && node.type) {
            // resolvedNameが存在するかチェック
            const resolvedName = node.type.resolvedName || node.type;
            
            // ROOTノードとAddComponentPlaceholderは除外し、実際のコンテンツノードのみをカウント
            if (resolvedName && 
                resolvedName !== 'Container' && 
                resolvedName !== 'AddComponentPlaceholder' &&
                key !== 'ROOT') {
              hasValidContentNodes = true;
              validContentNodeCount++;
            }
          }
        });
        
        // 有効なコンテンツノードがある場合はそのまま返す、そうでなければデフォルト構造を返す
        if (hasValidContentNodes) {
          return cleanedData;
        } else {
          return getDefaultEditorContent();
        }
      }

      return getDefaultEditorContent();
    } catch (error) {
      console.error('Data validation error:', error);
      return getDefaultEditorContent();
    }
  };

  // 初期データの処理
  React.useEffect(() => {
    try {
      const cleanedData = validateAndCleanData(initialData);
      setValidInitialData(cleanedData);
      setDataLoadError(false);
    } catch (error) {
      console.error('Failed to process initial data:', error);
      setDataLoadError(true);
      setValidInitialData(getDefaultEditorContent());
      toast({
        title: 'データ読み込みエラー',
        description: '既存のデザインデータに問題があります。新しいデザインから始めます。',
        variant: 'destructive',
      });
    }
  }, [initialData, toast]);

  // 保存の実装
  const saveData = React.useCallback(async () => {
    if (!isInitialized) {
      return;
    }

    setSaveStatus('saving');
    try {
      const serialized = query.serialize();

      if (profileId) {
        await updateDoc(doc(db, 'users', userId), {
          [`contextualProfiles.${profileId}.content`]: serialized,
          [`contextualProfiles.${profileId}.background`]: background,
          [`contextualProfiles.${profileId}.socialLinks`]: socialLinks,
          [`contextualProfiles.${profileId}.updatedAt`]: serverTimestamp(),
        });
      } else {
        // 従来のプロフィール情報とエディター情報の両方を保存
        const updateData: any = {
          'profile.editorContent': serialized,
          'profile.background': background,
          'profile.socialLinks': socialLinks,
          'profile.updatedAt': serverTimestamp(),
        };

        // プロフィールデータが存在する場合は従来形式も保存
        if (profileData) {
          updateData.name = profileData.name;
          updateData.company = profileData.company;
          updateData.position = profileData.position;
          updateData.bio = profileData.bio;
          updateData.email = profileData.email;
          updateData.phone = profileData.phone;
          updateData.website = profileData.website;
          updateData.address = profileData.address;
          updateData.links = profileData.links;
        }

        await updateDoc(doc(db, 'users', userId), updateData);
      }

      setSaveStatus('saved');
    } catch (error) {
      console.error('保存エラー:', error);
      setSaveStatus('error');
    }
  }, [isInitialized, query, profileId, userId, background, socialLinks]);

  // 自動保存の実装
  const autoSave = React.useCallback(async () => {
    if (saveStatus === 'saving') return;
    await saveData();
  }, [saveData, saveStatus]);

  // debounce処理付きの自動保存
  const debouncedAutoSave = React.useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        autoSave();
      }, 5000); // 5秒のdebounce
    };
  }, [autoSave]);

  // 自動保存を一時的に無効化（手動保存のみ）
  // React.useEffect(() => {
  //   console.log('Editor state changed, isInitialized:', isInitialized);
  //   if (isInitialized) {
  //     console.log('Triggering auto save');
  //     debouncedAutoSave();
  //   }
  // }, [background, socialLinks, isInitialized, debouncedAutoSave]);

  // 初期データをEditorに設定
  React.useEffect(() => {
    if (validInitialData && actions) {
      try {
        actions.deserialize(validInitialData);
      } catch (error) {
        console.error('Failed to set initial data:', error);
      }
    }
  }, [validInitialData, actions]);

  // 初期化完了を監視
  React.useEffect(() => {
    if (validInitialData !== null) {
      // 初期データロード後に少し遅延して初期化完了とする
      const timer = setTimeout(() => {
        setIsInitialized(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [validInitialData]);

  // ページ離脱時の保存
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isInitialized && saveStatus !== 'saved') {
        // 同期的に保存を試行
        saveData();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isInitialized, saveStatus, saveData]);

  const getViewportWidth = () => {
    switch(viewMode) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      case 'desktop': return '100%';
    }
  };

  const getBackgroundStyle = () => {
    if (!background) return {};

    const opacity = background.opacity || 1;

    switch (background.type) {
      case 'solid':
        const color = background.color || '#ffffff';
        // RGBAに変換して透明度を適用
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})` };
      case 'gradient':
        // グラデーションの場合は背景レイヤーとして分離
        return {
          position: 'relative' as const,
        };
      case 'image':
        // 画像の場合は背景レイヤーとして分離
        return {
          position: 'relative' as const,
        };
      case 'pattern':
        // パターンの場合は背景レイヤーとして分離
        return {
          position: 'relative' as const,
        };
      default:
        return {};
    }
  };

  const getBackgroundLayer = () => {
    if (!background || background.type === 'solid') return null;

    const opacity = background.opacity || 1;

    let backgroundStyle = {};
    switch (background.type) {
      case 'gradient':
        backgroundStyle = {
          background: `linear-gradient(${background.direction || 'to bottom right'}, ${background.from}, ${background.to})`,
        };
        break;
      case 'image':
        const size = background.backgroundSize || 'cover';
        let backgroundSize = size;
        if (size === 'custom') {
          const scale = background.scale || 100;
          backgroundSize = `${scale}%`;
        }

        const positionX = background.positionX || 50;
        const positionY = background.positionY || 50;

        backgroundStyle = {
          backgroundImage: `url(${background.imageUrl})`,
          backgroundSize: backgroundSize,
          backgroundPosition: `${positionX}% ${positionY}%`,
          backgroundRepeat: 'no-repeat',
        };
        break;
      case 'pattern':
        backgroundStyle = {
          // パターンのスタイルをここに追加
        };
        break;
    }

    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          ...backgroundStyle,
          opacity: opacity,
          zIndex: 0,
        }}
      />
    );
  };

  return (
    <div className="h-screen flex flex-col">
      {/* ツールバー */}
      <div className="border-b bg-background p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            ダッシュボード
          </Button>
          <h2 className="text-xl font-semibold">デザインエディター</h2>
          <Button
            variant="default"
            size="sm"
            onClick={saveData}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? '保存中...' : '保存'}
          </Button>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'mobile' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('mobile')}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'tablet' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('tablet')}
            >
              <Tablet className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'desktop' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('desktop')}
            >
              <Monitor className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isPreview && (
            <BackgroundSettingsButton
              userId={userId}
              background={background}
              onBackgroundChange={setBackground}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPreview(!isPreview)}
          >
            {isPreview ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {isPreview ? '編集' : 'プレビュー'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm('現在のデザインをリセットして新しいデザインを開始しますか？この操作は元に戻せません。')) {
                // 現在のエディターをクリア
                setValidInitialData(null);
                // ページをリロードして完全にリセット
                window.location.reload();
              }
            }}
          >
            新規作成
          </Button>
          {/* 自動保存状態表示 */}
          <div className="flex items-center gap-2 text-sm">
            {saveStatus === 'saving' && (
              <>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-blue-600">保存中...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-green-600">保存済み</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-red-600">保存エラー</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* キャンバス */}
        <div className="flex-1 bg-gray-100 overflow-auto p-4 relative">
          <div
            className="mx-auto bg-white rounded-lg shadow-lg transition-all"
            style={{
              width: getViewportWidth(),
              minHeight: '100vh',
              ...getBackgroundStyle()
            }}
          >
            {/* 背景レイヤー（透明度付き） */}
            {getBackgroundLayer()}

            <Frame data={validInitialData}>
              <Element
                is="div"
                canvas
                className="flex flex-col items-center gap-4 p-6 min-h-screen relative"
                style={{ zIndex: 1 }}
              >
                {/* 初期のコンポーネント追加ボタン（画面内に配置） */}
                {!isPreview && (
                  <Element
                    is={AddComponentPlaceholder}
                    socialLinks={socialLinks}
                    onSocialLinksChange={(links) => {
                      setSocialLinks(links);
                    }}
                    userId={userId}
                  />
                )}
              </Element>
            </Frame>
          </div>
        </div>

      </div>
    </div>
  );
}

export function PageEditor(props: PageEditorProps) {
  return (
    <EditorErrorBoundary>
      <Editor
        resolver={{
          Text,
          ImageUpload,
          LinkButton,
          ProfileInfo,
          AddComponentPlaceholder,
        }}
      >
        <EditorContent {...props} />
      </Editor>
    </EditorErrorBoundary>
  );
}