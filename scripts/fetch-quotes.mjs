import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const quotesFile = resolve(root, "public", "quotes.json");
const rankingsFile = resolve(root, "public", "tw-rankings.json");
const fundamentalsFile = resolve(root, "public", "tw-fundamentals.json");
const themesFile = resolve(root, "src", "data", "themes.json");
const themeBoardsFile = resolve(root, "public", "theme-boards.json");

const symbols = [
  "^GSPC",
  "^DJI",
  "^IXIC",
  "^TWII",
  "TWD=X",
  "AAPL",
  "MSFT",
  "NVDA",
  "GOOGL",
  "AMZN",
  "META",
  "TSLA",
  "AVGO",
  "AMD",
  "NFLX",
  "JPM",
  "V",
  "UNH",
  "XOM",
  "WMT",
  "COST",
  "LLY",
  "BRK-B",
  "HD",
  "ORCL",
  "2330.TW",
  "2317.TW",
  "2454.TW",
  "2308.TW",
  "2382.TW",
  "2303.TW",
  "3711.TW",
  "2412.TW",
  "2881.TW",
  "2882.TW",
  "2891.TW",
  "1301.TW",
  "1303.TW",
  "2002.TW",
  "2603.TW",
  "2609.TW",
  "3008.TW",
  "2357.TW",
  "2912.TW",
  "1216.TW",
];

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept: "application/json",
};

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function fetchBars(symbol) {
  const encoded = encodeURIComponent(symbol);
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=3mo&interval=1d`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encoded}?range=3mo&interval=1d`,
  ];

  let lastError;
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        lastError = new Error(`${symbol} ${response.status}`);
        continue;
      }
      const data = await response.json();
      const result = data?.chart?.result?.[0];
      const meta = result?.meta;
      const series = result?.indicators?.quote?.[0];
      if (!meta?.regularMarketPrice || !series) {
        lastError = new Error(`${symbol} missing price`);
        continue;
      }
      const timestamps = result.timestamp || [];
      const highs = series.high || [];
      const lows = series.low || [];
      const closes = series.close || [];
      const volumes = series.volume || [];
      const last = lastFinite(closes);
      const previousClose =
        (last ? prevFinite(closes, last.index) : null) ??
        meta.previousClose ??
        meta.chartPreviousClose;
      const price = meta.regularMarketPrice;
      const change = price - previousClose;
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
        quote: {
          symbol,
          price,
          previousClose,
          change,
          changePercent: previousClose ? (change / previousClose) * 100 : 0,
          volume: meta.regularMarketVolume,
          high: meta.regularMarketDayHigh,
          low: meta.regularMarketDayLow,
          currency: meta.currency,
          spark: closes.filter((value) => typeof value === "number").slice(-20),
          updatedAt: new Date().toISOString(),
        },
        ...daily,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function runPool(items, limit, worker) {
  const results = [];
  let index = 0;
  async function next() {
    const current = index;
    index += 1;
    if (current >= items.length) return;
    results[current] = await worker(items[current], current);
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

async function main() {
  const themesOnly = process.argv.includes("--themes-only");
  const themes = JSON.parse(await readFile(themesFile, "utf8"));
  const themeSymbols = themes.boards.flatMap((board) =>
    board.items.map((item) => item.yahoo),
  );
  const allSymbols = [
    ...new Set(themesOnly ? themeSymbols : [...symbols, ...themeSymbols]),
  ];
  const bars = {};
  const quotes = {};
  const failures = [];

  await runPool(allSymbols, 4, async (symbol, index) => {
    try {
      bars[symbol] = await fetchBars(symbol);
      quotes[symbol] = bars[symbol].quote;
      process.stdout.write(`ok  ${symbol}\n`);
    } catch (error) {
      failures.push(symbol);
      process.stdout.write(`fail ${symbol} ${error.message || error}\n`);
    }
    if (index % 4 === 3) await sleep(250);
  });

  let mergedQuotes = quotes;
  if (themesOnly) {
    try {
      const previous = JSON.parse(await readFile(quotesFile, "utf8"));
      mergedQuotes = { ...(previous.quotes ?? {}), ...quotes };
    } catch {
      mergedQuotes = quotes;
    }
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    quotes: mergedQuotes,
  };
  await writeFile(quotesFile, JSON.stringify(payload, null, 2));
  console.log(
    `wrote ${Object.keys(quotes).length}/${allSymbols.length} quotes -> public/quotes.json`,
  );
  if (failures.length) {
    console.warn("failed:", failures.join(", "));
  }

  if (!themesOnly) {
    try {
      await writeTwRankings();
    } catch (error) {
      console.warn("TW rankings failed:", error.message || error);
    }

    try {
      await writeTwFundamentals();
    } catch (error) {
      console.warn("TW fundamentals failed:", error.message || error);
    }
  }

  try {
    await writeThemeBoards(themes, bars);
  } catch (error) {
    console.warn("theme boards failed:", error.message || error);
  }
}

function toNumber(value) {
  if (value == null) return NaN;
  const parsed = Number(String(value).replace(/,/g, "").replace(/X/gi, ""));
  return parsed;
}

function rocToIso(roc) {
  if (!roc || String(roc).length < 7) return "";
  const text = String(roc);
  const year = Number(text.slice(0, text.length - 4)) + 1911;
  const month = text.slice(-4, -2);
  const day = text.slice(-2);
  return `${year}-${month}-${day}`;
}

function isListedStock(code) {
  return /^[0-9]{4}$/.test(code) && !code.startsWith("00");
}

function isEtf(code) {
  return /^00[0-9]{2}$/.test(code);
}

function rankRows(rows, key, direction, limit = 20) {
  return [...rows]
    .filter((row) => Number.isFinite(row[key]))
    .sort((a, b) => (a[key] - b[key]) * direction)
    .slice(0, limit)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

async function writeTwRankings() {
  const response = await fetch(
    "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",
    { headers },
  );
  if (!response.ok) {
    throw new Error(`TWSE ${response.status}`);
  }
  const raw = await response.json();
  const mapped = raw
    .map((item) => {
      const close = toNumber(item.ClosingPrice);
      const change = toNumber(item.Change);
      const previousClose = close - change;
      const high = toNumber(item.HighestPrice);
      const low = toNumber(item.LowestPrice);
      return {
        code: item.Code,
        name: item.Name,
        close,
        change,
        changePercent: previousClose ? (change / previousClose) * 100 : NaN,
        volume: toNumber(item.TradeVolume),
        value: toNumber(item.TradeValue),
        trades: toNumber(item.Transaction),
        high,
        low,
        amplitude: previousClose ? ((high - low) / previousClose) * 100 : NaN,
      };
    })
    .filter((row) => Number.isFinite(row.close) && row.close > 0);

  const stocks = mapped.filter((row) => isListedStock(row.code));
  const etfs = mapped.filter((row) => isEtf(row.code));
  const limitUp = stocks.filter((row) => row.changePercent >= 9.5);
  const limitDown = stocks.filter((row) => row.changePercent <= -9.5);

  const payload = {
    updatedAt: new Date().toISOString(),
    sessionDate: rocToIso(raw[0]?.Date),
    market: "TWSE",
    listed: stocks,
    boards: {
      volume: rankRows(stocks, "volume", -1),
      value: rankRows(stocks, "value", -1),
      gainers: rankRows(stocks, "changePercent", -1),
      losers: rankRows(stocks, "changePercent", 1),
      trades: rankRows(stocks, "trades", -1),
      amplitude: rankRows(stocks, "amplitude", -1),
      limitUp: rankRows(limitUp, "changePercent", -1),
      limitDown: rankRows(limitDown, "changePercent", 1),
      etfVolume: rankRows(etfs, "volume", -1),
    },
  };

  await writeFile(rankingsFile, JSON.stringify(payload, null, 2));
  console.log(
    `wrote TW rankings ${payload.sessionDate} -> public/tw-rankings.json`,
  );
}

function ensureStock(map, code, extra = {}) {
  if (!map[code]) {
    map[code] = { code, months: {} };
  }
  Object.assign(map[code], extra);
  return map[code];
}

function parseRocYmd(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 7) {
    return `${Number(digits.slice(0, 3)) + 1911}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`;
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return "";
}

function parseTwseDateLabel(value) {
  const match = String(value ?? "").match(/(\d{2,3})年(\d{1,2})月(\d{1,2})日/);
  if (!match) return "";
  const rawYear = Number(match[1]);
  const year = rawYear > 1911 ? rawYear : rawYear + 1911;
  return `${year}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
}

function ymKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function addMonths(year, month, delta) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function parseMopsRevenue(html) {
  const rows = [];
  const pattern =
    /<td align=center>(\d{4})<\/td>\s*<td align=left>[^<]*<\/td>\s*<td nowrap>\s*([0-9,.-]+)<\/td>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const value = toNumber(match[2]);
    if (Number.isFinite(value)) rows.push({ code: match[1], value });
  }
  return rows;
}

async function fetchText(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

async function writeTwFundamentals() {
  const stocks = {};

  const [peListed, peOtc, revListed, revOtc, coListed, coOtc, divListed] =
    await Promise.all([
      fetchJson("https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL"),
      fetchJson(
        "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis",
      ),
      fetchJson("https://openapi.twse.com.tw/v1/opendata/t187ap05_L"),
      fetchJson("https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O"),
      fetchJson("https://openapi.twse.com.tw/v1/opendata/t187ap03_L"),
      fetchJson("https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O"),
      fetchJson("https://openapi.twse.com.tw/v1/opendata/t187ap45_L"),
    ]);

  for (const row of peListed) {
    if (!/^[0-9]{4}$/.test(row.Code)) continue;
    ensureStock(stocks, row.Code, {
      name: row.Name,
      pe: toNumber(row.PEratio),
      yield: toNumber(row.DividendYield),
      pb: toNumber(row.PBratio),
      market: "twse",
    });
  }
  for (const row of peOtc) {
    const code = row.SecuritiesCompanyCode;
    if (!/^[0-9]{4}$/.test(code)) continue;
    ensureStock(stocks, code, {
      name: row.CompanyName,
      pe: toNumber(row.PriceEarningRatio),
      yield: toNumber(row.YieldRatio),
      pb: toNumber(row.PriceBookRatio),
      market: stocks[code]?.market || "tpex",
    });
  }

  let revenueYm = "";
  for (const row of [...revListed, ...revOtc]) {
    const code = row["公司代號"];
    if (!/^[0-9]{4}$/.test(code)) continue;
    const ym = String(row["資料年月"] || "");
    const year = Number(ym.slice(0, ym.length - 2)) + 1911;
    const month = Number(ym.slice(-2));
    const key = ymKey(year, month);
    if (!revenueYm) revenueYm = key;
    const current = toNumber(row["營業收入-當月營收"]);
    const stock = ensureStock(stocks, code, {
      name: row["公司名稱"],
      industry: row["產業別"],
      revYm: key,
      rev: current,
      mom: toNumber(row["營業收入-上月比較增減(%)"]),
      yoy: toNumber(row["營業收入-去年同月增減(%)"]),
      ytd: toNumber(row["累計營業收入-當月累計營收"]),
      ytdYoy: toNumber(row["累計營業收入-前期比較增減(%)"]),
    });
    if (Number.isFinite(current)) stock.months[key] = current;
  }

  for (const row of coListed) {
    const code = row["公司代號"];
    if (!/^[0-9]{4}$/.test(code)) continue;
    const shares = toNumber(row["已發行普通股數或TDR原股發行股數"]);
    ensureStock(stocks, code, {
      name: row["公司簡稱"] || row["公司名稱"],
      shares: Number.isFinite(shares) ? Math.round(shares / 1000) : undefined,
    });
  }
  for (const row of coOtc) {
    const code = row.SecuritiesCompanyCode;
    if (!/^[0-9]{4}$/.test(code)) continue;
    const shares = toNumber(row.IssueShares);
    ensureStock(stocks, code, {
      name: row.CompanyAbbreviation || row.CompanyName,
      shares: Number.isFinite(shares) ? Math.round(shares / 1000) : undefined,
    });
  }

  for (const row of divListed) {
    const code = row["公司代號"];
    if (!/^[0-9]{4}$/.test(code)) continue;
    const surplusCash = toNumber(row["股東配發-盈餘分配之現金股利(元/股)"]);
    const legalCash = toNumber(row["股東配發-法定盈餘公積發放之現金(元/股)"]);
    const capitalCash = toNumber(row["股東配發-資本公積發放之現金(元/股)"]);
    const surplusStock = toNumber(row["股東配發-盈餘轉增資配股(元/股)"]);
    const legalStock = toNumber(row["股東配發-法定盈餘公積轉增資配股(元/股)"]);
    const capitalStock = toNumber(row["股東配發-資本公積轉增資配股(元/股)"]);
    const cash =
      (Number.isFinite(surplusCash) ? surplusCash : 0) +
      (Number.isFinite(legalCash) ? legalCash : 0) +
      (Number.isFinite(capitalCash) ? capitalCash : 0);
    const stockDiv =
      (Number.isFinite(surplusStock) ? surplusStock : 0) +
      (Number.isFinite(legalStock) ? legalStock : 0) +
      (Number.isFinite(capitalStock) ? capitalStock : 0);
    const year = Number(row["股利年度"]);
    const current = stocks[code]?.div;
    if (current && Number(current.yearRoc) > year) continue;
    ensureStock(stocks, code, {
      name: row["公司名稱"],
      div: {
        yearRoc: year,
        year: year ? year + 1911 : undefined,
        progress: row["決議（擬議）進度"],
        cash,
        stock: stockDiv,
        surplusCash,
        legalCash,
        capitalCash,
        surplusStock,
        legalStock,
        capitalStock,
        boardDate: parseRocYmd(row["董事會（擬議）股利分派日"]),
        meetingDate: parseRocYmd(row["股東會日期"]),
      },
    });
  }

  try {
    const ex = await fetchJson(
      "https://www.twse.com.tw/rwd/zh/exRight/TWT49U?response=json&startDate=20250101&endDate=20261231",
    );
    for (const row of ex.data ?? []) {
      const code = String(row[1] ?? "");
      if (!/^[0-9]{4}$/.test(code) || !stocks[code]?.div) continue;
      const date = parseTwseDateLabel(row[0]);
      if (!date) continue;
      if (!stocks[code].div.exDate || date > stocks[code].div.exDate) {
        stocks[code].div.exDate = date;
      }
    }
  } catch (error) {
    console.warn("ex-dividend table failed:", error.message || error);
  }

  const latest = revenueYm
    ? {
        year: Number(revenueYm.slice(0, 4)),
        month: Number(revenueYm.slice(5, 7)),
      }
    : { year: 2026, month: 8 };
  const monthsToFetch = [];
  for (let i = 0; i < 36; i += 1) {
    monthsToFetch.push(addMonths(latest.year, latest.month, -i));
  }
  const mopsJobs = monthsToFetch.flatMap(({ year, month }) => {
    const roc = year - 1911;
    return [
      {
        year,
        month,
        url: `https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_${roc}_${month}_0.html`,
      },
      {
        year,
        month,
        url: `https://mopsov.twse.com.tw/nas/t21/otc/t21sc03_${roc}_${month}_0.html`,
      },
    ];
  });

  await runPool(mopsJobs, 3, async (job, index) => {
    try {
      const html = await fetchText(job.url);
      const key = ymKey(job.year, job.month);
      for (const row of parseMopsRevenue(html)) {
        const stock = ensureStock(stocks, row.code);
        if (stock.months[key] == null) stock.months[key] = row.value;
      }
      process.stdout.write(`rev ${key} ${job.url.includes("/otc/") ? "otc" : "sii"}\n`);
    } catch (error) {
      process.stdout.write(
        `rev fail ${job.year}-${job.month} ${error.message || error}\n`,
      );
    }
    if (index % 3 === 2) await sleep(200);
  });

  const payload = {
    updatedAt: new Date().toISOString(),
    revenueYm,
    stocks,
  };
  await writeFile(fundamentalsFile, JSON.stringify(payload));
  console.log(
    `wrote TW fundamentals ${Object.keys(stocks).length} names -> public/tw-fundamentals.json`,
  );
}

