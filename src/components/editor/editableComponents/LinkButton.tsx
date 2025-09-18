'use client';

import React, { useState } from 'react';
import { useNode, useEditor } from '@craftjs/core';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { HexColorPicker } from 'react-colorful';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Link2,
  Twitter,
  Github,
  Linkedin,
  Instagram,
  Facebook,
  Youtube,
  Globe,
  Mail,
  Phone,
  X,
  Palette
} from 'lucide-react';
import DOMPurify from 'dompurify';

interface LinkButtonProps {
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
  link: Link2,
};

const getIconForUrl = (url: string): string => {
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('github.com')) return 'github';
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com')) return 'facebook';
  if (url.includes('youtube.com')) return 'youtube';
  if (url.startsWith('mailto:')) return 'mail';
  if (url.startsWith('tel:')) return 'phone';
  if (url.startsWith('http')) return 'globe';
  return 'link';
};

export const LinkButton = ({
  text = 'リンクボタン',
  url = 'https://example.com',
  backgroundColor = '#3B82F6',
  textColor = '#FFFFFF',
  borderRadius = 8,
  icon = 'auto',
  target = '_blank',
  width = '100%',
  padding = '12px 24px',
  backgroundOpacity = 1,
  backgroundBlur = 0,
  fontFamily = 'sans-serif'
}: LinkButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [tempBgColor, setTempBgColor] = useState(backgroundColor);
  const [tempTextColor, setTempTextColor] = useState(textColor);
  const [colorPickerMode, setColorPickerMode] = useState<'bg' | 'text'>('bg');

  const {
    connectors: { connect, drag },
    actions: { setProp },
    selected,
    id
  } = useNode((state) => ({
    selected: state.events.selected,
    id: state.id
  }));

  const { actions } = useEditor();

  const iconName = icon === 'auto' ? getIconForUrl(url) : icon;
  const IconComponent = iconName && iconName !== 'none' ? iconMap[iconName] : null;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (actions && id) {
      actions.delete(id);
    }
  };

  const handleColorChange = () => {
    setProp((props: any) => {
      if (colorPickerMode === 'bg') {
        props.backgroundColor = tempBgColor;
      } else {
        props.textColor = tempTextColor;
      }
    });
    setIsColorPickerOpen(false);
  };

  return (
    <div
      ref={(ref) => connect(drag(ref as any))}
      className="relative group"
      style={{
        width,
        padding: '4px',
        border: selected ? '2px solid #3B82F6' : 'none',
        borderRadius: `${borderRadius + 4}px`,
        cursor: 'pointer'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ホバー時のコントロール */}
      {selected && isHovered && (
        <div className="absolute -top-10 right-0 flex gap-1 z-50 bg-background border rounded-lg shadow-lg p-1">
          <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  setColorPickerMode('bg');
                  setTempBgColor(backgroundColor);
                  setTempTextColor(textColor);
                }}
              >
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>カラー設定</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={colorPickerMode === 'bg' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setColorPickerMode('bg')}
                    >
                      背景色
                    </Button>
                    <Button
                      variant={colorPickerMode === 'text' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setColorPickerMode('text')}
                    >
                      文字色
                    </Button>
                  </div>
                </div>
                <HexColorPicker
                  color={colorPickerMode === 'bg' ? tempBgColor : tempTextColor}
                  onChange={(color) => {
                    if (colorPickerMode === 'bg') {
                      setTempBgColor(color);
                    } else {
                      setTempTextColor(color);
                    }
                  }}
                />
                <Input
                  value={colorPickerMode === 'bg' ? tempBgColor : tempTextColor}
                  onChange={(e) => {
                    if (colorPickerMode === 'bg') {
                      setTempBgColor(e.target.value);
                    } else {
                      setTempTextColor(e.target.value);
                    }
                  }}
                  placeholder="#000000"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleColorChange}
                  >
                    適用
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsColorPickerOpen(false)}
                  >
                    キャンセル
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
            onClick={handleDelete}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <a
        href={url}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          backgroundColor: (() => {
            const bgColor = colorPickerMode === 'bg' && isColorPickerOpen ? tempBgColor : backgroundColor;
            const hex = bgColor.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            return `rgba(${r}, ${g}, ${b}, ${backgroundOpacity})`;
          })(),
          color: colorPickerMode === 'text' && isColorPickerOpen ? tempTextColor : textColor,
          borderRadius: `${borderRadius}px`,
          padding,
          textDecoration: 'none',
          transition: 'opacity 0.2s',
          width: '100%',
          fontFamily: fontFamily,
          backdropFilter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : 'none',
          WebkitBackdropFilter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : 'none',
        }}
        className="hover:opacity-90"
        onClick={(e) => {
          if (selected) {
            e.preventDefault(); // 編集モードではリンクを無効化
          }
        }}
      >
        {IconComponent && <IconComponent size={20} />}
        {text}
      </a>
    </div>
  );
};

