import { useEffect, useMemo, useState } from "react";
import { DialGauge, NeedleGauge } from "../components/Gauges";
import { useFundamentals, useQuotes, useRankings, useThemeBoards, useUniverse } from "../lib/useData";
import { venueLabel } from "../lib/universe";
import {
  formatMoney,
  importHoldings,
  maskMoney,
  nextHourCountdown,
  parseMoney,
  positionValueTwd,
  readRiskBook,
  recommendedAllocation,
  riskSignals,
  usdTwdRate,
  upsertPosition,
  writeRiskBook,
} from "../lib/risk";
import { searchUniverse } from "../lib/search";
import type { RiskBook, Stock } from "../types";

function MoneyField({
  label,
  prefix,
  value,
  hidden,
  onChange,
}: {
  label: string;
  prefix: string;
  value: number;
  hidden: boolean;
  onChange: (value: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(String(value || ""));

  useEffect(() => {
    if (!focused) setDraft(value ? String(value) : "");
  }, [value, focused]);

  return (
    <label className="risk-field">
      <span className="kicker">{label}</span>
      <div className="risk-input">
        <span className="risk-prefix">{prefix}</span>
        <input
          inputMode="decimal"
          value={hidden && !focused ? "••••••" : focused ? draft : formatMoney(value)}
          onFocus={() => {
            setFocused(true);
            setDraft(value ? String(value) : "");
          }}
          onBlur={() => {
            setFocused(false);
            onChange(parseMoney(draft));
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            onChange(parseMoney(event.target.value));
          }}
        />
      </div>
    </label>
  );
}

export function RiskPage() {
  const [book, setBook] = useState<RiskBook>(readRiskBook);
  const quotes = useQuotes();
  const themes = useThemeBoards();
  const rankings = useRankings();
  const fundamentals = useFundamentals();
  const universe = useUniverse();
  const [query, setQuery] = useState("");
  const [shares, setShares] = useState("1000");
  const [showBook, setShowBook] = useState(false);
  const [clock, setClock] = useState(() => nextHourCountdown());

  useEffect(() => {
    writeRiskBook(book);
  }, [book]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(nextHourCountdown()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const fx = usdTwdRate(quotes);
  const signals = useMemo(() => riskSignals(quotes, themes), [quotes, themes]);
  const suggestPct = recommendedAllocation(signals);
  const results = useMemo(
    () => searchUniverse(query, themes, rankings, fundamentals, 24, universe),
    [query, themes, rankings, fundamentals, universe],
  );

  const cashTwd = book.twdCash + book.usdCash * fx;
  const holdingsTwd = book.twHoldings + book.usHoldings;
  const assets = holdingsTwd + cashTwd;
  const currentPct = assets > 0 ? (holdingsTwd / assets) * 100 : 0;
  const suggestHold = assets * (suggestPct / 100);
  const suggestCash = assets - suggestHold;
  const showUsd = book.currency === "USD";
  const unit = showUsd ? fx : 1;
  const money = (twd: number) => formatMoney(twd / unit);
  const prefix = showUsd ? "USD" : "TWD";

  function patch(next: Partial<RiskBook>) {
    setBook((prev) => ({ ...prev, ...next }));
  }

  function addStock(stock: Stock) {
    const qty = parseMoney(shares);
    if (qty <= 0) return;
    const positions = upsertPosition(book.positions, stock, qty);
    const imported = importHoldings(positions, quotes, rankings, fx);
    setBook({ ...book, positions, ...imported });
    setQuery("");
    setShowBook(true);
  }

  function applyBook() {
    setShowBook(true);
    if (!book.positions.length) return;
    patch(importHoldings(book.positions, quotes, rankings, fx));
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>風控運算</h1>
          <p className="lede">
            依台股／美股近月位階、波動與題材 KD 廣度估一個持股配置。庫存請自行輸入或帶入明細，不會連券商帳號。
          </p>
        </div>
        <div className="meta">
          美金匯率 {fx.toFixed(2)}
          <div>僅供參考，不是投資建議</div>
        </div>
      </div>

      <article className="card risk-stage">
        <div className="risk-tabs">
          {(["TWD", "USD"] as const).map((item) => (
            <button
              key={item}
              className={book.currency === item ? "chip on" : "chip"}
              onClick={() => patch({ currency: item })}
            >
              {item}
            </button>
          ))}
          <div className="risk-count">
            <span className="kicker">更新倒數</span>
            <strong className="mono">
              {clock.m}:{clock.s}
            </strong>
            <span className="note">min sec</span>
          </div>
        </div>

        <DialGauge percent={suggestPct} label="持股配置建議" />

        <div className="needle-row">
          {signals.map((item) => (
            <NeedleGauge key={item.id} value={item.value} label={item.label} />
          ))}
        </div>

        <div className="risk-split">
          <div>
            <div className="kicker">持股總市值</div>
            <button className="risk-eye" onClick={() => patch({ hideValues: !book.hideValues })}>
              {book.hideValues ? "顯示金額" : "隱藏金額"}
            </button>
          </div>
          <button className="btn gold" onClick={applyBook}>
            帶入庫存
          </button>
        </div>

        <div className="risk-grid">
          <MoneyField
            label="台股庫存（台幣計價）"
            prefix="TWD"
            value={book.twHoldings}
            hidden={book.hideValues}
            onChange={(twHoldings) => patch({ twHoldings })}
          />
          <MoneyField
            label="美股庫存（台幣計價）"
            prefix="TWD"
            value={book.usHoldings}
            hidden={book.hideValues}
            onChange={(usHoldings) => patch({ usHoldings })}
          />
        </div>
        <MoneyField
          label="請輸入您所持有的台幣"
          prefix="TWD"
          value={book.twdCash}
          hidden={book.hideValues}
          onChange={(twdCash) => patch({ twdCash })}
        />
        <MoneyField
          label="請輸入您所持有的美元"
          prefix="USD"
          value={book.usdCash}
          hidden={book.hideValues}
          onChange={(usdCash) => patch({ usdCash })}
        />

        <div className="risk-bar-block">
          <div className="risk-bar-head">
            <span>
              現在持股（{prefix}）
              <b className="mono">{maskMoney(book.hideValues, money(holdingsTwd))}</b>
            </span>
            <span className="mono">{currentPct.toFixed(2)}%</span>
            <span>
              資金總額
              <b className="mono">{maskMoney(book.hideValues, money(cashTwd))}</b>
            </span>
          </div>
          <div className="risk-bar">
            <i style={{ width: `${Math.min(100, currentPct)}%` }} />
          </div>
        </div>

        <div className="risk-bar-block">
          <div className="risk-bar-head">
            <span>
              建議持股（{prefix}）
              <b className="mono">{maskMoney(book.hideValues, money(suggestHold))}</b>
            </span>
            <span>
              建議閒錢
              <b className="mono">{maskMoney(book.hideValues, money(suggestCash))}</b>
            </span>
          </div>
          <div className="risk-bar gold">
            <i style={{ width: `${suggestPct}%` }} />
          </div>
        </div>
      </article>

      <article className="card pad">
        <div className="risk-split">
          <h2 className="section-title">庫存明細</h2>
          <button className="btn" onClick={() => setShowBook((value) => !value)}>
            {showBook ? "收合" : "展開"}
          </button>
        </div>
        <p className="lede">
          可搜台股上市櫃全市場（約 {universe?.stocks.length ?? "—"} 檔）或美股 ticker。直接輸入代號也能帶入。輸入股數後點選股票，再按帶入庫存會用最新價重算市值。
        </p>
        {showBook && (
          <>
            <div className="risk-add">
              <input
                value={query}
                placeholder="搜尋代號或名稱，例如 NVDA、QQQ、2330、中興電"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && results[0]) addStock(results[0]);
                }}
              />
              <input
                className="risk-shares"
                inputMode="decimal"
                value={shares}
                onChange={(event) => setShares(event.target.value)}
                aria-label="股數"
              />
            </div>
            {query && (
              <div className="search-results risk-results">
                {results.length === 0 && <div className="empty">沒有符合的股票</div>}
                {results.map((stock) => (
                  <button key={stock.id} className="risk-pick" onClick={() => addStock(stock)}>
                    <span>
                      <span className="symbol">{stock.symbol}</span> {stock.nameZh}
                    </span>
                    <small className="note">{venueLabel(stock)}</small>
                  </button>
                ))}
              </div>
            )}
            {book.positions.length === 0 ? (
              <div className="empty">還沒有明細。先搜尋股票並帶入股數。</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>股票</th>
                      <th className="num">股數</th>
                      <th className="num">市值（TWD）</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {book.positions.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {row.nameZh}
                          <span className="code">{row.symbol}</span>
                        </td>
                        <td className="num">{row.shares.toLocaleString("en-US")}</td>
                        <td className="num">
                          {maskMoney(
                            book.hideValues,
                            formatMoney(positionValueTwd(row, quotes, rankings, fx)),
                          )}
                        </td>
                        <td>
                          <button
                            className="btn"
                            onClick={() => {
                              const positions = book.positions.filter((item) => item.id !== row.id);
                              setBook({
                                ...book,
                                positions,
                                ...importHoldings(positions, quotes, rankings, fx),
                              });
                            }}
                          >
                            移除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </article>

      <div className="panel">
        {signals.map((item) => (
          <div key={item.id}>
            <b>{item.label}</b>
            {item.value == null ? " 尚無資料。" : ` ${item.value.toFixed(0)}。`}
            {item.hint}
          </div>
        ))}
      </div>
    </section>
  );
}
