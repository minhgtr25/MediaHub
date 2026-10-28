// Neutral initials for missing photos; never imply a stock/AI portrait belongs to a Creator.
export function avatarPlaceholder(name: string) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((word) => word.match(/\p{L}|\p{N}/u)?.[0] ?? "")
      .join("")
      .toUpperCase() || "MH";
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#eef1f0"/><text x="100" y="110" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="64" fill="#455751">${initials}</text></svg>`)}`;
}
