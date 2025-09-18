import { Timestamp } from "firebase/firestore";

// ユーザー情報
export interface User {
  uid: string; // Firebase User ID
  username: string; // ユニークなユーザー名
  email: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;

  // プロフィール情報
  profile: UserProfile;

  // NFCカード情報
  cards: NFCCard[];

  // サブスクリプション情報
  subscription: Subscription;

  // セキュリティ
  security?: SecurityInfo;

  // 削除フラグ
  deleted?: boolean;
  deletedAt?: Timestamp | Date;
}

// プロフィール詳細
export interface UserProfile {
  name: string;
  company?: string;
  title?: string;
  bio?: string;
  avatarUrl?: string;
  links: ProfileLink[];
  theme?: ProfileTheme; // 追加
  contextualProfiles?: ContextualProfile[]; // 追加
  activeProfileId?: string; // 追加
}

// デザインカスタマイズ設定
export interface ProfileTheme {
  // 背景設定
  backgroundType: "solid" | "gradient" | "image" | "pattern";
  backgroundColor?: string;
  backgroundGradient?: {
    from: string;
    to: string;
    direction: "to-r" | "to-b" | "to-br" | "to-bl";
  };
  backgroundImage?: string; // Firebase Storage URL
  backgroundPattern?: string; // hero-patterns identifier

  // フォント設定
  fontFamily?:
    | "noto-sans"
    | "noto-serif"
    | "sawarabi-mincho"
    | "sawarabi-gothic"
    | "kosugi-maru"
    | "zen-maru-gothic"
    | "yusei-magic";
  fontColor?: string;

  // レイアウト設定
  layoutType: "list" | "grid" | "bento" | "card";
  buttonStyle?: "solid" | "outline" | "ghost" | "gradient";
  buttonRadius?: "none" | "sm" | "md" | "lg" | "full";

  // アニメーション
  enableAnimations?: boolean;
  animationType?: "fade" | "slide" | "bounce";
}

