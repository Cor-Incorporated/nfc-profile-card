"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, Loader2, RotateCcw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface AdminUser {
  uid: string;
  email: string | null;
  name: string;
  username: string;
  isLikelyEmailDerivedUsername: boolean;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [targetUser, setTargetUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/signin");
    }
  }, [loading, router, user]);

  const getAuthorizationHeader = async () => {
    if (!user) {
      throw new Error("ログインが必要です");
    }

    return `Bearer ${await user.getIdToken()}`;
  };

  const lookupUser = async () => {
    const normalizedUid = uid.trim();
    if (!normalizedUid) {
      setError("対象ユーザーのUIDを入力してください。");
      return;
    }

    setError("");
    setMessage("");
    setTargetUser(null);
    setIsLookingUp(true);

    try {
      const response = await fetch(`/api/admin/users/${normalizedUid}`, {
        headers: {
          Authorization: await getAuthorizationHeader(),
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "ユーザー取得に失敗しました。");
      }

      setTargetUser(data);
    } catch (err: any) {
      setError(err.message || "ユーザー取得に失敗しました。");
    } finally {
      setIsLookingUp(false);
    }
  };

  const rotateUsername = async () => {
    if (!targetUser) return;

    const confirmed = window.confirm(
      `公開URL IDを変更します。古いURL /p/${targetUser.username} は使えなくなります。続行しますか？`,
    );
    if (!confirmed) return;

    setError("");
    setMessage("");
    setIsRotating(true);

    try {
      const response = await fetch(
        `/api/admin/users/${targetUser.uid}/rotate-username`,
        {
          method: "POST",
          headers: {
            Authorization: await getAuthorizationHeader(),
          },
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "公開URL IDの変更に失敗しました。");
      }

      setTargetUser((current) =>
        current ? { ...current, username: data.username } : current,
      );
      setMessage(
        `公開URL IDを ${data.previousUsername || "(未設定)"} から ${data.username} に変更しました。`,
      );
    } catch (err: any) {
      setError(err.message || "公開URL IDの変更に失敗しました。");
    } finally {
      setIsRotating(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">管理</h1>
        <p className="mt-1 text-sm text-gray-600">
          メール由来の公開URL IDをランダムなIDに変更します。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>公開URL IDのローテーション</CardTitle>
          <CardDescription>
            対象ユーザーのFirebase Auth UIDを指定してください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="uid">ユーザーUID</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="uid"
                value={uid}
                onChange={(event) => setUid(event.target.value)}
                placeholder="Firebase Auth UID"
              />
              <Button
                onClick={lookupUser}
                disabled={isLookingUp}
                className="w-full sm:w-auto"
              >
                {isLookingUp ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                検索
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert>
              <AlertTitle>完了</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {targetUser && (
            <div className="rounded-md border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {targetUser.name || "(名前未設定)"}
                  </p>
                  <p className="text-xs text-gray-600">{targetUser.email}</p>
                </div>
                {targetUser.isLikelyEmailDerivedUsername && (
                  <Badge variant="destructive">メール由来の可能性</Badge>
                )}
              </div>

              <dl className="mb-4 grid gap-2 text-sm">
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="text-gray-500">現在のID</dt>
                  <dd className="font-mono">
                    {targetUser.username || "(未設定)"}
                  </dd>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="text-gray-500">公開URL</dt>
                  <dd className="font-mono">
                    /p/{targetUser.username || `u_${targetUser.uid}`}
                  </dd>
                </div>
              </dl>

              <Button
                onClick={rotateUsername}
                disabled={isRotating}
                variant="destructive"
              >
                {isRotating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                ランダムIDに変更
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
