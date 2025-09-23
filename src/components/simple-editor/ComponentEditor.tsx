"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X } from 'lucide-react';
import { ProfileComponent } from './utils/dataStructure';
import { ImageUploader } from './ImageUploader';
import { getSocialServiceInfo } from '@/utils/socialLinks';
import { useEffect } from 'react';

interface ComponentEditorProps {
  component: ProfileComponent;
  onSave: (updatedComponent: ProfileComponent) => void;
  onClose: () => void;
  userId?: string;
}

export function ComponentEditor({ component, onSave, onClose, userId }: ComponentEditorProps) {
  const renderEditor = () => {
    switch(component.type) {
      case 'text':
        return <TextEditor component={component} onSave={onSave} onClose={onClose} userId={userId} />;
      case 'image':
        return <ImageEditor component={component} onSave={onSave} onClose={onClose} userId={userId} />;
      case 'link':
        return <LinkEditor component={component} onSave={onSave} onClose={onClose} userId={userId} />;
      case 'profile':
        return <ProfileEditor component={component} onSave={onSave} onClose={onClose} userId={userId} />;
      default:
        return <div>未対応のコンポーネントタイプ</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] sm:max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center p-3 sm:p-4 border-b">
          <h3 className="text-base sm:text-lg font-semibold">
            {component.type === 'text' && 'テキスト編集'}
            {component.type === 'image' && '画像編集'}
            {component.type === 'link' && 'リンク編集'}
            {component.type === 'profile' && 'プロフィール編集'}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-3 sm:p-4">
          {renderEditor()}
        </div>
      </div>
    </div>
  );
}

// テキストエディタ
function TextEditor({ component, onSave, onClose, userId }: ComponentEditorProps) {
  const [text, setText] = useState(component.content?.text || '');

  const handleSave = () => {
    onSave({
      ...component,
      content: { text }
    });
    onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="text-content">テキスト内容</Label>
        <Textarea
          id="text-content"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full mt-1"
          rows={4}
          placeholder="テキストを入力してください"
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSave} className="flex-1">
          保存
        </Button>
        <Button variant="outline" onClick={onClose} className="flex-1">
          キャンセル
        </Button>
      </div>
    </div>
  );
}

// 画像エディタ
function ImageEditor({ component, onSave, onClose, userId }: ComponentEditorProps) {
  const [imageUrl, setImageUrl] = useState(component.content?.src || '');
  const [alt, setAlt] = useState(component.content?.alt || '');
  const [useUpload, setUseUpload] = useState(true);

  const handleSave = () => {
    onSave({
      ...component,
      content: { src: imageUrl, alt }
    });
    onClose();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">画像を編集</h3>

      {/* タブ切り替え */}
      <div className="flex space-x-2">
        <Button
          size="sm"
          variant={useUpload ? "default" : "outline"}
          onClick={() => setUseUpload(true)}
        >
          アップロード
        </Button>
        <Button
          size="sm"
          variant={!useUpload ? "default" : "outline"}
          onClick={() => setUseUpload(false)}
        >
          URL入力
        </Button>
      </div>

      {useUpload && userId ? (
        <ImageUploader
          userId={userId}
          onImageUploaded={setImageUrl}
          currentImageUrl={imageUrl}
        />
      ) : (
        <div>
          <Label htmlFor="image-url" className="block text-sm font-medium mb-2">
            画像URL
          </Label>
          <Input
            id="image-url"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full"
            placeholder="https://example.com/image.jpg"
          />
        </div>
      )}

      <div>
        <Label htmlFor="image-alt" className="block text-sm font-medium mb-2">
          代替テキスト（alt）
        </Label>
        <Input
          id="image-alt"
          type="text"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          className="w-full"
          placeholder="画像の説明"
        />
      </div>

      <div className="flex space-x-2">
        <Button onClick={handleSave} className="flex-1">
          保存
        </Button>
        <Button onClick={onClose} variant="outline" className="flex-1">
          キャンセル
        </Button>
      </div>
    </div>
  );
}

