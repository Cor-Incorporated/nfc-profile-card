"use client";

import React, { useState } from "react";
import { useEditor } from "@craftjs/core";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Text } from "./Text";
import { ImageUpload } from "./ImageUpload";
import { LinkButton } from "./LinkButton";
import { ProfileInfo } from "./ProfileInfo";
import { SocialLinksManager } from "../SocialLinksManager";
import { Plus, Type, Image, User, Link, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AddComponentPlaceholderProps {
  socialLinks?: any[];
  onSocialLinksChange?: (links: any[]) => void;
  userId?: string;
}

const getServiceColor = (service: string): string => {
  const colors: Record<string, string> = {
    twitter: "#1DA1F2",
    x: "#000000",
    instagram: "#E1306C",
    facebook: "#1877F2",
    linkedin: "#0077B5",
    github: "#333333",
    youtube: "#FF0000",
    tiktok: "#000000",
    pinterest: "#BD081C",
    whatsapp: "#25D366",
    telegram: "#0088CC",
    discord: "#5865F2",
    twitch: "#9146FF",
    spotify: "#1DB954",
    reddit: "#FF4500",
  };

  return colors[service.toLowerCase()] || "#3B82F6";
};

// グローバルハンドラーを参照
declare global {
  interface Window {
    __socialLinksHandler?: (links: any[]) => void;
  }
}

export function AddComponentPlaceholder({
  socialLinks = [],
  onSocialLinksChange,
  userId,
}: AddComponentPlaceholderProps) {
  const { connectors } = useEditor();
  const [isOpen, setIsOpen] = useState(false);

  // グローバルハンドラーを使用
  const effectiveOnSocialLinksChange = onSocialLinksChange || window.__socialLinksHandler;

  console.log('[AddComponentPlaceholder] Props and globals:', {
    socialLinksCount: socialLinks?.length || 0,
    hasOnSocialLinksChange: !!onSocialLinksChange,
    hasGlobalHandler: !!window.__socialLinksHandler,
    hasEffectiveHandler: !!effectiveOnSocialLinksChange,
    userId: userId || 'not provided',
    isOpen
  });

  return (
    <div className="add-component-button-container">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="add-button"
          >
            <Plus className="h-6 w-6 mr-2" />
            コンポーネントを追加
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="center">
          <div className="h-96">
            <Tabs defaultValue="components" className="h-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="components">要素</TabsTrigger>
                <TabsTrigger value="links">リンク</TabsTrigger>
              </TabsList>

              <TabsContent
                value="components"
                className="p-4 h-full overflow-y-auto"
              >
                <div className="space-y-2">
                  <div
                    ref={(ref: any) =>
                      connectors.create(ref, <Text text="新しいテキスト" fontSize={16} />)
                    }
                    className="flex items-center gap-2 p-3 bg-background border rounded-lg hover:bg-muted cursor-move transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <Type className="h-4 w-4" />
                    <span className="text-sm">テキスト</span>
                  </div>

                  <div
                    ref={(ref: any) =>
                      connectors.create(ref, <ImageUpload />)
                    }
                    className="flex items-center gap-2 p-3 bg-background border rounded-lg hover:bg-muted cursor-move transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <Image className="h-4 w-4" />
                    <span className="text-sm">画像</span>
                  </div>

                  <div
                    ref={(ref: any) =>
                      connectors.create(ref, <ProfileInfo userId={userId || ""} />)
                    }
                    className="flex items-center gap-2 p-3 bg-background border rounded-lg hover:bg-muted cursor-move transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    <span className="text-sm">登録情報</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="links" className="p-4 h-full overflow-y-auto">
                {effectiveOnSocialLinksChange ? (
                  <>
                    <SocialLinksManager
                      links={socialLinks}
                      onChange={effectiveOnSocialLinksChange}
                    />

                    {socialLinks.length > 0 && (
                      <div className="mt-6 space-y-2">
                        <h3 className="text-sm font-semibold mb-2">
                          クリックしてページに追加
                        </h3>
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
                                    textColor="#FFFFFF"
                                  />
                                )
                              }
                              className="flex items-center gap-2 p-3 pr-10 bg-background border rounded-lg hover:bg-muted cursor-move transition-colors"
                              onClick={() => setIsOpen(false)}
                            >
                              <Link className="h-4 w-4" />
                              <span className="text-sm flex-1">
                                {link.title || link.service}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('[AddComponentPlaceholder] Removing link at index:', index);
                                if (effectiveOnSocialLinksChange) {
                                  const newLinks = socialLinks.filter(
                                    (_, i) => i !== index,
                                  );
                                  console.log('[AddComponentPlaceholder] New links after removal:', newLinks);
                                  effectiveOnSocialLinksChange(newLinks);
                                } else {
                                  console.error('[AddComponentPlaceholder] No handler available (neither prop nor global)!');
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
        </PopoverContent>
      </Popover>
    </div>
  );
}