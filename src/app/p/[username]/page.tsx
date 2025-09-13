import { notFound } from 'next/navigation'
import { adminDb } from '@/lib/firebase-admin'
import Link from 'next/link'
import { SUPPORTED_SERVICES } from '@/types'

interface ProfilePageProps {
  params: {
    username: string
  }
}

async function getUserProfile(username: string) {
  try {
    const usersRef = adminDb.collection('users')
    const snapshot = await usersRef.where('username', '==', username).limit(1).get()
    
    if (snapshot.empty) {
      return null
    }
    
    const userData = snapshot.docs[0].data()
    return userData
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return null
  }
}

function getServiceIcon(url: string) {
  const hostname = new URL(url).hostname.replace('www.', '')
  return SUPPORTED_SERVICES[hostname] || SUPPORTED_SERVICES['default']
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const user = await getUserProfile(params.username)
  
  if (!user) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="text-center">
            {user.profile.avatarUrl && (
              <img
                src={user.profile.avatarUrl}
                alt={user.profile.name}
                className="w-32 h-32 rounded-full mx-auto mb-4 object-cover"
              />
            )}
            {!user.profile.avatarUrl && (
              <div className="w-32 h-32 rounded-full mx-auto mb-4 bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <span className="text-white text-4xl font-bold">
                  {user.profile.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {user.profile.name}
            </h1>
            
            {user.profile.title && (
              <p className="text-lg text-gray-600 mb-1">
                {user.profile.title}
              </p>
            )}
            
            {user.profile.company && (
              <p className="text-md text-gray-500 mb-4">
                {user.profile.company}
              </p>
            )}
            
            {user.profile.bio && (
              <p className="text-gray-700 mb-6 max-w-md mx-auto">
                {user.profile.bio}
              </p>
            )}
            
            {/* Contact Button */}
            <button className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors mb-6">
              連絡先を保存
            </button>
          </div>
        </div>

        {/* Links Section */}
        {user.profile.links && user.profile.links.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">リンク</h2>
            <div className="space-y-3">
              {user.profile.links
                .sort((a: any, b: any) => a.order - b.order)
                .map((link: any, index: number) => {
                  const serviceIcon = getServiceIcon(link.url)
                  return (
                    <Link
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center p-4 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center mr-4"
                        style={{ backgroundColor: `${serviceIcon.color}20` }}
                      >
                        <span style={{ color: serviceIcon.color }}>
                          🔗
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                          {link.label || serviceIcon.name || link.service || 'Link'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new URL(link.url).hostname}
                        </p>
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </Link>
                  )
                })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Powered by NFC Profile Card</p>
        </div>
      </div>
    </div>
  )
}