// リンクエディタ
function LinkEditor({ component, onSave, onClose, userId }: ComponentEditorProps) {
  const [url, setUrl] = useState(component.content?.url || '');
  const [label, setLabel] = useState(component.content?.label || '');
  const [useAutoLabel, setUseAutoLabel] = useState(true);

  // URLが変更されたら自動的にラベルを設定
  useEffect(() => {
    if (useAutoLabel && url) {
      const serviceInfo = getSocialServiceInfo(url);
      setLabel(serviceInfo.name);
    }
  }, [url, useAutoLabel]);

  const handleSave = () => {
    onSave({
      ...component,
      content: { url, label }
    });
    onClose();
  };

  // プレビュー用のサービス情報
  const serviceInfo = getSocialServiceInfo(url);
  const Icon = serviceInfo.icon;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">リンクを編集</h3>

      <div>
        <Label htmlFor="link-url" className="block text-sm font-medium mb-2">
          URL
        </Label>
        <Input
          id="link-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full"
          placeholder="https://github.com/username"
        />
      </div>

      <div>
        <Label htmlFor="link-label" className="block text-sm font-medium mb-2">
          表示テキスト
        </Label>
        <div className="flex space-x-2">
          <Input
            id="link-label"
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setUseAutoLabel(false);
            }}
            className="flex-1"
            placeholder="リンクのラベル"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setUseAutoLabel(true);
              const info = getSocialServiceInfo(url);
              setLabel(info.name);
            }}
          >
            自動設定
          </Button>
        </div>
      </div>

      {/* プレビュー */}
      <div>
        <Label className="block text-sm font-medium mb-2">
          プレビュー
        </Label>
        <div
          className="p-3 border rounded flex items-center space-x-3"
          style={{
            backgroundColor: serviceInfo.color,
            color: '#FFFFFF'
          }}
        >
          <Icon className="h-5 w-5" />
          <span>{label || serviceInfo.name}</span>
        </div>
      </div>

      <div className="flex space-x-2">
        <Button onClick={handleSave} className="flex-1">
          保存
        </Button>
        <Button onClick={onClose} variant="outline" className="flex-1">
          キャンセル
        </Button>
      </div>
    </div>
  );
}

// プロフィールエディタ（拡充版）
interface ProfileContent {
  // 基本情報
  firstName?: string;
  lastName?: string;
  name?: string;  // 表示名（フルネーム）

  // 連絡先
  email?: string;
  phone?: string;
  cellPhone?: string;

  // 会社情報
  company?: string;
  position?: string;
  department?: string;

  // 住所
  address?: string;
  city?: string;
  postalCode?: string;

  // Web/SNS
  website?: string;

  // その他
  bio?: string;
  photoURL?: string;
}

