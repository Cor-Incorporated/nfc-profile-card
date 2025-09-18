import DOMPurify from 'dompurify';
import {
    Facebook,
    Github,
    Globe,
    Instagram,
    Link2,
    Linkedin,
    Mail,
    Phone,
    Twitter,
    X,
    Youtube,
} from 'lucide-react';
import React from 'react';

interface ReadOnlyLinkButtonProps {
  text: string;
  url: string;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: number;
  icon?: string;
  target?: '_blank' | '_self';
  width?: string;
  padding?: string;
  backgroundOpacity?: number;
  backgroundBlur?: number;
  fontFamily?: string;
}

const iconMap: Record<string, React.FC<any>> = {
  twitter: Twitter,
  github: Github,
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
  globe: Globe,
  mail: Mail,
  phone: Phone,
  x: X,
  link: Link2,
};

export const ReadOnlyLinkButton = ({
  text = 'リンク',
  url = '#',
  backgroundColor = '#3B82F6',
  textColor = '#FFFFFF',
  borderRadius = 8,
  icon = 'link',
  target = '_blank',
  width = 'auto',
  padding = '12px 24px',
  backgroundOpacity = 1,
  backgroundBlur = 0,
  fontFamily = 'sans-serif'
}: ReadOnlyLinkButtonProps) => {
  const IconComponent = iconMap[icon] || Link2;

  // テキストをサニタイズ
  const sanitizedText = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });

  // URLをサニタイズ（基本的な検証）
  const sanitizedUrl = DOMPurify.sanitize(url, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });

  // 背景色の透明度を適用
  const finalBackgroundColor = backgroundColor !== 'transparent' 
    ? `${backgroundColor}${Math.round(backgroundOpacity * 255).toString(16).padStart(2, '0')}` 
    : 'transparent';

  return (
    <a
      href={sanitizedUrl}
      target={target}
      rel={target === '_blank' ? 'noopener noreferrer' : undefined}
      className="inline-flex items-center gap-2 transition-all duration-200 hover:scale-105 hover:shadow-lg"
      style={{
        backgroundColor: finalBackgroundColor,
        color: textColor,
        borderRadius: `${borderRadius}px`,
        width: width,
        padding: padding,
        fontFamily: fontFamily,
        backdropFilter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : 'none',
        textDecoration: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
      }}
    >
      <IconComponent className="w-4 h-4" />
      <span>{sanitizedText}</span>
    </a>
  );
};
