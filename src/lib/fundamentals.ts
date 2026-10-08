import { bust, createStore } from "./store";
import type { Stock, TwFundamental, TwFundamentalsFile } from "../types";

const empty: TwFundamentalsFile = {
  updatedAt: "",
  revenueYm: "",
  stocks: {},
};

const store = createStore<TwFundamentalsFile | null>(null);
let inflight: Promise<TwFundamentalsFile> | null = null;

export function peekFundamentals() {
  return store.get();
}

export function subscribeFundamentals(listen: (value: TwFundamentalsFile | null) => void) {
  return store.subscribe(listen);
}

export function replaceFundamentals(data: TwFundamentalsFile) {
  store.set(data);
}

export async function loadFundamentals(): Promise<TwFundamentalsFile> {
  const current = store.get();
  if (current) return current;
  if (!inflight) {
    inflight = fetch(bust("./tw-fundamentals.json"), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return empty;
        return (await response.json()) as TwFundamentalsFile;
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

export function findFundamental(
  data: TwFundamentalsFile | null,
  code: string,
): TwFundamental | undefined {
  if (!data) return undefined;
  return data.stocks[code] ?? data.stocks[code.toUpperCase()];
}

export function fundToStock(row: TwFundamental): Stock {
  const otc = row.market === "tpex";
  return {
    id: `tw-${row.code}`,
    market: "tw",
    symbol: row.code,
    yahoo: `${row.code}.${otc ? "TWO" : "TW"}`,
    tv: `${otc ? "TPEX" : "TWSE"}:${row.code}`,
    nameZh: row.name || row.code,
    nameEn: row.code,
    sector: row.industry || (otc ? "上櫃" : "上市"),
    summary: "台股基本面資料來自月營收、本益比與股利分派公開資訊。",
  };
}

export function searchFundamentals(
  data: TwFundamentalsFile | null,
  query: string,
  limit = 8,
): Stock[] {
  const q = query.trim().toLowerCase();
  if (!q || !data) return [];
  return Object.values(data.stocks)
    .filter(
      (row) =>
        row.code.toLowerCase().includes(q) ||
        (row.name ?? "").toLowerCase().includes(q),
    )
    .slice(0, limit)
    .map(fundToStock);
}

export function formatComma(value?: number, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("zh-TW", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatSignedPct(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatIsoDate(iso?: string): string {
  if (!iso) return "—";
  return iso.replaceAll("-", "/");
}

export function toneClass(value?: number): string {
  if (value == null || Number.isNaN(value) || value === 0) return "chg flat";
  return value > 0 ? "chg up" : "chg down";
}
