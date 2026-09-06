import { profileContactVcard } from "./profileContactVcard";

it("preserves a complete display name without guessing family/given names", () => {
  const card = profileContactVcard({
    name: "王 小明",
    company: "Example;Corp",
    email: "test@example.com",
  });
  expect(card).toContain("FN:王 小明\r\nN:王 小明;;;;\r\n");
  expect(card).toContain("ORG:Example\\;Corp\r\n");
  expect(card).not.toContain("TEL");
  expect(card).not.toContain("URL");
});

it("escapes injected lines and folds UTF-8 without losing characters", () => {
  const address = "東京都".repeat(40) + "\r\nTEL:invented";
  const card = profileContactVcard({ name: "Example", address });
  expect(card.replace(/\r\n /g, "")).toContain(address.replace("\r\n", "\\n"));
  expect(
    card.split("\r\n").every((line) => Buffer.byteLength(line) <= 75),
  ).toBe(true);
  expect(
    card.split("\r\n").filter((line) => line.startsWith("TEL:")),
  ).toHaveLength(0);
});

it("uses the displayed custom profile and preserves mobile and social contacts", () => {
  const { customProfileContactVcard } = require("./profileContactVcard");
  const card = customProfileContactVcard([
    {
      type: "profile",
      content: {
        name: "Visible Name",
        cellPhone: "+8612345678901",
        postalCode: "123456",
      },
    },
    {
      type: "link",
      content: { label: "WeChat", url: "https://example.com/contact" },
    },
  ]);
  expect(card).toContain("FN:Visible Name\r\n");
  expect(card).toContain("TEL;TYPE=CELL:+8612345678901\r\n");
  expect(card).toContain("NOTE:WeChat: https://example.com/contact");
  expect(card).not.toContain("ORG:");
  expect(customProfileContactVcard([])).toBeUndefined();
  expect(
    customProfileContactVcard([
      { type: "profile", content: {} },
      { type: "profile", content: {} },
    ]),
  ).toBeUndefined();
});
