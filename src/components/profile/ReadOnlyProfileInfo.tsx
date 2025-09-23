import React from 'react';
import { VCardButton } from './VCardButton';
import {
  Mail,
  Phone,
  Building,
  MapPin,
  Globe,
  User,
  Briefcase,
  Smartphone
} from 'lucide-react';
import type { ProfileComponent } from '../simple-editor/utils/dataStructure';

interface ReadOnlyProfileInfoProps {
  component: ProfileComponent;
}

export function ReadOnlyProfileInfo({ component }: ReadOnlyProfileInfoProps) {
  const content = component.content || {};
  const {
    firstName,
    lastName,
    name,
    email,
    phone,
    cellPhone,
    company,
    position,
    department,
    address,
    city,
    postalCode,
    website,
    bio,
    photoURL
  } = content;

  // 表示名の決定
  const displayName = name || `${lastName || ''} ${firstName || ''}`.trim() || '名前未設定';

  // VCard用データの準備
  const vCardData = {
    firstName: firstName || '',
    lastName: lastName || '',
    organization: company || '',
    title: position || '',
    email: email || '',
    workPhone: phone || '',
    cellPhone: cellPhone || '',
    url: website || '',
    workAddress: {
      street: address || '',
      city: city || '',
      postalCode: postalCode || '',
      countryRegion: '日本'
    },
    photo: photoURL || '',
    note: bio || ''
  };

  return (
    <div className="w-3/4 mx-auto mb-6" style={{ width: '75%' }}>
      <div className="bg-white bg-opacity-95 rounded-lg shadow-lg overflow-hidden">
        {/* ヘッダー部分 */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
          <div className="flex items-center space-x-4">
            {photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                className="w-20 h-20 rounded-full border-3 border-white object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white bg-opacity-30 flex items-center justify-center">
                <User className="w-10 h-10 text-white" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold">{displayName}</h2>
              {position && (
                <p className="text-sm opacity-90">{position}</p>
              )}
              {company && (
                <p className="text-sm opacity-90">{company}</p>
              )}
            </div>
          </div>
        </div>

        {/* コンテンツ部分 */}
        <div className="p-6 space-y-4">
          {/* 自己紹介 */}
          {bio && (
            <div className="pb-4 border-b border-gray-200">
              <p className="text-gray-700">{bio}</p>
            </div>
          )}

          {/* 連絡先情報 */}
          <div className="space-y-3">
            {email && (
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <a
                  href={`mailto:${email}`}
                  className="text-blue-600 hover:underline"
                >
                  {email}
                </a>
              </div>
            )}

            {phone && (
              <div className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <a
                  href={`tel:${phone}`}
                  className="text-blue-600 hover:underline"
                >
                  {phone}
                </a>
              </div>
            )}

            {cellPhone && (
              <div className="flex items-center space-x-3">
                <Smartphone className="w-5 h-5 text-gray-400" />
                <a
                  href={`tel:${cellPhone}`}
                  className="text-blue-600 hover:underline"
                >
                  {cellPhone}
                </a>
              </div>
            )}

            {website && (
              <div className="flex items-center space-x-3">
                <Globe className="w-5 h-5 text-gray-400" />
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {website}
                </a>
              </div>
            )}

            {(company || department) && (
              <div className="flex items-center space-x-3">
                <Building className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700">
                  {company}
                  {department && ` - ${department}`}
                </span>
              </div>
            )}

            {(address || city || postalCode) && (
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700">
                  {postalCode && `〒${postalCode} `}
                  {city} {address}
                </span>
              </div>
            )}
          </div>

          {/* VCardダウンロードボタン */}
          <div className="pt-4 border-t border-gray-200">
            <VCardButton
              username={displayName}
              profileData={vCardData}
              className="w-full"
              variant="default"
              size="lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
