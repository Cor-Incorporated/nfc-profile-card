import { resolvePublicProfileOwner } from "@/lib/profile/publicProfileData";
import { ownsPublicUsername } from "./ownsPublicUsername";

jest.mock("@/lib/profile/publicProfileData", () => ({
  resolvePublicProfileOwner: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

test("only the owner returned by public routing may invalidate that URL", async () => {
  (resolvePublicProfileOwner as jest.Mock).mockResolvedValue("actual-owner");

  await expect(ownsPublicUsername("actual-owner", "alias")).resolves.toBe(true);
  await expect(ownsPublicUsername("other", "alias")).resolves.toBe(false);
  expect(resolvePublicProfileOwner).toHaveBeenCalledWith("alias");
});

test("rejects paths that cannot be a single safe public segment", async () => {
  await expect(ownsPublicUsername("owner", "../other")).resolves.toBe(false);
  await expect(ownsPublicUsername("owner", " alias ")).resolves.toBe(false);
  expect(resolvePublicProfileOwner).not.toHaveBeenCalled();
});
