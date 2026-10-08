import { useEffect, useState } from "react";
import { QuoteTable } from "../components/QuoteTable";
import { RankTable } from "../components/RankTable";
import { getStockById } from "../data/stocks";
import { formatUpdatedAt } from "../lib/quotes";
import { findListed } from "../lib/rankings";
import { findThemeById, themeToStock } from "../lib/themes";
import { useQuotes, useRankings, useThemeBoards } from "../lib/useData";
import { readWatchlist } from "../lib/watchlist";
import type { Stock, TwRankRow } from "../types";

export function WatchlistPage() {
  const [ids, setIds] = useState<string[]>([]);
  const data = useQuotes();
  const rankings = useRankings();
  const themes = useThemeBoards();

  useEffect(() => {
    setIds(readWatchlist());
    const onFocus = () => setIds(readWatchlist());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const curated: Stock[] = [];
  const ranked: TwRankRow[] = [];
  for (const id of ids) {
    const themeRow = findThemeById(themes, id);
    const stock = getStockById(id) ?? (themeRow ? themeToStock(themeRow) : undefined);
    if (stock) {
      curated.push(stock);
      continue;
    }
    if (id.startsWith("tw-")) {
      const row = findListed(rankings?.listed ?? [], id.slice(3));
      if (row) ranked.push(row);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>自選</h1>
          <p className="lede">清單存在這個瀏覽器，方便先盯盤，之後再接帳號同步。</p>
        </div>
        <div className="meta">報價更新 {formatUpdatedAt(data?.updatedAt)}</div>
      </div>
      <article className="card">
        {curated.length === 0 && ranked.length === 0 ? (
          <div className="empty">還沒有自選。到個股頁按「加入自選」即可。</div>
        ) : (
          <>
            {curated.length > 0 && (
              <QuoteTable rows={curated} quotes={data?.quotes ?? {}} />
            )}
            {ranked.length > 0 && <RankTable rows={ranked} />}
          </>
        )}
      </article>
    </section>
  );
}
