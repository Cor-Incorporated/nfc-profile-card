"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  label: string;
  icon?: string;
}

interface LinkManagerProps {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
}

const PLATFORM_OPTIONS = [
  { value: 'github', label: 'GitHub', icon: '🐙' },
  { value: 'twitter', label: 'Twitter/X', icon: '🐦' },
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { value: 'instagram', label: 'Instagram', icon: '📸' },
  { value: 'youtube', label: 'YouTube', icon: '▶️' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵' },
  { value: 'website', label: 'ウェブサイト', icon: '🌐' },
  { value: 'custom', label: 'カスタム', icon: '🔗' },
];

export function LinkManager({ links, onChange }: LinkManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<Partial<SocialLink>>({
    platform: 'website',
    url: '',
    label: '',
  });

  const addLink = () => {
    if (!newLink.url || !newLink.label) return;

    const link: SocialLink = {
      id: Date.now().toString(),
      platform: newLink.platform || 'website',
      url: newLink.url,
      label: newLink.label,
      icon: PLATFORM_OPTIONS.find(p => p.value === newLink.platform)?.icon || '🔗',
    };

    onChange([...links, link]);
    setNewLink({ platform: 'website', url: '', label: '' });
  };

  const updateLink = (id: string, updated: Partial<SocialLink>) => {
    onChange(links.map(link =>
      link.id === id ? { ...link, ...updated } : link
    ));
    setEditingId(null);
  };

  const deleteLink = (id: string) => {
    onChange(links.filter(link => link.id !== id));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">ソーシャルリンク管理</h3>

      {/* 既存リンク一覧 */}
      <div className="space-y-2">
        {links.map((link) => (
          <div key={link.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">{link.icon}</span>
            {editingId === link.id ? (
              <>
                <Input
                  value={link.label}
                  onChange={(e) => updateLink(link.id, { label: e.target.value })}
                  placeholder="表示名"
                  className="flex-1"
                />
                <Input
                  value={link.url}
                  onChange={(e) => updateLink(link.id, { url: e.target.value })}
                  placeholder="URL"
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => setEditingId(null)}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 font-medium">{link.label}</span>
                <span className="flex-1 text-sm text-gray-600">{link.url}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(link.id)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteLink(link.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 新規リンク追加 */}
      <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg space-y-3">
        <Label>新しいリンクを追加</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select
            value={newLink.platform}
            onValueChange={(value) => setNewLink({ ...newLink, platform: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="プラットフォーム" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORM_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="flex items-center gap-2">
                    <span>{option.icon}</span>
                    <span>{option.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="表示名（例：@username）"
            value={newLink.label || ''}
            onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
          />

          <Input
            placeholder="URL"
            value={newLink.url || ''}
            onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
          />
        </div>

        <Button onClick={addLink} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          リンクを追加
        </Button>
      </div>
    </div>
  );
}