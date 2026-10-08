import { bust, createStore } from "./store";
import type { QuotesFile, Quote } from "../types";

const store = createStore<QuotesFile | null>(null);
let inflight: Promise<QuotesFile> | null = null;

export function peekQuotes() {
  return store.get();
}

export function subscribeQuotes(listen: (value: QuotesFile | null) => void) {
  return store.subscribe(listen);
}

export function replaceQuotes(data: QuotesFile) {
  store.set(data);
}

export async function loadQuotes(): Promise<QuotesFile> {
  const current = store.get();
  if (current) return current;
  if (!inflight) {
    inflight = fetch(bust("./quotes.json"), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return { updatedAt: "", quotes: {} };
        }
        return (await response.json()) as QuotesFile;
      })
      .catch(() => ({ updatedAt: "", quotes: {} }))
      .then((data) => {
        store.set(data);
        inflight = null;
        return data;
      });
  }
  return inflight;
}

export function quoteOf(
  quotes: QuotesFile | null,
  yahooSymbol: string,
): Quote | undefined {
  return quotes?.quotes?.[yahooSymbol];
}

export function formatPrice(value?: number, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatChange(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatVolume(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

export function formatUpdatedAt(iso?: string): string {
  if (!iso) return "尚未更新報價";
  const date = new Date(iso);
  return date.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}
