"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { BIO_MAX_LENGTH, BIO_WARNING_THRESHOLD } from "@/lib/constants/profile";
import { db } from "@/lib/firebase";
import { getUidFallbackUsername } from "@/lib/username";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Loader2, Palette, RefreshCw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ImageUploader } from "@/components/simple-editor/ImageUploader";

interface ProfileData {
  name: string;
  username: string;
  bio: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  photoURL: string;
}

type LegacyUrlAction = "redirect" | "disable";

interface UsernameAlias {
  username: string;
  status: "redirect" | "disabled";
  targetUsername: string;
}

export default function EditProfilePage() {
  const { user, loading, getIdToken } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRotatingUsername, setIsRotatingUsername] = useState(false);
  const [isUpdatingAlias, setIsUpdatingAlias] = useState<string | null>(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [originalUsername, setOriginalUsername] = useState("");
  const [legacyUrlAction, setLegacyUrlAction] =
    useState<LegacyUrlAction>("redirect");
  const [usernameAliases, setUsernameAliases] = useState<UsernameAlias[]>([]);
  const [profile, setProfile] = useState<ProfileData>({
    name: "",
    username: "",
    bio: "",
    company: "",
    position: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    photoURL: "",
  });

  const loadProfile = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const username = userData?.username || getUidFallbackUsername(user.uid);

      let fromComponent: Record<string, string> = {};
      try {
        const profileDoc = await getDoc(
          doc(db, "users", user.uid, "profile", "data"),
        );
        if (profileDoc.exists()) {
          const pd = profileDoc.data();
          const comps: any[] = Array.isArray(pd?.components)
            ? pd.components
            : [];
          const pc = comps.find((c: any) => c.type === "profile");
          if (pc?.content) {
            const c = pc.content;
            fromComponent = {
              name: c.name || `${c.lastName || ""} ${c.firstName || ""}`.trim(),
              bio: c.bio || "",
              company: c.company || "",
              position: c.position || "",
              email: c.email || "",
              phone: c.phone || c.cellPhone || "",
              website: c.website || "",
              address:
                [c.postalCode, c.city, c.address].filter(Boolean).join(" ") ||
                "",
              photoURL: c.photoURL || "",
            };
          }
        }
      } catch {}

      const hasComponentData = Object.values(fromComponent).some(
        (v) => v !== "",
      );
      const fallback = {
        name: userData?.name || user.displayName || "",
        bio: userData?.bio || "",
        company: userData?.company || "",
        position: userData?.position || "",
        email: userData?.email || user.email || "",
        phone: userData?.phone || "",
        website: userData?.website || "",
        address: userData?.address || "",
        photoURL: userData?.photoURL || "",
      };
      const src = hasComponentData ? fromComponent : fallback;

      setProfile({
        name: src.name || user.displayName || "",
        username,
        bio: src.bio || "",
        company: src.company || "",
        position: src.position || "",
        email: src.email || user.email || "",
        phone: src.phone || "",
        website: src.website || "",
        address: src.address || "",
        photoURL: src.photoURL || "",
      });
      setOriginalUsername(username);
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: t("error"),
        description: t("profileLoadError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, t]);

  const loadUsernameAliases = useCallback(async () => {
    if (!user) return;

    try {
      const token = await getIdToken();
      if (!token) return;

      const response = await fetch("/api/users/me/username-aliases", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) return;

      const data = await response.json();
      setUsernameAliases(Array.isArray(data.aliases) ? data.aliases : []);
    } catch (error) {
      console.error("Error loading username aliases:", error);
    }
  }, [user, getIdToken]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/signin");
    } else if (user) {
      loadProfile();
      loadUsernameAliases();
    }
  }, [user, loading, router, loadProfile, loadUsernameAliases]);

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    if (field === "username") {
      setUsernameSuggestions([]);
    }

    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!user) return;

    if (!profile.username) {
      toast({
        title: t("error"),
        description: t("usernameRequired"),
        variant: "destructive",
      });
      return;
    }

    const usernameChanged =
      originalUsername &&
      profile.username.trim().toLowerCase() !==
        originalUsername.trim().toLowerCase();
    if (usernameChanged && !window.confirm(t("profileUrlChangeConfirm"))) {
      return;
    }

    setIsSaving(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Missing ID token");
      }

      const response = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...profile,
          legacyUrlAction,
        }),
      });

      const data = await response.json();
      if (response.status === 409 && data.error === "username_taken") {
        setUsernameSuggestions(
          Array.isArray(data.suggestions) ? data.suggestions : [],
        );
        toast({
          title: t("error"),
          description: t("usernameUnavailable"),
          variant: "destructive",
        });
        return;
      }

      if (response.status === 400 && data.error === "username_invalid") {
        toast({
          title: t("error"),
          description: t("usernameInvalid"),
          variant: "destructive",
        });
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to save profile");
      }

      if (data.profile?.username) {
        setProfile((prev) => ({ ...prev, username: data.profile.username }));
        setOriginalUsername(data.profile.username);
      }

      try {
        const profileDocRef = doc(db, "users", user.uid, "profile", "data");
        const profileDoc = await getDoc(profileDocRef);
        const nameParts = profile.name.split(" ");
        const firstName =
          nameParts.length > 1
            ? nameParts.slice(1).join(" ")
            : nameParts[0] || "";
        const lastName = nameParts.length > 1 ? nameParts[0] : "";

        if (profileDoc.exists()) {
          const pd = profileDoc.data();
          const components: any[] = Array.isArray(pd?.components)
            ? pd.components
            : [];
          const updated = components.map((comp: any) => {
            if (comp.type !== "profile") return comp;
            return {
              ...comp,
              content: {
                ...(comp.content || {}),
                ...(profile.name
                  ? { name: profile.name, firstName, lastName }
                  : {}),
                ...(profile.bio ? { bio: profile.bio } : {}),
                ...(profile.company ? { company: profile.company } : {}),
                ...(profile.position ? { position: profile.position } : {}),
                ...(profile.email ? { email: profile.email } : {}),
                ...(profile.phone ? { phone: profile.phone } : {}),
                ...(profile.website ? { website: profile.website } : {}),
                ...(profile.photoURL ? { photoURL: profile.photoURL } : {}),
              },
            };
          });
          await updateDoc(profileDocRef, { components: updated });
        }
      } catch {}

      toast({
        title: t("success"),
        description: usernameChanged
          ? legacyUrlAction === "redirect"
            ? t("profileUrlChangedRedirecting")
            : t("profileUrlChangedWarning")
          : t("profileSaved"),
      });
      await loadUsernameAliases();

      router.push("/dashboard");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: t("error"),
        description: t("profileSaveError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRotateUsername = async () => {
    if (!user || isRotatingUsername) return;

    const confirmed = window.confirm(t("profileUrlChangeConfirm"));
    if (!confirmed) return;

    setIsRotatingUsername(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Missing ID token");
      }

      const response = await fetch("/api/users/me/rotate-username", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ legacyUrlAction }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to rotate username");
      }

      setProfile((prev) => ({ ...prev, username: data.username }));
      setOriginalUsername(data.username);
      setUsernameSuggestions([]);
      toast({
        title: t("success"),
        description:
          legacyUrlAction === "redirect"
            ? t("profileUrlChangedRedirecting")
            : t("profileUrlChangedWarning"),
      });
      await loadUsernameAliases();
    } catch (error) {
      console.error("Error rotating username:", error);
      toast({
        title: t("error"),
        description: t("randomUsernameUpdateError"),
        variant: "destructive",
      });
    } finally {
      setIsRotatingUsername(false);
    }
  };

  const handleAliasUpdate = async (
    aliasUsername: string,
    action: LegacyUrlAction,
  ) => {
    if (!user || isUpdatingAlias) return;

    setIsUpdatingAlias(aliasUsername);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Missing ID token");
      }

      const response = await fetch("/api/users/me/username-aliases", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ aliasUsername, action }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update username alias");
      }

      setUsernameAliases((prev) =>
        prev.map((alias) =>
          alias.username === data.alias.username ? data.alias : alias,
        ),
      );
      toast({
        title: t("success"),
        description:
          action === "redirect"
            ? t("legacyUrlRedirectEnabled")
            : t("legacyUrlDisabled"),
      });
    } catch (error) {
      console.error("Error updating username alias:", error);
      toast({
        title: t("error"),
        description: t("legacyUrlUpdateError"),
        variant: "destructive",
      });
    } finally {
      setIsUpdatingAlias(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:p-6 max-w-4xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          {t("profileEdit")}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t("editProfileDescription")}
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("basicInfo")}</CardTitle>
            <CardDescription>{t("publicProfileDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("name")} *</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder={t("namePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">{t("username")} *</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="username"
                    value={profile.username}
                    onChange={(e) =>
                      handleInputChange("username", e.target.value)
                    }
                    placeholder={t("usernamePlaceholder")}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRotateUsername}
                    disabled={isRotatingUsername || isSaving}
                    className="w-full sm:w-auto"
                  >
                    {isRotatingUsername ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {t("useRandomUsername")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("randomUsernameHelp")}
                </p>
                {user && (
                  <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                    <p className="text-xs text-blue-900">
                      {t("profileIdEditHelp")}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-8 bg-white"
                      onClick={() =>
                        handleInputChange(
                          "username",
                          getUidFallbackUsername(user.uid).toLowerCase(),
                        )
                      }
                    >
                      {t("useUidUsername")}
                    </Button>
                  </div>
                )}
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-900">
                    {t("legacyUrlHandlingTitle")}
                  </p>
                  <div className="mt-2 space-y-2">
                    <label className="flex cursor-pointer gap-2 rounded-md bg-white p-2 text-xs text-gray-700">
                      <input
                        type="radio"
                        name="legacy-url-action"
                        value="redirect"
                        checked={legacyUrlAction === "redirect"}
                        onChange={() => setLegacyUrlAction("redirect")}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-medium text-gray-900">
                          {t("legacyUrlRedirectChoice")}
                        </span>
                        <span className="block text-gray-600">
                          {t("legacyUrlRedirectHelp")}
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer gap-2 rounded-md bg-white p-2 text-xs text-gray-700">
                      <input
                        type="radio"
                        name="legacy-url-action"
                        value="disable"
                        checked={legacyUrlAction === "disable"}
                        onChange={() => setLegacyUrlAction("disable")}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-medium text-gray-900">
                          {t("legacyUrlDisableChoice")}
                        </span>
                        <span className="block text-gray-600">
                          {t("legacyUrlDisableHelp")}
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("profileUrlPrefix")}: /p/{profile.username || "username"}
                </p>
                {usernameSuggestions.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-medium text-amber-900">
                      {t("usernameSuggestions")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {usernameSuggestions.map((suggestion) => (
                        <Button
                          key={suggestion}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 bg-white"
                          onClick={() =>
                            handleInputChange("username", suggestion)
                          }
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">{t("company")}</Label>
                <Input
                  id="company"
                  value={profile.company}
                  onChange={(e) => handleInputChange("company", e.target.value)}
                  placeholder={t("companyPlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">{t("position")}</Label>
                <Input
                  id="position"
                  value={profile.position}
                  onChange={(e) =>
                    handleInputChange("position", e.target.value)
                  }
                  placeholder={t("positionPlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder={t("emailPlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t("phone")}</Label>
                <Input
                  id="phone"
                  value={profile.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder={t("phonePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">{t("website")}</Label>
                <Input
                  id="website"
                  value={profile.website}
                  onChange={(e) => handleInputChange("website", e.target.value)}
                  placeholder={t("websitePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{t("address")}</Label>
                <Input
                  id="address"
                  value={profile.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder={t("addressPlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">{t("bio")}</Label>
              <Textarea
                id="bio"
                value={profile.bio}
                onChange={(e) => handleInputChange("bio", e.target.value)}
                placeholder={t("bioPlaceholder")}
                maxLength={BIO_MAX_LENGTH}
                rows={4}
              />
              <div className="flex items-center justify-between text-xs">
                <span
                  className={
                    profile.bio.length >= BIO_WARNING_THRESHOLD
                      ? "text-amber-600"
                      : "text-muted-foreground"
                  }
                >
                  {profile.bio.length >= BIO_WARNING_THRESHOLD
                    ? t("bioLimitWarning")
                    : ""}
                </span>
                <span className="text-muted-foreground">
                  {profile.bio.length} / {BIO_MAX_LENGTH}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {usernameAliases.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("legacyUrlManagementTitle")}</CardTitle>
              <CardDescription>
                {t("legacyUrlManagementDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {usernameAliases.map((alias) => (
                <div
                  key={alias.username}
                  className="rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        /p/{alias.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {alias.status === "redirect"
                          ? t("legacyUrlRedirectingTo").replace(
                              "{username}",
                              alias.targetUsername,
                            )
                          : t("legacyUrlCurrentlyDisabled")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={
                          alias.status === "redirect" ? "default" : "outline"
                        }
                        size="sm"
                        disabled={isUpdatingAlias === alias.username}
                        onClick={() =>
                          handleAliasUpdate(alias.username, "redirect")
                        }
                      >
                        {isUpdatingAlias === alias.username ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {t("enableRedirect")}
                      </Button>
                      <Button
                        type="button"
                        variant={
                          alias.status === "disabled" ? "default" : "outline"
                        }
                        size="sm"
                        disabled={isUpdatingAlias === alias.username}
                        onClick={() =>
                          handleAliasUpdate(alias.username, "disable")
                        }
                      >
                        {t("disableRedirect")}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("profilePhoto")}</CardTitle>
            <CardDescription>{t("profilePhotoField")}</CardDescription>
          </CardHeader>
          <CardContent>
            {user && (
              <ImageUploader
                userId={user.uid}
                onImageUploaded={(url) => handleInputChange("photoURL", url)}
                currentImageUrl={profile.photoURL}
                isCircular={true}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("designCustomization")}</CardTitle>
            <CardDescription>
              {t("designCustomizationDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push("/dashboard/edit/design")}
              variant="outline"
              className="w-full"
            >
              <Palette className="mr-2 h-4 w-4" />
              {t("openDesignEditor")}
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 justify-end">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("saving")}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {t("save")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
