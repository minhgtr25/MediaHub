const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    let id = "";
    if (host === "youtu.be" || host === "www.youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
      ].includes(host)
    ) {
      if (url.pathname === "/watch") id = url.searchParams.get("v") ?? "";
      else {
        const [, kind, segment] = url.pathname.split("/");
        if (["shorts", "embed", "live"].includes(kind)) id = segment ?? "";
      }
    } else return null;
    return videoIdPattern.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const id = youtubeVideoId(value);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}
