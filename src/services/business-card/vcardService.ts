import { ContactInfo } from "@/types/business-card";

export const generateVCard = (
  contact: ContactInfo,
  base64Image: string | null = null,
  imageMimeType: string | null = null,
): string => {
  let vCard = `BEGIN:VCARD
VERSION:3.0
`;

  // Name
  vCard += `N;CHARSET=UTF-8:${contact.lastName || ""};${contact.firstName || ""};;;\n`;
  vCard += `FN;CHARSET=UTF-8:${contact.firstName || ""} ${contact.lastName || ""}\n`;

  // Photo (if provided)
  if (base64Image && imageMimeType) {
    const type = imageMimeType.split("/")[1]?.toUpperCase();
    if (type) {
      vCard += `PHOTO;ENCODING=b;TYPE=${type}:${base64Image}\n`;
    }
  }

  // Phonetic names
  if (contact.phoneticFirstName) {
    vCard += `X-PHONETIC-FIRST-NAME;CHARSET=UTF-8:${contact.phoneticFirstName}\n`;
  }
  if (contact.phoneticLastName) {
    vCard += `X-PHONETIC-LAST-NAME;CHARSET=UTF-8:${contact.phoneticLastName}\n`;
  }

  // Organization
  let orgParts = [];
  if (contact.company) orgParts.push(contact.company);
  if (contact.department) orgParts.push(contact.department);
  if (orgParts.length > 0) {
    vCard += `ORG;CHARSET=UTF-8:${orgParts.join(";")}\n`;
  }

  // Title
  if (contact.title) {
    vCard += `TITLE;CHARSET=UTF-8:${contact.title}\n`;
  }

  // Phone numbers
  (contact.phoneNumbers || []).forEach((phone) => {
    if (phone.number) {
      let type: string = phone.type;
      if (type === "MOBILE") type = "CELL";
      vCard += `TEL;TYPE=${type},VOICE:${phone.number}\n`;
    }
  });

  // Email
  if (contact.email) {
    vCard += `EMAIL;TYPE=INTERNET,PREF:${contact.email}\n`;
  }

  // Website
  if (contact.website) {
    vCard += `URL:${contact.website}\n`;
  }

  // Addresses
  (contact.addresses || []).forEach((addr) => {
    if (addr.address || addr.postalCode) {
      const addressParts = [
        "", // P.O. Box
        addr.label || "", // Extended Address (for label)
        addr.address || "", // Street Address
        "", // Locality (City)
        "", // Region (State)
        addr.postalCode || "", // Postal Code
        "", // Country
      ];
      vCard += `ADR;TYPE=WORK;CHARSET=UTF-8:${addressParts.join(";")}\n`;
    }
  });

  vCard += "END:VCARD\n";

  return vCard;
};

/**
 * Download a vCard file
 */
export const downloadVCard = (
  contact: ContactInfo,
  base64Image?: string | null,
  imageMimeType?: string | null,
): void => {
  const vCardContent = generateVCard(
    contact,
    base64Image || null,
    imageMimeType || null,
  );
  const blob = new Blob([vCardContent], { type: "text/vcard;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;

  // Generate filename
  const name = `${contact.firstName || ""}_${contact.lastName || ""}`
    .trim()
    .replace(/\s+/g, "_");
  a.download = `${name || "contact"}.vcf`;

  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
