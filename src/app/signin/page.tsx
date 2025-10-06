"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Mail,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Info,
} from "lucide-react";
import { FcGoogle } from "react-icons/fc";

function SignInForm() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    user,
    resendVerificationEmail,
    loading,
  } = useAuth();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);
  const [defaultTab, setDefaultTab] = useState("signin");

  // フォーム状態
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  // URLパラメータからデフォルトタブを設定
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "signup" || tab === "signin") {
      setDefaultTab(tab);
    }
  }, [searchParams]);

  // 既にログイン済みの場合はダッシュボードへリダイレクト
  useEffect(() => {
    if (user && !loading) {
      // ロケールを保持したままリダイレクト
      const locale = pathname.startsWith("/en") ? "/en" : "";
      router.push(`${locale}/dashboard`);
    }
  }, [user, loading, router, pathname]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      setIsLoading(false);
      setError(error.message);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await signInWithEmail(email, password);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // バリデーション
    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(t("passwordTooShort"));
      setIsLoading(false);
      return;
    }

    try {
      await signUpWithEmail(email, password, displayName);
      setVerificationEmailSent(true);
      setSuccess(t("accountCreated"));
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (!email) {
      setError(t("enterEmail"));
      setIsLoading(false);
      return;
    }

    try {
      await resetPassword(email);
      setSuccess(t("resetEmailSent").replace("{email}", email));
      setTimeout(() => {
        setShowResetPassword(false);
        setSuccess(null);
      }, 5000);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await resendVerificationEmail();
      setSuccess(t("verificationEmailResent"));
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // パスワードリセットフォーム
  if (showResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Card>
            <CardHeader>
              <Button
                variant="ghost"
                className="w-fit mb-2"
                onClick={() => setShowResetPassword(false)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("backToSignIn")}
              </Button>
              <CardTitle>{t("passwordReset")}</CardTitle>
              <CardDescription>{t("resetPasswordDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="mb-4 border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    {success}
                  </AlertDescription>
                </Alert>
              )}
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">{t("emailAddress")}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder={t("emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("sendingEmail")}
                    </>
                  ) : (
                    t("sendResetEmail")
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">TapForge</h1>
          <p className="text-muted-foreground">{t("tagline")}</p>
        </div>

        <Card>
          <CardContent className="p-6">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="mb-4 border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            {/* メール未確認の警告 */}
            {user &&
              !user.emailVerified &&
              user.providerData[0]?.providerId === "password" && (
                <Alert className="mb-4 border-yellow-200 bg-yellow-50">
                  <Info className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    {t("emailNotVerified")}
                    <button
                      onClick={handleResendVerification}
                      className="ml-1 underline font-medium hover:text-yellow-900"
                      disabled={isLoading}
                    >
                      {t("resendVerificationEmail")}
                    </button>
                  </AlertDescription>
                </Alert>
              )}

            <Tabs
              value={defaultTab}
              onValueChange={setDefaultTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">{t("signIn")}</TabsTrigger>
                <TabsTrigger value="signup">{t("signUp")}</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">{t("emailAddress")}</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="signin-password">{t("password")}</Label>
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(true)}
                        className="text-sm text-primary hover:underline"
                      >
                        {t("forgotPassword")}
                      </button>
                    </div>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("signingIn")}
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        {t("signInWithEmail")}
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                {verificationEmailSent && (
                  <Alert className="mb-4 border-blue-200 bg-blue-50">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      {t("verificationEmailInfo")}
                    </AlertDescription>
                  </Alert>
                )}
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">{t("displayName")}</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder={t("namePlaceholderJa")}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={isLoading}
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t("emailAddress")}</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t("password")}</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder={t("passwordPlaceholder6Chars")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">
                      {t("confirmPasswordLabel")}
                    </Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("creatingAccount")}
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        {t("createAccount")}
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {t("or")}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <FcGoogle className="mr-2 h-5 w-5" />
              {t("signInWithGoogle")}
            </Button>
          </CardContent>

          <CardFooter className="flex flex-col space-y-2 text-center text-sm text-muted-foreground">
            <div>
              {(() => {
                const text = t("termsAgreement");
                const parts = [];
                let lastIndex = 0;

                // {terms}の位置を見つける
                const termsIndex = text.indexOf("{terms}");
                if (termsIndex !== -1) {
                  // {terms}の前のテキスト
                  if (termsIndex > 0) {
                    parts.push(text.substring(0, termsIndex));
                  }
                  // Termsリンク
                  parts.push(
                    <Link
                      key="terms"
                      href="https://tapforge.pages.dev/terms/"
                      className="underline underline-offset-4 hover:text-primary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("terms")}
                    </Link>
                  );
                  lastIndex = termsIndex + 7; // "{terms}".length
                }

                // {privacy}の位置を見つける
                const privacyIndex = text.indexOf("{privacy}", lastIndex);
                if (privacyIndex !== -1) {
                  // {privacy}の前のテキスト
                  if (privacyIndex > lastIndex) {
                    parts.push(text.substring(lastIndex, privacyIndex));
                  }
                  // Privacyリンク
                  parts.push(
                    <Link
                      key="privacy"
                      href="https://tapforge.pages.dev/privacy/"
                      className="underline underline-offset-4 hover:text-primary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("privacyPolicy")}
                    </Link>
                  );
                  lastIndex = privacyIndex + 9; // "{privacy}".length
                }

                // 残りのテキスト
                if (lastIndex < text.length) {
                  parts.push(text.substring(lastIndex));
                }

                return parts;
              })()}
            </div>
            <Link href="/" className="text-primary hover:underline">
              {t("returnHome")}
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
