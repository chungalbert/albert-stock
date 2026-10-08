import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { sessionLabel, twSession, usSession } from "../lib/market";
import { useLiveStatus } from "../lib/useData";
import { SearchBox } from "./SearchBox";

export function Shell({ children }: { children: ReactNode }) {
  const us = usSession();
  const tw = twSession();
  const live = useLiveStatus();

  return (
    <div className="app">
      <aside className="nav">
        <NavLink to="/" className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="brand-text">
            <strong>Albert Stock</strong>
            <span>US · TW</span>
          </div>
        </NavLink>
        <nav className="nav-links">
          <NavLink to="/" end>
            總覽
          </NavLink>
          <NavLink to="/us">美股</NavLink>
          <NavLink to="/tw">台股</NavLink>
          <NavLink to="/space">太空</NavLink>
          <NavLink to="/watchlist">自選</NavLink>
          <NavLink to="/risk">風控</NavLink>
        </nav>
        <div className="session-box">
          <div className="session-row">
            <span>
              <span className={`dot ${us}`} />
              美股
            </span>
            <span>{sessionLabel(us)}</span>
          </div>
          <div className="session-row">
            <span>
              <span className={`dot ${tw}`} />
              台股
            </span>
            <span>{sessionLabel(tw)}</span>
          </div>
          {live.message && (
            <div className="session-row">
              <span>
                <span className={`dot ${live.phase === "loading" ? "open" : live.phase === "static" ? "closed" : "open"}`} />
                資料
              </span>
              <span>{live.message}</span>
            </div>
          )}
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <SearchBox />
          {live.message && (
            <div className={`note live-flag ${live.phase}`}>
              <span className={`dot ${live.phase === "static" ? "closed" : "open"}`} />
              {live.message}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
