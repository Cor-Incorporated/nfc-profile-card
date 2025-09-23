import { Timestamp } from "firebase/firestore";

interface ErrorLog {
  timestamp: Date;
  component: string;
  error: string;
  userId?: string;
  context?: any;
}

class ErrorTracker {
  private errors: ErrorLog[] = [];
  private readonly MAX_ERRORS = 100;

  // エラーを記録
  logError(component: string, error: any, context?: any) {
    const errorLog: ErrorLog = {
      timestamp: new Date(),
      component,
      error: error?.message || String(error),
      userId: this.getCurrentUserId(),
      context,
    };

    this.errors.push(errorLog);

    // メモリ上限を超えたら古いエラーを削除
    if (this.errors.length > this.MAX_ERRORS) {
      this.errors.shift();
    }

    // コンソールにも出力（開発環境のみ）
    if (process.env.NODE_ENV === "development") {
      console.error(`[${component}]`, error, context);
    }

    // 重大なエラーの場合はアラート
    if (this.isCriticalError(error)) {
      this.alertCriticalError(errorLog);
    }
  }

  // Craft.js専用エラーハンドラ
  logCraftError(error: any, editorState?: any) {
    this.logError("CraftJS", error, {
      editorState: editorState ? "present" : "empty",
      errorType: error?.name,
      stack: error?.stack,
    });
  }

  // Firestore専用エラーハンドラ
  logFirestoreError(operation: string, error: any, path?: string) {
    this.logError("Firestore", error, {
      operation,
      path,
      code: error?.code,
    });
  }

  // 重大エラーの判定
  private isCriticalError(error: any): boolean {
    const criticalPatterns = [
      "Cannot destructure property",
      "Firebase",
      "Network",
      "Permission denied",
    ];

    const errorMessage = error?.message || String(error);
    return criticalPatterns.some((pattern) => errorMessage.includes(pattern));
  }

  // 重大エラーのアラート
  private alertCriticalError(errorLog: ErrorLog) {
    // 本番環境では外部サービスに送信（将来実装）
    console.error("🚨 CRITICAL ERROR:", errorLog);

    // ユーザーへの通知（後で実装）
    if (typeof window !== "undefined") {
      // toast通知など
    }
  }

  // 現在のユーザーID取得
  private getCurrentUserId(): string | undefined {
    // AuthContextから取得（実装簡略化のため仮実装）
    return typeof window !== "undefined"
      ? window.localStorage.getItem("userId") || undefined
      : undefined;
  }

  // エラーレポート生成
  generateReport(): string {
    const report = {
      totalErrors: this.errors.length,
      byComponent: this.groupByComponent(),
      recentErrors: this.errors.slice(-10),
      criticalErrors: this.errors.filter((e) =>
        this.isCriticalError({ message: e.error }),
      ),
    };

    return JSON.stringify(report, null, 2);
  }

  private groupByComponent() {
    return this.errors.reduce(
      (acc, error) => {
        acc[error.component] = (acc[error.component] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }
}

// シングルトンインスタンス
export const errorTracker = new ErrorTracker();

// 使いやすいヘルパー関数
export const logError = errorTracker.logError.bind(errorTracker);
export const logCraftError = errorTracker.logCraftError.bind(errorTracker);
export const logFirestoreError =
  errorTracker.logFirestoreError.bind(errorTracker);
