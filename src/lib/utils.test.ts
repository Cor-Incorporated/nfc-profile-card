import { cn } from "./utils";

describe("Utility Functions", () => {
  describe("cn (className merger)", () => {
    it("should merge single class name", () => {
      expect(cn("base")).toBe("base");
    });

    it("should merge multiple class names", () => {
      expect(cn("base", "additional")).toBe("base additional");
    });

    it("should handle conditional classes", () => {
      expect(cn("base", true && "active")).toBe("base active");
      expect(cn("base", false && "inactive")).toBe("base");
    });

    it("should handle object notation", () => {
      expect(cn("base", { active: true, disabled: false })).toBe("base active");
      expect(cn("base", { "text-lg": true, "font-bold": true })).toBe(
        "base text-lg font-bold",
      );
    });

    it("should handle arrays", () => {
      expect(cn(["base", "text-sm"])).toBe("base text-sm");
      expect(cn("base", ["additional", "more"])).toBe("base additional more");
    });

    it("should override Tailwind classes correctly", () => {
      expect(cn("text-sm", "text-lg")).toBe("text-lg");
      expect(cn("p-4", "p-6")).toBe("p-6");
      expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
    });

    it("should handle undefined and null values", () => {
      expect(cn("base", undefined, null, "additional")).toBe("base additional");
    });

    it("should handle empty strings", () => {
      expect(cn("", "base", "")).toBe("base");
      expect(cn("")).toBe("");
    });

    it("should merge complex Tailwind utilities", () => {
      expect(
        cn(
          "px-4 py-2 text-white bg-blue-500",
          "hover:bg-blue-600",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
        ),
      ).toBe(
        "px-4 py-2 text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500",
      );
    });
  });
});

// 追加のユーティリティ関数テスト（今後実装予定の関数用）
describe("Future Utility Functions", () => {
  describe("formatDate", () => {
    it.todo("should format date to Japanese locale");
    it.todo("should handle invalid dates gracefully");
  });

  describe("validateEmail", () => {
    it.todo("should validate correct email formats");
    it.todo("should reject invalid email formats");
  });

  describe("generateUsername", () => {
    it.todo("should generate unique username from email");
    it.todo("should handle special characters");
  });

  describe("sanitizeInput", () => {
    it.todo("should remove harmful scripts");
    it.todo("should preserve safe HTML");
  });
});
