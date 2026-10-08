import type { Quote } from "../types";

export function lastFinite(values: Array<number | null | undefined>) {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const value = values[i];
    if (typeof value === "number") return { value, index: i };
  }
  return null;
}

export function prevFinite(values: Array<number | null | undefined>, before: number) {
  for (let i = before - 1; i >= 0; i -= 1) {
    const value = values[i];
    if (typeof value === "number") return value;
  }
  return null;
}

export function changeFrom(
  closes: Array<number | null | undefined>,
  index: number,
  lookback: number,
): number | null {
  const now = closes[index];
  const prev = closes[index - lookback];
  if (typeof now !== "number" || typeof prev !== "number" || !prev) return null;
  return ((now - prev) / prev) * 100;
}

export function stochasticKD(
  highs: Array<number | null | undefined>,
  lows: Array<number | null | undefined>,
  closes: Array<number | null | undefined>,
  period = 9,
) {
  let k = 50;
  let d = 50;
  let lastK: number | null = null;
  let lastD: number | null = null;
  for (let i = 0; i < closes.length; i += 1) {
    if (
      typeof closes[i] !== "number" ||
      typeof highs[i] !== "number" ||
      typeof lows[i] !== "number"
    ) {
      continue;
    }
    if (i < period - 1) continue;
    let hh = -Infinity;
    let ll = Infinity;
    let valid = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      if (
        typeof highs[j] === "number" &&
        typeof lows[j] === "number" &&
        typeof closes[j] === "number"
      ) {
        hh = Math.max(hh, highs[j] as number);
        ll = Math.min(ll, lows[j] as number);
        valid += 1;
      }
    }
    if (valid < period) continue;
    const close = closes[i] as number;
    const rsv = hh === ll ? 50 : ((close - ll) / (hh - ll)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    lastK = k;
    lastD = d;
  }
  return { k: lastK, d: lastD };
}

export function kdStatus(k: number, d: number) {
  if (k < 20 && d < 20) return { id: "strong" as const, label: "強超跌", order: 0 };
  if (k < 20 || d < 20) return { id: "oversold" as const, label: "正式超跌", order: 1 };
  if (k < 30 || d < 30) return { id: "near" as const, label: "接近超跌", order: 2 };
  if (k > 80) return { id: "hot" as const, label: "偏強", order: 4 };
  return { id: "normal" as const, label: "觀察", order: 3 };
}

export type BarSet = {
  quote: Quote;
  timestamps: number[];
  highs: Array<number | null>;
  lows: Array<number | null>;
  closes: Array<number | null>;
  volumes: Array<number | null>;
};

export function barsToQuote(
  symbol: string,
  price: number,
  previousClose: number,
  closes: Array<number | null | undefined>,
  extra: Partial<Quote> = {},
): Quote {
  const change = price - previousClose;
  return {
    symbol,
    price,
    previousClose,
    change,
    changePercent: previousClose ? (change / previousClose) * 100 : 0,
    spark: closes.filter((value): value is number => typeof value === "number").slice(-20),
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}
