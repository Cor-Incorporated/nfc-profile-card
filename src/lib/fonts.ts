// Google Fonts APIを使用した日本語フォントの定義
export const JAPANESE_FONTS = {
  'noto-sans': {
    name: 'Noto Sans JP',
    url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap',
    fallback: 'sans-serif',
  },
  'noto-serif': {
    name: 'Noto Serif JP',
    url: 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap',
    fallback: 'serif',
  },
  'sawarabi-mincho': {
    name: 'Sawarabi Mincho',
    url: 'https://fonts.googleapis.com/css2?family=Sawarabi+Mincho&display=swap',
    fallback: 'serif',
  },
  'sawarabi-gothic': {
    name: 'Sawarabi Gothic',
    url: 'https://fonts.googleapis.com/css2?family=Sawarabi+Gothic&display=swap',
    fallback: 'sans-serif',
  },
  'kosugi-maru': {
    name: 'Kosugi Maru',
    url: 'https://fonts.googleapis.com/css2?family=Kosugi+Maru&display=swap',
    fallback: 'sans-serif',
  },
  'zen-maru-gothic': {
    name: 'Zen Maru Gothic',
    url: 'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700&display=swap',
    fallback: 'sans-serif',
  },
  'yusei-magic': {
    name: 'Yusei Magic',
    url: 'https://fonts.googleapis.com/css2?family=Yusei+Magic&display=swap',
    fallback: 'sans-serif',
  },
} as const;

// フォントを動的にロード
export function loadFont(fontKey: keyof typeof JAPANESE_FONTS) {
  const font = JAPANESE_FONTS[fontKey];
  if (!font) return;

  // すでにロードされているかチェック
  const existingLink = document.querySelector(`link[href="${font.url}"]`);
  if (existingLink) return;

  // フォントをロード
  const link = document.createElement('link');
  link.href = font.url;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}