function lastFinite(values) {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (typeof values[i] === "number") return { value: values[i], index: i };
  }
  return null;
}

function prevFinite(values, before) {
  for (let i = before - 1; i >= 0; i -= 1) {
    if (typeof values[i] === "number") return values[i];
  }
  return null;
}

function changeFrom(closes, index, lookback) {
  const now = closes[index];
  const prev = closes[index - lookback];
  if (typeof now !== "number" || typeof prev !== "number" || !prev) return null;
  return ((now - prev) / prev) * 100;
}

function stochasticKD(highs, lows, closes, period = 9) {
  let k = 50;
  let d = 50;
  let lastK = null;
  let lastD = null;
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
        hh = Math.max(hh, highs[j]);
        ll = Math.min(ll, lows[j]);
        valid += 1;
      }
    }
    if (valid < period) continue;
    const rsv = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    lastK = k;
    lastD = d;
  }
  return { k: lastK, d: lastD };
}

function isoDate(ts, timeZone) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleDateString("en-CA", { timeZone });
}

function kdStatus(k, d) {
  if (k < 20 && d < 20) return { id: "strong", label: "強超跌", order: 0 };
  if (k < 20 || d < 20) return { id: "oversold", label: "正式超跌", order: 1 };
  if (k < 30 || d < 30) return { id: "near", label: "接近超跌", order: 2 };
  if (k > 80) return { id: "hot", label: "偏強", order: 4 };
  return { id: "normal", label: "觀察", order: 3 };
}

