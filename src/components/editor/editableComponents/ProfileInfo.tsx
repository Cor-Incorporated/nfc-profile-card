'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import { uploadCompressedImage } from '@/lib/storage';
import { useEditor, useNode } from '@craftjs/core';
import { Camera, Download, Edit, Trash2, User } from 'lucide-react';
import React, { useState } from 'react';

interface ProfileInfoProps {
  name?: string;
  company?: string;
  title?: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  avatarUrl?: string;
  userId?: string;
}

export function ProfileInfo({
  name = '山田太郎',
  company = 'サンプル株式会社',
  title = 'エンジニア',
  description = 'よろしくお願いします',
  email = 'taro@example.com',
  phone = '090-1234-5678',
  website = 'https://example.com',
  avatarUrl = '',
  userId = ''
}: ProfileInfoProps) {
  const {
    connectors: { connect, drag },
    actions: { setProp },
    isActive,
    isHovered,
    id
  } = useNode((state) => ({
    isActive: state.events.selected,
    isHovered: state.events.hovered,
    id: state.id
  }));

  const { actions } = useEditor();

  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const generateVCard = () => {
    const vcardLines = [
      'BEGIN:VCARD',
      'VERSION:3.0'
    ];

    // 名前（必須）
    if (name) {
      vcardLines.push(`N:${name}`);
      vcardLines.push(`FN:${name}`);
      // ふりがなは日本語名の場合に有用だが、現在は設定していない
      // vcardLines.push(`X-PHONETIC-LAST-NAME:${phonetic}`);
    }

    // 会社・役職
    if (company) {
      vcardLines.push(`ORG:${company}`);
    }
    if (title) {
      vcardLines.push(`TITLE:${title}`);
    }

    // 連絡先情報
    if (email) {
      vcardLines.push(`EMAIL:${email}`);
    }
    if (phone) {
      // 携帯電話として設定（TYPE=CELL;）
      const phoneClean = phone.replace(/[\s-]/g, ''); // スペースとハイフンを除去
      vcardLines.push(`TEL;TYPE=CELL:${phoneClean}`);
    }
    if (website) {
      vcardLines.push(`URL:${website}`);
    }

    // 一言メッセージを備考として追加
    if (description) {
      vcardLines.push(`NOTE:${description}`);
    }

    vcardLines.push('END:VCARD');

    const vcard = vcardLines.join('\n');

    // UTF-8形式でBlobを作成
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name || 'contact'}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    setIsUploading(true);
    try {
      const imageUrl = await uploadCompressedImage(userId, file, 'content');
      setProp((props: ProfileInfoProps) => {
        props.avatarUrl = imageUrl;
      });
      toast({
        title: '成功',
        description: 'プロフィール画像をアップロードしました',
      });
    } catch (error: any) {
      toast({
        title: 'エラー',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      ref={(ref: any) => connect(drag(ref))}
      className={`relative p-6 bg-white rounded-lg shadow-sm border transition-all ${
        isActive ? 'ring-2 ring-blue-500' : ''
      } ${isHovered ? 'shadow-md' : ''}`}
    >
      {/* ホバー時の編集コントロール */}
      {isHovered && (
        <div className="absolute top-2 right-2 flex gap-2 z-10">
          <Button
            variant="destructive"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              actions.delete(id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="icon" className="h-8 w-8">
                <Edit className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 max-h-96 overflow-y-auto" align="end">
              <div className="space-y-4">
                <h3 className="font-semibold">登録情報を編集</h3>

                <div className="space-y-2">
                  <Label htmlFor="avatar">プロフィール画像</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="プロフィール画像"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-8 h-8 text-gray-600" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                        className="hidden"
                        id="avatar-upload"
                      />
                      <Label
                        htmlFor="avatar-upload"
                        className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
                      >
                        <Camera className="h-4 w-4" />
                        {isUploading ? 'アップロード中...' : '画像を選択'}
                      </Label>
                      {avatarUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setProp((props: ProfileInfoProps) => {
                            props.avatarUrl = '';
                          })}
                        >
                          画像を削除
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">名前</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setProp((props: ProfileInfoProps) => {
                      props.name = e.target.value;
                    })}
                    placeholder="名前を入力"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">会社名</Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setProp((props: ProfileInfoProps) => {
                      props.company = e.target.value;
                    })}
                    placeholder="会社名を入力"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">職業・役職</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setProp((props: ProfileInfoProps) => {
                      props.title = e.target.value;
                    })}
                    placeholder="職業・役職を入力"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">一言</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setProp((props: ProfileInfoProps) => {
                      props.description = e.target.value;
                    })}
                    placeholder="一言メッセージを入力"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setProp((props: ProfileInfoProps) => {
                      props.email = e.target.value;
                    })}
                    placeholder="メールアドレスを入力"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">電話番号</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setProp((props: ProfileInfoProps) => {
                      props.phone = e.target.value;
                    })}
                    placeholder="電話番号を入力"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">ウェブサイト</Label>
                  <Input
                    id="website"
                    value={website}
                    onChange={(e) => setProp((props: ProfileInfoProps) => {
                      props.website = e.target.value;
                    })}
                    placeholder="https://example.com"
                  />
                </div>

                <Button
                  onClick={() => setIsOpen(false)}
                  className="w-full"
                >
                  完了
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* プロフィール情報表示 */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="プロフィール画像"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-gray-600" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold">{name}</h3>
            {company && <p className="text-gray-600 text-sm">{company}</p>}
            {title && <p className="text-gray-500 text-sm">{title}</p>}
          </div>
        </div>

        {description && (
          <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
            {description}
          </div>
        )}

        <Button
          onClick={generateVCard}
          className="w-full mt-4"
          variant="outline"
        >
          <Download className="mr-2 h-4 w-4" />
          連絡先をダウンロード
        </Button>
      </div>
    </div>
  );
}

ProfileInfo.craft = {
  displayName: 'ProfileInfo',
  props: {
    name: '山田太郎',
    company: 'サンプル株式会社',
    title: 'エンジニア',
    description: 'よろしくお願いします',
    email: 'taro@example.com',
    phone: '090-1234-5678',
    website: 'https://example.com',
    avatarUrl: '',
    userId: ''
  },
  related: {}
};