import { useEffect, useMemo, useState } from "react";
import { IndexCards } from "../components/IndexCards";
import { QuoteTable } from "../components/QuoteTable";
import { RankTable } from "../components/RankTable";
import { ThemeTable } from "../components/ThemeTable";
import { indices, stocksByMarket } from "../data/stocks";
import { formatUpdatedAt } from "../lib/quotes";
import { formatSessionDate, twBoards } from "../lib/rankings";
import { namesOf } from "../lib/themes";
import { useQuotes, useRankings, useThemeBoards } from "../lib/useData";
import type { Market } from "../types";

export function MarketPage({ market }: { market: Market }) {
  const indexItems = indices.filter((item) => item.market === market);
  const data = useQuotes();
  const rankings = useRankings();
  const themes = useThemeBoards();
  const [sector, setSector] = useState("全部");
  const [board, setBoard] = useState<(typeof twBoards)[number]["id"]>("volume");

  useEffect(() => {
    setSector("全部");
    setBoard("volume");
  }, [market]);

  const rows = stocksByMarket(market);
  const sectors = ["全部", ...Array.from(new Set(rows.map((item) => item.sector)))];
  const filtered = useMemo(
    () => (sector === "全部" ? rows : rows.filter((item) => item.sector === sector)),
    [rows, sector],
  );
  const quotes = data?.quotes ?? {};
  const themeBoards =
    market === "us"
      ? [themes?.boards.usAi, themes?.boards.usSpace]
      : [themes?.boards.twAi, themes?.boards.twSpace];
  const oversold = themeBoards
    .flatMap((item) => item?.rows ?? [])
    .filter((row) => row.kdId === "strong" || row.kdId === "oversold");

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>{market === "us" ? "美股 AI × 太空" : "台股 AI × 太空"}</h1>
          <p className="lede">
            {market === "us"
              ? "美股 AI 與太空題材池，按 KD 超跌排序。"
              : "台股 AI 與太空題材池，按 KD 超跌排序；下方保留證交所當日量價排行。"}
          </p>
        </div>
        <div className="meta">
          更新 {formatUpdatedAt(themes?.updatedAt || data?.updatedAt)}
          {market === "tw" && (
            <div>上市收盤 {formatSessionDate(rankings?.sessionDate)}</div>
          )}
        </div>
      </div>

      <IndexCards items={indexItems} quotes={quotes} />

      <div className="panel alert">
        <b>嚴格超跌：</b>
        {oversold.length === 0
          ? "這市場目前沒有 K 或 D 低於 20 的題材股。"
          : `${oversold.length} 檔${namesOf(oversold) ? `：${namesOf(oversold)}` : ""}`}
      </div>

      {themeBoards.map(
        (item) => item && <ThemeTable key={item.id} board={item} />,
      )}

      {market === "tw" ? (
        <>
          <h2 className="board-title">上市當日量價排行</h2>
          <div className="filters">
            {twBoards.map((item) => (
              <button
                key={item.id}
                className={item.id === board ? "chip on" : "chip"}
                onClick={() => setBoard(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <article className="card">
            <RankTable rows={rankings?.boards[board] ?? []} />
          </article>
        </>
      ) : (
        <>
          <h2 className="board-title">觀察名單</h2>
          <div className="filters">
            {sectors.map((item) => (
              <button
                key={item}
                className={item === sector ? "chip on" : "chip"}
                onClick={() => setSector(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <article className="card">
            <QuoteTable rows={filtered} quotes={quotes} />
          </article>
        </>
      )}
    </section>
  );
}
