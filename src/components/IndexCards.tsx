import type { Quote, Stock } from "../types";
import { formatChange, formatPercent, formatPrice } from "../lib/quotes";

function chgClass(value?: number) {
  if (value == null || value === 0) return "chg flat";
  return value > 0 ? "chg up" : "chg down";
}

export function IndexCards({
  items,
  quotes,
}: {
  items: Stock[];
  quotes: Record<string, Quote>;
}) {
  return (
    <div className="grid-4">
      {items.map((item) => {
        const quote = quotes[item.yahoo];
        return (
          <article key={item.id} className="card index-card">
            <div className="kicker">
              {item.market === "us" ? "美股指數" : "台股指數"} · {item.nameEn}
            </div>
            <div>{item.nameZh}</div>
            <div className="price mono">{formatPrice(quote?.price)}</div>
            <div className={chgClass(quote?.changePercent)}>
              {formatChange(quote?.change)} ({formatPercent(quote?.changePercent)})
            </div>
          </article>
        );
      })}
    </div>
  );
}
