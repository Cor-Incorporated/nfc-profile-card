import { getDesignRevision } from "./designRevision";

test("compares Web and Admin timestamps at nanosecond precision", () => {
  expect(getDesignRevision({ seconds: 100, nanoseconds: 10 })).toBe(
    "100:000000010",
  );
  expect(getDesignRevision({ seconds: 100, nanoseconds: 11 })).not.toBe(
    "100:000000010",
  );
  expect(getDesignRevision(new Date(100_001))).toBe("100:001000000");
  expect(getDesignRevision(null)).toBeNull();
});