// コンテキスチュアル・プロファイル
export interface ContextualProfile {
  id: string;
  name: string;
  context: "business" | "creative" | "sales" | "personal";
  theme: ProfileTheme;
  content: CraftJsSerializedData;
  isActive: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// Craft.jsのシリアライズデータ型
export interface CraftJsSerializedData {
  ROOT: any; // Craft.jsが生成する構造
}

// コンテクスチュアル・プロファイルのコンテキスト列挙
export type ProfileContextType = 'business' | 'creator' | 'sales' | 'personal';

// 新しいプロファイル構造（profiles サブコレクション用）
export interface Profile {
  id: string;
  name: string;
  context: ProfileContextType;
  description?: string;
  isActive: boolean;
  isDefault?: boolean;
  editorContent?: any;
  background?: BackgroundSettings;
  backgroundColor?: string;
  backgroundImage?: string | null;
  backgroundGradient?: any;
  backgroundOpacity?: number;
  socialLinks?: SocialLink[];
  customFields?: Record<string, any>;
  fontSettings?: {
    family: string;
    size: string;
    color: string;
  };
  analytics?: {
    views: number;
    clicks: number;
    lastViewed: Timestamp | Date | null;
  };
  priority?: number;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// コンテクスチュアル・プロファイル（後方互換性のため維持）
export interface ProfileContext {
  id: string;
  userId: string;
  name: string;  // "ビジネス", "クリエイター", "セールス" など
  description?: string;
  isActive: boolean;
  editorContent?: any;  // Craft.jsのコンテンツ
  background?: BackgroundSettings;
  socialLinks?: SocialLink[];
  priority: number;  // 表示優先度
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// プロフィールリンク
export interface ProfileLink {
  url: string;
  label?: string; // カスタムラベル
  service?: string; // 自動認識されたサービス名
  icon?: string; // アイコン識別子
  order: number; // 表示順
}

// NFCカード情報
export interface NFCCard {
  id: string;
  userId: string;
  serialNumber: string;
  nickname?: string;
  assignedProfileId?: string;  // 割り当てられたプロファイルID
  isActive: boolean;
  lastTapped?: Timestamp | Date;
  tapCount: number;
  createdAt: Timestamp | Date;
}

// 背景設定
export interface BackgroundSettings {
  type: "solid" | "gradient" | "image" | "pattern";
  color?: string;
  gradient?: {
    from: string;
    to: string;
    direction: string;
  };
  image?: string;
  pattern?: string;
}

// ソーシャルリンク
export interface SocialLink {
  id: string;
  title: string;
  url: string;
  icon?: string;
  order: number;
}

// サブスクリプション情報
export interface Subscription {
  plan: "free" | "premium";
  expiresAt?: Timestamp | Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

// セキュリティ情報
export interface SecurityInfo {
  oneTimeToken?: string; // ワンタイムURL用
  tokenExpiresAt?: Timestamp | Date;
}

// 連絡先情報
export interface Contact {
  id: string;
  scannedAt: Timestamp | Date;
  location?: string; // 出会った場所
  event?: string; // イベント名
  notes?: string; // プライベートメモ
  contactInfo: ContactInfo;
  vCardData?: string;
}

// 連絡先詳細
export interface ContactInfo {
  name: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  profileUrl?: string;
  address?: string;
}

// アナリティクス情報
export interface Analytics {
  date: string; // YYYY-MM-DD
  views: number;
  uniqueVisitors: number;
  linkClicks: Record<string, number>;
  cardTaps: number;
}

// 注文情報
export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: "pending" | "processing" | "completed" | "cancelled";
  stripePaymentIntentId?: string;
  shippingAddress: ShippingAddress;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// 注文アイテム
export interface OrderItem {
  type: "nfc_card";
  quantity: number;
  pricePerUnit: number;
  cardIds?: string[]; // 割り当てられたカードID
}

// 配送先住所
export interface ShippingAddress {
  name: string;
  postalCode: string;
  prefecture: string;
  city: string;
  address1: string;
  address2?: string;
  phone: string;
  email: string;
}

// OCRレスポンス
export interface OCRResponse {
  success: boolean;
  data?: ContactInfo;
  vcard?: string;
  error?: string;
}

// サービスアイコン定義
export interface ServiceIcon {
  icon: string;
  color: string;
  name?: string;
}

// サポートするサービス一覧
export const SUPPORTED_SERVICES: Record<string, ServiceIcon> = {
  // SNS
  "twitter.com": { icon: "FaTwitter", color: "#1DA1F2", name: "Twitter" },
  "x.com": { icon: "FaXTwitter", color: "#000000", name: "X" },
  "instagram.com": { icon: "FaInstagram", color: "#E4405F", name: "Instagram" },
  "facebook.com": { icon: "FaFacebook", color: "#1877F2", name: "Facebook" },
  "linkedin.com": { icon: "FaLinkedin", color: "#0077B5", name: "LinkedIn" },
  "tiktok.com": { icon: "FaTiktok", color: "#000000", name: "TikTok" },
  "youtube.com": { icon: "FaYoutube", color: "#FF0000", name: "YouTube" },

  // 開発者向け
  "github.com": { icon: "FaGithub", color: "#333333", name: "GitHub" },
  "gitlab.com": { icon: "FaGitlab", color: "#FC6D26", name: "GitLab" },
  "bitbucket.org": { icon: "FaBitbucket", color: "#0052CC", name: "Bitbucket" },
  "stackoverflow.com": {
    icon: "FaStackOverflow",
    color: "#F58025",
    name: "Stack Overflow",
  },

  // 日本のサービス
  "zenn.dev": { icon: "SiZenn", color: "#3EA8FF", name: "Zenn" },
  "qiita.com": { icon: "SiQiita", color: "#55C500", name: "Qiita" },
  "note.com": { icon: "SiNote", color: "#41C9B4", name: "note" },
  "connpass.com": { icon: "Calendar", color: "#E53935", name: "connpass" },

  // クリエイター向け
  "behance.net": { icon: "FaBehance", color: "#1769FF", name: "Behance" },
  "dribbble.com": { icon: "FaDribbble", color: "#EA4C89", name: "Dribbble" },
  "pinterest.com": { icon: "FaPinterest", color: "#E60023", name: "Pinterest" },
  "deviantart.com": {
    icon: "FaDeviantart",
    color: "#05CC47",
    name: "DeviantArt",
  },

  // その他
  "medium.com": { icon: "FaMedium", color: "#000000", name: "Medium" },
  "reddit.com": { icon: "FaReddit", color: "#FF4500", name: "Reddit" },
  "discord.com": { icon: "FaDiscord", color: "#5865F2", name: "Discord" },
  "slack.com": { icon: "FaSlack", color: "#4A154B", name: "Slack" },
  "twitch.tv": { icon: "FaTwitch", color: "#9146FF", name: "Twitch" },
  "spotify.com": { icon: "FaSpotify", color: "#1DB954", name: "Spotify" },
  "soundcloud.com": {
    icon: "FaSoundcloud",
    color: "#FF3300",
    name: "SoundCloud",
  },
  "patreon.com": { icon: "FaPatreon", color: "#F96854", name: "Patreon" },

  // デフォルト
  default: { icon: "FaLink", color: "#718096", name: "Link" },
};

// VCard形式
export interface VCard {
  version: string;
  fn: string; // Full Name
  n?: string; // Name (Last;First;Middle;Prefix;Suffix)
  org?: string; // Organization
  title?: string; // Job Title
  email?: string;
  tel?: string;
  url?: string;
  adr?: string; // Address
  note?: string;
}
