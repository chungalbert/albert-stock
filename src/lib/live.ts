import { barsToQuote, changeFrom, kdStatus, lastFinite, prevFinite, stochasticKD } from "./bars";
import type { BarSet } from "./bars";
import { replaceFundamentals } from "./fundamentals";
import { twSession, usSession } from "./market";
import { peekQuotes, replaceQuotes } from "./quotes";
import { replaceRankings } from "./rankings";
import { peekThemeBoards, replaceThemeBoards } from "./themes";
import type {
  Quote,
  QuotesFile,
  ThemeBoardsFile,
  ThemeRow,
  TwFundamental,
  TwFundamentalsFile,
  TwRankRow,
  TwRankingsFile,
} from "../types";

export type LiveStatus = {
  phase: "idle" | "loading" | "live" | "partial" | "static";
  message: string;
  tickAt?: string;
};

const listeners = new Set<(status: LiveStatus) => void>();
let status: LiveStatus = { phase: "idle", message: "" };
let booted = false;
let ticking = false;
let rankingsDone = false;
let peDone = false;
let kdDone = false;
let timer: number | null = null;

const TW_INTERVAL_MS = 10_000;
const US_INTERVAL_MS = 45_000;
let lastUsAt = 0;

export function getLiveStatus() {
  return status;
}

export function subscribeLiveStatus(listen: (value: LiveStatus) => void) {
  listeners.add(listen);
  listen(status);
  return () => listeners.delete(listen);
}

function setStatus(next: LiveStatus) {
  status = next;
  listeners.forEach((listen) => listen(status));
}

function canUseProxy() {
  const host = window.location.hostname;
  return host === "127.0.0.1" || host === "localhost";
}

function toNumber(value: unknown) {
  if (value == null) return NaN;
  const text = String(value).trim();
  if (!text || text === "-" || text === "—" || /^[X-]+$/i.test(text)) return NaN;
  return Number(text.replace(/,/g, ""));
}

function rocToIso(roc: string) {
  const digits = String(roc ?? "").replace(/\D/g, "");
  if (digits.length === 7) {
    return `${Number(digits.slice(0, 3)) + 1911}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`;
  }
  return "";
}

function parseCsvLine(line: string) {
  return line
    .replace(/^\uFEFF/, "")
    .replace(/^"|"$/g, "")
    .split('","');
}

function clock(time?: string) {
  if (time && /^\d{1,2}:\d{2}/.test(time)) return time;
  return new Date().toLocaleTimeString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

async function fetchText(url: string, ms = 10_000) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ms) });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.text();
}

async function fetchJson(url: string, ms = 10_000) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ms) });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

function extractJson(text: string, token: string) {
  const start = text.indexOf(token);
  if (start < 0) throw new Error(`no ${token}`);
  const body = text.slice(start);
  try {
    return JSON.parse(body);
  } catch {
    return JSON.parse(body.slice(0, body.lastIndexOf("}") + 1));
  }
}

function yahooChartUrl(symbol: string, range: string, interval: string) {
  const encoded = encodeURIComponent(symbol);
  const path = `/v8/finance/chart/${encoded}?range=${range}&interval=${interval}`;
  if (canUseProxy()) return `/live/yahoo${path}`;
  return `https://r.jina.ai/https://query1.finance.yahoo.com${path}`;
}

async function fetchYahooPayload(symbol: string, range: string, interval: string) {
  const url = yahooChartUrl(symbol, range, interval);
  if (canUseProxy()) return fetchJson(url);
  return extractJson(await fetchText(url), '{"chart":');
}