function ProfileEditor({ component, onSave, onClose, userId }: ComponentEditorProps) {
  const [profileData, setProfileData] = useState<ProfileContent>({
    firstName: component.content?.firstName || '',
    lastName: component.content?.lastName || '',
    name: component.content?.name || '',
    email: component.content?.email || '',
    phone: component.content?.phone || '',
    cellPhone: component.content?.cellPhone || '',
    company: component.content?.company || '',
    position: component.content?.position || '',
    department: component.content?.department || '',
    address: component.content?.address || '',
    city: component.content?.city || '',
    postalCode: component.content?.postalCode || '',
    website: component.content?.website || '',
    bio: component.content?.bio || '',
    photoURL: component.content?.photoURL || '',
  });

  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'company' | 'address'>('basic');

  const handleSave = () => {
    // フルネームの自動生成
    const fullName = profileData.name ||
      `${profileData.lastName || ''} ${profileData.firstName || ''}`.trim();

    onSave({
      ...component,
      content: {
        ...profileData,
        name: fullName
      }
    });
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* タブナビゲーション */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic" className="text-xs">
            基本情報
          </TabsTrigger>
          <TabsTrigger value="contact" className="text-xs">
            連絡先
          </TabsTrigger>
          <TabsTrigger value="company" className="text-xs">
            会社情報
          </TabsTrigger>
          <TabsTrigger value="address" className="text-xs">
            住所
          </TabsTrigger>
        </TabsList>

        {/* 基本情報タブ */}
        <TabsContent value="basic" className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="lastName" className="text-xs">姓</Label>
              <Input
                id="lastName"
                value={profileData.lastName}
                onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                placeholder="山田"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="firstName" className="text-xs">名</Label>
              <Input
                id="firstName"
                value={profileData.firstName}
                onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                placeholder="太郎"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="bio" className="text-xs">自己紹介</Label>
            <Textarea
              id="bio"
              value={profileData.bio}
              onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
              rows={3}
              placeholder="簡単な自己紹介"
              className="mt-1"
            />
          </div>

          {/* 写真アップロード */}
          <div>
            <Label className="text-xs">プロフィール写真</Label>
            <ImageUploader
              userId={userId || ''}
              onImageUploaded={(url) => setProfileData({...profileData, photoURL: url})}
              currentImageUrl={profileData.photoURL}
            />
          </div>
        </TabsContent>

        {/* 連絡先タブ */}
        <TabsContent value="contact" className="space-y-3">
          <div>
            <Label htmlFor="email" className="text-xs">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              value={profileData.email}
              onChange={(e) => setProfileData({...profileData, email: e.target.value})}
              placeholder="example@email.com"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="phone" className="text-xs">電話番号（会社）</Label>
            <Input
              id="phone"
              type="tel"
              value={profileData.phone}
              onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
              placeholder="03-1234-5678"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="cellPhone" className="text-xs">携帯電話</Label>
            <Input
              id="cellPhone"
              type="tel"
              value={profileData.cellPhone}
              onChange={(e) => setProfileData({...profileData, cellPhone: e.target.value})}
              placeholder="090-1234-5678"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="website" className="text-xs">ウェブサイト</Label>
            <Input
              id="website"
              type="url"
              value={profileData.website}
              onChange={(e) => setProfileData({...profileData, website: e.target.value})}
              placeholder="https://example.com"
              className="mt-1"
            />
          </div>
        </TabsContent>

        {/* 会社情報タブ */}
        <TabsContent value="company" className="space-y-3">
          <div>
            <Label htmlFor="company" className="text-xs">会社名</Label>
            <Input
              id="company"
              value={profileData.company}
              onChange={(e) => setProfileData({...profileData, company: e.target.value})}
              placeholder="株式会社○○"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="department" className="text-xs">部署</Label>
            <Input
              id="department"
              value={profileData.department}
              onChange={(e) => setProfileData({...profileData, department: e.target.value})}
              placeholder="営業部"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="position" className="text-xs">役職</Label>
            <Input
              id="position"
              value={profileData.position}
              onChange={(e) => setProfileData({...profileData, position: e.target.value})}
              placeholder="部長"
              className="mt-1"
            />
          </div>
        </TabsContent>

        {/* 住所タブ */}
        <TabsContent value="address" className="space-y-3">
          <div>
            <Label htmlFor="postalCode" className="text-xs">郵便番号</Label>
            <Input
              id="postalCode"
              value={profileData.postalCode}
              onChange={(e) => setProfileData({...profileData, postalCode: e.target.value})}
              placeholder="100-0001"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="city" className="text-xs">都道府県・市区町村</Label>
            <Input
              id="city"
              value={profileData.city}
              onChange={(e) => setProfileData({...profileData, city: e.target.value})}
              placeholder="東京都千代田区"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="address" className="text-xs">住所</Label>
            <Input
              id="address"
              value={profileData.address}
              onChange={(e) => setProfileData({...profileData, address: e.target.value})}
              placeholder="千代田1-1-1"
              className="mt-1"
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* 保存・キャンセルボタン */}
      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} className="flex-1">
          保存
        </Button>
        <Button variant="outline" onClick={onClose} className="flex-1">
          キャンセル
        </Button>
      </div>
    </div>
  );
}