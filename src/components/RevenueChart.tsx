import type { TwFundamental } from "../types";

export function RevenueChart({ stock }: { stock: TwFundamental }) {
  const months = stock.months ?? {};
  const keys = Object.keys(months).sort();
  if (keys.length === 0) {
    return <p className="lede">尚無近三年月營收資料。</p>;
  }
  const latestYear = Number(keys[keys.length - 1].slice(0, 4));
  const years = [latestYear - 2, latestYear - 1, latestYear];
  const max = Math.max(1, ...Object.values(months));

  return (
    <div className="rev-chart">
      <div className="rev-legend">
        {years.map((year, index) => (
          <span key={year}>
            <i className={`y${index}`} />
            {year}
          </span>
        ))}
      </div>
      <div className="rev-bars">
        {Array.from({ length: 12 }, (_, monthIndex) => {
          const month = monthIndex + 1;
          return (
            <div className="rev-group" key={month}>
              <div className="rev-cols">
                {years.map((year, index) => {
                  const value = months[`${year}-${String(month).padStart(2, "0")}`];
                  const height = value ? Math.max(4, (value / max) * 120) : 0;
                  return (
                    <div
                      key={year}
                      className={`rev-col y${index}${value ? "" : " empty"}`}
                      title={
                        value
                          ? `${year}/${month}  ${value.toLocaleString("zh-TW")} 千元`
                          : `${year}/${month}  無資料`
                      }
                      style={{ height: `${height}px` }}
                    />
                  );
                })}
              </div>
              <span>{month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
