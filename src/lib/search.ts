import { searchStocks } from "../data/stocks";
import { searchFundamentals } from "./fundamentals";
import { searchListed } from "./rankings";
import { searchThemeRows } from "./themes";
import type { Stock, ThemeBoardsFile, TwFundamentalsFile, TwRankingsFile } from "../types";

export function searchUniverse(
  query: string,
  themes: ThemeBoardsFile | null,
  rankings: TwRankingsFile | null,
  fundamentals: TwFundamentalsFile | null,
  limit = 8,
): Stock[] {
  const curated = searchStocks(query, limit);
  const extra = [
    ...searchThemeRows(themes, query, limit),
    ...searchListed(rankings?.listed ?? [], query, limit),
    ...searchFundamentals(fundamentals, query, limit),
  ];
  const seen = new Set(curated.map((item) => `${item.market}:${item.symbol}`));
  const merged = [...curated];
  for (const item of extra) {
    const key = `${item.market}:${item.symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged.slice(0, limit);
}