function parseYahooPayload(data: { chart?: { result?: Array<Record<string, unknown>> } }, symbol: string): BarSet {
  const result = data?.chart?.result?.[0] as {
    meta?: Record<string, number | string>;
    timestamp?: number[];
    indicators?: { quote?: Array<Record<string, Array<number | null>>> };
  };
  const meta = result?.meta;
  const series = result?.indicators?.quote?.[0];
  if (!meta?.regularMarketPrice || !series) throw new Error(`${symbol} missing price`);
  const timestamps = result.timestamp || [];
  const highs = series.high || [];
  const lows = series.low || [];
  const closes = series.close || [];
  const volumes = series.volume || [];
  const last = lastFinite(closes);
  const previousClose =
    Number(meta.previousClose) ||
    (last ? prevFinite(closes, last.index) : null) ||
    Number(meta.chartPreviousClose);
  const price = Number(meta.regularMarketPrice);
  const daily =
    meta.marketState === "REGULAR"
      ? {
          timestamps: timestamps.slice(0, -1),
          highs: highs.slice(0, -1),
          lows: lows.slice(0, -1),
          closes: closes.slice(0, -1),
          volumes: volumes.slice(0, -1),
        }
      : { timestamps, highs, lows, closes, volumes };
  return {
    quote: barsToQuote(symbol, price, Number(previousClose) || 0, daily.closes, {
      volume: Number(meta.regularMarketVolume) || undefined,
      high: Number(meta.regularMarketDayHigh) || undefined,
      low: Number(meta.regularMarketDayLow) || undefined,
      currency: String(meta.currency || ""),
    }),
    ...daily,
  };
}

function quoteFromYahoo(data: { chart?: { result?: Array<Record<string, unknown>> } }, symbol: string, previous?: Quote): Quote {
  const meta = data?.chart?.result?.[0]?.meta as Record<string, number | string> | undefined;
  if (!meta?.regularMarketPrice) throw new Error(`${symbol} missing price`);
  const price = Number(meta.regularMarketPrice);
  const previousClose = Number(meta.previousClose) || previous?.previousClose || 0;
  return barsToQuote(symbol, price, previousClose, [...(previous?.spark ?? []), price], {
    volume: Number(meta.regularMarketVolume) || previous?.volume,
    high: Number(meta.regularMarketDayHigh) || previous?.high,
    low: Number(meta.regularMarketDayLow) || previous?.low,
    currency: String(meta.currency || previous?.currency || ""),
  });
}

async function fetchYahooBars(symbol: string): Promise<BarSet> {
  return parseYahooPayload(await fetchYahooPayload(symbol, "3mo", "1d"), symbol);
}

async function fetchYahooQuote(symbol: string, previous?: Quote): Promise<Quote> {
  return quoteFromYahoo(await fetchYahooPayload(symbol, "1d", "1m"), symbol, previous);
}

function yahooToMis(yahoo: string) {
  if (yahoo === "^TWII") return "tse_t00.tw";
  const match = /^(\d{4})\.(TW|TWO)$/.exec(yahoo);
  if (!match) return null;
  return `${match[2] === "TWO" ? "otc" : "tse"}_${match[1]}.tw`;
}

function misToYahoo(row: Record<string, unknown>, quotes: QuotesFile) {
  const code = String(row.c || "");
  if (code === "t00") return "^TWII";
  const tw = `${code}.TW`;
  const two = `${code}.TWO`;
  if (String(row.ex) === "otc") return quotes.quotes[two] ? two : two;
  return quotes.quotes[tw] ? tw : quotes.quotes[two] ? two : tw;
}

function misLastPrice(row: Record<string, unknown>) {
  const trade = row.trade as { z?: string } | undefined;
  for (const value of [row.z, trade?.z, row.pz]) {
    const price = toNumber(value);
    if (Number.isFinite(price) && price > 0) return price;
  }
  const bid = toNumber(String(row.b ?? "").split("_")[0]);
  const ask = toNumber(String(row.a ?? "").split("_")[0]);
  if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) return (bid + ask) / 2;
  const prev = toNumber(row.y);
  return Number.isFinite(prev) && prev > 0 ? prev : NaN;
}

