interface BasicProfilePresentation {
  name: string;
  bio: string;
  company: string;
  position: string;
  photoURL?: string;
}

interface ProfileDocument {
  components?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(content: Record<string, unknown>, key: string): string {
  return typeof content[key] === "string" ? content[key] : "";
}

/** The first visible profile card is the source for public previews and QR branding. */
export function resolvePublicProfilePresentation(
  user: BasicProfilePresentation,
  profileData: ProfileDocument | null,
): BasicProfilePresentation {
  const components = profileData?.components;
  if (!Array.isArray(components)) return user;

  const profileComponent = [...components]
    .filter((component) => isRecord(component) && component.type === "profile")
    .sort((left, right) => {
      const leftOrder = typeof left.order === "number" ? left.order : 0;
      const rightOrder = typeof right.order === "number" ? right.order : 0;
      return leftOrder - rightOrder;
    })[0];

  if (!profileComponent) return user;

  // A field removed in SimpleEditor is deliberately blank; do not resurrect
  // a stale value from users/{uid} for metadata or the QR logo.
  const content = isRecord(profileComponent.content)
    ? profileComponent.content
    : {};
  const name =
    stringField(content, "name") ||
    `${stringField(content, "lastName")} ${stringField(content, "firstName")}`.trim() ||
    "名前未設定";

  return {
    name,
    bio: stringField(content, "bio"),
    company: stringField(content, "company"),
    position: stringField(content, "position"),
    photoURL: stringField(content, "photoURL"),
  };
}
