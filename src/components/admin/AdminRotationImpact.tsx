import { getUidFallbackUsername } from "@/lib/username";

interface AdminRotationImpactProps {
  uid: string;
  username: string;
}

export function getAdminRotationImpact(uid: string, username: string) {
  const fallbackUsername = getUidFallbackUsername(uid);
  const previousUsername = username || fallbackUsername;

  if (previousUsername === fallbackUsername) {
    return `UID形式の公開URL /p/${fallbackUsername} は固定URLのため、ID変更後も利用できます。`;
  }

  return `古い公開URL /p/${previousUsername} は無効化の対象です。反映まで一時的に表示される場合があります。UID形式の固定URL /p/${fallbackUsername} は引き続き利用できます。`;
}

export function AdminRotationImpact({
  uid,
  username,
}: AdminRotationImpactProps) {
  return (
    <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <strong>次のID変更時の影響：</strong>
      <br />
      {getAdminRotationImpact(uid, username)}
    </p>
  );
}
