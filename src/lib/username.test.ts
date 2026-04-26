import { generateDefaultUsername, getUidFallbackUsername } from "./username";

describe("generateDefaultUsername", () => {
  it("メールアドレス由来ではない公開ユーザー名を生成する", () => {
    const username = generateDefaultUsername();

    expect(username).toMatch(/^user_[a-f0-9]{16}$/);
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
