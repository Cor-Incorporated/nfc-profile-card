import React, { useState } from 'react';
import { useNode, useEditor } from '@craftjs/core';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { X, Palette, Type, Bold } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import DOMPurify from 'dompurify';

interface TextProps {
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

export const Text = ({
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
}: TextProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [tempColor, setTempColor] = useState(color);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [fontSizePickerOpen, setFontSizePickerOpen] = useState(false);

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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (actions && id) {
      actions.delete(id);
    }
  };

  const handleColorChange = () => {
    setProp((props: any) => {
      props.color = tempColor;
    });
    setIsColorPickerOpen(false);
  };

  const handleFontChange = (font: string) => {
    setProp((props: any) => {
      props.fontFamily = font;
    });
    setFontPickerOpen(false);
  };

  const handleFontSizeChange = (size: number) => {
    setProp((props: any) => {
      props.fontSize = size;
    });
    setFontSizePickerOpen(false);
  };

  const handleFontWeightChange = (weight: string) => {
    setProp((props: any) => {
      props.fontWeight = weight;
    });
  };

  const fonts = [
    { value: 'sans-serif', label: 'サンセリフ' },
    { value: 'serif', label: 'セリフ' },
    { value: 'monospace', label: '等幅' },
    { value: 'cursive', label: '筆記体' },
    { value: 'fantasy', label: 'ファンタジー' },
    { value: 'system-ui', label: 'システム' },
    { value: '"Noto Sans JP", sans-serif', label: 'Noto Sans JP' },
    { value: '"Hiragino Sans", sans-serif', label: 'ヒラギノ角ゴ' },
  ];

