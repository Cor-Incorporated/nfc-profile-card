/** Public, already displayed profile fields only; no inferred name splitting. */
export function profileContactVcard(profile: {
  name: string;
  company?: string;
  position?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  cellPhone?: string;
  city?: string;
  postalCode?: string;
  notes?: string;
}): string {
  const escape = (value: string) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escape(profile.name)}`,
    `N:${escape(profile.name)};;;;`,
  ];
  for (const [key, value] of [
    ["ORG", profile.company],
    ["TITLE", profile.position],
    ["EMAIL", profile.email],
    ["TEL;TYPE=WORK,VOICE", profile.phone],
    ["TEL;TYPE=CELL", profile.cellPhone],
    ["NOTE", profile.notes],
    ["URL", profile.website],
  ])
    if (value) lines.push(`${key}:${escape(value)}`);
  if (profile.address || profile.city || profile.postalCode)
    lines.push(
      `ADR;TYPE=WORK:;;${escape(profile.address || "")};${escape(profile.city || "")};;${escape(profile.postalCode || "")};`,
    );
  lines.push("END:VCARD");
  return (
    lines
      .map((line) => {
        let folded = "",
          bytes = 0;
        for (const char of line) {
          const size = Buffer.byteLength(char, "utf8");
          if (bytes + size > 75) {
            folded += "\r\n ";
            bytes = 1;
          }
          folded += char;
          bytes += size;
        }
        return folded;
      })
      .join("\r\n") + "\r\n"
  );
}

/** Match the visible custom profile, without falling back to hidden account fields. */
export function customProfileContactVcard(
  components: Array<{ type: string; content?: unknown }>,
): string | undefined {
  const profiles = components.filter((c) => c.type === "profile");
  if (profiles.length !== 1) return undefined;
  const c = profiles[0].content as Record<string, unknown> | undefined;
  if (!c || typeof c !== "object") return undefined;
  const field = (key: string) =>
    typeof c[key] === "string" ? (c[key] as string) : "";
  const name =
    field("name") || `${field("lastName")} ${field("firstName")}`.trim();
  if (!name) return undefined;
  const notes = components
    .filter((c) => c.type === "link")
    .map((c) => {
      const link = c.content as { url?: string; label?: string } | undefined;
      return typeof link?.url === "string"
        ? `${typeof link.label === "string" ? link.label + ": " : ""}${link.url}`
        : "";
    })
    .filter(Boolean)
    .join("\n");
  return profileContactVcard({
    name,
    company: field("company"),
    position: field("position"),
    email: field("email"),
    phone: field("phone"),
    cellPhone: field("cellPhone"),
    website: field("website"),
    address: field("address"),
    city: field("city"),
    postalCode: field("postalCode"),
    notes,
  });
}
