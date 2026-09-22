import { revalidatePath } from "next/cache";
import {
  getOwnedUidFallbackUsername,
  revalidatePublicProfiles,
} from "./revalidatePublicProfiles";

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test("invalidates only the exact URL for a mixed-case UID", () => {
  revalidatePublicProfiles("u_AbC123", "u_AbC123", "");

  expect((revalidatePath as jest.Mock).mock.calls).toEqual([["/p/u_AbC123"]]);
});

test("ignores values outside a single safe public profile segment", () => {
  revalidatePublicProfiles("..", "another/path", "x".repeat(151), "alice");
  expect((revalidatePath as jest.Mock).mock.calls).toEqual([["/p/alice"]]);
});

test("only exact, safe UIDs have an owned fallback URL", () => {
  expect(getOwnedUidFallbackUsername("MixCase-1")).toBe("u_MixCase-1");
  expect(getOwnedUidFallbackUsername("a:b")).toBeNull();
  expect(getOwnedUidFallbackUsername("x".repeat(149))).toBeNull();
});
