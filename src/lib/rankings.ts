import { bust, createStore } from "./store";
import type { Stock, TwRankRow, TwRankingsFile } from "../types";

const empty: TwRankingsFile = {
  updatedAt: "",
  sessionDate: "",
  market: "TWSE",
  listed: [],
  boards: {},
};

const store = createStore<TwRankingsFile | null>(null);
let inflight: Promise<TwRankingsFile> | null = null;

export const twBoards = [
  { id: "volume", label: "成交量前20" },
  { id: "value", label: "成交金額前20" },
  { id: "gainers", label: "漲幅前20" },
  { id: "losers", label: "跌幅前20" },
  { id: "trades", label: "成交筆數前20" },
  { id: "amplitude", label: "振幅前20" },
  { id: "limitUp", label: "漲停" },
  { id: "limitDown", label: "跌停" },
  { id: "etfVolume", label: "ETF 成交量前20" },
] as const;

export function peekRankings() {
  return store.get();
}

export function subscribeRankings(listen: (value: TwRankingsFile | null) => void) {
  return store.subscribe(listen);
}

export function replaceRankings(data: TwRankingsFile) {
  store.set(data);
}

export async function loadRankings(): Promise<TwRankingsFile> {
  const current = store.get();
  if (current) return current;
  if (!inflight) {
    inflight = fetch(bust("./tw-rankings.json"), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return empty;
        return (await response.json()) as TwRankingsFile;
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

export function findListed(listed: TwRankRow[], code: string): TwRankRow | undefined {
  const key = code.toUpperCase();
  return listed.find((row) => row.code.toUpperCase() === key);
}

export function rankToStock(row: TwRankRow): Stock {
  const etf = row.kind === "etf" || /^00[0-9]{2,4}$/.test(row.code);
  return {
    id: `tw-${row.code}`,
    market: "tw",
    symbol: row.code,
    yahoo: `${row.code}.TW`,
    tv: `TWSE:${row.code}`,
    nameZh: row.name,
    nameEn: row.name,
    sector: etf ? "ETF" : "上市",
    summary: etf ? "證交所上市 ETF，資料來自當日收盤排行。" : "證交所上市股票，資料來自當日收盤排行。",
  };
}

export function searchListed(listed: TwRankRow[], query: string, limit = 8): Stock[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return listed
    .filter(
      (row) =>
        row.code.toLowerCase().includes(q) || row.name.toLowerCase().includes(q),
    )
    .slice(0, limit)
    .map(rankToStock);
}

export function formatSessionDate(iso?: string): string {
  if (!iso) return "尚無收盤資料";
  const [year, month, day] = iso.split("-");
  return `${year}/${Number(month)}/${Number(day)}`;
}

export function formatLots(shares?: number): string {
  if (shares == null || Number.isNaN(shares)) return "—";
  return `${Math.round(shares / 1000).toLocaleString("zh-TW")}張`;
}

export function formatTwd(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}億`;
  if (abs >= 10_000) return `${(value / 10_000).toFixed(0)}萬`;
  return value.toLocaleString("zh-TW");
}

export function formatTrades(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("zh-TW");
}
