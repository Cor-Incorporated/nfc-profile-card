import {
  Noto_Sans_JP,
  // Noto_Serif_JP,
  // M_PLUS_1p,
  // M_PLUS_Rounded_1c,
  // Sawarabi_Mincho,
  // Sawarabi_Gothic,
  // Kosugi_Maru,
  // Zen_Maru_Gothic
} from 'next/font/google';

// 主要フォント（よく使うもの）
export const notoSansJP = Noto_Sans_JP({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-sans-jp',
  preload: false, // パフォーマンス改善のためpreloadを無効化
});

// 以下のフォントは使用頻度が低いため、動的ロードに変更またはコメントアウト
// エディター機能でのみ使用されるため、必要時のみロード

// export const notoSerifJP = Noto_Serif_JP({
//   weight: ['400', '700'],
//   subsets: ['latin'],
//   display: 'swap',
//   variable: '--font-noto-serif-jp',
// });

// export const mPlus1p = M_PLUS_1p({
//   weight: ['400', '700'],
//   subsets: ['latin'],
//   display: 'swap',
//   variable: '--font-mplus-1p',
//   preload: false,
// });

// export const mPlusRounded = M_PLUS_Rounded_1c({
//   weight: ['400', '700'],
//   subsets: ['latin'],
//   display: 'swap',
//   variable: '--font-mplus-rounded',
// });

// export const sawarabiMincho = Sawarabi_Mincho({
//   weight: '400',
//   subsets: ['latin'],
//   display: 'swap',
//   variable: '--font-sawarabi-mincho',
// });

// export const sawarabiGothic = Sawarabi_Gothic({
//   weight: '400',
//   subsets: ['latin'],
//   display: 'swap',
//   variable: '--font-sawarabi-gothic',
// });

// export const kosugiMaru = Kosugi_Maru({
//   weight: '400',
//   subsets: ['latin'],
//   display: 'swap',
//   variable: '--font-kosugi-maru',
// });

// export const zenMaruGothic = Zen_Maru_Gothic({
//   weight: ['400', '700'],
//   subsets: ['latin'],
//   display: 'swap',
//   variable: '--font-zen-maru',
//   preload: false,
// });

// フォントリスト（エディターで使用）
// パフォーマンス最適化のため、一部のフォントを一時的に無効化
export const JAPANESE_FONTS = [
  { value: 'noto-sans-jp', label: 'Noto Sans JP（ゴシック）', className: 'font-noto-sans-jp' },
  // { value: 'noto-serif-jp', label: 'Noto Serif JP（明朝）', className: 'font-noto-serif-jp' },
  // { value: 'mplus-1p', label: 'M PLUS 1p（モダン）', className: 'font-mplus-1p' },
  // { value: 'mplus-rounded', label: 'M PLUS Rounded（丸ゴシック）', className: 'font-mplus-rounded' },
  // { value: 'sawarabi-mincho', label: 'さわらび明朝（エレガント）', className: 'font-sawarabi-mincho' },
  // { value: 'sawarabi-gothic', label: 'さわらびゴシック（クリーン）', className: 'font-sawarabi-gothic' },
  // { value: 'kosugi-maru', label: '小杉丸ゴシック（やわらか）', className: 'font-kosugi-maru' },
  // { value: 'zen-maru', label: 'Zen丸ゴシック（親しみやすい）', className: 'font-zen-maru' },
];

// レガシーサポート用（既存コードとの互換性のため）
export const JAPANESE_FONTS_LEGACY = {
  "noto-sans": {
    name: "Noto Sans JP",
    url: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap",
    fallback: "sans-serif",
  },
  "noto-serif": {
    name: "Noto Serif JP",
    url: "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap",
    fallback: "serif",
  },
  "sawarabi-mincho": {
    name: "Sawarabi Mincho",
    url: "https://fonts.googleapis.com/css2?family=Sawarabi+Mincho&display=swap",
    fallback: "serif",
  },
  "sawarabi-gothic": {
    name: "Sawarabi Gothic",
    url: "https://fonts.googleapis.com/css2?family=Sawarabi+Gothic&display=swap",
    fallback: "sans-serif",
  },
  "kosugi-maru": {
    name: "Kosugi Maru",
    url: "https://fonts.googleapis.com/css2?family=Kosugi+Maru&display=swap",
    fallback: "sans-serif",
  },
  "zen-maru-gothic": {
    name: "Zen Maru Gothic",
    url: "https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700&display=swap",
    fallback: "sans-serif",
  },
} as const;

// フォントを動的にロード（レガシーサポート）
export function loadFont(fontKey: keyof typeof JAPANESE_FONTS_LEGACY) {
  const font = JAPANESE_FONTS_LEGACY[fontKey];
  if (!font) return;

  // すでにロードされているかチェック
  const existingLink = document.querySelector(`link[href="${font.url}"]`);
  if (existingLink) return;

  // フォントをロード
  const link = document.createElement("link");
  link.href = font.url;
  link.rel = "stylesheet";
  document.head.appendChild(link);
}