  const fontSizes = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];
  const fontWeights = [
    { value: '300', label: '細字' },
    { value: 'normal', label: '標準' },
    { value: '500', label: '中太' },
    { value: 'bold', label: '太字' },
    { value: '800', label: '極太' },
  ];

  return (
    <div
      ref={(ref) => connect(drag(ref as any))}
      className="relative"
      style={{
        padding: `${padding}px`,
        fontSize: `${fontSize}px`,
        color: color,
        textAlign: textAlign,
        fontFamily: fontFamily,
        fontWeight: fontWeight,
        border: selected ? '2px solid #3B82F6' : 'none',
        cursor: 'text',
        minHeight: '40px',
        backgroundColor: backgroundColor !== 'transparent' ? `${backgroundColor}${Math.round(backgroundOpacity * 255).toString(16).padStart(2, '0')}` : 'transparent',
        backdropFilter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : 'none',
        borderRadius: '6px',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ホバー時のコントロール */}
      {selected && isHovered && (
        <div className="absolute -top-10 right-0 flex gap-1 z-50 bg-background border rounded-lg shadow-lg p-1">
          {/* カラーピッカー */}
          <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  setTempColor(color);
                }}
              >
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>文字色</Label>
                  <HexColorPicker
                    color={tempColor}
                    onChange={setTempColor}
                  />
                  <Input
                    value={tempColor}
                    onChange={(e) => setTempColor(e.target.value)}
                    placeholder="#000000"
                  />
                </div>
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

          {/* フォント選択 */}
          <Popover open={fontPickerOpen} onOpenChange={setFontPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                A
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="end">
              <div className="space-y-2">
                <Label>フォント</Label>
                <div className="space-y-1">
                  {fonts.map((font) => (
                    <Button
                      key={font.value}
                      variant={fontFamily === font.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleFontChange(font.value)}
                      className="w-full justify-start"
                      style={{ fontFamily: font.value }}
                    >
                      {font.label}
                    </Button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* フォントサイズ選択 */}
          <Popover open={fontSizePickerOpen} onOpenChange={setFontSizePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <Type className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="end">
              <div className="space-y-2">
                <Label>フォントサイズ</Label>
                <div className="grid grid-cols-3 gap-1">
                  {fontSizes.map((size) => (
                    <Button
                      key={size}
                      variant={fontSize === size ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleFontSizeChange(size)}
                      className="text-xs"
                    >
                      {size}px
                    </Button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* 太文字選択 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <Bold className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="end">
              <div className="space-y-2">
                <Label>文字の太さ</Label>
                <div className="space-y-1">
                  {fontWeights.map((weight) => (
                    <Button
                      key={weight.value}
                      variant={fontWeight === weight.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleFontWeightChange(weight.value)}
                      className="w-full justify-start"
                      style={{ fontWeight: weight.value }}
                    >
                      {weight.label}
                    </Button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* 削除ボタン */}
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

      <div
        contentEditable={selected}
        suppressContentEditableWarning
        onBlur={(e) => {
          // DOMPurifyで入力をサニタイズしてXSS攻撃を防ぐ
          const rawText = e.currentTarget.innerText;
          const sanitizedText = DOMPurify.sanitize(rawText, {
            ALLOWED_TAGS: [], // HTMLタグを許可しない（テキストのみ）
            ALLOWED_ATTR: []  // 属性も許可しない
          });
          setProp((props: any) => {
            props.text = sanitizedText;
          });
        }}
      >
        {text}
      </div>
    </div>
  );
};

// 設定パネルコンポーネント
const TextSettings = () => {
  const {
    actions: { setProp },
    text,
    fontSize,
    color,
    textAlign,
    backgroundColor,
    backgroundOpacity,
    backgroundBlur,
    fontFamily,
    padding
  } = useNode((node) => ({
    text: node.data.props.text,
    fontSize: node.data.props.fontSize,
    color: node.data.props.color,
    textAlign: node.data.props.textAlign,
    backgroundColor: node.data.props.backgroundColor,
    backgroundOpacity: node.data.props.backgroundOpacity,
    backgroundBlur: node.data.props.backgroundBlur,
    fontFamily: node.data.props.fontFamily,
    padding: node.data.props.padding,
  }));

  const fonts = [
    { value: 'sans-serif', label: 'サンセリフ' },
    { value: 'serif', label: 'セリフ' },
    { value: 'monospace', label: '等幅' },
    { value: 'cursive', label: '筆記体' },
    { value: 'fantasy', label: 'ファンタジー' },
    { value: 'system-ui', label: 'システム' },
    { value: '"Noto Sans JP", sans-serif', label: 'Noto Sans JP' },
    { value: '"Hiragino Sans", sans-serif', label: 'ヒラギノ角ゴ' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="text">テキスト内容</Label>
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
        />
      </div>

      <div>
        <Label htmlFor="fontFamily">フォント</Label>
        <select
          id="fontFamily"
          value={fontFamily || 'sans-serif'}
          onChange={(e) => {
            setProp((props: any) => {
              props.fontFamily = e.target.value;
            });
          }}
          className="w-full px-3 py-2 border rounded-md"
        >
          {fonts.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="fontSize">
          フォントサイズ: {fontSize}px
        </Label>
        <Slider
          id="fontSize"
          min={8}
          max={72}
          value={[fontSize]}
          onValueChange={(value: number[]) => {
            setProp((props: any) => {
              props.fontSize = value[0];
            });
          }}
        />
      </div>

      <div>
        <Label htmlFor="color">テキストカラー</Label>
        <div className="flex gap-2">
          <input
            id="color"
            type="color"
            value={color || '#000000'}
            onChange={(e) => {
              setProp((props: any) => {
                props.color = e.target.value;
              });
            }}
            className="h-10 w-20"
          />
          <Input
            value={color || '#000000'}
            onChange={(e) => {
              setProp((props: any) => {
                props.color = e.target.value;
              });
            }}
            placeholder="#000000"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="textAlign">テキスト配置</Label>
        <select
          id="textAlign"
          value={textAlign || 'left'}
          onChange={(e) => {
            setProp((props: any) => {
              props.textAlign = e.target.value;
            });
          }}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="left">左寄せ</option>
          <option value="center">中央</option>
          <option value="right">右寄せ</option>
        </select>
      </div>

      <div>
        <Label htmlFor="backgroundColor">背景色</Label>
        <div className="flex gap-2">
          <input
            id="backgroundColor"
            type="color"
            value={backgroundColor === 'transparent' ? '#ffffff' : backgroundColor || '#ffffff'}
            onChange={(e) => {
              setProp((props: any) => {
                props.backgroundColor = e.target.value;
              });
            }}
            className="h-10 w-20"
          />
          <Button
            variant={backgroundColor === 'transparent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setProp((props: any) => {
                props.backgroundColor = 'transparent';
              });
            }}
          >
            透明
          </Button>
        </div>
      </div>

      {backgroundColor !== 'transparent' && (
        <div>
          <Label htmlFor="backgroundOpacity">
            背景の透明度: {Math.round((backgroundOpacity || 0) * 100)}%
          </Label>
          <Slider
            id="backgroundOpacity"
            min={0}
            max={1}
            step={0.01}
            value={[backgroundOpacity || 0]}
            onValueChange={(value: number[]) => {
              setProp((props: any) => {
                props.backgroundOpacity = value[0];
              });
            }}
          />
        </div>
      )}

      <div>
        <Label htmlFor="backgroundBlur">
          背景ぼかし: {backgroundBlur || 0}px
        </Label>
        <Slider
          id="backgroundBlur"
          min={0}
          max={20}
          value={[backgroundBlur || 0]}
          onValueChange={(value: number[]) => {
            setProp((props: any) => {
              props.backgroundBlur = value[0];
            });
          }}
        />
      </div>

      <div>
        <Label htmlFor="padding">
          余白: {padding || 10}px
        </Label>
        <Slider
          id="padding"
          min={0}
          max={50}
          value={[padding || 10]}
          onValueChange={(value: number[]) => {
            setProp((props: any) => {
              props.padding = value[0];
            });
          }}
        />
      </div>
    </div>
  );
};

// Craft.jsの設定（必須）
Text.craft = {
  displayName: 'テキスト',
  props: {
    text: 'クリックして編集',
    fontSize: 16,
    color: '#000000',
    textAlign: 'left',
    backgroundColor: 'transparent',
    backgroundOpacity: 0,
    backgroundBlur: 0,
    fontFamily: 'sans-serif',
    padding: 10,
    fontWeight: 'normal'
  },
  related: {
    settings: TextSettings  // これが重要：設定パネルとの関連付け
  }
};