import { formatProfileAddress, normalizeProfileAddress } from "./address";

const structured = {
  postalCode: "100-0001",
  city: "東京都千代田区",
  address: "千代田1-1",
};

describe("profile address", () => {
  it("formats structured fields once", () => {
    expect(formatProfileAddress(structured)).toBe(
      "100-0001 東京都千代田区千代田1-1",
    );
    expect(formatProfileAddress(structured, true)).toBe(
      "〒100-0001 東京都千代田区千代田1-1",
    );
  });

  it("removes prefixes accumulated by repeated basic-profile saves", () => {
    const duplicated = {
      ...structured,
      address: "100-0001 東京都千代田区 〒100-0001 東京都千代田区千代田1-1",
    };
    const normalized = normalizeProfileAddress(duplicated);
    expect(normalized.address).toBe("千代田1-1");
    expect(normalizeProfileAddress(normalized)).toEqual(normalized);
    expect(formatProfileAddress(duplicated)).toBe(
      "100-0001 東京都千代田区千代田1-1",
    );
  });

  it("is stable after loading the basic edit field more than once", () => {
    const fullAddress = formatProfileAddress(structured);
    expect(formatProfileAddress({ ...structured, address: fullAddress })).toBe(
      fullAddress,
    );
  });

  it("keeps a manually entered address when there are no split fields", () => {
    expect(formatProfileAddress({ address: "Somewhere 42" })).toBe(
      "Somewhere 42",
    );
  });
});
