'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Link from 'next/link';
import { VCardButton } from '@/components/profile/VCardButton';
import { SUPPORTED_SERVICES } from '@/types';

interface UserProfile {
  name: string;
  username: string;
  bio: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  photoURL?: string;
  links: Array<{
    id: string;
    title: string;
    url: string;
    service?: string;
  }>;
}

function getServiceIcon(url: string) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return SUPPORTED_SERVICES[hostname] || SUPPORTED_SERVICES['default'];
  } catch {
    return SUPPORTED_SERVICES['default'];
  }
}

export default function ProfilePage() {
  const params = useParams();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const username = params.username as string;

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', username));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setUser(null);
        } else {
          const userData = snapshot.docs[0].data() as UserProfile;
          setUser(userData);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">プロフィールが見つかりません</h1>
          <Link href="/" className="text-primary hover:underline">
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  const vcardData = {
    firstName: user.name?.split(' ')[0] || '',
    lastName: user.name?.split(' ').slice(1).join(' ') || '',
    organization: user.company || '',
    title: user.position || '',
    email: user.email || '',
    workPhone: user.phone || '',
    url: user.website || '',
    workAddress: user.address ? {
      street: user.address,
    } : undefined,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="text-center">
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.name}
                className="w-32 h-32 rounded-full mx-auto mb-4 object-cover"
              />
            )}
            <h1 className="text-3xl font-bold mb-2">{user.name}</h1>
            {user.position && (
              <p className="text-lg text-gray-600 mb-1">{user.position}</p>
            )}
            {user.company && (
              <p className="text-lg text-gray-600 mb-4">{user.company}</p>
            )}
            {user.bio && (
              <p className="text-gray-700 mb-6 max-w-md mx-auto">{user.bio}</p>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h2 className="text-xl font-semibold mb-4">連絡先</h2>
          <div className="space-y-3">
            {user.email && (
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href={`mailto:${user.email}`} className="text-primary hover:underline">
                  {user.email}
                </a>
              </div>
            )}
            {user.phone && (
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href={`tel:${user.phone}`} className="text-primary hover:underline">
                  {user.phone}
                </a>
              </div>
            )}
            {user.website && (
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <a href={user.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {user.website}
                </a>
              </div>
            )}
            {user.address && (
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-gray-700">{user.address}</span>
              </div>
            )}
          </div>
          <div className="mt-6">
            <VCardButton profileData={vcardData} variant="default" className="w-full" />
          </div>
        </div>

        {/* Social Links */}
        {user.links && user.links.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-xl font-semibold mb-4">ソーシャルリンク</h2>
            <div className="grid gap-3">
              {user.links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-300 bg-white hover:border-primary hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔗</span>
                    <span className="font-medium text-gray-800">{link.title || link.url || 'リンク'}</span>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}