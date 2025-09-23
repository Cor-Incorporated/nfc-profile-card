// src/components/simple-editor/utils/validation.ts
import { z } from "zod";
import DOMPurify from "isomorphic-dompurify";

// Configure DOMPurify to remove all HTML tags and keep only text
const sanitizeString = (str: string): string => {
  // Remove all HTML tags and keep only text content
  return DOMPurify.sanitize(str, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
};

// Sanitize HTML content (allows safe HTML)
const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "br", "p", "span", "div"],
    ALLOWED_ATTR: ["href", "target", "rel", "class"],
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
};

// Text content schema
export const TextContentSchema = z.object({
  text: z.string().min(1).max(5000).transform(sanitizeString),
});

// Image content schema
export const ImageContentSchema = z.object({
  src: z
    .string()
    .refine(
      (val) => val === "" || z.string().url().safeParse(val).success,
      "Invalid URL",
    )
    .optional(),
  alt: z.string().max(200).transform(sanitizeString).optional(),
});

// Link content schema
export const LinkContentSchema = z.object({
  url: z
    .string()
    .refine(
      (val) => val === "" || z.string().url().safeParse(val).success,
      "Invalid URL",
    ),
  label: z.string().max(200).transform(sanitizeString).optional(),
});

// Profile content schema
export const ProfileContentSchema = z.object({
  firstName: z.string().max(100).transform(sanitizeString).optional(),
  lastName: z.string().max(100).transform(sanitizeString).optional(),
  phoneticFirstName: z.string().max(100).transform(sanitizeString).optional(),
  phoneticLastName: z.string().max(100).transform(sanitizeString).optional(),
  name: z.string().max(200).transform(sanitizeString).optional(),
  company: z.string().max(200).transform(sanitizeString).optional(),
  position: z.string().max(200).transform(sanitizeString).optional(),
  department: z.string().max(200).transform(sanitizeString).optional(),
  email: z
    .string()
    .refine(
      (val) => val === "" || z.string().email().safeParse(val).success,
      "Invalid email",
    )
    .optional(),
  phone: z.string().max(50).transform(sanitizeString).optional(),
  cellPhone: z.string().max(50).transform(sanitizeString).optional(),
  website: z
    .string()
    .refine(
      (val) => val === "" || z.string().url().safeParse(val).success,
      "Invalid URL",
    )
    .optional(),
  address: z.string().max(500).transform(sanitizeString).optional(),
  city: z.string().max(200).transform(sanitizeString).optional(),
  postalCode: z.string().max(20).transform(sanitizeString).optional(),
  bio: z.string().max(1000).transform(sanitizeString).optional(),
  photoURL: z
    .string()
    .refine(
      (val) => val === "" || z.string().url().safeParse(val).success,
      "Invalid URL",
    )
    .optional(),
  cardBackgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  cardBackgroundOpacity: z.number().min(0).max(100).optional(),
});

// Component content schema (union of all content types)
export const ComponentContentSchema = z.union([
  TextContentSchema,
  ImageContentSchema,
  LinkContentSchema,
  ProfileContentSchema,
]);

// Component schema
export const ProfileComponentSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "image", "link", "profile"]),
  order: z.number().min(0),
  content: ComponentContentSchema,
  style: z.record(z.union([z.string(), z.number()])).optional(),
});

// Background settings schema
export const BackgroundSettingsSchema = z.object({
  type: z.enum(["color", "gradient", "image", "pattern"]),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  gradient: z
    .object({
      from: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      to: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      direction: z.string(),
    })
    .optional(),
  image: z
    .object({
      url: z.string().url(),
      opacity: z.number().min(0).max(1),
      blur: z.number().min(0).max(20).optional(),
    })
    .optional(),
  pattern: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
});

// Profile data schema
export const ProfileDataSchema = z.object({
  components: z.array(ProfileComponentSchema),
  background: BackgroundSettingsSchema.optional(),
  updatedAt: z.date(),
});

// Validation functions
export function validateComponentContent(
  type: string,
  content: unknown,
): boolean {
  try {
    switch (type) {
      case "text":
        TextContentSchema.parse(content);
        return true;
      case "image":
        ImageContentSchema.parse(content);
        return true;
      case "link":
        LinkContentSchema.parse(content);
        return true;
      case "profile":
        ProfileContentSchema.parse(content);
        return true;
      default:
        return false;
    }
  } catch (error) {
    console.error(`[Validation] Error validating ${type} content:`, error);
    return false;
  }
}

export function validateProfileData(data: unknown): boolean {
  try {
    ProfileDataSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

// Safe content transform functions
export function sanitizeComponentContent(
  type: string,
  content: unknown,
): unknown {
  try {
    switch (type) {
      case "text":
        return TextContentSchema.parse(content);
      case "image":
        return ImageContentSchema.parse(content);
      case "link":
        return LinkContentSchema.parse(content);
      case "profile":
        return ProfileContentSchema.parse(content);
      default:
        return content;
    }
  } catch (error) {
    console.error(`[Sanitization] Error sanitizing ${type} content:`, error);
    return null;
  }
}
