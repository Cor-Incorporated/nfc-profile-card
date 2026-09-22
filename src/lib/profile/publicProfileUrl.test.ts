import { publicProfileUrl } from "./publicProfileUrl";

test.each(["foo#bar", "foo?bar", "u_a#b", "name with space"])(
  "a public identifier with URL delimiters stays in one profile path: %s",
  (username) => {
    const url = publicProfileUrl("https://www.tapforge.org", username);

    expect(new URL(url).pathname).toBe(`/p/${encodeURIComponent(username)}`);
    expect(decodeURIComponent(new URL(url).pathname.slice(3))).toBe(username);
  },
);
