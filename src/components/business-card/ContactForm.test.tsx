import { render, screen } from "@testing-library/react";
import ContactForm from "./ContactForm";
import type { BusinessCardScanResponse } from "@/types/api";
import type { ContactInfo } from "@/types/business-card";

const mockTranslations: Record<string, string> = {};
const mockTranslate = jest.fn((key: string) => mockTranslations[key] || key);

jest.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: mockTranslate }),
}));

jest.mock("@/services/business-card/vcardService", () => ({
  generateVCard: jest.fn(() => "BEGIN:VCARD\nEND:VCARD"),
}));

type FieldReviews = NonNullable<BusinessCardScanResponse["fieldReviews"]>;

const initialData: ContactInfo = {
  lastName: "Lee",
  firstName: "Alex",
  phoneticLastName: "",
  phoneticFirstName: "",
  company: "",
  department: "Research",
  title: "Director",
  email: "alex@example.com",
  website: "https://example.com",
  addresses: [
    {
      label: "WORK",
      postalCode: "100-0005",
      address: "Tokyo",
    },
  ],
  phoneNumbers: [
    { type: "WORK", number: "03-1111-2222" },
    { type: "MOBILE", number: "090-1111-2222" },
    { type: "FAX", number: "03-1111-2223" },
  ],
};

function setEnglishTranslations() {
  Object.assign(mockTranslations, {
    confirmAndEdit: "Confirm and edit",
    lastName: "Last name",
    firstName: "First name",
    phoneticReading: "phonetic",
    company: "Company",
    department: "Department",
    position: "Position",
    email: "Email",
    website: "Website",
    address: "Address",
    phone: "Phone",
    delete: "Delete",
    mobile: "Mobile",
    fax: "Fax",
    postalCode: "Postal code",
    ocrNeedsHumanReview: "Review the OCR fields before saving",
    ocrNeedsHumanReviewHint: "Compare fields with the card.",
    ocrReviewRequired: "Needs review",
    ocrReviewFieldOther: "OCR field",
    ocrReviewReasonClassicVlmDisagree:
      "The OCR results disagree. Confirm the value shown on the card.",
    ocrReviewReasonSemanticMissing:
      "No value was read for this field. Enter it from the card.",
    ocrReviewReasonSemanticAssociation:
      "The text was read, but its association needs confirmation.",
    ocrReviewReasonGeneral:
      "The OCR result is uncertain. Compare this field with the card image.",
  });
}

function renderForm(fieldReviews: FieldReviews, data = initialData) {
  return render(
    <ContactForm
      initialData={data}
      onSave={jest.fn()}
      onCancel={jest.fn()}
      humanReview
      fieldReviews={fieldReviews}
    />,
  );
}

function expectDescribedInvalid(input: HTMLElement, description: string) {
  expect(input).toHaveAttribute("aria-invalid", "true");
  const descriptionId = input.getAttribute("aria-describedby");
  expect(descriptionId).toBeTruthy();
  expect(document.getElementById(descriptionId || "")).toHaveTextContent(
    description,
  );
}

describe("ContactForm OCR field reviews", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockTranslations))
      delete mockTranslations[key];
    setEnglishTranslations();
    mockTranslate.mockClear();
  });

  it("marks an empty semantic field and does not mark exact fields with human_review=false", () => {
    renderForm({
      company: {
        human_review: true,
        confidence: 0,
        reason: "semantic_value_missing",
      },
      email: {
        human_review: false,
        confidence: 0.96,
        reason: "classic_and_vlm_agree",
      },
    });

    expectDescribedInvalid(
      screen.getByLabelText("Company"),
      "No value was read for this field",
    );
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
    expect(
      screen.queryByText("semantic_value_missing"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("classic_and_vlm_agree")).not.toBeInTheDocument();
  });

  it("maps an unknown reason to safe Japanese guidance", () => {
    Object.assign(mockTranslations, {
      ocrReviewRequired: "確認が必要",
      ocrReviewReasonGeneral:
        "読み取り結果の確信度が不足しています。画像と見比べて確認してください。",
    });
    renderForm({
      title: {
        human_review: true,
        confidence: 0.2,
        reason: "unexpected_internal_reason",
      },
    });

    expectDescribedInvalid(
      screen.getByLabelText("Position"),
      "読み取り結果の確信度が不足しています",
    );
    expect(
      screen.queryByText("unexpected_internal_reason"),
    ).not.toBeInTheDocument();
  });

  it("shows an inline review description for an empty address group", () => {
    renderForm(
      {
        address: {
          human_review: true,
          confidence: 0,
          reason: "semantic_value_missing",
        },
      },
      { ...initialData, addresses: [] },
    );

    const addressGroup = screen.getByRole("group", { name: "Address" });
    const descriptionId = addressGroup.getAttribute("aria-describedby");
    expect(descriptionId).toBe("address-empty-ocr-review");
    expect(document.getElementById(descriptionId || "")).toHaveTextContent(
      "No value was read for this field",
    );
  });

  it("associates review state with matching phone types only", () => {
    renderForm({
      phone: {
        human_review: true,
        confidence: 0.3,
        reason: "classic_and_vlm_disagree",
      },
      mobile: {
        human_review: false,
        confidence: 0.96,
        reason: "classic_and_vlm_agree",
      },
      fax: {
        human_review: true,
        confidence: 0.3,
        reason: "classic_and_vlm_disagree",
      },
    });

    const [work, mobile, fax] = screen.getAllByPlaceholderText("Phone");
    expectDescribedInvalid(work, "The OCR results disagree");
    expect(mobile).not.toHaveAttribute("aria-invalid");
    expectDescribedInvalid(fax, "The OCR results disagree");
  });

  it("labels icon-only remove controls for assistive technology", () => {
    renderForm({});

    expect(
      screen.getByRole("button", { name: "Delete Address 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Phone 1" }),
    ).toBeInTheDocument();
  });
});
