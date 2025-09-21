"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

// プロフィールエディタ
function ProfileEditor({ component, onSave, onClose, userId }: ComponentEditorProps) {
  const [name, setName] = useState(component.content?.name || '');
  const [bio, setBio] = useState(component.content?.bio || '');

  const handleSave = () => {
    onSave({
      ...component,
      content: { name, bio }
    });
    onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="profile-name">名前</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mt-1"
          placeholder="お名前"
        />
      </div>
      <div>
        <Label htmlFor="profile-bio">自己紹介</Label>
        <Textarea
          id="profile-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full mt-1"
          rows={3}
          placeholder="自己紹介文"
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