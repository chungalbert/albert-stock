import { useNavigate } from "react-router-dom";
import type { Quote, Stock } from "../types";
import {
  formatChange,
  formatPercent,
  formatPrice,
  formatVolume,
} from "../lib/quotes";

function chgClass(value?: number) {
  if (value == null || value === 0) return "chg flat";
  return value > 0 ? "chg up" : "chg down";
}

export function QuoteTable({
  rows,
  quotes,
}: {
  rows: Stock[];
  quotes: Record<string, Quote>;
}) {
  const navigate = useNavigate();

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>代號</th>
            <th>名稱</th>
            <th className="num">股價</th>
            <th className="num">漲跌幅</th>
            <th className="num col-optional">漲跌</th>
            <th className="num col-optional">成交量</th>
            <th className="col-optional">產業</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((stock) => {
            const quote = quotes[stock.yahoo];
            return (
              <tr
                key={stock.id}
                onClick={() => navigate(`/stock/${stock.market}/${stock.symbol}`)}
              >
                <td className="symbol">{stock.symbol}</td>
                <td>
                  <div className="name-cell">
                    <span>{stock.nameZh}</span>
                    <small>{stock.nameEn}</small>
                  </div>
                </td>
                <td className="num">{formatPrice(quote?.price)}</td>
                <td className={`num ${chgClass(quote?.changePercent)}`}>
                  {formatPercent(quote?.changePercent)}
                </td>
                <td className={`num col-optional ${chgClass(quote?.change)}`}>
                  {formatChange(quote?.change)}
                </td>
                <td className="num col-optional">{formatVolume(quote?.volume)}</td>
                <td className="col-optional">{stock.sector}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
