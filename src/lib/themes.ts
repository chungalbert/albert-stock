import { bust, createStore } from "./store";
import type { Stock, ThemeBoardsFile, ThemeRow } from "../types";

const empty: ThemeBoardsFile = {
  updatedAt: "",
  method: "",
  boards: {},
  highlights: [],
  counts: {},
};

const store = createStore<ThemeBoardsFile | null>(null);
let inflight: Promise<ThemeBoardsFile> | null = null;

export function peekThemeBoards() {
  return store.get();
}

export function subscribeThemeBoards(listen: (value: ThemeBoardsFile | null) => void) {
  return store.subscribe(listen);
}

export function replaceThemeBoards(data: ThemeBoardsFile) {
  store.set(data);
}

export async function loadThemeBoards(): Promise<ThemeBoardsFile> {
  const current = store.get();
  if (current) return current;
  if (!inflight) {
    inflight = fetch(bust("./theme-boards.json"), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return empty;
        return (await response.json()) as ThemeBoardsFile;
      })
      .catch(() => empty)
      .then((data) => {
        store.set(data);
        inflight = null;
        return data;
      });
  }
  return inflight;
}

export function themeToStock(row: ThemeRow): Stock {
  return {
    id: `${row.market}-${row.symbol}`.toLowerCase(),
    market: row.market,
    symbol: row.symbol,
    yahoo: row.yahoo,
    tv: row.market === "tw" ? `TWSE:${row.symbol}` : row.symbol,
    nameZh: row.nameZh,
    nameEn: row.nameEn,
    sector: row.theme,
    summary: row.note,
  };
}

export function findThemeRows(
  data: ThemeBoardsFile | null,
  market: string,
  symbol: string,
): ThemeRow[] {
  if (!data) return [];
  const key = symbol.toUpperCase();
  const rows: ThemeRow[] = [];
  const seen = new Set<string>();
  for (const board of Object.values(data.boards)) {
    for (const row of board.rows) {
      if (row.market !== market || row.symbol.toUpperCase() !== key) continue;
      const id = `${board.id}:${row.yahoo}`;
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(row);
    }
  }
  return rows;
}

export function findThemeRow(
  data: ThemeBoardsFile | null,
  market: string,
  symbol: string,
): ThemeRow | undefined {
  const rows = findThemeRows(data, market, symbol);
  return rows.find((row) => row.outlook) ?? rows[0];
}

export function searchThemeRows(
  data: ThemeBoardsFile | null,
  query: string,
  limit = 8,
): Stock[] {
  const q = query.trim().toLowerCase();
  if (!q || !data) return [];
  const seen = new Set<string>();
  const results: Stock[] = [];
  for (const board of Object.values(data.boards)) {
    for (const row of board.rows) {
      const key = `${row.market}:${row.symbol}`;
      if (seen.has(key)) continue;
      if (
        row.symbol.toLowerCase().includes(q) ||
        row.nameZh.toLowerCase().includes(q) ||
        row.nameEn.toLowerCase().includes(q)
      ) {
        seen.add(key);
        results.push(themeToStock(row));
      }
      if (results.length >= limit) return results;
    }
  }
  return results;
}

export function findThemeById(
  data: ThemeBoardsFile | null,
  id: string,
): ThemeRow | undefined {
  const match = id.match(/^(us|tw)-(.+)$/i);
  if (!match) return undefined;
  return findThemeRow(data, match[1].toLowerCase(), match[2]);
}

export function namesOf(rows: ThemeRow[], max = 8): string {
  return rows
    .slice(0, max)
    .map((row) => row.nameZh)
    .join("、");
}
