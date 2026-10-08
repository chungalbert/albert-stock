import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FundamentalsPanel } from "../components/FundamentalsPanel";
import { OutlookPill } from "../components/OutlookGrid";
import { KdPill } from "../components/ThemeTable";
import { getStock, stocksByMarket } from "../data/stocks";
import {
  formatChange,
  formatPercent,
  formatPrice,
  formatVolume,
} from "../lib/quotes";
import {
  findListed,
  formatLots,
  formatTwd,
  rankToStock,
} from "../lib/rankings";
import { findFundamental, fundToStock } from "../lib/fundamentals";
import { readWatchlist, toggleWatch } from "../lib/watchlist";
import { findThemeRow, findThemeRows, themeToStock } from "../lib/themes";
import { useFundamentals, useQuotes, useRankings, useThemeBoards } from "../lib/useData";
import type { Stock, TwFundamental, TwRankRow } from "../types";

export function StockPage() {
  const { market = "", symbol = "" } = useParams();
  const code = decodeURIComponent(symbol);
  const curated = getStock(market, code);
  const data = useQuotes();
  const rankings = useRankings();
  const themes = useThemeBoards();
  const fundamentals = useFundamentals();
  const [watched, setWatched] = useState(false);

  const listed = market === "tw" ? findListed(rankings?.listed ?? [], code) : undefined;
  const fund: TwFundamental | undefined =
    market === "tw" ? findFundamental(fundamentals, code) : undefined;
  const themeRows = findThemeRows(themes, market, code);
  const themeRow = findThemeRow(themes, market, code);
  const outlooks = themeRows.filter((row) => row.outlook);
  const stock: Stock | undefined =
    curated ??
    (listed ? rankToStock(listed) : undefined) ??
    (fund ? fundToStock(fund) : undefined) ??
    (themeRow ? themeToStock(themeRow) : undefined);

  useEffect(() => {
    if (!stock) return;
    setWatched(readWatchlist().includes(stock.id));
  }, [stock?.id]);

  if (!stock) {
    if (market === "tw" && rankings === null && themes === null && fundamentals === null) {
      return (
        <section className="page">
          <p className="lede">載入中…</p>
        </section>
      );
    }
    return (
      <section className="page">
        <h1>找不到這檔股票</h1>
        <p className="lede">可用上方搜尋，或從台股當日排行點進去。</p>
        <Link to="/tw">回台股排行</Link>
      </section>
    );
  }

  const quote = data?.quotes?.[stock.yahoo];
  const related = stocksByMarket(stock.market)
    .filter((item) => item.sector === stock.sector && item.id !== stock.id)
    .slice(0, 4);
  const price = quote?.price ?? listed?.close ?? themeRow?.close;
  const change = quote?.change ?? listed?.change ?? themeRow?.change;
  const changePercent =
    quote?.changePercent ?? listed?.changePercent ?? themeRow?.changePercent;
  const volume = quote?.volume ?? listed?.volume ?? themeRow?.volume;
  const chg = changePercent ?? 0;
  const tone = chg > 0 ? "chg up" : chg < 0 ? "chg down" : "chg flat";

  return (
    <section className="page">
      <div className="stock-hero">
        <div>
          <div className="note">
            {stock.market === "us" ? "美股" : "台股"} · {stock.sector}
          </div>
          <h1>
            {stock.nameZh} <span className="symbol">{stock.symbol}</span>
          </h1>
          <p className="lede">{stock.summary}</p>
          <div className="quote-line">
            <span className="price mono">{formatPrice(price)}</span>
            <span className={tone}>
              {formatChange(change)} ({formatPercent(changePercent)})
            </span>
            <span className="note">
              量 {stock.market === "tw" ? formatLots(volume) : formatVolume(volume)}
            </span>
          </div>
        </div>
        {stock.sector !== "指數" && (
          <div className="actions">
            <button
              className={watched ? "btn gold" : "btn"}
              onClick={() => setWatched(toggleWatch(stock.id).includes(stock.id))}
            >
              {watched ? "已加入自選" : "加入自選"}
            </button>
          </div>
        )}
      </div>

      {fund && (
        <FundamentalsPanel stock={fund} volume={listed?.volume ?? volume} />
      )}

      {themeRow && (
        <article className="card pad">
          <h2 className="section-title">KD（9,3,3）</h2>
          <div className="stat-grid">
            <div>
              <div className="kicker">K</div>
              <div className="mono">{themeRow.k}</div>
            </div>
            <div>
              <div className="kicker">D</div>
              <div className="mono">{themeRow.d}</div>
            </div>
            <div>
              <div className="kicker">狀態</div>
              <KdPill id={themeRow.kdId} label={themeRow.kdLabel} />
            </div>
            <div>
              <div className="kicker">細分題材</div>
              <div>{themeRow.theme}</div>
            </div>
          </div>
          <p className="lede kd-note">
            {themeRow.note}
          </p>
        </article>
      )}

      {outlooks.map((row) => (
        <article className="card pad" key={`${row.theme}-${row.yahoo}`}>
          <h2 className="section-title">前景分析</h2>
          <div className="outlook-head">
            <div>
              <div className="kicker">{row.theme}</div>
              <div>{row.nameZh}</div>
            </div>
            <OutlookPill tone={row.outlookTone} />
          </div>
          <p className="outlook-body">{row.outlook}</p>
          <p className="note">產業位置判斷，不是目標價或進出場建議。</p>
        </article>
      ))}

      {listed && <DailyStats row={listed} />}

      {related.length > 0 && (
        <article className="card pad">
          <h2 className="section-title">同產業</h2>
          {related.map((item) => (
            <Link
              key={item.id}
              className="related-link"
              to={`/stock/${item.market}/${item.symbol}`}
            >
              <span className="symbol">{item.symbol}</span> {item.nameZh}
              <div className="note">{item.nameEn}</div>
            </Link>
          ))}
        </article>
      )}
    </section>
  );
}

function DailyStats({ row }: { row: TwRankRow }) {
  return (
    <article className="card pad">
      <h2 className="section-title">當日收盤</h2>
      <div className="stat-grid">
        <div>
          <div className="kicker">開盤區間</div>
          <div className="mono">
            {formatPrice(row.low)} – {formatPrice(row.high)}
          </div>
        </div>
        <div>
          <div className="kicker">成交量</div>
          <div className="mono">{formatLots(row.volume)}</div>
        </div>
        <div>
          <div className="kicker">成交金額</div>
          <div className="mono">{formatTwd(row.value)}</div>
        </div>
        <div>
          <div className="kicker">振幅</div>
          <div className="mono">{formatPercent(row.amplitude)}</div>
        </div>
      </div>
    </article>
  );
}