async function fetchMisBatch(exCh: string): Promise<Array<Record<string, unknown>>> {
  const qs = `ex_ch=${encodeURIComponent(exCh)}&json=1&delay=0&_=${Date.now()}`;
  if (canUseProxy()) {
    const json = await fetchJson(`/live/mis/stock/api/getStockInfo.jsp?${qs}`);
    return (json.msgArray as Array<Record<string, unknown>>) ?? [];
  }
  const text = await fetchText(
    `https://r.jina.ai/https://mis.twse.com.tw/stock/api/getStockInfo.jsp?${qs}`,
  );
  const json = extractJson(text, '{"msgArray"');
  return (json.msgArray as Array<Record<string, unknown>>) ?? [];
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

function mergeQuote(previous: Quote | undefined, next: Quote): Quote {
  return {
    ...previous,
    ...next,
    spark: [...(previous?.spark ?? []).slice(-19), next.price],
    updatedAt: next.updatedAt,
  };
}

function applyMisRows(quotes: QuotesFile, rows: Array<Record<string, unknown>>) {
  const next = { ...quotes.quotes };
  let tickTime = "";
  let count = 0;
  const now = new Date().toISOString();
  for (const row of rows) {
    const price = misLastPrice(row);
    const previousClose = toNumber(row.y);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(previousClose)) continue;
    const symbol = misToYahoo(row, quotes);
    const prev = next[symbol];
    const volumeLots = toNumber(row.v);
    next[symbol] = mergeQuote(prev, {
      symbol,
      price,
      previousClose,
      change: price - previousClose,
      changePercent: previousClose ? ((price - previousClose) / previousClose) * 100 : 0,
      volume: Number.isFinite(volumeLots) ? volumeLots * 1000 : prev?.volume,
      high: toNumber(row.h) || prev?.high,
      low: toNumber(row.l) || prev?.low,
      currency: "TWD",
      updatedAt: now,
    });
    tickTime = String(row.t || row["%"] || tickTime);
    count += 1;
  }
  return { quotes: { updatedAt: now, quotes: next }, tickTime, count };
}

async function refreshTwMis(quotes: QuotesFile, themes: ThemeBoardsFile) {
  const wanted = [
    ...new Set([
      "^TWII",
      ...Object.values(themes.boards).flatMap((board) => board.rows.map((row) => row.yahoo)),
      ...Object.keys(quotes.quotes),
    ]),
  ]
    .map((symbol) => yahooToMis(symbol))
    .filter((ex): ex is string => Boolean(ex));

  const codes = [...new Set(wanted)];
  let next = quotes;
  let tickTime = "";
  let count = 0;

  const ingest = (rows: Array<Record<string, unknown>>) => {
    const applied = applyMisRows(next, rows);
    next = applied.quotes;
    tickTime = applied.tickTime || tickTime;
    count += applied.count;
    replaceQuotes(next);
  };

  ingest(await fetchMisBatch("tse_t00.tw"));

  const rest = codes.filter((ex) => ex !== "tse_t00.tw");
  for (const group of chunk(rest, 40)) {
    ingest(await fetchMisBatch(group.join("|")));
  }
  if (!count) throw new Error("no mis prices");
  return { quotes: next, tickTime, count };
}

