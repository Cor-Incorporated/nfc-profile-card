"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  GripVertical,
  Save,
  Check,
  AlertCircle,
  ArrowLeft,
  Eye,
  Settings,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { saveLatestVersion } from "@/lib/profile/saveLatestVersion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ProfileComponent,
  ProfileData,
  SortableItemProps,
  SimplePageEditorProps,
} from "./utils/dataStructure";
import {
  sanitizeComponentContent,
  validateComponentContent,
} from "./utils/validation";
import { ComponentEditor } from "./ComponentEditor";
import { BackgroundCustomizer } from "./BackgroundCustomizer";
import { DevicePreview } from "./DevicePreview";
import { getUidFallbackUsername } from "@/lib/username";

// ドラッグ可能なコンポーネントアイテム
function SortableItem({ component, onDelete, onEdit }: SortableItemProps) {
  const { t } = useLanguage();
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
          {(() => {
            const content = component.content as any;

            switch (component.type) {
              case "text":
                return content?.text ? (
                  <p className="text-sm text-gray-600 mt-1">{content.text}</p>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    {t("clickToEdit")}
                  </p>
                );

              case "image":
                return content?.src ? (
                  <p className="text-sm text-gray-600 mt-1">
                    画像: {content.alt || "名称未設定"}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    {t("clickToEdit")}
                  </p>
                );

              case "link":
                return content?.label || content?.url ? (
                  <p className="text-sm text-gray-600 mt-1 truncate">
                    {content.label || content.url}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    {t("clickToEdit")}
                  </p>
                );

              case "profile":
                const displayName =
                  content?.name ||
                  `${content?.lastName || ""} ${content?.firstName || ""}`.trim() ||
                  null;

                if (displayName || content?.company) {
                  return (
                    <p className="text-sm text-gray-600 mt-1">
                      {displayName || t("profile")}
                      {content?.company ? ` - ${content.company}` : ""}
                    </p>
                  );
                } else {
                  return (
                    <p className="text-sm text-gray-500 mt-1">
                      {t("clickToEdit")}
                    </p>
                  );
                }

              default:
                return (
                  <p className="text-sm text-gray-500 mt-1">
                    {t("clickToEdit")}
                  </p>
                );
            }
          })()}
        </div>

        {/* ボタン */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(component)}>
            {t("edit")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(component.id)}
          >
            {t("delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SimplePageEditor({
  userId,
  initialData,
  initialRevision,
  user,
}: SimplePageEditorProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { user: authUser } = useAuth();
  const [components, setComponents] = useState<ProfileComponent[]>(
    initialData?.components || [],
  );
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingComponent, setEditingComponent] =
    useState<ProfileComponent | null>(null);
  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
  const [showDevicePreview, setShowDevicePreview] = useState(false);
  const [background, setBackground] = useState(initialData?.background || null);

  // 保存状態の管理
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [requestPending, setRequestPending] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false); // 保存中フラグ
  const revisionRef = useRef(initialRevision ?? null);
  const draftVersionRef = useRef(0);
  const latestDraftRef = useRef({
    components: initialData?.components || [],
    background: initialData?.background || null,
  });

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
    }),
  );

  // ドラッグ終了時の処理
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const nextItems = (() => {
        const items = latestDraftRef.current.components;
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        // order値を更新
        return newItems.map((item, index) => ({
          ...item,
          order: index,
        }));
      })();
      queueDraft({ ...latestDraftRef.current, components: nextItems });
    }
  };

  const addComponent = (type: ProfileComponent["type"]) => {
    const defaultContent = getDefaultContent(type, t);
    // Validate default content
    const isValid = validateComponentContent(type, defaultContent);
    if (!isValid) {
      console.error("Invalid default content for type:", type);
      return;
    }

    const newComponent: ProfileComponent = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      order: latestDraftRef.current.components.length,
      content: sanitizeComponentContent(
        type,
        defaultContent,
      ) as ProfileComponent["content"],
    };
    queueDraft({
      ...latestDraftRef.current,
      components: [...latestDraftRef.current.components, newComponent],
    });
    setShowAddMenu(false);
  };

  const deleteComponent = (id: string) => {
    queueDraft({
      ...latestDraftRef.current,
      components: latestDraftRef.current.components.filter((c) => c.id !== id),
    });
  };

  const editComponent = (component: ProfileComponent) => {
    setEditingComponent(component);
  };

  const updateComponent = (updatedComponent: ProfileComponent) => {
    // Validate and sanitize content before updating
    const isValid = validateComponentContent(
      updatedComponent.type,
      updatedComponent.content,
    );
    if (!isValid) {
      console.error("Invalid component content:", {
        type: updatedComponent.type,
        content: updatedComponent.content,
      });
      return;
    }

    const sanitizedContent = sanitizeComponentContent(
      updatedComponent.type,
      updatedComponent.content,
    );

    if (sanitizedContent === null) {
      console.error("Sanitization returned null - aborting update");
      return;
    }

    const safeComponent = {
      ...updatedComponent,
      content: sanitizedContent as ProfileComponent["content"],
    };

    queueDraft({
      ...latestDraftRef.current,
      components: latestDraftRef.current.components.map((c) =>
        c.id === safeComponent.id ? safeComponent : c,
      ),
    });
    setEditingComponent(null);
  };

  // デバッグ用：データリセット機能（開発環境のみ）
  const handleDataReset = async () => {
    if (process.env.NODE_ENV !== "development") return;

    const confirmed = window.confirm(
      "⚠️ 警告: すべてのプロファイルデータがリセットされます。続行しますか？",
    );
    if (!confirmed) return;

    queueDraft({ components: [], background: null });
  };

  // 保存関数（useCallbackで最適化）
  const saveProfile = React.useCallback(async () => {
    // 既に保存中の場合はスキップ
    if (isSavingRef.current) {
      console.log("[SimplePageEditor] Already saving, skipping...");
      return;
    }

    isSavingRef.current = true;
    setRequestPending(true);
    setSaveStatus("saving");

    try {
      if (!authUser || authUser.uid !== userId) {
        throw new Error(
          "ログイン状態を確認できません。再読み込みしてください。",
        );
      }
      const token = await authUser.getIdToken();
      await saveLatestVersion(
        () => ({
          version: draftVersionRef.current,
          draft: latestDraftRef.current,
        }),
        async (draft) => {
          const response = await fetch("/api/users/me/profile/design", {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...draft, revision: revisionRef.current }),
          });
          const result = await response.json();
          if (typeof result.revision === "string") {
            revisionRef.current = result.revision;
          }
          if (typeof result.committedRevision === "string") {
            revisionRef.current = result.committedRevision;
          }
          if (response.status === 409) {
            throw new Error(
              "別の画面でプロフィールが更新されました。再読み込みしてから編集してください。",
            );
          }
          if (response.status === 401 || response.status === 403) {
            throw new Error(
              "ログインを確認できません。再読み込みしてから保存してください。",
            );
          }
          if (result.error === "invalidation_failed") {
            throw new Error(
              "保存されましたが公開ページの更新を確認できません。再保存してください。",
            );
          }
          if (!response.ok) {
            throw new Error(
              "保存に失敗しました。内容を確認して再保存してください。",
            );
          }
        },
      );
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      setSaveError(null);
      setSaveStatus("saved");
      setLastSaved(new Date());
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "保存に失敗しました。再保存してください。",
      );
      setSaveStatus("error");
    } finally {
      isSavingRef.current = false;
      setRequestPending(false);
    }
  }, [authUser, userId]);

  // デバウンス付き自動保存（3秒）
  const debouncedSave = React.useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      void saveProfile();
    }, 3000); // 3秒後に保存
  }, [saveProfile]);

  const queueDraft = React.useCallback(
    (draft: typeof latestDraftRef.current) => {
      latestDraftRef.current = draft;
      draftVersionRef.current += 1;
      setComponents(draft.components);
      setBackground(draft.background);
      setSaveError(null);
      setSaveStatus("saving");
      debouncedSave();
    },
    [debouncedSave],
  );

  // ページ離脱時の自動保存設定
  useEffect(() => {
    // ページ離脱時の保存処理
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // A browser unload cannot await the server write. Warn while a draft
      // or request is pending rather than claiming that it was saved.
      if (saveTimeoutRef.current || isSavingRef.current) {
        e.preventDefault();
        e.returnValue =
          "保存中です。ページを離れると変更が失われる可能性があります。";
        return e.returnValue;
      }
    };

    // ページの可視性が変わった時（タブの切り替え等）
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // ページが非表示になった時、保留中の保存を即座に実行
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
          void saveProfile();
        }
      }
    };

    // イベントリスナーの登録
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // クリーンアップ関数
    return () => {
      // コンポーネントアンマウント時に保存タイマーをクリア
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // 最後の保存を実行（フラグをチェックして重複を防ぐ）
        if (!isSavingRef.current) {
          // 非同期処理をブロックしないように
          void saveProfile();
        }
      }

      // イベントリスナーの削除
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [saveProfile]); // saveProfileを依存配列に追加

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 固定ヘッダー */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-md z-50">
        <div className="flex flex-col sm:flex-row justify-between items-center p-4 gap-2 sm:gap-4">
          {/* モバイル：上段にタイトル、下段にボタン類 */}
          {/* デスクトップ：横並び */}

          {/* 左：戻るボタン */}
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="w-full sm:w-auto justify-start"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">ダッシュボード</span>
            <span className="sm:hidden">戻る</span>
          </Button>

          {/* 中央：ページタイトル（モバイルでは非表示） */}
          <h1 className="hidden sm:block font-bold text-center">
            {t("profileEditor")}
          </h1>

          {/* 右：プレビューと背景設定ボタン */}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBackgroundSettings(true)}
              className="flex-1 sm:flex-none"
            >
              <Settings className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">{t("background")}</span>
              <span className="sm:hidden">背景</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDevicePreview(true)}
              className="flex-1 sm:flex-none"
            >
              <Eye className="mr-1 h-4 w-4" />
              {t("preview")}
            </Button>
          </div>
        </div>
      </div>

      {/* メインコンテンツ（ヘッダー分の余白を追加） */}
      <div className="pt-24 sm:pt-20 py-8">
        <div className="max-w-lg mx-auto px-4 w-full">
          {/* コンポーネントリスト */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={components.map((c) => c.id)}
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
                <Button onClick={() => addComponent("text")} className="w-full">
                  {t("addText")}
                </Button>
                <Button
                  onClick={() => addComponent("image")}
                  className="w-full"
                >
                  {t("addImage")}
                </Button>
                <Button onClick={() => addComponent("link")} className="w-full">
                  {t("addLink")}
                </Button>
                <Button
                  onClick={() => addComponent("profile")}
                  className="w-full"
                >
                  {t("addProfile")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowAddMenu(false)}
                  className="w-full"
                >
                  {t("cancel")}
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setShowAddMenu(true)}
                size="lg"
                className="w-full"
              >
                <Plus className="mr-2 h-5 w-5" />
                {t("addComponent")}
              </Button>
            )}
          </div>

          {/* 保存ボタンと保存状態表示 */}
          <div className="mt-6 space-y-4">
            {/* 保存状態表示 */}
            <div className="flex items-center justify-center text-sm text-gray-600">
              {saveStatus === "saving" && (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  {t("saving")}
                </div>
              )}
              {saveStatus === "saved" && lastSaved && (
                <div className="flex items-center text-green-600">
                  <Check className="h-4 w-4 mr-2" />
                  {lastSaved.toLocaleTimeString()} {t("savedAt")}
                </div>
              )}
              {saveStatus === "error" && (
                <div role="alert" className="flex items-center text-red-600">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {saveError || t("saveFailed")}
                </div>
              )}
            </div>

            {saveStatus === "error" && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => window.location.reload()}
              >
                再読み込みして最新の内容を確認
              </Button>
            )}

            {/* 手動保存ボタン */}
            <Button
              onClick={() => {
                if (saveTimeoutRef.current) {
                  clearTimeout(saveTimeoutRef.current);
                  saveTimeoutRef.current = null;
                }
                void saveProfile();
              }}
              disabled={requestPending}
              className="w-full"
              variant="outline"
            >
              <Save className="mr-2 h-4 w-4" />
              {t("manualSave")}
            </Button>

            {/* デバッグ用：データリセットボタン（開発環境のみ） */}
            {process.env.NODE_ENV === "development" && (
              <Button
                onClick={handleDataReset}
                disabled={saveStatus === "saving"}
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
                      queueDraft({
                        ...latestDraftRef.current,
                        background: newBg,
                      });
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
              profileUrl={`/p/${user?.username || getUidFallbackUsername(userId)}`}
              components={components}
              background={background}
              onClose={() => setShowDevicePreview(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function getDefaultContent(type: string, t: (key: string) => string) {
  switch (type) {
    case "text":
      return { text: t("newText") };
    case "image":
      return { src: "", alt: "" };
    case "link":
      return { url: "", label: t("newLink") };
    case "profile":
      return {
        isInitialPlaceholder: true,
        firstName: "",
        lastName: "",
        phoneticFirstName: "",
        phoneticLastName: "",
        name: "",
        email: "",
        phone: "",
        cellPhone: "",
        company: "",
        position: "",
        department: "",
        address: "",
        city: "",
        postalCode: "",
        website: "",
        bio: "",
        photoURL: "",
        cardBackgroundColor: "#ffffff",
        cardBackgroundOpacity: 95,
      };
    default:
      return {};
  }
}
