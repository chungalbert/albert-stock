import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IndexCards } from "../components/IndexCards";
import { QuoteTable } from "../components/QuoteTable";
import { RankTable } from "../components/RankTable";
import { ThemeTable } from "../components/ThemeTable";
import { indices, stocksByMarket } from "../data/stocks";
import { formatUpdatedAt } from "../lib/quotes";
import { formatSessionDate, twBoards } from "../lib/rankings";
import { namesOf } from "../lib/themes";
import { useQuotes, useRankings, useThemeBoards, useUniverse } from "../lib/useData";
import type { Market } from "../types";

export function MarketPage({ market }: { market: Market }) {
  const indexItems = indices.filter((item) => item.market === market);
  const data = useQuotes();
  const rankings = useRankings();
  const themes = useThemeBoards();
  const universe = useUniverse();
  const [sector, setSector] = useState("全部");
  const [board, setBoard] = useState<(typeof twBoards)[number]["id"]>("volume");
  const [dirQuery, setDirQuery] = useState("");
  const [dirMarket, setDirMarket] = useState<"all" | "twse" | "tpex">("all");

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
  const twNames = universe?.stocks ?? [];
  const listedCount = twNames.filter((row) => row.market === "twse").length;
  const otcCount = twNames.filter((row) => row.market === "tpex").length;
  const directory = useMemo(() => {
    const q = dirQuery.trim().toLowerCase();
    return twNames.filter((row) => {
      if (dirMarket !== "all" && row.market !== dirMarket) return false;
      if (!q) return true;
      return row.code.toLowerCase().includes(q) || row.name.toLowerCase().includes(q);
    });
  }, [twNames, dirQuery, dirMarket]);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>{market === "us" ? "美股 AI × 太空" : "台股 AI × 太空"}</h1>
          <p className="lede">
            {market === "us"
              ? "美股 AI 與太空題材池，按 KD 超跌排序。"
              : "台股 AI 與太空題材池，按 KD 超跌排序；下方有證交所當日量價排行，以及上市櫃全市場名冊。"}
          </p>
        </div>
        <div className="meta">
          更新 {formatUpdatedAt(themes?.updatedAt || data?.updatedAt)}
          {market === "tw" && (
            <>
              <div>上市收盤 {formatSessionDate(rankings?.sessionDate)}</div>
              <div>
                全市場 {twNames.length || "—"} 檔
              </div>
            </>
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

          <h2 className="board-title">台股全市場名冊</h2>
          <p className="lede">
            上市 {listedCount} 檔、上櫃 {otcCount} 檔。搜尋代號或名稱可進個股基本面。
          </p>
          <div className="filters">
            {(
              [
                ["all", `全部 ${twNames.length}`],
                ["twse", `上市 ${listedCount}`],
                ["tpex", `上櫃 ${otcCount}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={dirMarket === id ? "chip on" : "chip"}
                onClick={() => setDirMarket(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            className="dir-search"
            value={dirQuery}
            placeholder="篩選代號或名稱，例如 6488、中興電"
            onChange={(event) => setDirQuery(event.target.value)}
          />
          <article className="card">
            <div className="table-wrap dir-wrap">
              <table>
                <thead>
                  <tr>
                    <th>代號</th>
                    <th>名稱</th>
                    <th>市場</th>
                    <th>產業</th>
                  </tr>
                </thead>
                <tbody>
                  {directory.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty">
                        {universe ? "沒有符合的股票" : "載入中…"}
                      </td>
                    </tr>
                  ) : (
                    directory.slice(0, 200).map((row) => (
                      <tr key={row.code}>
                        <td>
                          <Link to={`/stock/tw/${row.code}`}>{row.code}</Link>
                        </td>
                        <td>
                          <Link to={`/stock/tw/${row.code}`}>{row.name}</Link>
                        </td>
                        <td>{row.market === "tpex" ? "上櫃" : "上市"}</td>
                        <td>{row.industry || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
          {directory.length > 200 && (
            <p className="note">
              符合 {directory.length} 檔，先顯示前 200 檔。請再輸入代號或名稱縮小範圍。
            </p>
          )}
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
