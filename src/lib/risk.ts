import { findListed } from "./rankings";
import type {
  Quote,
  QuotesFile,
  RiskBook,
  RiskPosition,
  RiskSignal,
  Stock,
  ThemeBoardsFile,
  TwRankingsFile,
} from "../types";

const KEY = "albert-stock-risk";
export const FALLBACK_FX = 31.8;

const emptyBook: RiskBook = {
  twHoldings: 0,
  usHoldings: 0,
  twdCash: 0,
  usdCash: 0,
  positions: [],
  hideValues: false,
  currency: "TWD",
};

export function readRiskBook(): RiskBook {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyBook;
    const parsed = JSON.parse(raw) as Partial<RiskBook>;
    return {
      ...emptyBook,
      ...parsed,
      positions: Array.isArray(parsed.positions)
        ? parsed.positions.filter((row) => row && typeof row.id === "string")
        : [],
    };
  } catch {
    return emptyBook;
  }
}

export function writeRiskBook(book: RiskBook) {
  localStorage.setItem(KEY, JSON.stringify(book));
}

export function usdTwdRate(quotes: QuotesFile | null): number {
  const row = quotes?.quotes?.["TWD=X"] ?? quotes?.quotes?.["USDTWD=X"];
  if (row?.price && row.price > 10 && row.price < 50) return row.price;
  return FALLBACK_FX;
}

export function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseMoney(value: string): number {
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function maskMoney(hidden: boolean, value: string): string {
  return hidden ? "••••••" : value;
}

function rangeScore(quote?: Quote): number | null {
  const points = [...(quote?.spark ?? []), quote?.price].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (points.length < 4) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const last = points[points.length - 1];
  if (max === min) return 50;
  return clamp(0, 100, ((last - min) / (max - min)) * 100);
}

function volScore(quote?: Quote): number | null {
  const spark = quote?.spark?.filter((value) => typeof value === "number") ?? [];
  if (spark.length < 6) return null;
  const returns: number[] = [];
  for (let i = 1; i < spark.length; i += 1) {
    if (spark[i - 1]) returns.push((spark[i] - spark[i - 1]) / spark[i - 1]);
  }
  if (returns.length < 5) return null;
  const mean = returns.reduce((sum, item) => sum + item, 0) / returns.length;
  const variance =
    returns.reduce((sum, item) => sum + (item - mean) ** 2, 0) / returns.length;
  const annual = Math.sqrt(variance) * Math.sqrt(252) * 100;
  return clamp(0, 100, ((annual - 6) / 34) * 100);
}

function themeBreadth(themes: ThemeBoardsFile | null) {
  const rows = Object.values(themes?.boards ?? {}).flatMap((board) => board.rows);
  if (!rows.length) return { oversold: null, hot: null };
  const oversold =
    (rows.filter((row) => row.kdId === "strong" || row.kdId === "oversold").length /
      rows.length) *
    100;
  const hot = (rows.filter((row) => row.kdId === "hot").length / rows.length) * 100;
  return { oversold, hot };
}

export function riskSignals(
  quotes: QuotesFile | null,
  themes: ThemeBoardsFile | null,
): RiskSignal[] {
  const tw = rangeScore(quotes?.quotes?.["^TWII"]);
  const us = rangeScore(quotes?.quotes?.["^GSPC"]);
  const volTw = volScore(quotes?.quotes?.["^TWII"]);
  const volUs = volScore(quotes?.quotes?.["^GSPC"]);
  const vol =
    volTw != null && volUs != null ? (volTw + volUs) / 2 : (volTw ?? volUs ?? null);
  const { oversold, hot } = themeBreadth(themes);
  return [
    { id: "twPos", label: "台股位階", value: tw, hint: "加權近20日高低位置，愈高愈接近短線高檔" },
    { id: "usPos", label: "美股位階", value: us, hint: "S&P 500 近20日高低位置" },
    { id: "vol", label: "波動風險", value: vol, hint: "指數近月波動，愈高建議現金比重愈高" },
    { id: "oversold", label: "超跌廣度", value: oversold, hint: "題材池 KD 嚴格超跌占比，愈高愈偏可加碼區" },
    { id: "hot", label: "題材偏強", value: hot, hint: "題材池 K 值偏強占比，愈高愈宜降槓桿" },
  ];
}

export function recommendedAllocation(signals: RiskSignal[]): number {
  const byId = Object.fromEntries(signals.map((item) => [item.id, item.value]));
  let pct = 70;
  if (byId.twPos != null) pct -= (byId.twPos - 50) * 0.16;
  if (byId.usPos != null) pct -= (byId.usPos - 50) * 0.16;
  if (byId.vol != null) pct -= (byId.vol - 40) * 0.14;
  if (byId.oversold != null) pct += (byId.oversold - 12) * 0.2;
  if (byId.hot != null) pct -= (byId.hot - 12) * 0.16;
  return clamp(35, 90, pct);
}

export function positionPrice(
  row: RiskPosition,
  quotes: QuotesFile | null,
  rankings: TwRankingsFile | null,
): number {
  const quote = quotes?.quotes?.[row.yahoo]?.price;
  if (quote) return quote;
  if (row.market === "tw") {
    return findListed(rankings?.listed ?? [], row.symbol)?.close ?? 0;
  }
  return 0;
}

export function positionValueTwd(
  row: RiskPosition,
  quotes: QuotesFile | null,
  rankings: TwRankingsFile | null,
  fx: number,
): number {
  const price = positionPrice(row, quotes, rankings);
  if (!price) return 0;
  return row.market === "tw" ? price * row.shares : price * row.shares * fx;
}

export function importHoldings(
  positions: RiskPosition[],
  quotes: QuotesFile | null,
  rankings: TwRankingsFile | null,
  fx: number,
): { twHoldings: number; usHoldings: number } {
  let twHoldings = 0;
  let usHoldings = 0;
  for (const row of positions) {
    const value = positionValueTwd(row, quotes, rankings, fx);
    if (row.market === "tw") twHoldings += value;
    else usHoldings += value;
  }
  return { twHoldings, usHoldings };
}

export function upsertPosition(positions: RiskPosition[], stock: Stock, shares: number): RiskPosition[] {
  const next = positions.filter((row) => row.id !== stock.id);
  if (shares <= 0) return next;
  return [
    {
      id: stock.id,
      market: stock.market,
      symbol: stock.symbol,
      yahoo: stock.yahoo,
      nameZh: stock.nameZh,
      shares,
    },
    ...next,
  ];
}

export function nextHourCountdown(now = Date.now()): { m: string; s: string; total: number } {
  const remain = Math.max(0, Math.ceil(now / 3_600_000) * 3_600_000 - now);
  const minutes = Math.floor(remain / 60_000);
  const seconds = Math.floor((remain % 60_000) / 1000);
  return {
    total: remain,
    m: String(minutes).padStart(2, "0"),
    s: String(seconds).padStart(2, "0"),
  };
}
