import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { searchUniverse } from "../lib/search";
import { useFundamentals, useRankings, useThemeBoards } from "../lib/useData";

export function SearchBox() {
  const [query, setQuery] = useState("");
  const rankings = useRankings();
  const themes = useThemeBoards();
  const fundamentals = useFundamentals();
  const navigate = useNavigate();

  const results = useMemo(
    () => searchUniverse(query, themes, rankings, fundamentals, 8),
    [query, rankings, themes, fundamentals],
  );

  return (
    <div className="search">
      <input
        value={query}
        placeholder="搜尋代號或名稱，例如 NVDA、中興電、2330"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results[0]) {
            navigate(`/stock/${results[0].market}/${results[0].symbol}`);
            setQuery("");
          }
          if (event.key === "Escape") setQuery("");
        }}
      />
      {query && (
        <div className="search-results">
          {results.length === 0 && <div className="empty">沒有符合的股票</div>}
          {results.map((stock) => (
            <Link
              key={stock.id}
              to={`/stock/${stock.market}/${stock.symbol}`}
              onClick={() => setQuery("")}
            >
              <span>
                <span className="symbol">{stock.symbol}</span> {stock.nameZh}
              </span>
              <small className="note">{stock.market === "us" ? "美股" : "台股"}</small>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
