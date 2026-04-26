import { generateDefaultUsername, getUidFallbackUsername } from "./username";

describe("generateDefaultUsername", () => {
  it("メールアドレス由来ではないランダム数字IDを生成する", () => {
    const username = generateDefaultUsername();

    expect(username).toMatch(/^[1-9][0-9]{11}$/);
    expect(username).not.toContain("@");
  });
});

describe("getUidFallbackUsername", () => {
  it("username未設定ユーザー向けに安定したUID由来のフォールバックを返す", () => {
    expect(getUidFallbackUsername("abc123XYZ_4567890-long-uid")).toBe(
      "u_abc123XYZ_4567890-long-uid",
    );
  });

  it("URLに使える文字だけに正規化する", () => {
    expect(getUidFallbackUsername("abc@example.com")).toBe("u_abcexamplecom");
  });
});
