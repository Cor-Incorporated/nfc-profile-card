import {
  formatProfileAddress,
  normalizeProfileAddress,
  profileAddressForVCard,
  splitEditedProfileAddress,
} from "./address";

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
    // The final unseparated city/street boundary is ambiguous, so retain
    // the complete address instead of truncating a possible street name.
    expect(normalized.address).toBe("〒100-0001 東京都千代田区千代田1-1");
    expect(normalizeProfileAddress(normalized)).toEqual(normalized);
    expect(formatProfileAddress(duplicated)).toBe(
      "〒100-0001 東京都千代田区千代田1-1",
    );
    expect(profileAddressForVCard(duplicated)).toEqual({
      postalCode: "",
      city: "",
      address: "〒100-0001 東京都千代田区千代田1-1",
    });
  });

  it("keeps a longer city name in the final complete address", () => {
    const duplicated = {
      postalCode: "100-0001",
      city: "架空県架空市",
      address: "100-0001 架空県架空市 100-0001 架空県架空市中央区中央1-1",
    };
    expect(formatProfileAddress(duplicated, true)).toBe(
      "〒100-0001 架空県架空市中央区中央1-1",
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

  it("keeps street names that only share a prefix with the city", () => {
    expect(
      normalizeProfileAddress({ city: "York", address: "Yorkshire Road 5" })
        .address,
    ).toBe("Yorkshire Road 5");
    expect(
      normalizeProfileAddress({ city: "York", address: "York Road 5" }).address,
    ).toBe("York Road 5");
    expect(
      normalizeProfileAddress({ city: "架空市", address: "架空市民会館5" })
        .address,
    ).toBe("架空市民会館5");
    expect(
      normalizeProfileAddress({ city: "架空市", address: "架空市 中央1-1" })
        .address,
    ).toBe("架空市 中央1-1");
    expect(
      splitEditedProfileAddress("Yorkshire Road 5", { city: "York" }),
    ).toEqual({ postalCode: "", city: "", address: "Yorkshire Road 5" });
  });

  it("keeps a matching house number when the city does not follow it", () => {
    expect(
      normalizeProfileAddress({
        postalCode: "12345",
        city: "Fiction City",
        address: "12345 Main St",
      }).address,
    ).toBe("12345 Main St");
  });

  it("does not cut a facility name that begins with the city characters", () => {
    const parts = {
      postalCode: "12345",
      city: "架空市",
      address: "12345 架空市民会館5",
    };
    expect(normalizeProfileAddress(parts).address).toBe(parts.address);
    expect(formatProfileAddress(parts)).toBe(parts.address);
    expect(profileAddressForVCard(parts)).toEqual({
      postalCode: "",
      city: "",
      address: parts.address,
    });
    expect(splitEditedProfileAddress(parts.address, parts)).toEqual(parts);
  });

  it("keeps a single full address without guessing its city/street split", () => {
    expect(
      normalizeProfileAddress({
        postalCode: "12345",
        city: "架空市",
        address: "12345 架空市 中央町1",
      }).address,
    ).toBe("12345 架空市 中央町1");
  });

  it("removes only repeated complete prefixes before a city-like facility", () => {
    const parts = {
      postalCode: "12345",
      city: "架空市",
      address: "12345 架空市 12345 架空市民会館5",
    };
    expect(normalizeProfileAddress(parts).address).toBe("12345 架空市民会館5");
    expect(formatProfileAddress(parts)).toBe("12345 架空市民会館5");
  });

  it("removes all provable old prefixes even beyond ten saves", () => {
    const oldPrefix = "100-0001 東京都千代田区 ";
    expect(
      formatProfileAddress({
        postalCode: "100-0001",
        city: "東京都千代田区",
        address: `${oldPrefix.repeat(12)}千代田1-1`,
      }),
    ).toBe("100-0001 東京都千代田区 千代田1-1");
  });
});
