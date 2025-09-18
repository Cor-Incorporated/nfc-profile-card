'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BackgroundCustomizer } from './BackgroundCustomizer';
import { Palette } from 'lucide-react';

interface BackgroundSettingsButtonProps {
  userId: string;
  background: any;
  onBackgroundChange: (background: any) => void;
}

export function BackgroundSettingsButton({
  userId,
  background,
  onBackgroundChange
}: BackgroundSettingsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Palette className="h-4 w-4" />
          背景設定
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <h3 className="font-semibold">背景設定</h3>
          <BackgroundCustomizer
            userId={userId}
            currentBackground={background}
            onBackgroundChange={onBackgroundChange}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}