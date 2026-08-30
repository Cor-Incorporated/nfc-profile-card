"use client";

import React, { useState, useCallback, useEffect } from "react";
import { ContactInfo, PhoneNumber, Address } from "@/types/business-card";
import type { BusinessCardScanResponse } from "@/types/api";
import { generateVCard } from "@/services/business-card/vcardService";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type FieldReviews = NonNullable<BusinessCardScanResponse["fieldReviews"]>;
type FieldReview = FieldReviews[string];
type Translate = (key: string) => string;

const REVIEW_REASON_KEYS: Record<string, string> = {
  classic_and_vlm_disagree: "ocrReviewReasonClassicVlmDisagree",
  vlm_invented_exact_value: "ocrReviewReasonInventedExact",
  vlm_unverified_exact_value: "ocrReviewReasonUnverifiedExact",
  semantic_value_missing: "ocrReviewReasonSemanticMissing",
  vlm_unverified_semantic_value: "ocrReviewReasonUnverifiedSemantic",
  semantic_association_requires_review: "ocrReviewReasonSemanticAssociation",
};

function reviewReason(review: FieldReview, t: Translate): string {
  return t(REVIEW_REASON_KEYS[review.reason || ""] || "ocrReviewReasonGeneral");
}

function reviewFieldLabel(field: string, t: Translate): string {
  const labels: Record<string, string> = {
    name: t("name"),
    name_kana: `${t("name")} (${t("phoneticReading")})`,
    company: t("company"),
    department: t("department"),
    title: t("position"),
    email: t("email"),
    phone: t("phone"),
    mobile: t("mobile"),
    fax: t("fax"),
    postal_code: t("postalCode"),
    address: t("address"),
    url: t("website"),
    social: t("website"),
  };
  return labels[field] || t("ocrReviewFieldOther");
}

function ReviewNotice({
  id,
  review,
  t,
}: {
  id: string;
  review?: FieldReview;
  t: Translate;
}) {
  if (!review) return null;
  return (
    <p
      id={id}
      className="flex items-start gap-1.5 text-pretty text-sm text-orange-800"
    >
      <AlertTriangle
        aria-hidden="true"
        className="mt-0.5 size-4 flex-shrink-0"
      />
      <span>
        <span className="font-semibold">{t("ocrReviewRequired")}:</span>{" "}
        {reviewReason(review, t)}
      </span>
    </p>
  );
}

interface ContactFormProps {
  initialData: ContactInfo;
  onSave: (
    data: ContactInfo,
    selectedImageBase64?: string | null,
    selectedImageMimeType?: string | null,
  ) => void;
  onCancel: () => void;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  enhancedImageBase64?: string | null;
  enhancedImageMimeType?: string | null;
  imageQualityWarnings?: string[];
  humanReview?: boolean;
  fieldReviews?: FieldReviews;
}

