export function publicProfilePath(username: string) {
  return `/p/${encodeURIComponent(username)}`;
}

export function publicProfileUrl(origin: string, username: string) {
  return `${origin}${publicProfilePath(username)}`;
}
