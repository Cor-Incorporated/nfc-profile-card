import { adminDb } from "@/lib/firebase-admin";
import { resolvePublicProfileOwner } from "@/lib/profile/publicProfileData";
import { getOwnedRedirectAliases } from "./getOwnedRedirectAliases";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn() },
}));
jest.mock("@/lib/profile/publicProfileData", () => ({
  resolvePublicProfileOwner: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

test("returns only redirect aliases from the owner's alias query", async () => {
  const get = jest.fn().mockResolvedValue({
    docs: [
      { id: "very-old", data: () => ({ status: "redirect" }) },
      { id: "disabled", data: () => ({ status: "disabled" }) },
      { id: "u_shadowed", data: () => ({ status: "redirect" }) },
      { id: "reserved-by-other", data: () => ({ status: "redirect" }) },
    ],
  });
  const where = jest.fn().mockReturnValue({ get });
  (adminDb.collection as jest.Mock).mockReturnValue({ where });
  (resolvePublicProfileOwner as jest.Mock).mockImplementation(
    async (username: string) =>
      username === "very-old" ? "owner" : "different-user",
  );

  await expect(getOwnedRedirectAliases("owner")).resolves.toEqual(["very-old"]);
  expect(adminDb.collection).toHaveBeenCalledWith("usernameAliases");
  expect(where).toHaveBeenCalledWith("uid", "==", "owner");
  expect(resolvePublicProfileOwner).toHaveBeenCalledTimes(3);
  expect(resolvePublicProfileOwner).toHaveBeenCalledWith("u_shadowed");
  expect(resolvePublicProfileOwner).toHaveBeenCalledWith("reserved-by-other");
});
