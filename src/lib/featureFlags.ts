/**
 * フィーチャーフラグ管理
 * 新機能の段階的リリースを制御
 */

export const FeatureFlags = {
  // プロファイル移行機能（デフォルト無効）
  ENABLE_PROFILE_MIGRATION:
    process.env.NEXT_PUBLIC_ENABLE_PROFILE_MIGRATION === "true",

  // 複数プロファイル機能（デフォルト無効）
  ENABLE_MULTIPLE_PROFILES:
    process.env.NEXT_PUBLIC_ENABLE_MULTIPLE_PROFILES === "true",

  // デバッグモード
  DEBUG_MODE: process.env.NEXT_PUBLIC_DEBUG_MODE === "true",
} as const;

/**
 * フィーチャーフラグの状態をログ出力
 */
export function logFeatureFlags() {
  if (FeatureFlags.DEBUG_MODE) {
    console.log("Feature Flags:", {
      ENABLE_PROFILE_MIGRATION: FeatureFlags.ENABLE_PROFILE_MIGRATION,
      ENABLE_MULTIPLE_PROFILES: FeatureFlags.ENABLE_MULTIPLE_PROFILES,
      DEBUG_MODE: FeatureFlags.DEBUG_MODE,
    });
  }
}
