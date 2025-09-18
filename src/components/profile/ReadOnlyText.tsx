import DOMPurify from 'dompurify';

interface ReadOnlyTextProps {
  text: string;
  fontSize: number;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  backgroundOpacity?: number;
  backgroundBlur?: number;
  fontFamily?: string;
  padding?: number;
  fontWeight?: 'normal' | 'bold' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
}

export const ReadOnlyText = ({
  text = 'クリックして編集',
  fontSize = 16,
  color = '#000000',
  textAlign = 'left',
  backgroundColor = 'transparent',
  backgroundOpacity = 0,
  backgroundBlur = 0,
  fontFamily = 'sans-serif',
  padding = 10,
  fontWeight = 'normal'
}: ReadOnlyTextProps) => {
  // テキストをサニタイズ
  const sanitizedText = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // HTMLタグを許可しない（テキストのみ）
    ALLOWED_ATTR: []  // 属性も許可しない
  });

  return (
    <div
      className="relative"
      style={{
        padding: `${padding}px`,
        fontSize: `${fontSize}px`,
        color: color,
        textAlign: textAlign,
        fontFamily: fontFamily,
        fontWeight: fontWeight,
        minHeight: '40px',
        backgroundColor: backgroundColor !== 'transparent' ? `${backgroundColor}${Math.round(backgroundOpacity * 255).toString(16).padStart(2, '0')}` : 'transparent',
        backdropFilter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : 'none',
        borderRadius: '6px',
      }}
    >
      {sanitizedText}
    </div>
  );
};
