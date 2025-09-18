"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreVertical,
  Check,
  Edit,
  Trash,
  Copy,
  CreditCard
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { migrateUserProfile, needsMigration } from "@/lib/migration/profileMigration";

interface ProfileContext {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
  assignedCards?: string[];
}

export default function ProfilesPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    // Auto-migration check and execution - TEMPORARILY DISABLED FOR P0 FIX
    // const checkAndMigrate = async () => {
    //   setMigrating(true);
    //   try {
    //     const needsMig = await needsMigration(user.uid);
    //     if (needsMig) {
    //       console.log("Migration needed, starting migration...");
    //       const success = await migrateUserProfile(user.uid);
    //       if (success) {
    //         toast({
    //           title: "プロファイルを移行しました",
    //           description: "既存のデータが新しいシステムに移行されました",
    //         });
    //       } else {
    //         toast({
    //           title: "移行エラー",
    //           description: "プロファイルの移行中にエラーが発生しました",
    //           variant: "destructive",
    //         });
    //       }
    //     }
    //   } catch (error) {
    //     console.error("Migration check error:", error);
    //   } finally {
    //     setMigrating(false);
    //   }
    // };

    // // Run migration check first
    // checkAndMigrate();

    // Set up real-time listener for profiles
    const q = query(
      collection(db, "users", user.uid, "profiles"),
      orderBy("priority", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const profilesData: ProfileContext[] = [];
      snapshot.forEach((doc) => {
        profilesData.push({ id: doc.id, ...doc.data() } as ProfileContext);
      });
      setProfiles(profilesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  // 新規プロファイル作成
  const createProfile = async () => {
    if (!user) return;

    try {
      const newProfile = {
        name: `プロファイル${profiles.length + 1}`,
        description: "",
        isActive: profiles.length === 0, // 最初のプロファイルは自動でアクティブ
        priority: profiles.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, "users", user.uid, "profiles"),
        newProfile
      );

      toast({
        title: "プロファイルを作成しました",
        description: "編集画面から内容をカスタマイズできます",
      });

      // 編集画面へ遷移
      router.push(`/dashboard/edit/design?profileId=${docRef.id}`);
    } catch (error) {
      toast({
        title: "エラー",
        description: "プロファイルの作成に失敗しました",
        variant: "destructive",
      });
    }
  };

  // プロファイルをアクティブに設定
  const setActiveProfile = async (profileId: string) => {
    if (!user) return;

    try {
      // 全プロファイルを非アクティブに
      const batch = profiles.map(profile =>
        updateDoc(
          doc(db, "users", user.uid, "profiles", profile.id),
          { isActive: false }
        )
      );

      await Promise.all(batch);

      // 選択したプロファイルをアクティブに
      await updateDoc(
        doc(db, "users", user.uid, "profiles", profileId),
        {
          isActive: true,
          updatedAt: serverTimestamp()
        }
      );

      toast({
        title: "アクティブプロファイルを変更しました",
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "プロファイルの切り替えに失敗しました",
        variant: "destructive",
      });
    }
  };

  // プロファイル複製
  const duplicateProfile = async (profileId: string) => {
    if (!user) return;

    const originalProfile = profiles.find(p => p.id === profileId);
    if (!originalProfile) return;

    try {
      const newProfile = {
        ...originalProfile,
        name: `${originalProfile.name}（コピー）`,
        isActive: false,
        priority: profiles.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      delete (newProfile as any).id;
      delete (newProfile as any).assignedCards;

      await addDoc(
        collection(db, "users", user.uid, "profiles"),
        newProfile
      );

      toast({
        title: "プロファイルを複製しました",
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "プロファイルの複製に失敗しました",
        variant: "destructive",
      });
    }
  };

  // プロファイル削除
  const deleteProfile = async (profileId: string) => {
    if (!user) return;

    if (profiles.length <= 1) {
      toast({
        title: "削除できません",
        description: "最低1つのプロファイルが必要です",
        variant: "destructive",
      });
      return;
    }

    try {
      await deleteDoc(doc(db, "users", user.uid, "profiles", profileId));
      toast({
        title: "プロファイルを削除しました",
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "プロファイルの削除に失敗しました",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">プロファイル管理</h1>
          <p className="text-gray-600 mt-2">
            異なるシーンに応じた複数のプロファイルを作成・管理できます
          </p>
        </div>
        <Button onClick={createProfile}>
          <Plus className="mr-2 h-4 w-4" />
          新規プロファイル
        </Button>
      </div>

      {migrating ? (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4" />
          <p className="text-gray-600">プロファイルデータを移行中...</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((profile) => (
            <Card
              key={profile.id}
              className={`relative ${
                profile.isActive
                  ? 'ring-2 ring-blue-500 shadow-lg'
                  : 'hover:shadow-md transition-shadow'
              }`}
            >
              {profile.isActive && (
                <div className="absolute -top-3 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                  アクティブ
                </div>
              )}

              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">
                    {profile.name}
                  </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/dashboard/edit/design?profileId=${profile.id}`)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        編集
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setActiveProfile(profile.id)}
                        disabled={profile.isActive}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        アクティブにする
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => duplicateProfile(profile.id)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        複製
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteProfile(profile.id)}
                        className="text-red-600"
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        削除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  {profile.description || "説明を追加..."}
                </p>

                {profile.assignedCards && profile.assignedCards.length > 0 && (
                  <div className="flex items-center text-sm text-gray-500">
                    <CreditCard className="mr-1 h-4 w-4" />
                    {profile.assignedCards.length}枚のカードに割り当て
                  </div>
                )}

                <div className="mt-4 pt-4 border-t flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/p/${user?.uid}?profile=${profile.id}`)}
                  >
                    プレビュー
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => router.push(`/dashboard/edit/design?profileId=${profile.id}`)}
                  >
                    編集
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}