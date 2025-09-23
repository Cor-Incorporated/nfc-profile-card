export enum AppStatus {
  IDLE = "IDLE",
  PROCESSING = "PROCESSING",
  EDITING = "EDITING",
}

export interface PhoneNumber {
  type: "WORK" | "MOBILE" | "FAX" | "OTHER";
  number: string;
}

export interface Address {
  label: string;
  postalCode: string;
  address: string;
}

export interface ContactInfo {
  lastName: string;
  firstName: string;
  phoneticLastName: string;
  phoneticFirstName: string;
  company: string;
  department: string;
  title: string;
  addresses: Address[];
  email: string;
  website: string;
  phoneNumbers: PhoneNumber[];
}

export interface BusinessCard {
  id?: string;
  contactInfo: ContactInfo;
  imageUrl?: string;
  scannedAt: Date;
  userId: string;
}
