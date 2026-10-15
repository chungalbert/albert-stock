import { extraStocks } from "../data/extraUniverse";
import { searchStocks } from "../data/stocks";
import { searchFundamentals } from "./fundamentals";
import { searchListed } from "./rankings";
import { searchThemeRows } from "./themes";
import { findUniverseName, nameToStock, searchUniverseNames } from "./universe";
import type {
  Stock,
  ThemeBoardsFile,
  TwFundamentalsFile,
  TwRankingsFile,
  TwUniverseFile,
} from "../types";

function score(stock: Stock, q: string) {
  const symbol = stock.symbol.toLowerCase();
  const zh = stock.nameZh.toLowerCase();
  const en = stock.nameEn.toLowerCase();
  if (symbol === q || zh === q || en === q) return 0;
  if (symbol.startsWith(q) || zh.startsWith(q) || en.startsWith(q)) return 1;
  return 2;
}

export function guessTicker(query: string, universe: TwUniverseFile | null = null): Stock | null {
  const raw = query.trim();
  if (!raw) return null;
  if (/^\d{4,6}$/.test(raw) || /^\d{4,6}\.(TW|TWO)$/i.test(raw)) {
    const code = raw.replace(/\.(TW|TWO)$/i, "");
    const known = findUniverseName(universe, code);
    if (known) return nameToStock(known);
    const otc = /\.TWO$/i.test(raw);
    return {
      id: `tw-${code}`,
      market: "tw",
      symbol: code,
      yahoo: `${code}.${otc ? "TWO" : "TW"}`,
      tv: `${otc ? "TPEX" : "TWSE"}:${code}`,
      nameZh: code,
      nameEn: code,
      sector: otc ? "上櫃" : "上市",
      summary: "以代號帶入的台股庫存。",
    };
  }
  if (/^[A-Za-z][A-Za-z0-9.-]{0,6}$/.test(raw)) {
    const symbol = raw.toUpperCase();
    return {
      id: `us-${symbol.toLowerCase()}`,
      market: "us",
      symbol,
      yahoo: symbol,
      tv: symbol,
      nameZh: symbol,
      nameEn: symbol,
      sector: "美股",
      summary: "以代號帶入的美股庫存。",
    };
  }
  return null;
}

export function searchUniverse(
  query: string,
  themes: ThemeBoardsFile | null,
  rankings: TwRankingsFile | null,
  fundamentals: TwFundamentalsFile | null,
  limit = 8,
  universe: TwUniverseFile | null = null,
): Stock[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const guessed = guessTicker(query, universe);
  const pool = [
    ...searchStocks(query, limit),
    ...extraStocks.filter(
      (item) =>
        item.symbol.toLowerCase().includes(q) ||
        item.nameZh.toLowerCase().includes(q) ||
        item.nameEn.toLowerCase().includes(q),
    ),
    ...searchThemeRows(themes, query, limit),
    ...searchUniverseNames(universe, query, Math.max(limit, 40)),
    ...searchListed(rankings?.listed ?? [], query, Math.max(limit, 24)),
    ...searchFundamentals(fundamentals, query, Math.max(limit, 24)),
    ...(guessed ? [guessed] : []),
  ];
  const seen = new Set<string>();
  const merged: Stock[] = [];
  for (const item of pool.sort((a, b) => score(a, q) - score(b, q))) {
    const key = `${item.market}:${item.symbol.toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}
