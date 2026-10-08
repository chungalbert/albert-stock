import { useNavigate } from "react-router-dom";
import type { TwRankRow } from "../types";
import { formatChange, formatPercent, formatPrice } from "../lib/quotes";
import { formatLots, formatTrades, formatTwd } from "../lib/rankings";

function chgClass(value?: number) {
  if (value == null || value === 0) return "chg flat";
  return value > 0 ? "chg up" : "chg down";
}

export function RankTable({ rows }: { rows: TwRankRow[] }) {
  const navigate = useNavigate();

  if (rows.length === 0) {
    return <div className="empty">這張榜單目前沒有資料。</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="num">#</th>
            <th>代號</th>
            <th>名稱</th>
            <th className="num">收盤</th>
            <th className="num">漲跌幅</th>
            <th className="num">漲跌</th>
            <th className="num">成交量</th>
            <th className="num col-optional">成交金額</th>
            <th className="num col-optional">筆數</th>
            <th className="num col-optional">振幅</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.code}
              onClick={() => navigate(`/stock/tw/${row.code}`)}
            >
              <td className="num muted">{row.rank ?? "—"}</td>
              <td className="symbol">{row.code}</td>
              <td>{row.name}</td>
              <td className="num">{formatPrice(row.close)}</td>
              <td className={`num ${chgClass(row.changePercent)}`}>
                {formatPercent(row.changePercent)}
              </td>
              <td className={`num ${chgClass(row.change)}`}>
                {formatChange(row.change)}
              </td>
              <td className="num">{formatLots(row.volume)}</td>
              <td className="num col-optional">{formatTwd(row.value)}</td>
              <td className="num col-optional">{formatTrades(row.trades)}</td>
              <td className="num col-optional">{formatPercent(row.amplitude)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
