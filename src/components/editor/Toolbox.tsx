import React from 'react';
import { useEditor, Element } from '@craftjs/core';
import { Text } from './editableComponents/Text';
import { ImageUpload } from './editableComponents/ImageUpload';
import { LinkButton } from './editableComponents/LinkButton';
import { ProfileInfo } from './editableComponents/ProfileInfo';
import { SocialLinksManager } from './SocialLinksManager';
import { Type, Square, Image, Link, X, Palette, Layers, User } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ToolboxProps {
  socialLinks?: any[];
  onSocialLinksChange?: (links: any[]) => void;
  userId?: string;
}

const getServiceColor = (service: string): string => {
  const colors: Record<string, string> = {
    twitter: '#1DA1F2',
    x: '#000000',
    instagram: '#E1306C',
    facebook: '#1877F2',
    linkedin: '#0077B5',
    github: '#333333',
    youtube: '#FF0000',
    tiktok: '#000000',
    pinterest: '#BD081C',
    whatsapp: '#25D366',
    telegram: '#0088CC',
    discord: '#5865F2',
    twitch: '#9146FF',
    spotify: '#1DB954',
    reddit: '#FF4500'
  };

  return colors[service.toLowerCase()] || '#3B82F6';
};

export function Toolbox({ socialLinks = [], onSocialLinksChange, userId }: ToolboxProps) {
  const { connectors } = useEditor();

  return (
    <div className="h-full">
      <Tabs defaultValue="components" className="h-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="components">要素</TabsTrigger>
          <TabsTrigger value="links">リンク</TabsTrigger>
        </TabsList>

        <TabsContent value="components" className="p-4">
          <div className="space-y-2">
        <div
          ref={(ref: any) =>
            connectors.create(ref, <Text text="新しいテキスト" fontSize={16} />)
          }
          className="flex items-center gap-2 p-3 bg-background border rounded-lg hover:bg-muted cursor-move transition-colors"
        >
          <Type className="h-4 w-4" />
          <span className="text-sm">テキスト</span>
        </div>

        <div
          ref={(ref: any) =>
            connectors.create(ref, <ImageUpload />)
          }
          className="flex items-center gap-2 p-3 bg-background border rounded-lg hover:bg-muted cursor-move transition-colors"
        >
          <Image className="h-4 w-4" aria-label="画像アイコン" />
          <span className="text-sm">画像</span>
        </div>

        <div
          ref={(ref: any) =>
            connectors.create(ref, <ProfileInfo userId={userId || ''} />)
          }
          className="flex items-center gap-2 p-3 bg-background border rounded-lg hover:bg-muted cursor-move transition-colors"
        >
          <User className="h-4 w-4" />
          <span className="text-sm">登録情報</span>
        </div>

          </div>
        </TabsContent>

        <TabsContent value="links" className="p-4">
          {onSocialLinksChange ? (
            <>
              <SocialLinksManager
                links={socialLinks}
                onChange={onSocialLinksChange}
              />

              {socialLinks.length > 0 && (
                <div className="mt-6 space-y-2">
                  <h3 className="text-sm font-semibold mb-2">ドラッグしてページに追加</h3>
                  {socialLinks.map((link, index) => (
                    <div key={index} className="group relative">
                      <div
                        ref={(ref: any) =>
                          connectors.create(
                            ref,
                            <LinkButton
                              text={link.title || link.service}
                              url={link.url}
                              backgroundColor={getServiceColor(link.service)}
                              width="100%"
                              textColor="#FFFFFF"
                            />
                          )
                        }
                        className="flex items-center gap-2 p-3 pr-10 bg-background border rounded-lg hover:bg-muted cursor-move transition-colors"
                      >
                        <Link className="h-4 w-4" />
                        <span className="text-sm flex-1">{link.title || link.service}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          if (onSocialLinksChange) {
                            const newLinks = socialLinks.filter((_, i) => i !== index);
                            onSocialLinksChange(newLinks);
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              ソーシャルリンクの設定が必要です
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}