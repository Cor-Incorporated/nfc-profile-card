"use client";

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "./AuthContext";

type Language = "ja" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

// Translation dictionary
const translations = {
  ja: {
    // Dashboard
    title: "ダッシュボード",
    welcome: "ようこそ",
    profileSetup: "プロフィール設定が必要です",
    publicProfile: "公開プロファイル",
    editProfile: "プロフィールを編集",
    scanCard: "名刺をスキャン",
    logout: "ログアウト",
    analytics: "アナリティクス",
    totalViews: "総閲覧数",
    todayViews: "今日",
    weekViews: "今週",
    language: "言語",

    // Profile Edit
    profile: "プロフィール",
    basicInfo: "基本情報",
    firstName: "名",
    lastName: "姓",
    phoneticFirstName: "メイ",
    phoneticLastName: "セイ",
    email: "メールアドレス",
    phone: "電話番号",
    mobile: "携帯電話",
    company: "会社名",
    department: "部署",
    position: "役職",
    website: "ウェブサイト",
    bio: "自己紹介",
    postalCode: "郵便番号",
    address: "住所",
    city: "市区町村",
    save: "保存",
    cancel: "キャンセル",
    delete: "削除",
    edit: "編集",
    loading: "読み込み中...",
    saving: "保存中...",
    saved: "保存しました",
    error: "エラーが発生しました",

    // Profile Editor
    design: "デザイン",
    background: "背景",
    backgroundColor: "背景色",
    gradient: "グラデーション",
    opacity: "不透明度",
    profileCardColor: "プロフィールカードの色",
    addComponent: "コンポーネントを追加",
    text: "テキスト",
    image: "画像",
    link: "リンク",
    preview: "プレビュー",

    // Business Card Scanner
    businessCardScanner: "名刺スキャナー",
    scanBusinessCard: "名刺をスキャン",
    selectFromGallery: "ギャラリーから選択",
    takePhoto: "写真を撮る",
    processing: "処理中...",
    scanResult: "スキャン結果",
    addToContacts: "連絡先に追加",
    scanAgain: "もう一度スキャン",
    remainingScans: "残りスキャン回数",
    upgradeForMore: "より多くスキャンするにはアップグレード",
    backToDashboard: "ダッシュボードに戻る",
    viewPublicProfile: "公開プロフィールを見る",
    scanBusinessCardDescription: "名刺を撮影して連絡先情報を抽出",
    success: "成功",
    scansThisMonth: "今月のスキャン数",
    unlimited: "無制限",
    approachingMonthlyLimit: "まもなく月間上限に達します",
    reset: "リセット",
    daysRemaining: "日後",
    selectImageFile: "画像ファイルを選択してください",
    or: "または",
    selectImage: "画像を選択",
    photoTips: "撮影のコツ",
    photoTipBrightArea: "明るい場所で撮影",
    photoTipCaptureEntire: "名刺全体を画面に収める",
    photoTipFocus: "ピントを合わせて撮影",
    confirmAndEdit: "情報の確認・編集",
    phoneticReading: "ふりがな",
    labelExample: "ラベル (例: 本社)",
    postalCodeExample: "郵便番号 (例: 100-0001)",
    addAddress: "住所を追加",
    work: "会社",
    fax: "FAX",
    other: "その他",
    addPhoneNumber: "電話番号を追加",
    vcardPreview: "vCard プレビュー",
    saveVCard: "vCardを保存",
    failedToAnalyzeCard: "名刺の解析に失敗しました",

    // Profile Edit
    profileEdit: "プロフィール編集",
    editProfileDescription: "あなたのプロフィール情報を編集できます",
    publicProfileDescription:
      "公開プロフィールに表示される基本的な情報を設定します",
    name: "名前",
    username: "ユーザー名",
    profileUrlPrefix: "プロフィールURL",
    designCustomization: "デザインカスタマイズ",
    designCustomizationDescription:
      "プロフィールページのデザインをカスタマイズできます",
    openDesignEditor: "デザインエディターを開く",
    usernameRequired: "ユーザー名は必須です",
    profileSaved: "プロフィールを保存しました",
    profileLoadError: "プロフィールの読み込みに失敗しました",
    profileSaveError: "プロフィールの保存に失敗しました",

    // VCard
    saveContact: "連絡先を保存",
    vcardDownloaded: "VCardをダウンロードしました",
    vcardDownloadFailed: "VCardのダウンロードに失敗しました",

    // Placeholders
    namePlaceholder: "山田 太郎",
    usernamePlaceholder: "yamada_taro",
    companyPlaceholder: "株式会社Example",
    positionPlaceholder: "営業部長",
    emailPlaceholder: "example@email.com",
    phonePlaceholder: "03-1234-5678",
    websitePlaceholder: "https://example.com",
    addressPlaceholder: "東京都渋谷区...",
    bioPlaceholder: "あなたについて教えてください...",

    // SimplePageEditor
    profileEditor: "プロフィール編集",
    addText: "テキストを追加",
    addImage: "画像を追加",
    addLink: "リンクを追加",
    addProfile: "プロフィールを追加",
    editText: "テキスト編集",
    editImage: "画像編集",
    editLink: "リンク編集",
    editProfileComponent: "プロフィール編集",
    textContent: "テキスト内容",
    textPlaceholderInput: "テキストを入力してください",
    imageAlt: "代替テキスト（alt）",
    imageAltPlaceholder: "画像の説明",
    imageUrl: "画像URL",
    upload: "アップロード",
    uploading: "アップロード中...",
    imageSizeLimit: "画像サイズは5MB以下にしてください",
    uploadFailed: "画像のアップロードに失敗しました",
    noPermission: "アップロード権限がありません。ログインし直してください。",
    linkLabel: "表示テキスト",
    linkLabelPlaceholder: "リンクのラベル",
    linkPreview: "プレビュー",
    clickToEdit: "クリックして編集",
    manualSave: "手動保存",
    savedAt: "に保存済み",
    saveFailed: "保存に失敗しました",
    unsupportedComponent: "未対応のコンポーネントタイプ",
    noComponents: "コンポーネントがありません",
    addComponentMessage:
      "下の「コンポーネントを追加」ボタンから追加してください",
    newText: "新しいテキスト",
    newLink: "リンク",
    backgroundImage: "背景画像",
    backgroundOpacity: "背景画像の不透明度",
    previewMobile: "プレビュー（スマホ表示）",
    profilePhoto: "プロフィール写真",
    noImage: "画像がありません",

    // ComponentEditor specific
    urlInput: "URL入力",
    autoSet: "自動設定",
    basic: "基本",
    contact: "連絡",
    addressTab: "住所",
    companyInfo: "会社",
    lastNameField: "姓",
    firstNameField: "名",
    phoneticLastNameDetailed: "ふりがな（姓）",
    phoneticFirstNameDetailed: "ふりがな（名）",
    briefIntroduction: "簡単な自己紹介",
    profilePhotoField: "プロフィール写真",
    workPhone: "電話番号（会社）",
    cellPhone: "携帯電話",
    departmentField: "部署",
    postalCodeField: "郵便番号",
    cityField: "都道府県・市区町村",
    profileCardBackground: "プロフィールカードの背景色",
    cardTransparency: "カードの透明度",
    transparencyDescription: "0%（完全に透明）〜 100%（不透明）",
    blue: "ブルー",
    green: "グリーン",
    orange: "オレンジ",
    red: "レッド",
    purple: "パープル",
    pink: "ピンク",
    gray: "グレー",
    black: "ブラック",

    // BackgroundCustomizer
    backgroundCustomize: "背景カスタマイズ",
    solidColor: "単色",
    gradientShort: "グラデ",
    selectColor: "色を選択",
    customColor: "カスタムカラー",
    preset: "プリセット",
    customSettings: "カスタム設定",
    startColor: "開始色",
    endColor: "終了色",
    purpleGradient: "紫グラデーション",
    pinkGradient: "ピンクグラデーション",
    blueGradient: "青グラデーション",
    greenGradient: "緑グラデーション",
    sunset: "サンセット",
    deepSea: "深海",
    backgroundImageTab: "画像",

    // CollapsibleComponentList
    profileSection: "プロフィール",
    textSection: "テキスト",
    imageSection: "画像",
    linkSection: "リンク",

    // QR Code
    qrCode: "QRコード",
    shareProfile: "プロフィールを共有",
    downloadQR: "QRコードをダウンロード",
    copyLink: "リンクをコピー",
    linkCopied: "リンクをコピーしました",
    qrCodeDescription: "このQRコードを名刺や印刷物に使用できます",
    generatingQRCode: "QRコード生成中...",
    qrCodeDownloaded: "QRコードをダウンロードしました",
    urlCopiedToClipboard: "URLをクリップボードにコピーしました",
    qrCodeGenerationFailed: "QRコードの生成に失敗しました",
    copyFailed: "コピーに失敗しました",

    // Common
    close: "閉じる",
    open: "開く",
    yes: "はい",
    no: "いいえ",
    confirm: "確認",
    back: "戻る",
    next: "次へ",
    finish: "完了",
    required: "必須",
    optional: "任意",
    viewDetails: "詳細を表示",
    noData: "データがありません",
    tryAgain: "もう一度お試しください",

    // Public Profile Page
    profileNotFound: "プロフィールが見つかりません",
    returnHome: "ホームに戻る",
    contactInfo: "連絡先",
    socialLinks: "ソーシャルリンク",
    linkText: "リンク",
    scanBusinessCardButton: "名刺をスキャン",
    loginToScanCard: "ログインして名刺をスキャン",
    showQRCode: "QRコード表示",

    // Sign In / Sign Up Page
    signIn: "ログイン",
    signUp: "新規登録",
    emailAddress: "メールアドレス",
    password: "パスワード",
    confirmPasswordLabel: "パスワード（確認）",
    displayName: "名前（任意）",
    forgotPassword: "パスワードをお忘れですか？",
    signInWithEmail: "メールでログイン",
    signInWithGoogle: "Googleでログイン",
    createAccount: "アカウント作成",
    backToSignIn: "ログインに戻る",
    passwordReset: "パスワードリセット",
    sendResetEmail: "リセットメールを送信",
    sendingEmail: "送信中...",
    signingIn: "ログイン中...",
    creatingAccount: "アカウント作成中...",
    passwordMismatch: "パスワードが一致しません。",
    passwordTooShort: "パスワードは6文字以上にしてください。",
    accountCreated: "アカウントを作成しました。確認メールをご確認ください。",
    enterEmail: "メールアドレスを入力してください。",
    resetEmailSent: "パスワードリセットメールを {email} に送信しました。",
    verificationEmailResent: "確認メールを再送信しました。",
    resetPasswordDescription:
      "登録したメールアドレスにパスワードリセットリンクを送信します。",
    emailNotVerified: "メールアドレスが確認されていません。",
    resendVerificationEmail: "確認メールを再送信",
    verificationEmailInfo:
      "アカウント作成後、メールアドレスの確認が必要です。確認メールに記載されたリンクをクリックしてください。",
    tagline: "デジタル名刺で新しいネットワーキングを始めましょう",
    termsAgreement:
      "続行することで、{terms}と{privacy}に同意したものとみなされます。",
    terms: "利用規約",
    privacyPolicy: "プライバシーポリシー",
    namePlaceholderJa: "山田 太郎",
    passwordPlaceholder6Chars: "••••••••（6文字以上）",

    // Home Page
    getStarted: "Get Started",

    // Promo Code
    promoCode: "プロモーションコード",
    enterPromoCode: "プロモーションコードを入力",
    applyPromoCode: "適用",
    promoCodePlaceholder: "コードを入力してください",
    promoCodeSuccess: "Proプランにアップグレードしました！",
    promoCodeInvalid: "無効なプロモーションコードです。",
    promoCodeAlreadyUsed: "このコードは既に使用済みです。",
    promoCodeAlreadyPro: "既にProプランです。",
    upgradeToPro: "Proプランにアップグレード",
    currentPlan: "現在のプラン",
    freePlan: "無料プラン",
    proPlan: "Proプラン",
    scanLimitReached: "今月のスキャン上限に達しました",
    upgradeForUnlimited: "Proプランで無制限スキャン",
    scanSaveFailed: "スキャン結果の保存に失敗しました。もう一度お試しください。",
    quotaExceeded: "今月のスキャン上限に達しました。プロモーションコードでProプランにアップグレードすると無制限でご利用いただけます。",
  },
  en: {
    // Dashboard
    title: "Dashboard",
    welcome: "Welcome",
    profileSetup: "Profile setup required",
    publicProfile: "Public Profile",
    editProfile: "Edit Profile",
    scanCard: "Scan Business Card",
    logout: "Logout",
    analytics: "Analytics",
    totalViews: "Total Views",
    todayViews: "Today",
    weekViews: "This Week",
    language: "Language",

    // Profile Edit
    profile: "Profile",
    basicInfo: "Basic Information",
    firstName: "First Name",
    lastName: "Last Name",
    phoneticFirstName: "Phonetic First Name",
    phoneticLastName: "Phonetic Last Name",
    email: "Email",
    phone: "Phone",
    mobile: "Mobile",
    company: "Company",
    department: "Department",
    position: "Position",
    website: "Website",
    bio: "Bio",
    postalCode: "Postal Code",
    address: "Address",
    city: "City",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    loading: "Loading...",
    saving: "Saving...",
    saved: "Saved",
    error: "An error occurred",

    // Profile Editor
    design: "Design",
    background: "Background",
    backgroundColor: "Background Color",
    gradient: "Gradient",
    opacity: "Opacity",
    profileCardColor: "Profile Card Color",
    addComponent: "Add Component",
    text: "Text",
    image: "Image",
    link: "Link",
    preview: "Preview",

    // Business Card Scanner
    businessCardScanner: "Business Card Scanner",
    scanBusinessCard: "Scan Business Card",
    selectFromGallery: "Select from Gallery",
    takePhoto: "Take Photo",
    processing: "Processing...",
    scanResult: "Scan Result",
    addToContacts: "Add to Contacts",
    scanAgain: "Scan Again",
    remainingScans: "Remaining Scans",
    upgradeForMore: "Upgrade for more scans",
    backToDashboard: "Back to Dashboard",
    viewPublicProfile: "View Public Profile",
    scanBusinessCardDescription:
      "Take a photo of a business card to extract contact information",
    success: "Success",
    scansThisMonth: "Scans this month",
    unlimited: "Unlimited",
    approachingMonthlyLimit: "Approaching monthly limit",
    reset: "Reset",
    daysRemaining: "days remaining",
    selectImageFile: "Please select an image file",
    or: "or",
    selectImage: "Select Image",
    photoTips: "Photo Tips",
    photoTipBrightArea: "Take photo in bright area",
    photoTipCaptureEntire: "Capture entire business card",
    photoTipFocus: "Take photo with focus",
    confirmAndEdit: "Confirm and Edit Information",
    phoneticReading: "phonetic",
    labelExample: "Label (e.g. Head Office)",
    postalCodeExample: "Postal Code (e.g. 100-0001)",
    addAddress: "Add Address",
    work: "Work",
    fax: "FAX",
    other: "Other",
    addPhoneNumber: "Add Phone Number",
    vcardPreview: "vCard Preview",
    saveVCard: "Save vCard",
    failedToAnalyzeCard: "Failed to analyze business card",

    // Profile Edit
    profileEdit: "Edit Profile",
    editProfileDescription: "Edit your profile information",
    publicProfileDescription:
      "Set basic information to display on your public profile",
    name: "Name",
    username: "Username",
    profileUrlPrefix: "Profile URL",
    designCustomization: "Design Customization",
    designCustomizationDescription: "Customize your profile page design",
    openDesignEditor: "Open Design Editor",
    usernameRequired: "Username is required",
    profileSaved: "Profile saved successfully",
    profileLoadError: "Failed to load profile",
    profileSaveError: "Failed to save profile",

    // VCard
    saveContact: "Save Contact",
    vcardDownloaded: "VCard downloaded",
    vcardDownloadFailed: "Failed to download VCard",

    // Placeholders
    namePlaceholder: "John Smith",
    usernamePlaceholder: "john_smith",
    companyPlaceholder: "Example Inc.",
    positionPlaceholder: "Sales Manager",
    emailPlaceholder: "example@email.com",
    phonePlaceholder: "+1-234-567-8900",
    websitePlaceholder: "https://example.com",
    addressPlaceholder: "123 Main St, New York...",
    bioPlaceholder: "Tell us about yourself...",

    // SimplePageEditor
    profileEditor: "Profile Editor",
    addText: "Add Text",
    addImage: "Add Image",
    addLink: "Add Link",
    addProfile: "Add Profile",
    editText: "Edit Text",
    editImage: "Edit Image",
    editLink: "Edit Link",
    editProfileComponent: "Edit Profile",
    textContent: "Text Content",
    textPlaceholderInput: "Enter your text",
    imageAlt: "Alternative Text (alt)",
    imageAltPlaceholder: "Image description",
    imageUrl: "Image URL",
    upload: "Upload",
    uploading: "Uploading...",
    imageSizeLimit: "Image size must be under 5MB",
    uploadFailed: "Failed to upload image",
    noPermission: "No upload permission. Please login again.",
    linkLabel: "Display Text",
    linkLabelPlaceholder: "Link label",
    linkPreview: "Preview",
    clickToEdit: "Click to edit",
    manualSave: "Manual Save",
    savedAt: "Saved at",
    saveFailed: "Save failed",
    unsupportedComponent: "Unsupported component type",
    noComponents: "No components",
    addComponentMessage: "Please add components using the button below",
    newText: "New text",
    newLink: "Link",
    backgroundImage: "Background Image",
    backgroundOpacity: "Background Image Opacity",
    previewMobile: "Preview (Mobile View)",
    profilePhoto: "Profile Photo",
    noImage: "No image",

    // ComponentEditor specific
    urlInput: "URL Input",
    autoSet: "Auto Set",
    basic: "Basic",
    contact: "Contact",
    addressTab: "Address",
    companyInfo: "Company",
    lastNameField: "Last Name",
    firstNameField: "First Name",
    phoneticLastNameDetailed: "Phonetic (Last)",
    phoneticFirstNameDetailed: "Phonetic (First)",
    briefIntroduction: "Brief introduction",
    profilePhotoField: "Profile Photo",
    workPhone: "Work Phone",
    cellPhone: "Cell Phone",
    departmentField: "Department",
    postalCodeField: "Postal Code",
    cityField: "City/State",
    profileCardBackground: "Profile Card Background Color",
    cardTransparency: "Card Transparency",
    transparencyDescription: "0% (Transparent) ~ 100% (Opaque)",
    blue: "Blue",
    green: "Green",
    orange: "Orange",
    red: "Red",
    purple: "Purple",
    pink: "Pink",
    gray: "Gray",
    black: "Black",

    // BackgroundCustomizer
    backgroundCustomize: "Background Customize",
    solidColor: "Solid",
    gradientFull: "Gradient",
    selectColor: "Select Color",
    customColor: "Custom Color",
    preset: "Preset",
    customSettings: "Custom Settings",
    startColor: "Start Color",
    endColor: "End Color",
    purpleGradient: "Purple Gradient",
    pinkGradient: "Pink Gradient",
    blueGradient: "Blue Gradient",
    greenGradient: "Green Gradient",
    sunset: "Sunset",
    deepSea: "Deep Sea",
    backgroundImageTab: "Image",

    // CollapsibleComponentList
    profileSection: "Profile",
    textSection: "Text",
    imageSection: "Image",
    linkSection: "Link",

    // QR Code
    qrCode: "QR Code",
    shareProfile: "Share Profile",
    downloadQR: "Download QR Code",
    copyLink: "Copy Link",
    linkCopied: "Link Copied",
    qrCodeDescription:
      "Use this QR code on business cards and printed materials",
    generatingQRCode: "Generating QR code...",
    qrCodeDownloaded: "QR code downloaded",
    urlCopiedToClipboard: "URL copied to clipboard",
    qrCodeGenerationFailed: "Failed to generate QR code",
    copyFailed: "Failed to copy",

    // Common
    close: "Close",
    open: "Open",
    yes: "Yes",
    no: "No",
    confirm: "Confirm",
    back: "Back",
    next: "Next",
    finish: "Finish",
    required: "Required",
    optional: "Optional",
    viewDetails: "View Details",
    noData: "No data available",
    tryAgain: "Try Again",

    // Public Profile Page
    profileNotFound: "Profile not found",
    returnHome: "Return to Home",
    contactInfo: "Contact Information",
    socialLinks: "Social Links",
    linkText: "Link",
    scanBusinessCardButton: "Scan Business Card",
    loginToScanCard: "Login to Scan Business Card",
    showQRCode: "Show QR Code",

    // Sign In / Sign Up Page
    signIn: "Sign In",
    signUp: "Sign Up",
    emailAddress: "Email Address",
    password: "Password",
    confirmPasswordLabel: "Confirm Password",
    displayName: "Name (Optional)",
    forgotPassword: "Forgot password?",
    signInWithEmail: "Sign in with Email",
    signInWithGoogle: "Sign in with Google",
    createAccount: "Create Account",
    backToSignIn: "Back to Sign In",
    passwordReset: "Password Reset",
    sendResetEmail: "Send Reset Email",
    sendingEmail: "Sending...",
    signingIn: "Signing in...",
    creatingAccount: "Creating account...",
    passwordMismatch: "Passwords do not match.",
    passwordTooShort: "Password must be at least 6 characters.",
    accountCreated: "Account created. Please check your email for verification.",
    enterEmail: "Please enter your email address.",
    resetEmailSent: "Password reset email sent to {email}.",
    verificationEmailResent: "Verification email resent.",
    resetPasswordDescription:
      "We'll send a password reset link to your registered email address.",
    emailNotVerified: "Email address not verified.",
    resendVerificationEmail: "Resend verification email",
    verificationEmailInfo:
      "After creating an account, you need to verify your email address. Please click the link in the verification email.",
    tagline: "Start new networking with digital business cards",
    termsAgreement:
      "By continuing, you agree to our {terms} and {privacy}.",
    terms: "Terms of Service",
    privacyPolicy: "Privacy Policy",
    namePlaceholderJa: "John Smith",
    passwordPlaceholder6Chars: "•••••••• (6+ characters)",

    // Home Page
    getStarted: "Get Started",

    // Promo Code
    promoCode: "Promo Code",
    enterPromoCode: "Enter promo code",
    applyPromoCode: "Apply",
    promoCodePlaceholder: "Enter your code",
    promoCodeSuccess: "Upgraded to Pro plan!",
    promoCodeInvalid: "Invalid promo code.",
    promoCodeAlreadyUsed: "This code has already been used.",
    promoCodeAlreadyPro: "You are already on the Pro plan.",
    upgradeToPro: "Upgrade to Pro",
    currentPlan: "Current Plan",
    freePlan: "Free Plan",
    proPlan: "Pro Plan",
    scanLimitReached: "Monthly scan limit reached",
    upgradeForUnlimited: "Upgrade to Pro for unlimited scans",
    scanSaveFailed: "Failed to save scan result. Please try again.",
    quotaExceeded: "Monthly scan limit reached. Upgrade to Pro with a promo code for unlimited scans.",
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // クライアント側で即時に既存の言語設定を反映し、初回描画の空白を避ける
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("userLanguage");
      if (saved === "ja" || saved === "en") return saved;
    }
    return "ja";
  });

  // 認証ユーザーの言語設定をFirestoreから非同期で上書き
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (!cancelled && userSnap.exists()) {
          const data = userSnap.data();
          if (data.language === "ja" || data.language === "en") {
            setLanguageState(data.language as Language);
          }
        }
      } catch (error) {
        console.error("Error loading language preference:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Save language preference
  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("userLanguage", lang);

    if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, { language: lang }, { merge: true });
      } catch (error) {
        console.error("Error saving language preference:", error);
      }
    }
  };

  // Translation function
  const t = (key: string): string => {
    const keys = key.split(".");
    let value: any = translations[language];

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    return typeof value === "string" ? value : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
