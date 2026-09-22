export function publicProfileUrl(origin: string, username: string) {
  return `${origin}/p/${encodeURIComponent(username)}`;
}
