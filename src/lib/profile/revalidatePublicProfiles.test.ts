import { revalidatePath } from "next/cache";
import { revalidatePublicProfiles } from "./revalidatePublicProfiles";

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test("invalidates the original and normalized public URL for a mixed-case UID", () => {
  revalidatePublicProfiles("u_AbC123", "u_AbC123", "");

  expect((revalidatePath as jest.Mock).mock.calls).toEqual([
    ["/p/u_AbC123"],
    ["/p/u_abc123"],
  ]);
});

test("ignores values outside a single safe public profile segment", () => {
  revalidatePublicProfiles("..", "another/path", "x".repeat(151), "alice");
  expect((revalidatePath as jest.Mock).mock.calls).toEqual([["/p/alice"]]);
});
