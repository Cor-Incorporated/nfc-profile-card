import { BIO_MAX_LENGTH } from "@/lib/constants/profile";
import { z } from "zod";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const webUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  });
// The public renderer inserts these values as React text, which escapes HTML.
// Keep server validation independent of the browser DOMPurify bundle.
const TextContentSchema = z.object({ text: z.string().min(1).max(5000) });
const ImageContentSchema = z.object({
  src: z.union([webUrl, z.literal("")]).optional(),
  alt: z.string().max(200).optional(),
});
const LinkContentSchema = z.object({
  url: z.union([webUrl, z.literal("")]),
  label: z.string().max(200).optional(),
});
const ProfileContentSchema = z.object({
  isInitialPlaceholder: z.boolean().optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phoneticFirstName: z.string().max(100).optional(),
  phoneticLastName: z.string().max(100).optional(),
  name: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  position: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().max(50).optional(),
  cellPhone: z.string().max(50).optional(),
  website: z.union([webUrl, z.literal("")]).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  postalCode: z.string().max(20).optional(),
  bio: z.string().max(BIO_MAX_LENGTH).optional(),
  photoURL: z.union([webUrl, z.literal("")]).optional(),
  cardBackgroundColor: color.optional(),
  cardBackgroundOpacity: z.number().min(0).max(100).optional(),
});
const background = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solid"), color }),
  z.object({ type: z.literal("color"), color }),
  z.object({ type: z.literal("gradient"), from: color, to: color }),
  z.object({
    type: z.literal("image"),
    url: webUrl,
    opacity: z.number().min(0).max(1),
  }),
  z.object({
    type: z.literal("pattern"),
    pattern: z.string().max(100).optional(),
  }),
]);
const component = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(["text", "image", "link", "profile"]),
  order: z.number().int().min(0).max(99),
  content: z.unknown(),
  style: z
    .record(z.union([z.string().max(200), z.number().finite()]))
    .optional(),
});
const bodySchema = z
  .object({
    revision: z
      .string()
      .regex(/^-?\d+:\d{9}$/)
      .nullable(),
    components: z.array(component).max(100),
    background: background.nullable(),
  })
  .strict();

const contentSchemas = {
  text: TextContentSchema,
  image: ImageContentSchema,
  link: LinkContentSchema,
  profile: ProfileContentSchema,
};

export function parseDesignSave(input: unknown) {
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return null;

  const ids = new Set<string>();
  const components = [];
  for (const item of parsed.data.components) {
    if (
      ids.has(item.id) ||
      (item.style && Object.keys(item.style).length > 30)
    ) {
      return null;
    }
    ids.add(item.id);
    const content = contentSchemas[item.type].safeParse(item.content);
    if (!content.success) return null;
    components.push({
      id: item.id,
      type: item.type,
      order: item.order,
      content: content.data,
      ...(item.style ? { style: item.style } : {}),
    });
  }

  return {
    revision: parsed.data.revision,
    components,
    background: parsed.data.background,
  };
}
