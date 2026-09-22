import { publicProfilePath, publicProfileUrl } from "./publicProfileUrl";
import { ROUTES } from "@/lib/constants/routes";

test.each(["foo#bar", "foo?bar", "u_a#b", "name with space"])(
  "a public identifier with URL delimiters stays in one profile path: %s",
  (username) => {
    expect(publicProfilePath(username)).toBe(
      `/p/${encodeURIComponent(username)}`,
    );
    expect(ROUTES.PUBLIC_PROFILE(username)).toBe(publicProfilePath(username));
    const url = publicProfileUrl("https://www.tapforge.org", username);

    expect(new URL(url).pathname).toBe(`/p/${encodeURIComponent(username)}`);
    expect(decodeURIComponent(new URL(url).pathname.slice(3))).toBe(username);
  },
);
