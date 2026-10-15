import { bust, createStore } from "./store";
import type { Stock, TwName, TwUniverseFile } from "../types";

const empty: TwUniverseFile = { updatedAt: "", stocks: [] };
const store = createStore<TwUniverseFile | null>(null);
let inflight: Promise<TwUniverseFile> | null = null;

export function peekUniverse() {
  return store.get();
}

export function subscribeUniverse(listen: (value: TwUniverseFile | null) => void) {
  return store.subscribe(listen);
}

export function replaceUniverse(data: TwUniverseFile) {
  store.set(data);
}

export async function loadUniverse(): Promise<TwUniverseFile> {
  const current = store.get();
  if (current) return current;
  if (!inflight) {
    inflight = fetch(bust("./tw-universe.json"), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return empty;
        return (await response.json()) as TwUniverseFile;
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

export function isTwCode(code: string): boolean {
  return /^[0-9]{4,6}[A-Za-z]?$/i.test(code.trim());
}

export function nameToStock(row: TwName): Stock {
  const otc = row.market === "tpex";
  const etf = row.industry === "ETF" || row.code.startsWith("00");
  return {
    id: `tw-${row.code}`,
    market: "tw",
    symbol: row.code,
    yahoo: `${row.code}.${otc ? "TWO" : "TW"}`,
    tv: `${otc ? "TPEX" : "TWSE"}:${row.code}`,
    nameZh: row.name || row.code,
    nameEn: row.name || row.code,
    sector: row.industry || (etf ? "ETF" : otc ? "上櫃" : "上市"),
    summary: etf
      ? "證交所上市 ETF。"
      : otc
        ? "櫃買中心上櫃股票。"
        : "證交所上市股票。",
  };
}

export function findUniverseName(data: TwUniverseFile | null, code: string): TwName | undefined {
  if (!data) return undefined;
  const key = code.toUpperCase();
  return data.stocks.find((row) => row.code.toUpperCase() === key);
}

export function venueLabel(stock: Stock): string {
  if (stock.market !== "tw") return "美股";
  return stock.yahoo.toUpperCase().endsWith(".TWO") ? "上櫃" : "上市";
}

export function searchUniverseNames(data: TwUniverseFile | null, query: string, limit = 24): Stock[] {
  const q = query.trim().toLowerCase();
  if (!q || !data) return [];
  return data.stocks
    .filter(
      (row) =>
        row.code.toLowerCase().includes(q) || row.name.toLowerCase().includes(q),
    )
    .slice(0, limit)
    .map(nameToStock);
}
