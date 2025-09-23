// /src/utils/socialLinks.ts
// ソーシャルリンク自動認識ユーティリティ

import {
  Github,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Globe,
  Music,
  Mail,
  MessageCircle,
  Video
} from 'lucide-react';

// ソーシャルメディアの定義
export const SOCIAL_SERVICES = {
  github: {
    name: 'GitHub',
    icon: Github,
    color: '#181717',
    patterns: ['github.com']
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: '#1877F2',
    patterns: ['facebook.com', 'fb.com']
  },
  twitter: {
    name: 'X (Twitter)',
    icon: Twitter,
    color: '#000000',
    patterns: ['twitter.com', 'x.com']
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: '#E4405F',
    patterns: ['instagram.com']
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: '#0A66C2',
    patterns: ['linkedin.com']
  },
  youtube: {
    name: 'YouTube',
    icon: Youtube,
    color: '#FF0000',
    patterns: ['youtube.com', 'youtu.be']
  },
  tiktok: {
    name: 'TikTok',
    icon: Video,
    color: '#000000',
    patterns: ['tiktok.com']
  },
  spotify: {
    name: 'Spotify',
    icon: Music,
    color: '#1DB954',
    patterns: ['spotify.com']
  },
  discord: {
    name: 'Discord',
    icon: MessageCircle,
    color: '#5865F2',
    patterns: ['discord.gg', 'discord.com']
  },
  email: {
    name: 'Email',
    icon: Mail,
    color: '#EA4335',
    patterns: ['mailto:']
  },
  default: {
    name: 'Website',
    icon: Globe,
    color: '#6B7280',
    patterns: []
  }
};

/**
 * URLからソーシャルサービスを検出
 */
export function detectSocialService(url: string): keyof typeof SOCIAL_SERVICES {
  if (!url) return 'default';

  const lowerUrl = url.toLowerCase();

  for (const [key, service] of Object.entries(SOCIAL_SERVICES)) {
    if (key === 'default') continue;

    for (const pattern of service.patterns) {
      if (lowerUrl.includes(pattern)) {
        return key as keyof typeof SOCIAL_SERVICES;
      }
    }
  }

  return 'default';
}

/**
 * URLからサービス情報を取得
 */
export function getSocialServiceInfo(url: string) {
  const serviceKey = detectSocialService(url);
  return SOCIAL_SERVICES[serviceKey];
}