async function refreshTwRankings(): Promise<TwRankingsFile> {
  const text = await fetchText(
    `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json&_=${Date.now()}`,
  );
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const mapped: TwRankRow[] = lines.slice(1).flatMap((line) => {
    const cells = parseCsvLine(line);
    if (cells.length < 11) return [];
    const close = toNumber(cells[8]);
    const change = toNumber(cells[9]);
    const previousClose = close - change;
    const high = toNumber(cells[6]);
    const low = toNumber(cells[7]);
    if (!Number.isFinite(close) || close <= 0) return [];
    return [
      {
        code: cells[1],
        name: cells[2],
        close,
        change,
        changePercent: previousClose ? (change / previousClose) * 100 : NaN,
        volume: toNumber(cells[3]),
        value: toNumber(cells[4]),
        trades: toNumber(cells[10]),
        high,
        low,
        amplitude: previousClose ? ((high - low) / previousClose) * 100 : NaN,
      },
    ];
  });

  const isTwCode = (code: string) => /^[0-9]{4,6}[A-Za-z]?$/i.test(code);
  const isListed = (code: string) => /^[0-9]{4}$/.test(code) && !code.startsWith("00");
  const isEtf = (code: string) => isTwCode(code) && code.startsWith("00");
  const stocks = mapped.filter((row) => isListed(row.code));
  const etfs = mapped.filter((row) => isEtf(row.code));
  const rank = (rows: TwRankRow[], key: keyof TwRankRow, direction: number) =>
    [...rows]
      .filter((row) => Number.isFinite(Number(row[key])))
      .sort((a, b) => (Number(a[key]) - Number(b[key])) * direction)
      .slice(0, 20)
      .map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    updatedAt: new Date().toISOString(),
    sessionDate: rocToIso(lines[1] ? parseCsvLine(lines[1])[0] : ""),
    market: "TWSE",
    listed: [...stocks, ...etfs],
    boards: {
      volume: rank(stocks, "volume", -1),
      value: rank(stocks, "value", -1),
      gainers: rank(stocks, "changePercent", -1),
      losers: rank(stocks, "changePercent", 1),
      trades: rank(stocks, "trades", -1),
      amplitude: rank(stocks, "amplitude", -1),
      limitUp: rank(
        stocks.filter((row) => row.changePercent >= 9.5),
        "changePercent",
        -1,
      ),
      limitDown: rank(
        stocks.filter((row) => row.changePercent <= -9.5),
        "changePercent",
        1,
      ),
      etfVolume: rank(etfs, "volume", -1),
    },
  };
}

async function refreshPe(fundamentals: TwFundamentalsFile | null) {
  if (!fundamentals) return;
  const json = await fetchJson(
    `https://www.twse.com.tw/rwd/zh/afterTrading/BWIBBU_d?response=json&_=${Date.now()}`,
  );
  const rows = (json.data as string[][]) ?? [];
  const stocks = { ...fundamentals.stocks };
  for (const row of rows) {
    const code = row[0];
    if (!/^[0-9]{4}$/.test(code)) continue;
    const current: TwFundamental = stocks[code] ?? { code, months: {} };
    stocks[code] = {
      ...current,
      name: current.name || row[1],
      yield: toNumber(row[3]),
      pe: toNumber(row[5]),
      pb: toNumber(row[6]),
    };
  }
  replaceFundamentals({ ...fundamentals, updatedAt: new Date().toISOString(), stocks });
}

function patchThemePrices(previous: ThemeBoardsFile, quotes: QuotesFile): ThemeBoardsFile {
  const boards: ThemeBoardsFile["boards"] = {};
  for (const board of Object.values(previous.boards)) {
    boards[board.id] = {
      ...board,
      rows: board.rows.map((row) => {
        const quote = quotes.quotes[row.yahoo];
        if (!quote) return row;
        return {
          ...row,
          close: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume ?? row.volume,
        };
      }),
    };
  }
  return {
    ...previous,
    updatedAt: quotes.updatedAt,
    method: "開啟網站後改抓盤中報價，KD 仍用日K",
    boards,
  };
}

