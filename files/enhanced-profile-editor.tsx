// 拡充版 ProfileEditor 実装仕様
// /src/components/simple-editor/ComponentEditor.tsx の ProfileEditor を以下に置き換え

interface ProfileContent {
  // 基本情報
  firstName?: string;
  lastName?: string;
  name?: string;  // 表示名（フルネーム）
  
  // 連絡先
  email?: string;
  phone?: string;
  cellPhone?: string;
  
  // 会社情報
  company?: string;
  position?: string;
  department?: string;
  
  // 住所
  address?: string;
  city?: string;
  postalCode?: string;
  
  // Web/SNS
  website?: string;
  
  // その他
  bio?: string;
  photoURL?: string;
}

function ProfileEditor({ component, onSave, onClose, userId }: ComponentEditorProps) {
  const [profileData, setProfileData] = useState<ProfileContent>({
    firstName: component.content?.firstName || '',
    lastName: component.content?.lastName || '',
    name: component.content?.name || '',
    email: component.content?.email || '',
    phone: component.content?.phone || '',
    cellPhone: component.content?.cellPhone || '',
    company: component.content?.company || '',
    position: component.content?.position || '',
    department: component.content?.department || '',
    address: component.content?.address || '',
    city: component.content?.city || '',
    postalCode: component.content?.postalCode || '',
    website: component.content?.website || '',
    bio: component.content?.bio || '',
    photoURL: component.content?.photoURL || '',
  });
  
  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'company' | 'address'>('basic');

  const handleSave = () => {
    // フルネームの自動生成
    const fullName = profileData.name || 
      `${profileData.lastName || ''} ${profileData.firstName || ''}`.trim();
    
    onSave({
      ...component,
      content: {
        ...profileData,
        name: fullName
      }
    });
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* タブナビゲーション */}
      <div className="flex space-x-2 border-b">
        <button
          className={`px-3 py-2 text-sm ${
            activeTab === 'basic' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-600'
          }`}
          onClick={() => setActiveTab('basic')}
        >
          基本情報
        </button>
        <button
          className={`px-3 py-2 text-sm ${
            activeTab === 'contact' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-600'
          }`}
          onClick={() => setActiveTab('contact')}
        >
          連絡先
        </button>
        <button
          className={`px-3 py-2 text-sm ${
            activeTab === 'company' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-600'
          }`}
          onClick={() => setActiveTab('company')}
        >
          会社情報
        </button>
        <button
          className={`px-3 py-2 text-sm ${
            activeTab === 'address' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-600'
          }`}
          onClick={() => setActiveTab('address')}
        >
          住所
        </button>
      </div>

      {/* 基本情報タブ */}
      {activeTab === 'basic' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="lastName" className="text-xs">姓</Label>
              <Input
                id="lastName"
                value={profileData.lastName}
                onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                placeholder="山田"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="firstName" className="text-xs">名</Label>
              <Input
                id="firstName"
                value={profileData.firstName}
                onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                placeholder="太郎"
                className="mt-1"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="bio" className="text-xs">自己紹介</Label>
            <Textarea
              id="bio"
              value={profileData.bio}
              onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
              rows={3}
              placeholder="簡単な自己紹介"
              className="mt-1"
            />
          </div>
          
          {/* 写真アップロード */}
          <div>
            <Label className="text-xs">プロフィール写真</Label>
            <ImageUploader
              userId={userId || ''}
              onImageUploaded={(url) => setProfileData({...profileData, photoURL: url})}
              currentImageUrl={profileData.photoURL}
            />
          </div>
        </div>
      )}

      {/* 連絡先タブ */}
      {activeTab === 'contact' && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="email" className="text-xs">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              value={profileData.email}
              onChange={(e) => setProfileData({...profileData, email: e.target.value})}
              placeholder="example@email.com"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="phone" className="text-xs">電話番号（会社）</Label>
            <Input
              id="phone"
              type="tel"
              value={profileData.phone}
              onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
              placeholder="03-1234-5678"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="cellPhone" className="text-xs">携帯電話</Label>
            <Input
              id="cellPhone"
              type="tel"
              value={profileData.cellPhone}
              onChange={(e) => setProfileData({...profileData, cellPhone: e.target.value})}
              placeholder="090-1234-5678"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="website" className="text-xs">ウェブサイト</Label>
            <Input
              id="website"
              type="url"
              value={profileData.website}
              onChange={(e) => setProfileData({...profileData, website: e.target.value})}
              placeholder="https://example.com"
              className="mt-1"
            />
          </div>
        </div>
      )}

      {/* 会社情報タブ */}
      {activeTab === 'company' && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="company" className="text-xs">会社名</Label>
            <Input
              id="company"
              value={profileData.company}
              onChange={(e) => setProfileData({...profileData, company: e.target.value})}
              placeholder="株式会社○○"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="department" className="text-xs">部署</Label>
            <Input
              id="department"
              value={profileData.department}
              onChange={(e) => setProfileData({...profileData, department: e.target.value})}
              placeholder="営業部"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="position" className="text-xs">役職</Label>
            <Input
              id="position"
              value={profileData.position}
              onChange={(e) => setProfileData({...profileData, position: e.target.value})}
              placeholder="部長"
              className="mt-1"
            />
          </div>
        </div>
      )}

      {/* 住所タブ */}
      {activeTab === 'address' && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="postalCode" className="text-xs">郵便番号</Label>
            <Input
              id="postalCode"
              value={profileData.postalCode}
              onChange={(e) => setProfileData({...profileData, postalCode: e.target.value})}
              placeholder="100-0001"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="city" className="text-xs">都道府県・市区町村</Label>
            <Input
              id="city"
              value={profileData.city}
              onChange={(e) => setProfileData({...profileData, city: e.target.value})}
              placeholder="東京都千代田区"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="address" className="text-xs">住所</Label>
            <Input
              id="address"
              value={profileData.address}
              onChange={(e) => setProfileData({...profileData, address: e.target.value})}
              placeholder="千代田1-1-1"
              className="mt-1"
            />
          </div>
        </div>
      )}

      {/* 保存・キャンセルボタン */}
      <div className="flex gap-2 pt-2">
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