async function writeThemeBoards(themes, bars) {
  let previous = { boards: {} };
  try {
    previous = JSON.parse(await readFile(themeBoardsFile, "utf8"));
  } catch {
    previous = { boards: {} };
  }

  const boards = {};
  const highlights = [];

  for (const board of themes.boards) {
    const prevRows = previous.boards?.[board.id]?.rows ?? [];
    const prevMap = Object.fromEntries(prevRows.map((row) => [row.yahoo, row]));
    const rows = [];

    for (const item of board.items) {
      const bar = bars[item.yahoo];
      if (!bar) continue;
      const last = lastFinite(bar.closes);
      if (!last) continue;
      const prevClose = prevFinite(bar.closes, last.index);
      const kd = stochasticKD(bar.highs, bar.lows, bar.closes);
      if (kd.k == null || kd.d == null) continue;
      const status = kdStatus(kd.k, kd.d);
      const prev = prevMap[item.yahoo];
      const oversold = status.order <= 1;
      const close = last.value;
      const change = prevClose == null ? 0 : close - prevClose;
      const timeZone = board.market === "tw" ? "Asia/Taipei" : "America/New_York";
      const sessionDate = isoDate(bar.timestamps?.[last.index], timeZone);
      const streak = oversold
        ? prev?.sessionDate === sessionDate
          ? prev.streak || 1
          : (prev?.streak || 0) + 1
        : 1;
      rows.push({
        market: board.market,
        symbol: item.symbol,
        yahoo: item.yahoo,
        nameZh: item.nameZh,
        nameEn: item.nameEn,
        theme: item.theme,
        note: item.note,
        outlook: item.outlook,
        outlookTone: item.outlookTone,
        close,
        change,
        changePercent: prevClose ? (change / prevClose) * 100 : 0,
        change5d: changeFrom(bar.closes, last.index, 5),
        volume: bar.volumes?.[last.index] ?? bar.quote.volume,
        k: Math.round(kd.k),
        d: Math.round(kd.d),
        kdId: status.id,
        kdLabel: status.label,
        kdOrder: status.order,
        rankChange: prev?.rank == null ? "新進" : null,
        prevRank: prev?.rank ?? null,
        sessionDate,
        streak,
      });
    }

    rows.sort((a, b) => a.kdOrder - b.kdOrder || Math.min(a.k, a.d) - Math.min(b.k, b.d));
    const ranked = rows.map((row, index) => {
      const rank = index + 1;
      let rankChange = "新進";
      if (row.prevRank != null) {
        const diff = row.prevRank - rank;
        rankChange = diff === 0 ? "—" : diff > 0 ? `↑${diff}` : `↓${Math.abs(diff)}`;
      }
      return { ...row, rank, rankChange };
    });

    boards[board.id] = {
      id: board.id,
      market: board.market,
      theme: board.theme,
      title: board.title,
      rows: ranked,
      oversold: ranked.filter((row) => row.kdOrder <= 1).length,
    };
    highlights.push(
      ...ranked.filter((row) => row.kdOrder <= 1).map((row) => ({
        ...row,
        board: board.title,
      })),
    );
  }

  highlights.sort((a, b) => a.kdOrder - b.kdOrder || Math.min(a.k, a.d) - Math.min(b.k, b.d));

  const payload = {
    updatedAt: new Date().toISOString(),
    method: "KD(9,3,3)，以最近完整日K計算；K<20 或 D<20 視為嚴格超跌",
    boards,
    highlights: highlights.slice(0, 12),
    counts: Object.fromEntries(
      Object.values(boards).map((board) => [board.id, board.oversold]),
    ),
  };
  await writeFile(themeBoardsFile, JSON.stringify(payload, null, 2));
  console.log("wrote theme boards -> public/theme-boards.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
