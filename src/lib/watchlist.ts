const KEY = "albert-stock-watchlist";

export function readWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writeWatchlist(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids));
}

export function toggleWatch(id: string): string[] {
  const current = readWatchlist();
  const next = current.includes(id)
    ? current.filter((item) => item !== id)
    : [id, ...current];
  writeWatchlist(next);
  return next;
}