const ContactForm: React.FC<ContactFormProps> = ({
  initialData,
  onSave,
  onCancel,
  imageBase64,
  imageMimeType,
  enhancedImageBase64,
  enhancedImageMimeType,
  imageQualityWarnings = [],
  humanReview = false,
  fieldReviews = {},
}) => {
  const [formData, setFormData] = useState<ContactInfo>(initialData);
  const [vcardPreview, setVcardPreview] = useState("");
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(true);
  const [imageVariant, setImageVariant] = useState<"enhanced" | "original">(
    enhancedImageBase64 ? "enhanced" : "original",
  );
  const { t } = useLanguage();

  const reviewEntries = Object.entries(fieldReviews).filter(
    ([, review]) => review.human_review,
  );
  const reviewFor = (...fields: string[]): FieldReview | undefined =>
    fields
      .map((field) => fieldReviews[field])
      .find((review) => review?.human_review);
  const nameReview = reviewFor("name");
  const nameKanaReview = reviewFor("name_kana");
  const companyReview = reviewFor("company");
  const departmentReview = reviewFor("department");
  const titleReview = reviewFor("title");
  const emailReview = reviewFor("email");
  const websiteReview = reviewFor("url", "social");
  const addressReview = reviewFor("address");
  const postalCodeReview = reviewFor("postal_code");
  const phoneGroupReview = reviewFor("phone", "mobile", "fax");

  const selectedImageBase64 =
    imageVariant === "enhanced" && enhancedImageBase64
      ? enhancedImageBase64
      : imageBase64;
  const selectedImageMimeType =
    imageVariant === "enhanced" && enhancedImageMimeType
      ? enhancedImageMimeType
      : imageMimeType;

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (formData) {
      const vcardString = generateVCard(
        formData,
        selectedImageBase64 || null,
        selectedImageMimeType || null,
      );
      setVcardPreview(vcardString);
    }
  }, [formData, selectedImageBase64, selectedImageMimeType]);

  useEffect(() => {
    if (!enhancedImageBase64) {
      setImageVariant("original");
    }
  }, [enhancedImageBase64]);

  const handleChange = useCallback(
    (field: keyof Omit<ContactInfo, "phoneNumbers" | "addresses">) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      },
    [],
  );

  const handlePhoneChange =
    (index: number, field: keyof PhoneNumber) => (value: string) => {
      const newPhoneNumbers = [...formData.phoneNumbers];
      newPhoneNumbers[index] = { ...newPhoneNumbers[index], [field]: value };
      setFormData((prev) => ({ ...prev, phoneNumbers: newPhoneNumbers }));
    };

  const handleAddressChange =
    (index: number, field: keyof Address) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newAddresses = [...formData.addresses];
      newAddresses[index] = { ...newAddresses[index], [field]: e.target.value };
      setFormData((prev) => ({ ...prev, addresses: newAddresses }));
    };

  const addPhoneNumber = () => {
    setFormData((prev) => ({
      ...prev,
      phoneNumbers: [
        ...(prev.phoneNumbers || []),
        { type: "WORK", number: "" },
      ],
    }));
  };

  const removePhoneNumber = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      phoneNumbers: (prev.phoneNumbers || []).filter((_, i) => i !== index),
    }));
  };

  const addAddress = () => {
    setFormData((prev) => ({
      ...prev,
      addresses: [
        ...(prev.addresses || []),
        { label: "", postalCode: "", address: "" },
      ],
    }));
  };

  const removeAddress = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      addresses: (prev.addresses || []).filter((_, i) => i !== index),
    }));
  };

  return (
    <Card className="w-full shadow-lg">
      <div className="p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold mb-4 pb-3 border-b text-center">
          📝 {t("confirmAndEdit")}
        </h2>

        <div className="space-y-6">
          {imageQualityWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div className="space-y-1 text-sm">
                  {imageQualityWarnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(humanReview || reviewEntries.length > 0) && (
            <div
              role="status"
              className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-orange-800"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-4 flex-shrink-0"
                />
                <div className="space-y-1 text-sm">
                  <p className="text-pretty font-medium">
                    {t("ocrNeedsHumanReview")}
                  </p>
                  <p className="text-pretty">{t("ocrNeedsHumanReviewHint")}</p>
                  {reviewEntries.length > 0 && (
                    <ul className="list-disc pl-4">
                      {reviewEntries.map(([field, review]) => (
                        <li className="text-pretty" key={field}>
                          <span className="font-medium">
                            {reviewFieldLabel(field, t)}:
                          </span>{" "}
                          {reviewReason(review, t)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {imageBase64 && enhancedImageBase64 && (
            <div className="space-y-3">
              <Label>{t("vcardImageChoice")}</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setImageVariant("enhanced")}
                  className={`rounded-md border p-2 text-left transition ${
                    imageVariant === "enhanced"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Image
                    src={`data:${enhancedImageMimeType};base64,${enhancedImageBase64}`}
                    alt=""
                    width={320}
                    height={200}
                    unoptimized
                    className="mb-2 aspect-[1.6] w-full rounded object-cover"
                  />
                  <span className="text-sm font-medium">
                    {t("enhancedImage")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setImageVariant("original")}
                  className={`rounded-md border p-2 text-left transition ${
                    imageVariant === "original"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Image
                    src={`data:${imageMimeType};base64,${imageBase64}`}
                    alt=""
                    width={320}
                    height={200}
                    unoptimized
                    className="mb-2 aspect-[1.6] w-full rounded object-cover"
                  />
                  <span className="text-sm font-medium">
                    {t("originalImage")}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* 名前 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lastName">{t("lastName")}</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={handleChange("lastName")}
                placeholder={t("lastNamePlaceholder")}
                aria-invalid={nameReview ? true : undefined}
                aria-describedby={
                  nameReview ? "lastName-ocr-review" : undefined
                }
                className={cn(nameReview && "border-orange-500")}
              />
              <ReviewNotice
                id="lastName-ocr-review"
                review={nameReview}
                t={t}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">{t("firstName")}</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={handleChange("firstName")}
                placeholder={t("firstNamePlaceholder")}
                aria-invalid={nameReview ? true : undefined}
                aria-describedby={
                  nameReview ? "firstName-ocr-review" : undefined
                }
                className={cn(nameReview && "border-orange-500")}
              />
              <ReviewNotice
                id="firstName-ocr-review"
                review={nameReview}
                t={t}
              />
            </div>
          </div>

          {/* ふりがな */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phoneticLastName">
                {t("lastName")}{" "}
                <span className="text-xs text-gray-500">
                  ({t("phoneticReading")})
                </span>
              </Label>
              <Input
                id="phoneticLastName"
                value={formData.phoneticLastName}
                onChange={handleChange("phoneticLastName")}
                placeholder={t("phoneticLastNamePlaceholder")}
                aria-invalid={nameKanaReview ? true : undefined}
                aria-describedby={
                  nameKanaReview ? "phoneticLastName-ocr-review" : undefined
                }
                className={cn(nameKanaReview && "border-orange-500")}
              />
              <ReviewNotice
                id="phoneticLastName-ocr-review"
                review={nameKanaReview}
                t={t}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneticFirstName">
                {t("firstName")}{" "}
                <span className="text-xs text-gray-500">
                  ({t("phoneticReading")})
                </span>
              </Label>
              <Input
                id="phoneticFirstName"
                value={formData.phoneticFirstName}
                onChange={handleChange("phoneticFirstName")}
                placeholder={t("phoneticFirstNamePlaceholder")}
                aria-invalid={nameKanaReview ? true : undefined}
                aria-describedby={
                  nameKanaReview ? "phoneticFirstName-ocr-review" : undefined
                }
                className={cn(nameKanaReview && "border-orange-500")}
              />
              <ReviewNotice
                id="phoneticFirstName-ocr-review"
                review={nameKanaReview}
                t={t}
              />
            </div>
          </div>

          {/* 会社情報 */}
          <div className="space-y-2">
            <Label htmlFor="company">{t("company")}</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={handleChange("company")}
              placeholder="株式会社サンプル"
              aria-invalid={companyReview ? true : undefined}
              aria-describedby={
                companyReview ? "company-ocr-review" : undefined
              }
              className={cn(companyReview && "border-orange-500")}
            />
            <ReviewNotice
              id="company-ocr-review"
              review={companyReview}
              t={t}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">{t("department")}</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={handleChange("department")}
                placeholder="営業部"
                aria-invalid={departmentReview ? true : undefined}
                aria-describedby={
                  departmentReview ? "department-ocr-review" : undefined
                }
                className={cn(departmentReview && "border-orange-500")}
              />
              <ReviewNotice
                id="department-ocr-review"
                review={departmentReview}
                t={t}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">{t("position")}</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={handleChange("title")}
                placeholder="課長"
                aria-invalid={titleReview ? true : undefined}
                aria-describedby={titleReview ? "title-ocr-review" : undefined}
                className={cn(titleReview && "border-orange-500")}
              />
              <ReviewNotice id="title-ocr-review" review={titleReview} t={t} />
            </div>
          </div>

          {/* 連絡先 */}
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={handleChange("email")}
              placeholder="yamada@example.com"
              aria-invalid={emailReview ? true : undefined}
              aria-describedby={emailReview ? "email-ocr-review" : undefined}
              className={cn(emailReview && "border-orange-500")}
            />
            <ReviewNotice id="email-ocr-review" review={emailReview} t={t} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">{t("website")}</Label>
            <Input
              id="website"
              type="url"
              value={formData.website}
              onChange={handleChange("website")}
              placeholder="https://example.com"
              aria-invalid={websiteReview ? true : undefined}
              aria-describedby={
                websiteReview ? "website-ocr-review" : undefined
              }
              className={cn(websiteReview && "border-orange-500")}
            />
            <ReviewNotice
              id="website-ocr-review"
              review={websiteReview}
              t={t}
            />
          </div>

          {/* 住所 */}
          <div
            className="space-y-3"
            role="group"
            aria-labelledby="address-section-label"
            aria-describedby={
              addressReview && formData.addresses.length === 0
                ? "address-empty-ocr-review"
                : undefined
            }
          >
            <Label id="address-section-label">{t("address")}</Label>
            {formData.addresses.length === 0 && (
              <ReviewNotice
                id="address-empty-ocr-review"
                review={addressReview}
                t={t}
              />
            )}
            {(formData.addresses || []).map((addr, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg bg-gray-50 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={addr.label}
                    onChange={handleAddressChange(index, "label")}
                    placeholder={t("labelExample")}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => removeAddress(index)}
                    variant="ghost"
                    size="icon"
                    aria-label={`${t("delete")} ${t("address")} ${index + 1}`}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <Input
                    id={`address-${index}-postalCode`}
                    value={addr.postalCode}
                    onChange={handleAddressChange(index, "postalCode")}
                    placeholder={t("postalCodeExample")}
                    aria-invalid={postalCodeReview ? true : undefined}
                    aria-describedby={
                      postalCodeReview
                        ? `address-${index}-postalCode-ocr-review`
                        : undefined
                    }
                    className={cn(postalCodeReview && "border-orange-500")}
                  />
                  <ReviewNotice
                    id={`address-${index}-postalCode-ocr-review`}
                    review={postalCodeReview}
                    t={t}
                  />
                </div>
                <div className="space-y-1">
                  <Input
                    id={`address-${index}-address`}
                    value={addr.address}
                    onChange={handleAddressChange(index, "address")}
                    placeholder={t("address")}
                    aria-invalid={addressReview ? true : undefined}
                    aria-describedby={
                      addressReview
                        ? `address-${index}-address-ocr-review`
                        : undefined
                    }
                    className={cn(addressReview && "border-orange-500")}
                  />
                  <ReviewNotice
                    id={`address-${index}-address-ocr-review`}
                    review={addressReview}
                    t={t}
                  />
                </div>
              </div>
            ))}
            <Button
              onClick={addAddress}
              variant="outline"
              className="w-full h-10 touch-manipulation"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("addAddress")}
            </Button>
          </div>

          {/* 電話番号 */}
          <div
            className="space-y-3"
            role="group"
            aria-labelledby="phone-section-label"
            aria-describedby={
              phoneGroupReview && formData.phoneNumbers.length === 0
                ? "phone-empty-ocr-review"
                : undefined
            }
          >
            <Label id="phone-section-label">{t("phone")}</Label>
            {formData.phoneNumbers.length === 0 && (
              <ReviewNotice
                id="phone-empty-ocr-review"
                review={phoneGroupReview}
                t={t}
              />
            )}
            {(formData.phoneNumbers || []).map((phone, index) => {
              const reviewField =
                phone.type === "WORK"
                  ? "phone"
                  : phone.type === "MOBILE"
                    ? "mobile"
                    : phone.type === "FAX"
                      ? "fax"
                      : undefined;
              const phoneReview = reviewField
                ? reviewFor(reviewField)
                : undefined;
              const phoneInputId = `phone-${index}-number`;
              return (
                <div
                  key={index}
                  className="flex items-start gap-2 flex-wrap sm:flex-nowrap"
                >
                  <Select
                    value={phone.type}
                    onValueChange={(value) =>
                      handlePhoneChange(index, "type")(value as any)
                    }
                  >
                    <SelectTrigger className="w-[100px] sm:w-[120px] flex-shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WORK">{t("work")}</SelectItem>
                      <SelectItem value="MOBILE">{t("mobile")}</SelectItem>
                      <SelectItem value="FAX">{t("fax")}</SelectItem>
                      <SelectItem value="OTHER">{t("other")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="min-w-0 flex-1 space-y-1">
                    <Input
                      id={phoneInputId}
                      type="tel"
                      value={phone.number || ""}
                      onChange={(e) =>
                        handlePhoneChange(index, "number")(e.target.value)
                      }
                      placeholder={t("phone")}
                      aria-invalid={phoneReview ? true : undefined}
                      aria-describedby={
                        phoneReview ? `${phoneInputId}-ocr-review` : undefined
                      }
                      className={cn(phoneReview && "border-orange-500")}
                    />
                    <ReviewNotice
                      id={`${phoneInputId}-ocr-review`}
                      review={phoneReview}
                      t={t}
                    />
                  </div>
                  <Button
                    onClick={() => removePhoneNumber(index)}
                    variant="ghost"
                    size="icon"
                    aria-label={`${t("delete")} ${t("phone")} ${index + 1}`}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
            <Button
              onClick={addPhoneNumber}
              variant="outline"
              className="w-full h-10 touch-manipulation"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("addPhoneNumber")}
            </Button>
          </div>

          {/* vCard プレビュー */}
          <div className="border-t pt-4">
            <Button
              onClick={() => setIsPreviewCollapsed(!isPreviewCollapsed)}
              variant="ghost"
              className="w-full justify-between"
            >
              <span className="font-semibold">{t("vcardPreview")}</span>
              {isPreviewCollapsed ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronUp className="h-5 w-5" />
              )}
            </Button>
            {!isPreviewCollapsed && (
              <pre className="mt-4 p-4 bg-gray-100 rounded-md text-xs overflow-auto">
                {vcardPreview}
              </pre>
            )}
          </div>

          {/* アクションボタン */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button
              onClick={() =>
                onSave(formData, selectedImageBase64, selectedImageMimeType)
              }
              className="flex-1 h-12 text-base touch-manipulation"
            >
              💾 {t("saveVCard")}
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              className="flex-1 h-12 text-base touch-manipulation"
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ContactForm;