function applyThemes(
  previous: ThemeBoardsFile,
  quotes: QuotesFile,
  bars: Record<string, BarSet>,
): ThemeBoardsFile {
  const boards: ThemeBoardsFile["boards"] = {};
  const highlights: ThemeRow[] = [];
  for (const board of Object.values(previous.boards)) {
    const rows = board.rows.map((row) => {
      const bar = bars[row.yahoo];
      const quote = quotes.quotes[row.yahoo];
      if (bar) {
        const last = lastFinite(bar.closes);
        if (!last) return row;
        const prevClose = prevFinite(bar.closes, last.index);
        const kd = stochasticKD(bar.highs, bar.lows, bar.closes);
        if (kd.k == null || kd.d == null) return row;
        const kdState = kdStatus(kd.k, kd.d);
        return {
          ...row,
          close: quote?.price ?? last.value,
          change: quote?.change ?? (prevClose == null ? 0 : last.value - prevClose),
          changePercent:
            quote?.changePercent ?? (prevClose ? ((last.value - prevClose) / prevClose) * 100 : 0),
          change5d: changeFrom(bar.closes, last.index, 5),
          volume: quote?.volume ?? bar.volumes[last.index] ?? bar.quote.volume,
          k: Math.round(kd.k),
          d: Math.round(kd.d),
          kdId: kdState.id,
          kdLabel: kdState.label,
        };
      }
      if (!quote) return row;
      return {
        ...row,
        close: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume ?? row.volume,
      };
    });
    rows.sort((a, b) => {
      const order = (id: ThemeRow["kdId"]) =>
        id === "strong" ? 0 : id === "oversold" ? 1 : id === "near" ? 2 : id === "hot" ? 4 : 3;
      return order(a.kdId) - order(b.kdId) || Math.min(a.k, a.d) - Math.min(b.k, b.d);
    });
    const ranked = rows.map((row, index) => ({ ...row, rank: index + 1 }));
    boards[board.id] = {
      ...board,
      rows: ranked,
      oversold: ranked.filter((row) => row.kdId === "strong" || row.kdId === "oversold").length,
    };
    highlights.push(...ranked.filter((row) => row.kdId === "strong" || row.kdId === "oversold"));
  }
  highlights.sort((a, b) => Math.min(a.k, a.d) - Math.min(b.k, b.d));
  return {
    ...previous,
    updatedAt: new Date().toISOString(),
    method: "開啟網站後改抓盤中報價，KD 仍用日K",
    boards,
    highlights: highlights.slice(0, 12),
    counts: Object.fromEntries(
      Object.values(boards).map((board) => [board.id, board.oversold]),
    ),
  };
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  async function next() {
    const current = index;
    index += 1;
    if (current >= items.length) return;
    await worker(items[current]);
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
}

function usSymbolsOf(_themes: ThemeBoardsFile, _quotes: QuotesFile) {
  return ["^GSPC", "^DJI", "^IXIC", "TWD=X"];
}

function liveMessage(twOk: boolean, usOk: boolean, tickTime: string) {
  const time = clock(tickTime);
  const tw = twSession();
  if (twOk && tw === "open") return `台股即時 ${time}`;
  if (twOk && usOk) return `報價已更新 ${time}`;
  if (twOk) return tw === "open" ? `台股即時 ${time}` : `台股已更新 ${time}`;
  if (usOk) return `美股已更新 ${time}`;
  return "即時來源暫時連不上，顯示上次建置資料";
}

async function refreshUsQuotes(quotes: QuotesFile, themes: ThemeBoardsFile, withBars: boolean) {
  const symbols = usSymbolsOf(themes, quotes);
  const bars: Record<string, BarSet> = {};
  let nextQuotes = quotes;
  let ok = 0;
  await runPool(symbols, canUseProxy() ? 6 : 2, async (symbol) => {
    try {
      if (withBars) {
        bars[symbol] = await fetchYahooBars(symbol);
        nextQuotes = {
          updatedAt: new Date().toISOString(),
          quotes: {
            ...nextQuotes.quotes,
            [symbol]: mergeQuote(nextQuotes.quotes[symbol], bars[symbol].quote),
          },
        };
      } else {
        const quote = await fetchYahooQuote(symbol, nextQuotes.quotes[symbol]);
        nextQuotes = {
          updatedAt: quote.updatedAt,
          quotes: { ...nextQuotes.quotes, [symbol]: mergeQuote(nextQuotes.quotes[symbol], quote) },
        };
      }
      replaceQuotes(nextQuotes);
      ok += 1;
    } catch {
      /* keep last snapshot */
    }
  });
  if (withBars && Object.keys(bars).length) {
    replaceThemeBoards(applyThemes(peekThemeBoards() ?? themes, nextQuotes, bars));
  } else if (ok) {
    replaceThemeBoards(patchThemePrices(peekThemeBoards() ?? themes, nextQuotes));
  }
  return { quotes: nextQuotes, ok };
}

async function tick(fundamentals: TwFundamentalsFile | null, seedQuotes: QuotesFile, seedThemes: ThemeBoardsFile) {
  if (ticking) return;
  ticking = true;
  try {
  if (status.phase === "idle") {
    setStatus({ phase: "loading", message: "正在抓盤中行情…" });
  }

  let quotes = peekQuotes() ?? seedQuotes;
  const themes = peekThemeBoards() ?? seedThemes;
  let twOk = false;
  let tickTime = "";

  try {
    const live = await refreshTwMis(quotes, themes);
    quotes = live.quotes;
    tickTime = live.tickTime;
    replaceQuotes(quotes);
    replaceThemeBoards(patchThemePrices(themes, quotes));
    twOk = true;
    setStatus({
      phase: "live",
      message: liveMessage(true, false, tickTime),
      tickAt: new Date().toISOString(),
    });
  } catch {
    try {
      const quote = await fetchYahooQuote("^TWII", quotes.quotes["^TWII"]);
      quotes = {
        updatedAt: quote.updatedAt,
        quotes: { ...quotes.quotes, "^TWII": mergeQuote(quotes.quotes["^TWII"], quote) },
      };
      replaceQuotes(quotes);
      replaceThemeBoards(patchThemePrices(themes, quotes));
      twOk = true;
      tickTime = clock();
      setStatus({
        phase: "live",
        message: liveMessage(true, false, tickTime),
        tickAt: new Date().toISOString(),
      });
    } catch {
      /* keep snapshot */
    }
  }

  const wantUs =
    !kdDone || usSession() === "open" || Date.now() - lastUsAt > US_INTERVAL_MS;
  if (wantUs) {
    lastUsAt = Date.now();
    void refreshUsQuotes(quotes, themes, false).then((us) => {
      if (us.ok) kdDone = true;
      if (us.ok) {
        setStatus({
          phase: twOk ? "live" : "partial",
          message: liveMessage(twOk, true, tickTime || clock()),
          tickAt: new Date().toISOString(),
        });
      }
    });
  }

  if (!rankingsDone) {
    void refreshTwRankings()
      .then((data) => {
        replaceRankings(data);
        rankingsDone = true;
      })
      .catch(() => {
        rankingsDone = true;
      });
  }
  if (!peDone) {
    void refreshPe(fundamentals)
      .catch(() => undefined)
      .finally(() => {
        peDone = true;
      });
  }

  const now = new Date().toISOString();
  if (!twOk && (status.phase === "loading" || status.phase === "idle")) {
    setStatus({ phase: "static", message: liveMessage(false, false, ""), tickAt: now });
  }
  } catch {
    setStatus({
      phase: "static",
      message: "即時來源暫時連不上，顯示上次建置資料",
      tickAt: new Date().toISOString(),
    });
  } finally {
    ticking = false;
  }
}

export function bootLiveRefresh(
  quotes: QuotesFile,
  themes: ThemeBoardsFile,
  fundamentals: TwFundamentalsFile | null,
) {
  if (booted) return;
  booted = true;
  const run = () => {
    if (ticking) return;
    void tick(fundamentals, quotes, themes).then(() => {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(run, TW_INTERVAL_MS);
    });
  };
  run();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (timer != null) window.clearTimeout(timer);
    run();
  });
}

export function stopLiveRefresh() {
  if (timer != null) window.clearTimeout(timer);
  timer = null;
}
