import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VCardButton } from "./VCardButton";
import { toast } from "@/components/ui/use-toast";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";

// Toastのモック
jest.mock("@/components/ui/use-toast", () => ({
  toast: jest.fn(),
}));

// Test wrapper component with both providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </AuthProvider>
  );
}

// fetchのモックをセットアップ
global.fetch = jest.fn();

// URL.createObjectURL と URL.revokeObjectURLのモック
global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = jest.fn();

// document.createElement のモック
const mockClick = jest.fn();
const originalCreateElement = document.createElement.bind(document);
const mockCreateElement = jest.spyOn(document, "createElement");
mockCreateElement.mockImplementation((tagName: string) => {
  if (tagName === "a") {
    const element = originalCreateElement("a");
    element.click = mockClick;
    return element;
  }
  return originalCreateElement(tagName);
});

describe("VCardButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("レンダリング", () => {
    it("デフォルトの状態で正しくレンダリングされる", () => {
      render(<VCardButton username="testuser" />, { wrapper: TestWrapper });

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(screen.getByText("連絡先を保存")).toBeInTheDocument();

      // ダウンロードアイコンが存在することを確認
      const downloadIcon = button.querySelector("svg");
      expect(downloadIcon).toBeInTheDocument();
    });

    it("異なるバリアントとサイズでレンダリングされる", () => {
      render(
        <VCardButton
          username="testuser"
          variant="outline"
          size="lg"
          className="custom-class"
        />,
        { wrapper: TestWrapper },
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-class");
    });
  });

  describe("ダウンロード機能", () => {
    it("usernameを使用してVCardをダウンロードできる", async () => {
      const mockBlob = new Blob(["vcard data"], { type: "text/vcard" });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      render(<VCardButton username="testuser" />, { wrapper: TestWrapper });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      // ローディング状態の確認
      expect(screen.getByText("生成中...")).toBeInTheDocument();

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith("/api/vcard?username=testuser");
        expect(mockClick).toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith({
          title: "成功",
          description: "VCardをダウンロードしました",
        });
      });

      // ローディング状態が解除されることを確認
      expect(screen.getByText("連絡先を保存")).toBeInTheDocument();
    });

    it("profileDataを使用してVCardをダウンロードできる", async () => {
      const profileData = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        organization: "Test Corp",
        title: "Developer",
      };

      const mockBlob = new Blob(["vcard data"], { type: "text/vcard" });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      render(<VCardButton profileData={profileData} />, {
        wrapper: TestWrapper,
      });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith("/api/vcard", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(profileData),
        });
        expect(mockClick).toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith({
          title: "成功",
          description: "VCardをダウンロードしました",
        });
      });
    });

    it("完全なprofileDataで正しくダウンロードされる", async () => {
      const fullProfileData = {
        firstName: "Test",
        lastName: "User",
        organization: "Test Corp",
        title: "Developer",
        email: "test@example.com",
        workPhone: "03-1234-5678",
        cellPhone: "090-1234-5678",
        url: "https://example.com",
        workAddress: {
          street: "1-1-1 Test Street",
          city: "Tokyo",
          stateProvince: "Tokyo",
          postalCode: "100-0001",
          countryRegion: "Japan",
        },
        socialUrls: {
          facebook: "https://facebook.com/testuser",
          linkedIn: "https://linkedin.com/in/testuser",
          twitter: "https://twitter.com/testuser",
          instagram: "https://instagram.com/testuser",
        },
        photo: "data:image/png;base64,iVBORw0KGgo",
        note: "This is a test note",
      };

      const mockBlob = new Blob(["vcard data"], { type: "text/vcard" });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      render(<VCardButton profileData={fullProfileData} />, {
        wrapper: TestWrapper,
      });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith("/api/vcard", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fullProfileData),
        });
      });
    });
  });

  describe("エラーハンドリング", () => {
    it("usernameもprofileDataも提供されていない場合エラーを表示する", async () => {
      render(<VCardButton />, { wrapper: TestWrapper });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: "エラー",
          description: "VCardのダウンロードに失敗しました",
          variant: "destructive",
        });
      });
    });

    it("APIがエラーレスポンスを返した場合エラーを表示する", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      render(<VCardButton username="testuser" />, { wrapper: TestWrapper });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: "エラー",
          description: "VCardのダウンロードに失敗しました",
          variant: "destructive",
        });
      });
    });

    it("ネットワークエラーが発生した場合エラーを表示する", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error"),
      );

      render(<VCardButton username="testuser" />, { wrapper: TestWrapper });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith({
          title: "エラー",
          description: "VCardのダウンロードに失敗しました",
          variant: "destructive",
        });
      });
    });
  });

  describe("ローディング状態", () => {
    it("ダウンロード中はボタンが無効になる", async () => {
      const mockBlob = new Blob(["vcard data"], { type: "text/vcard" });
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                blob: async () => mockBlob,
              });
            }, 100);
          }),
      );

      render(<VCardButton username="testuser" />, { wrapper: TestWrapper });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      // ローディング中の確認
      expect(button).toBeDisabled();
      expect(screen.getByText("生成中...")).toBeInTheDocument();

      await waitFor(() => {
        expect(button).not.toBeDisabled();
        expect(screen.getByText("連絡先を保存")).toBeInTheDocument();
      });
    });

    it("ローディングアイコンが正しくアニメーションする", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      render(<VCardButton username="testuser" />, { wrapper: TestWrapper });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      const loader = button.querySelector(".animate-spin");
      expect(loader).toBeInTheDocument();
    });
  });

  describe("ファイル名の生成", () => {
    it("usernameからファイル名を生成する", async () => {
      const mockBlob = new Blob(["vcard data"], { type: "text/vcard" });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      render(<VCardButton username="testuser" />, { wrapper: TestWrapper });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        const downloadLink = mockCreateElement.mock.results.find(
          (result) => result.value.tagName === "A",
        )?.value;
        expect(downloadLink?.download).toBe("testuser.vcf");
      });
    });

    it("profileDataのfirstNameからファイル名を生成する", async () => {
      const mockBlob = new Blob(["vcard data"], { type: "text/vcard" });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      render(<VCardButton profileData={{ firstName: "John" }} />, {
        wrapper: TestWrapper,
      });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        const downloadLink = mockCreateElement.mock.results.find(
          (result) => result.value.tagName === "A",
        )?.value;
        expect(downloadLink?.download).toBe("John.vcf");
      });
    });

    it("デフォルトファイル名を使用する", async () => {
      const mockBlob = new Blob(["vcard data"], { type: "text/vcard" });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      render(<VCardButton profileData={{}} />, { wrapper: TestWrapper });

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        const downloadLink = mockCreateElement.mock.results.find(
          (result) => result.value.tagName === "A",
        )?.value;
        expect(downloadLink?.download).toBe("contact.vcf");
      });
    });
  });
});
