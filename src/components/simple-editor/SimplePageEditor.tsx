"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, GripVertical, Save, Check, AlertCircle, ArrowLeft, Eye, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ProfileComponent } from './utils/dataStructure';
import { ComponentEditor } from './ComponentEditor';
import { BackgroundCustomizer } from './BackgroundCustomizer';
import { DevicePreview } from './DevicePreview';
import { cleanupProfileData } from '@/utils/cleanupProfileData';

// ドラッグ可能なコンポーネントアイテム
function SortableItem({ component, onDelete, onEdit }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: component.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border rounded-lg shadow-sm"
    >
      <div className="flex items-center p-4">
        {/* ドラッグハンドル */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none mr-3"
        >
          <GripVertical className="h-5 w-5 text-gray-400" />
        </div>

        {/* コンポーネント内容 */}
        <div
          className="flex-1 cursor-pointer"
          onClick={() => onEdit(component)}
        >
          <span className="font-medium">{component.type}</span>
          {component.content?.text && (
            <p className="text-sm text-gray-600 mt-1">{component.content.text}</p>
          )}
          {component.content?.label && (
            <p className="text-sm text-gray-600 mt-1">{component.content.label}</p>
          )}
          {component.type === 'profile' && component.content && (
            <div className="text-sm text-gray-600 mt-1">
              {component.content.name ||
               `${component.content.lastName || ''} ${component.content.firstName || ''}`.trim() ||
               'プロフィール'}
              {component.content.company && ` - ${component.content.company}`}
            </div>
          )}
          {!component.content?.text &&
           !component.content?.label &&
           !component.content?.name &&
           !component.content?.lastName &&
           !component.content?.firstName && (
            <p className="text-sm text-gray-500 mt-1">クリックして編集</p>
          )}
        </div>

        {/* ボタン */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(component)}
          >
            編集
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(component.id)}
          >
            削除
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SimplePageEditor({ userId, initialData, user }: any) {
  const router = useRouter();
  const [components, setComponents] = useState<ProfileComponent[]>(
    initialData?.components || []
  );
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingComponent, setEditingComponent] = useState<ProfileComponent | null>(null);
  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
  const [showDevicePreview, setShowDevicePreview] = useState(false);
  const [background, setBackground] = useState(initialData?.background || null);

  // 保存状態の管理
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false); // 保存中フラグ

  // センサー設定（モバイル対応）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ドラッグ終了時の処理
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setComponents((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        // order値を更新
        return newItems.map((item, index) => ({
          ...item,
          order: index,
        }));
      });

      // 並び替え後に自動保存を実行
      setSaveStatus('saving');
      debouncedSave();
    }
  };

  const addComponent = (type: ProfileComponent['type']) => {
    const newComponent: ProfileComponent = {
      id: `${Date.now()}`,
      type,
      order: components.length,
      content: getDefaultContent(type),
    };
    setComponents([...components, newComponent]);
    setShowAddMenu(false);
    // 追加後に自動保存を実行
    setSaveStatus('saving');
    debouncedSave();
  };

  const deleteComponent = (id: string) => {
    setComponents(components.filter(c => c.id !== id));
    // 削除後に自動保存を実行
    setSaveStatus('saving');
    debouncedSave();
  };

  const editComponent = (component: ProfileComponent) => {
    setEditingComponent(component);
  };

  const updateComponent = (updatedComponent: ProfileComponent) => {
    setComponents(components.map(c =>
      c.id === updatedComponent.id ? updatedComponent : c
    ));
    setEditingComponent(null);
    // 更新後に自動保存を実行
    setSaveStatus('saving');
    debouncedSave();
  };

  // デバッグ用：データリセット機能（開発環境のみ）
  const handleDataReset = async () => {
    if (process.env.NODE_ENV !== 'development') return;

    const confirmed = window.confirm('⚠️ 警告: すべてのプロファイルデータがリセットされます。続行しますか？');
    if (!confirmed) return;

    setSaveStatus('saving');
    try {
      const result = await cleanupProfileData(userId, user?.username || 'unknown');
      if (result.success) {
        // UIを初期状態にリセット
        window.location.reload();
      } else {
        console.error('Reset failed:', result.error);
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Reset error:', error);
      setSaveStatus('error');
    }
  };

  // 保存関数（useCallbackで最適化）
  const saveProfile = React.useCallback(async () => {
    // 既に保存中の場合はスキップ
    if (isSavingRef.current) {
      console.log('[SimplePageEditor] Already saving, skipping...');
      return;
    }

    isSavingRef.current = true;
    setSaveStatus('saving');

    try {
      const docRef = doc(db, "users", userId, "profile", "data");

      // updateDocを使用した差分更新
      await updateDoc(docRef, {
        components,
        background,
        updatedAt: new Date(),
      });

      setSaveStatus('saved');
      setLastSaved(new Date());
      console.log('[SimplePageEditor] Profile saved successfully');
    } catch (error: any) {
      // ドキュメントが存在しない場合はsetDocで作成
      if (error.code === 'not-found') {
        try {
          await setDoc(
            doc(db, "users", userId, "profile", "data"),
            {
              components,
              background,
              updatedAt: serverTimestamp(),
            }
          );
          setSaveStatus('saved');
          setLastSaved(new Date());
          console.log('[SimplePageEditor] Profile created successfully');
        } catch (createError) {
          console.error('[SimplePageEditor] Error creating profile:', createError);
          setSaveStatus('error');
        }
      } else {
        console.error('[SimplePageEditor] Error saving profile:', error);
        setSaveStatus('error');
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [components, background, userId]);

  // デバウンス付き自動保存（3秒）
  const debouncedSave = React.useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveProfile();
    }, 3000); // 3秒後に保存
  }, [saveProfile]);

  // ページ離脱時の自動保存設定
  useEffect(() => {
    // ページ離脱時の保存処理
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 保留中の変更がある場合は保存
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveProfile(); // 即座に保存を実行
      }

      // 保存状態が「保存中」の場合は警告を表示
      if (isSavingRef.current) {
        e.preventDefault();
        e.returnValue = '保存中です。ページを離れると変更が失われる可能性があります。';
        return e.returnValue;
      }
    };

    // ページの可視性が変わった時（タブの切り替え等）
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // ページが非表示になった時、保留中の保存を即座に実行
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveProfile();
        }
      }
    };

    // イベントリスナーの登録
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // クリーンアップ関数
    return () => {
      // コンポーネントアンマウント時に保存
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveProfile(); // 即座に保存
      }

      // イベントリスナーの削除
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveProfile]); // saveProfileを依存配列に追加

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 固定ヘッダー */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-md z-50">
        <div className="flex justify-between items-center p-4">
          {/* 左：戻るボタン */}
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            ダッシュボード
          </Button>

          {/* 中央：ページタイトル */}
          <h1 className="font-bold">プロフィール編集</h1>

          {/* 右：プレビューと背景設定ボタン */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBackgroundSettings(true)}
            >
              <Settings className="mr-1 h-4 w-4" />
              背景
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDevicePreview(true)}
            >
              <Eye className="mr-1 h-4 w-4" />
              プレビュー
            </Button>
          </div>
        </div>
      </div>

      {/* メインコンテンツ（ヘッダー分の余白を追加） */}
      <div className="pt-20 py-8">
        <div className="max-w-md mx-auto px-4">

        {/* コンポーネントリスト */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={components.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3 mb-6">
              {components.map((component) => (
                <SortableItem
                  key={component.id}
                  component={component}
                  onDelete={deleteComponent}
                  onEdit={editComponent}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* 追加ボタンエリア */}
        <div className="add-component-button-container">
          {showAddMenu ? (
            <div className="bg-white rounded-lg shadow-lg p-4 space-y-2">
              <Button onClick={() => addComponent('text')} className="w-full">
                テキストを追加
              </Button>
              <Button onClick={() => addComponent('image')} className="w-full">
                画像を追加
              </Button>
              <Button onClick={() => addComponent('link')} className="w-full">
                リンクを追加
              </Button>
              <Button onClick={() => addComponent('profile')} className="w-full">
                プロフィールを追加
              </Button>
              <Button variant="ghost" onClick={() => setShowAddMenu(false)} className="w-full">
                キャンセル
              </Button>
            </div>
          ) : (
            <Button onClick={() => setShowAddMenu(true)} size="lg" className="w-full">
              <Plus className="mr-2 h-5 w-5" />
              コンポーネントを追加
            </Button>
          )}
        </div>

        {/* 保存ボタンと保存状態表示 */}
        <div className="mt-6 space-y-4">
          {/* 保存状態表示 */}
          <div className="flex items-center justify-center text-sm text-gray-600">
            {saveStatus === 'saving' && (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                保存中...
              </div>
            )}
            {saveStatus === 'saved' && lastSaved && (
              <div className="flex items-center text-green-600">
                <Check className="h-4 w-4 mr-2" />
                {lastSaved.toLocaleTimeString()}に保存済み
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center text-red-600">
                <AlertCircle className="h-4 w-4 mr-2" />
                保存に失敗しました
              </div>
            )}
          </div>

          {/* 手動保存ボタン */}
          <Button
            onClick={saveProfile}
            disabled={saveStatus === 'saving'}
            className="w-full"
            variant="outline"
          >
            <Save className="mr-2 h-4 w-4" />
            手動保存
          </Button>

          {/* デバッグ用：データリセットボタン（開発環境のみ） */}
          {process.env.NODE_ENV === 'development' && (
            <Button
              onClick={handleDataReset}
              disabled={saveStatus === 'saving'}
              className="w-full"
              variant="destructive"
            >
              🧹 データをリセット (DEV)
            </Button>
          )}
        </div>

        {/* 編集モーダル */}
        {editingComponent && (
          <ComponentEditor
            component={editingComponent}
            onSave={updateComponent}
            onClose={() => setEditingComponent(null)}
            userId={userId}
          />
        )}

        {/* 背景設定モーダル */}
        {showBackgroundSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-4">
                <BackgroundCustomizer
                  currentBackground={background}
                  userId={userId}
                  onBackgroundChange={(newBg) => {
                    setBackground(newBg);
                    // 背景変更後に自動保存
                    setSaveStatus('saving');
                    debouncedSave();
                  }}
                />
                <Button
                  onClick={() => setShowBackgroundSettings(false)}
                  className="w-full mt-4"
                >
                  閉じる
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* デバイスプレビューモーダル */}
        {showDevicePreview && (
          <DevicePreview
            profileUrl={`/p/${user?.username || user?.email?.split('@')[0] || 'preview'}`}
            onClose={() => setShowDevicePreview(false)}
          />
        )}
        </div>
      </div>
    </div>
  );
}

function getDefaultContent(type: string) {
  switch(type) {
    case 'text':
      return { text: '新しいテキスト' };
    case 'image':
      return { src: '', alt: '' };
    case 'link':
      return { url: '', label: 'リンク' };
    case 'profile':
      return {
        firstName: '',
        lastName: '',
        phoneticFirstName: '',
        phoneticLastName: '',
        name: '',
        email: '',
        phone: '',
        cellPhone: '',
        company: '',
        position: '',
        department: '',
        address: '',
        city: '',
        postalCode: '',
        website: '',
        bio: '',
        photoURL: ''
      };
    default:
      return {};
  }
}