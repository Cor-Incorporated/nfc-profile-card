import {
  classifyPhones,
  exactValuesEqual,
  formatPhone,
  isMobilePhone,
  normalizePhone,
} from "./parsers";

describe("business-card phone parsing", () => {
  it.each([
    ["03-1234-5678", "03-1234-5678"],
    ["090-1234-5678", "090-1234-5678"],
    ["092-123-4567", "092-123-4567"],
    ["075-123-4567", "075-123-4567"],
    ["0120-123-456", "0120-123-456"],
  ])("formats %s without changing its digits", (input, expected) => {
    expect(formatPhone(normalizePhone(input))).toBe(expected);
  });

  it("keeps 050 as a work phone while retaining 090 as mobile", () => {
    const classified = classifyPhones(
      ["TEL: 03-1234-5678", "IP: 050-1234-5678", "Mobile: 090-1234-5678"].join(
        "\n",
      ),
    );

    expect(isMobilePhone("050-1234-5678")).toBe(false);
    expect(classified.phone).toEqual(["03-1234-5678", "050-1234-5678"]);
    expect(classified.mobile).toEqual(["090-1234-5678"]);
  });

  it.each(["FAX", "ファックス", "ファクス"])(
    "classifies a number after the %s label as fax",
    (label) => {
      const classified = classifyPhones(
        `TEL: 03-1234-5678 ${label}: 092-123-4567`,
      );

      expect(classified.phone).toEqual(["03-1234-5678"]);
      expect(classified.fax).toEqual(["092-123-4567"]);
    },
  );

  it("continues to compare phone values by normalized digits", () => {
    expect(exactValuesEqual("phone", "092-123-4567", "0921234567")).toBe(true);
  });
});
