import { formatProfileAddress } from "./address";
import { syncBasicProfileContent } from "./syncBasicProfile";

describe("basic edit profile sync", () => {
  it("does not grow the public address after repeated edit saves", () => {
    let content: Record<string, unknown> = {
      postalCode: "100-0001",
      city: "東京都千代田区",
      address: "千代田1-1",
      cardBackgroundColor: "#ffffff",
    };

    for (let save = 0; save < 3; save += 1) {
      const editedAddress = formatProfileAddress(content);
      content = syncBasicProfileContent(
        content,
        { address: editedAddress },
        true,
      );
      expect(formatProfileAddress(content)).toBe(
        "100-0001 東京都千代田区千代田1-1",
      );
      expect(content.postalCode).toBe("100-0001");
      expect(content.city).toBe("東京都千代田区");
      expect(content.address).toBe("千代田1-1");
      expect(content.cardBackgroundColor).toBe("#ffffff");
    }
  });

  it("clears an address in both basic and public profiles", () => {
    const content = syncBasicProfileContent(
      { postalCode: "100-0001", city: "東京都", address: "千代田1-1" },
      { address: "" },
      true,
    );
    expect(formatProfileAddress(content)).toBe("");
  });

  it("preserves split address fields during username-only setup", () => {
    const existing = {
      postalCode: "100-0001",
      city: "東京都千代田区",
      address: "千代田1-1",
    };
    expect(syncBasicProfileContent(existing, { address: "" })).toEqual(
      existing,
    );
  });

  it("drops stale split fields when the full address changes region", () => {
    const content = syncBasicProfileContent(
      { postalCode: "100-0001", city: "東京都千代田区", address: "千代田1-1" },
      { address: "530-0001 大阪府大阪市北区梅田1-1" },
      true,
    );
    expect(content.address).toBe("530-0001 大阪府大阪市北区梅田1-1");
    expect(content).not.toHaveProperty("postalCode");
    expect(content).not.toHaveProperty("city");
  });

  it("keeps a postal mark in a free-form address", () => {
    const content = syncBasicProfileContent(
      { address: "" },
      { address: "〒530-0001 大阪府大阪市北区梅田1-1" },
      true,
    );
    expect(content.address).toBe("〒530-0001 大阪府大阪市北区梅田1-1");
  });

  it("clears public contact fields and fallback name parts on full edit", () => {
    const content = syncBasicProfileContent(
      {
        name: "Old Name",
        firstName: "Old",
        lastName: "Name",
        email: "old@example.test",
        phone: "000-1111",
        cellPhone: "000-2222",
        bio: "Old bio",
        photoURL: "https://example.test/old.png",
      },
      { name: "", email: "", phone: "", bio: "", photoURL: "" },
      true,
    );

    expect(content).toMatchObject({
      name: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      cellPhone: "",
      bio: "",
      photoURL: "",
    });
  });

  it("keeps a cell-only phone from appearing twice on an unrelated edit", () => {
    const content = syncBasicProfileContent(
      { phone: "", cellPhone: "000-2222" },
      { phone: "000-2222", bio: "Updated" },
      true,
    );
    expect(content.phone).toBe("");
    expect(content.cellPhone).toBe("000-2222");
  });
});
