'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SocialLink {
  id: string;
  service: string;
  title: string;
  url: string;
}

interface SocialLinksManagerProps {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
}

function SortableItem({ link, onUpdate, onDelete }: { link: SocialLink; onUpdate: (link: SocialLink) => void; onDelete: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const detectService = (url: string): string => {
    const lowercaseUrl = url.toLowerCase();
    if (lowercaseUrl.includes('twitter.com') || lowercaseUrl.includes('x.com')) return 'Twitter/X';
    if (lowercaseUrl.includes('instagram.com')) return 'Instagram';
    if (lowercaseUrl.includes('facebook.com')) return 'Facebook';
    if (lowercaseUrl.includes('linkedin.com')) return 'LinkedIn';
    if (lowercaseUrl.includes('github.com')) return 'GitHub';
    if (lowercaseUrl.includes('youtube.com')) return 'YouTube';
    if (lowercaseUrl.includes('tiktok.com')) return 'TikTok';
    if (lowercaseUrl.includes('pinterest.com')) return 'Pinterest';
    if (lowercaseUrl.includes('discord.')) return 'Discord';
    if (lowercaseUrl.includes('twitch.tv')) return 'Twitch';
    if (lowercaseUrl.includes('spotify.com')) return 'Spotify';
    if (lowercaseUrl.includes('reddit.com')) return 'Reddit';
    return 'カスタム';
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 p-3 bg-background border rounded-lg">
      <button {...attributes} {...listeners} className="cursor-move">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="タイトル（オプション）"
            value={link.title}
            onChange={(e) => onUpdate({ ...link, title: e.target.value })}
            className="flex-1"
          />
          <div className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
            {detectService(link.url)}
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="URLを入力"
            value={link.url}
            onChange={(e) => {
              const newUrl = e.target.value;
              onUpdate({
                ...link,
                url: newUrl,
                service: detectService(newUrl).toLowerCase()
              });
            }}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SocialLinksManager({ links, onChange }: SocialLinksManagerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = links.findIndex((link) => link.id === active.id);
      const newIndex = links.findIndex((link) => link.id === over.id);
      onChange(arrayMove(links, oldIndex, newIndex));
    }
  };

  const addLink = () => {
    const newLink: SocialLink = {
      id: Date.now().toString(),
      service: '',
      title: '',
      url: '',
    };
    onChange([...links, newLink]);
  };

  const updateLink = (id: string, updatedLink: SocialLink) => {
    onChange(links.map(link => link.id === id ? updatedLink : link));
  };

  const deleteLink = (id: string) => {
    onChange(links.filter(link => link.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">ソーシャルリンク</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={addLink}
        >
          <Plus className="h-4 w-4 mr-1" />
          追加
        </Button>
      </div>

      {links.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
          ソーシャルリンクを追加して、プロフィールページに表示できます
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={links.map(link => link.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {links.map((link) => (
                <SortableItem
                  key={link.id}
                  link={link}
                  onUpdate={(updatedLink) => updateLink(link.id, updatedLink)}
                  onDelete={() => deleteLink(link.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}