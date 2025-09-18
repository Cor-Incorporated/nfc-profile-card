'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Editor, Frame, Element, useEditor } from '@craftjs/core';
import { Text } from './editableComponents/Text';
import { Container } from './editableComponents/Container';
import { Toolbox } from './Toolbox';
import { SettingsPanel } from './SettingsPanel';
import { Button } from '@/components/ui/button';
import { Save, Eye, EyeOff, Smartphone, Tablet, Monitor, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface PageEditorProps {
  userId: string;
  username: string;
  initialData?: any;
  profileId?: string;
}

function EditorContent({ userId, username, initialData, profileId }: PageEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const [viewMode, setViewMode] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { query } = useEditor();
  const router = useRouter();

  const saveDesign = async () => {
    setIsSaving(true);
    try {
      const serialized = query.serialize();

      if (profileId) {
        await updateDoc(doc(db, 'users', userId), {
          [`contextualProfiles.${profileId}.content`]: serialized,
          [`contextualProfiles.${profileId}.updatedAt`]: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'users', userId), {
          'profile.editorContent': serialized,
          'profile.updatedAt': serverTimestamp(),
        });
      }

      toast({
        title: '保存完了',
        description: 'デザインを保存しました',
      });
    } catch (error) {
      console.error('保存エラー:', error);
      toast({
        title: 'エラー',
        description: '保存に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getViewportWidth = () => {
    switch(viewMode) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      case 'desktop': return '100%';
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* ツールバー */}
      <div className="border-b bg-background p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/edit')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            編集ページへ戻る
          </Button>
          <h2 className="text-xl font-semibold">ページエディター</h2>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPreview(!isPreview)}
          >
            {isPreview ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {isPreview ? '編集' : 'プレビュー'}
          </Button>
          <Button
            size="sm"
            onClick={saveDesign}
            disabled={isSaving}
          >
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ツールボックス */}
        {!isPreview && (
          <div className="w-72 border-r bg-muted/30 overflow-y-auto">
            <Toolbox />
          </div>
        )}

        {/* キャンバス */}
        <div className="flex-1 bg-gray-100 overflow-auto p-4">
          <div
            className="mx-auto bg-white rounded-lg shadow-lg transition-all"
            style={{
              width: getViewportWidth(),
              minHeight: '100vh'
            }}
          >
            <Frame data={initialData}>
              <Element is="div" canvas className="p-6 min-h-screen">
                {/* 初期状態は空にして、ドラッグ&ドロップでコンポーネントを追加 */}
              </Element>
            </Frame>
          </div>
        </div>

        {/* 設定パネル */}
        {!isPreview && (
          <div className="w-80 border-l bg-muted/30 overflow-y-auto">
            <SettingsPanel />
          </div>
        )}
      </div>
    </div>
  );
}

export function PageEditor(props: PageEditorProps) {
  return (
    <Editor
      resolver={{
        Text,
        Container,
      }}
    >
      <EditorContent {...props} />
    </Editor>
  );
}