/**
 * 環境に応じたログ出力を制御するユーティリティ
 */

const isDevelopment = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";
const isProduction = process.env.NODE_ENV === "production";

// ログレベルの定義
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

// 環境に応じたデフォルトログレベル
const getDefaultLogLevel = (): LogLevel => {
  if (isTest) return LogLevel.NONE; // テスト時はログを出力しない
  if (isProduction) return LogLevel.ERROR; // 本番環境はエラーのみ
  return LogLevel.DEBUG; // 開発環境はすべて出力
};

const currentLogLevel = getDefaultLogLevel();

/**
 * ログ出力クラス
 */
class Logger {
  private prefix: string;
  private logLevel: LogLevel;

  constructor(prefix: string = "", logLevel?: LogLevel) {
    this.prefix = prefix;
    this.logLevel = logLevel ?? currentLogLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(...args: any[]): any[] {
    if (this.prefix) {
      return [`[${this.prefix}]`, ...args];
    }
    return args;
  }

  debug(...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(...this.formatMessage(...args));
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(...this.formatMessage(...args));
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(...this.formatMessage(...args));
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(...this.formatMessage(...args));
    }
  }

  // グループ化されたログ出力
  group(label: string, fn: () => void): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.group(this.prefix ? `[${this.prefix}] ${label}` : label);
      fn();
      console.groupEnd();
    } else {
      fn();
    }
  }

  // タイミング測定
  time(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.time(this.prefix ? `[${this.prefix}] ${label}` : label);
    }
  }

  timeEnd(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.timeEnd(this.prefix ? `[${this.prefix}] ${label}` : label);
    }
  }
}

// デフォルトのloggerインスタンス
export const logger = new Logger();

// 特定のモジュール用のloggerを作成
export const createLogger = (prefix: string, logLevel?: LogLevel): Logger => {
  return new Logger(prefix, logLevel);
};

// OCRサービス専用のlogger
export const ocrLogger = createLogger("OCR");

// 認証関連のlogger
export const authLogger = createLogger("Auth");

// API関連のlogger
export const apiLogger = createLogger("API");