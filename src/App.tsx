import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { loadFundamentals } from "./lib/fundamentals";
import { bootLiveRefresh } from "./lib/live";
import { loadQuotes } from "./lib/quotes";
import { loadRankings } from "./lib/rankings";
import { loadThemeBoards } from "./lib/themes";
import { HomePage } from "./pages/HomePage";
import { MarketPage } from "./pages/MarketPage";
import { SpacePage } from "./pages/SpacePage";
import { StockPage } from "./pages/StockPage";
import { RiskPage } from "./pages/RiskPage";
import { WatchlistPage } from "./pages/WatchlistPage";

export default function App() {
  useEffect(() => {
    Promise.all([
      loadQuotes(),
      loadThemeBoards(),
      loadRankings(),
      loadFundamentals(),
    ]).then(([quotes, themes, , fundamentals]) => {
      void bootLiveRefresh(quotes, themes, fundamentals);
    });
  }, []);

  return (
    <HashRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/us" element={<MarketPage key="us" market="us" />} />
          <Route path="/tw" element={<MarketPage key="tw" market="tw" />} />
          <Route path="/space" element={<SpacePage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/risk" element={<RiskPage />} />
          <Route path="/stock/:market/:symbol" element={<StockPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}
