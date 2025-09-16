'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

interface VCardButtonProps {
  username?: string;
  profileData?: {
    firstName?: string;
    lastName?: string;
    organization?: string;
    title?: string;
    email?: string;
    workPhone?: string;
    cellPhone?: string;
    url?: string;
    workAddress?: {
      street?: string;
      city?: string;
      stateProvince?: string;
      postalCode?: string;
      countryRegion?: string;
    };
    socialUrls?: {
      facebook?: string;
      linkedIn?: string;
      twitter?: string;
      instagram?: string;
    };
    photo?: string;
    note?: string;
  };
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function VCardButton({
  username,
  profileData,
  variant = 'default',
  size = 'default',
  className = '',
}: VCardButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    setIsLoading(true);

    try {
      let response: Response;

      if (profileData) {
        response = await fetch('/api/vcard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(profileData),
        });
      } else if (username) {
        response = await fetch(`/api/vcard?username=${username}`);
      } else {
        throw new Error('No username or profile data provided');
      }

      if (!response.ok) {
        throw new Error('Failed to generate VCard');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${username || profileData?.firstName || 'contact'}.vcf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: '成功',
        description: 'VCardをダウンロードしました',
      });
    } catch (error) {
      console.error('VCard download error:', error);
      toast({
        title: 'エラー',
        description: 'VCardのダウンロードに失敗しました',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={isLoading}
      variant={variant}
      size={size}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          生成中...
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          連絡先を保存
        </>
      )}
    </Button>
  );
}