import { act, render, waitFor } from "@testing-library/react";
import BusinessCardScanPage from "./page";
import type { ContactInfo } from "@/types/business-card";

const mockContactFormProps = jest.fn();
const mockUser = { uid: "test-user" };
const mockGetIdToken = jest.fn().mockResolvedValue("test-token");
let mockOnImageSelected:
  | ((file: File, warnings: string[]) => Promise<void>)
  | undefined;

jest.mock("@/components/business-card/ContactForm", () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockContactFormProps(props);
    return <div data-testid="contact-form" />;
  },
}));

jest.mock("@/components/business-card/ImageSelector", () => ({
  __esModule: true,
  default: ({
    onImageSelected,
  }: {
    onImageSelected: (file: File, warnings: string[]) => Promise<void>;
  }) => {
    mockOnImageSelected = onImageSelected;
    return <div data-testid="image-selector" />;
  },
}));

jest.mock("@/components/business-card/LoadingSpinner", () => ({
  __esModule: true,
  default: () => <div data-testid="loading" />,
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    getIdToken: mockGetIdToken,
  }),
}));

jest.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock("@/services/business-card/imageEnhancement", () => ({
  enhanceBusinessCardImage: jest.fn().mockResolvedValue({
    dataUrl: "data:image/jpeg;base64,enhanced",
    base64: "enhanced",
    mimeType: "image/jpeg",
  }),
}));

jest.mock("@/services/business-card/scanQuotaService", () => ({
  getScanQuota: jest.fn().mockResolvedValue({
    used: 0,
    limit: 10,
    daysRemaining: 1,
    resetDate: new Date("2026-09-01T00:00:00Z"),
    plan: "free",
  }),
  recordScan: jest.fn(),
}));

jest.mock("@/services/business-card/vcardService", () => ({
  downloadVCard: jest.fn(),
}));

jest.mock("@/components/ui/use-toast", () => ({ toast: jest.fn() }));

class DeferredFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

  readAsDataURL() {
    this.result = "data:image/png;base64,card";
    setTimeout(() => this.onload?.({} as ProgressEvent<FileReader>), 0);
  }
}

const contactInfo: ContactInfo = {
  lastName: "Lee",
  firstName: "Alex",
  phoneticLastName: "",
  phoneticFirstName: "",
  company: "Example",
  department: "Research",
  title: "Director",
  addresses: [],
  email: "alex@example.com",
  website: "",
  phoneNumbers: [],
};

describe("BusinessCardScanPage review handoff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnImageSelected = undefined;
    Object.defineProperty(global, "FileReader", {
      configurable: true,
      writable: true,
      value: DeferredFileReader,
    });
  });

  it("passes the structured fieldReviews object to ContactForm unchanged", async () => {
    const fieldReviews = {
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
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: contactInfo,
        humanReview: true,
        fieldReviews,
      }),
    });

    render(<BusinessCardScanPage />);
    expect(mockOnImageSelected).toBeDefined();

    await act(async () => {
      await mockOnImageSelected?.(
        new File(["card"], "card.png", { type: "image/png" }),
        [],
      );
    });

    await waitFor(() => expect(mockContactFormProps).toHaveBeenCalled());
    const props = mockContactFormProps.mock.lastCall?.[0];
    expect(props.fieldReviews).toBe(fieldReviews);
    expect(props.reviewReasons).toBeUndefined();
  });
});
