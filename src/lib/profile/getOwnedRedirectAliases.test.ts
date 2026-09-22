import { adminDb } from "@/lib/firebase-admin";
import { getOwnedRedirectAliases } from "./getOwnedRedirectAliases";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: jest.fn() },
}));

test("returns only redirect aliases from the owner's alias query", async () => {
  const get = jest.fn().mockResolvedValue({
    docs: [
      { id: "very-old", data: () => ({ status: "redirect" }) },
      { id: "disabled", data: () => ({ status: "disabled" }) },
    ],
  });
  const where = jest.fn().mockReturnValue({ get });
  (adminDb.collection as jest.Mock).mockReturnValue({ where });

  await expect(getOwnedRedirectAliases("owner")).resolves.toEqual([
    "very-old",
  ]);
  expect(adminDb.collection).toHaveBeenCalledWith("usernameAliases");
  expect(where).toHaveBeenCalledWith("uid", "==", "owner");
});