// 設定パネルコンポーネント
const LinkButtonSettings = () => {
  const {
    actions: { setProp },
    text,
    url,
    backgroundColor,
    textColor,
    borderRadius,
    icon,
    target,
    width,
    padding
  } = useNode((node) => ({
    text: node.data.props.text,
    url: node.data.props.url,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    borderRadius: node.data.props.borderRadius,
    icon: node.data.props.icon,
    target: node.data.props.target,
    width: node.data.props.width,
    padding: node.data.props.padding,
  }));

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="text">ボタンテキスト</Label>
        <Input
          id="text"
          value={text || ''}
          onChange={(e) => {
            const sanitizedText = DOMPurify.sanitize(e.target.value, {
              ALLOWED_TAGS: [],
              ALLOWED_ATTR: []
            });
            setProp((props: any) => {
              props.text = sanitizedText;
            });
          }}
          placeholder="ボタンのテキスト"
        />
      </div>

      <div>
        <Label htmlFor="url">リンクURL</Label>
        <Input
          id="url"
          value={url || ''}
          onChange={(e) => {
            setProp((props: any) => {
              props.url = e.target.value;
              // URLに基づいてアイコンを自動設定
              if (props.icon === 'auto') {
                props.icon = 'auto';
              }
            });
          }}
          placeholder="https://example.com"
        />
      </div>

      <div>
        <Label htmlFor="backgroundColor">背景色</Label>
        <div className="space-y-2">
          <HexColorPicker
            color={backgroundColor || '#3B82F6'}
            onChange={(color) => {
              setProp((props: any) => {
                props.backgroundColor = color;
              });
            }}
          />
          <Input
            value={backgroundColor || '#3B82F6'}
            onChange={(e) => {
              setProp((props: any) => {
                props.backgroundColor = e.target.value;
              });
            }}
            placeholder="#3B82F6"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="textColor">テキスト色</Label>
        <div className="space-y-2">
          <HexColorPicker
            color={textColor || '#FFFFFF'}
            onChange={(color) => {
              setProp((props: any) => {
                props.textColor = color;
              });
            }}
          />
          <Input
            value={textColor || '#FFFFFF'}
            onChange={(e) => {
              setProp((props: any) => {
                props.textColor = e.target.value;
              });
            }}
            placeholder="#FFFFFF"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="borderRadius">
          角丸: {borderRadius}px
        </Label>
        <Slider
          id="borderRadius"
          min={0}
          max={50}
          value={[borderRadius || 8]}
          onValueChange={(value: number[]) => {
            setProp((props: any) => {
              props.borderRadius = value[0];
            });
          }}
        />
      </div>

      <div>
        <Label htmlFor="icon">アイコン</Label>
        <select
          id="icon"
          value={icon || 'auto'}
          onChange={(e) => {
            setProp((props: any) => {
              props.icon = e.target.value;
            });
          }}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="auto">自動選択</option>
          <option value="none">アイコンなし</option>
          <option value="twitter">Twitter</option>
          <option value="github">GitHub</option>
          <option value="linkedin">LinkedIn</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="youtube">YouTube</option>
          <option value="globe">ウェブサイト</option>
          <option value="mail">メール</option>
          <option value="phone">電話</option>
          <option value="link">リンク</option>
        </select>
      </div>

      <div>
        <Label htmlFor="target">リンクの開き方</Label>
        <select
          id="target"
          value={target || '_blank'}
          onChange={(e) => {
            setProp((props: any) => {
              props.target = e.target.value;
            });
          }}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="_blank">新しいタブで開く</option>
          <option value="_self">同じタブで開く</option>
        </select>
      </div>

      <div>
        <Label htmlFor="width">幅</Label>
        <Input
          id="width"
          value={width || '100%'}
          onChange={(e) => {
            setProp((props: any) => {
              props.width = e.target.value;
            });
          }}
          placeholder="100% または 200px"
        />
      </div>
    </div>
  );
};

// Craft.jsの設定
LinkButton.craft = {
  displayName: 'リンクボタン',
  props: {
    text: 'リンクボタン',
    url: 'https://example.com',
    backgroundColor: '#3B82F6',
    textColor: '#FFFFFF',
    borderRadius: 8,
    icon: 'auto',
    target: '_blank',
    width: '100%',
    padding: '12px 24px',
    backgroundOpacity: 1,
    backgroundBlur: 0,
    fontFamily: 'sans-serif'
  },
  related: {
    settings: LinkButtonSettings
  }
};