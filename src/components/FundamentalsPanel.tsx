import { RevenueChart } from "./RevenueChart";
import {
  formatComma,
  formatIsoDate,
  formatSignedPct,
  toneClass,
} from "../lib/fundamentals";
import type { TwFundamental } from "../types";

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <article className="card fund-kpi">
      <div className="kicker">{label}</div>
      <div className={`fund-kpi-value ${tone ?? ""}`}>{value}</div>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="div-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function FundamentalsPanel({
  stock,
  volume,
}: {
  stock: TwFundamental;
  volume?: number;
}) {
  const div = stock.div;
  const yahooCode = `${stock.code}.${stock.market === "tpex" ? "TWO" : "TW"}`;

  return (
    <section className="fund-panel">
      <div className="grid-3">
        <Kpi label="本益比" value={formatComma(stock.pe, 1)} />
        <Kpi
          label="年增率"
          value={formatSignedPct(stock.yoy)}
          tone={toneClass(stock.yoy)}
        />
        <Kpi label="殖利率" value={stock.yield == null ? "—" : `${stock.yield.toFixed(2)}%`} />
      </div>

      <div className="fund-meta">
        <span>
          總股本 <b>{formatComma(stock.shares)}</b>
        </span>
        <span>
          成交量 <b>{formatComma(volume)}</b>
        </span>
      </div>

      <div className="fund-actions">
        <a
          className="btn gold"
          href={`https://mops.twse.com.tw/mops/web/t05st01?step=1&TYPEK=all&co_id=${stock.code}`}
          target="_blank"
          rel="noreferrer"
        >
          最新公告
        </a>
        <a
          className="btn gold"
          href={`https://tw.stock.yahoo.com/quote/${yahooCode}/news`}
          target="_blank"
          rel="noreferrer"
        >
          最新新聞
        </a>
      </div>

      <article className="card pad">
        <div className="card-head">
          <h2 className="section-title">營收資訊</h2>
          <span className="note">{stock.revYm ? `${stock.revYm} 月營收` : ""}</span>
        </div>
        <div className="grid-3 rev-stats">
          <div>
            <div className="kicker">營收</div>
            <div className="mono">{formatComma(stock.rev)}</div>
          </div>
          <div>
            <div className="kicker">月增率</div>
            <div className={`mono ${toneClass(stock.mom)}`}>
              {formatSignedPct(stock.mom)}
            </div>
          </div>
          <div>
            <div className="kicker">年增率</div>
            <div className={`mono ${toneClass(stock.yoy)}`}>
              {formatSignedPct(stock.yoy)}
            </div>
          </div>
        </div>
      </article>

      <article className="card pad">
        <h2 className="section-title">近三年每月營收</h2>
        <RevenueChart stock={stock} />
        <p className="note">單位：新台幣千元。資料來自公開資訊觀測站月營收。</p>
      </article>

      <article className="card pad">
        <h2 className="section-title">股利分配</h2>
        {div ? (
          <div className="div-grid">
            <Fact label="股利年度" value={div.year ? String(div.year) : "—"} />
            <Fact label="決議進度" value={div.progress || "—"} />
            <Fact label="股票股利" value={formatComma(div.stock, 4)} />
            <Fact label="現金股利" value={formatComma(div.cash, 4)} />
            <Fact label="除權息日" value={formatIsoDate(div.exDate)} />
            <Fact label="發放日" value={formatIsoDate(div.payDate)} />
            <Fact label="盈餘分派日" value={formatIsoDate(div.meetingDate)} />
            <Fact label="董事會決議日" value={formatIsoDate(div.boardDate)} />
            <Fact label="盈餘現金股利（元/股）" value={formatComma(div.surplusCash, 4)} />
            <Fact label="公積現金股利（元/股）" value={formatComma(div.capitalCash, 4)} />
            <Fact label="盈餘轉增資配股（元/股）" value={formatComma(div.surplusStock, 4)} />
            <Fact label="公積轉增資配股（元/股）" value={formatComma(div.capitalStock, 4)} />
          </div>
        ) : (
          <p className="lede">尚無股利分派資料。</p>
        )}
      </article>
    </section>
  );
}
