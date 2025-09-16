'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { SUPPORTED_SERVICES } from '@/types';

export interface Link {
  id: string;
  title: string;
  url: string;
  service?: string;
  order?: number;
}

interface LinkManagerProps {
  links: Link[];
  onChange: (links: Link[]) => void;
  maxLinks?: number;
  title?: string;
  description?: string;
}

export function LinkManager({
  links,
  onChange,
  maxLinks = 10,
  title = 'リンク管理',
  description = 'SNSやポートフォリオサイトなどのリンクを管理できます',
}: LinkManagerProps) {
  const [localLinks, setLocalLinks] = useState<Link[]>(links);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  useEffect(() => {
    setLocalLinks(links);
  }, [links]);

  const detectService = (url: string): string | undefined => {
    const lowercaseUrl = url.toLowerCase();
    for (const [service, patterns] of Object.entries(SUPPORTED_SERVICES)) {
      if (Array.isArray(patterns)) {
        for (const pattern of patterns) {
          if (lowercaseUrl.includes(pattern)) {
            return service;
          }
        }
      }
    }
    return undefined;
  };

  const handleLinkChange = (index: number, field: 'title' | 'url', value: string) => {
    const newLinks = [...localLinks];
    newLinks[index] = {
      ...newLinks[index],
      [field]: value,
    };

    if (field === 'url') {
      const service = detectService(value);
      if (service) {
        newLinks[index].service = service;
        if (!newLinks[index].title) {
          newLinks[index].title = service.charAt(0).toUpperCase() + service.slice(1);
        }
      }
    }

    setLocalLinks(newLinks);
    onChange(newLinks);
  };

  const addLink = () => {
    if (localLinks.length >= maxLinks) {
      toast({
        title: '制限',
        description: `リンクは最大${maxLinks}個まで追加できます`,
        variant: 'destructive',
      });
      return;
    }

    const newLinks = [
      ...localLinks,
      {
        id: Date.now().toString(),
        title: '',
        url: '',
        order: localLinks.length,
      },
    ];

    setLocalLinks(newLinks);
    onChange(newLinks);
  };

  const removeLink = (index: number) => {
    const newLinks = localLinks.filter((_, i) => i !== index);
    newLinks.forEach((link, i) => {
      link.order = i;
    });
    setLocalLinks(newLinks);
    onChange(newLinks);
  };

  const handleDragStart = (index: number) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedItem === null) return;

    const draggedLink = localLinks[draggedItem];
    const newLinks = [...localLinks];

    newLinks.splice(draggedItem, 1);
    newLinks.splice(dropIndex, 0, draggedLink);

    newLinks.forEach((link, i) => {
      link.order = i;
    });

    setLocalLinks(newLinks);
    onChange(newLinks);
    setDraggedItem(null);
  };

  const getServiceIcon = (service?: string) => {
    const icons: { [key: string]: string } = {
      twitter: '𝕏',
      x: '𝕏',
      linkedin: 'in',
      github: 'gh',
      instagram: '📷',
      facebook: 'f',
      youtube: '▶️',
      tiktok: '♪',
      discord: '💬',
      slack: '#',
      telegram: '✈️',
      whatsapp: '💬',
      line: 'L',
      wechat: 'W',
      pinterest: 'P',
      reddit: 'R',
      tumblr: 't',
      snapchat: '👻',
      twitch: '🎮',
      spotify: '♫',
      soundcloud: '☁️',
      medium: 'M',
      dev: 'DEV',
      dribbble: '🏀',
      behance: 'Be',
      figma: 'F',
      codepen: '{ }',
      gitlab: 'GL',
      bitbucket: 'BB',
      stackoverflow: 'SO',
      producthunt: 'P',
      angellist: 'AL',
      crunchbase: 'CB',
    };

    return icons[service || ''] || '🔗';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {localLinks.map((link, index) => (
          <div
            key={link.id}
            className="flex items-center gap-2 p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
          >
            <div className="cursor-move">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>

            {link.service && (
              <Badge variant="outline" className="min-w-[3rem] text-center">
                {getServiceIcon(link.service)}
              </Badge>
            )}

            <Input
              value={link.title}
              onChange={(e) => handleLinkChange(index, 'title', e.target.value)}
              placeholder="タイトル"
              className="flex-1"
            />

            <Input
              value={link.url}
              onChange={(e) => handleLinkChange(index, 'url', e.target.value)}
              placeholder="https://..."
              className="flex-2"
            />

            {link.url && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(link.url, '_blank')}
                title="プレビュー"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeLink(index)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          onClick={addLink}
          disabled={localLinks.length >= maxLinks}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          リンクを追加 ({localLinks.length}/{maxLinks})
        </Button>

        {localLinks.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">
              💡 ヒント: リンクをドラッグして順番を変更できます。
              URLを入力すると、自動的にサービスを検出してアイコンが表示されます。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}