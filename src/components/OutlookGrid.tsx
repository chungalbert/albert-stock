import { useNavigate } from "react-router-dom";
import type { OutlookTone, ThemeRow } from "../types";

const toneLabel: Record<OutlookTone, string> = {
  positive: "偏正向",
  mixed: "中性觀察",
  cautious: "宜審慎",
};

export function OutlookPill({ tone }: { tone?: OutlookTone }) {
  if (!tone) return null;
  return <span className={`pill ${tone}`}>{toneLabel[tone]}</span>;
}

export function OutlookGrid({
  rows,
  title,
}: {
  rows: ThemeRow[];
  title: string;
}) {
  const navigate = useNavigate();

  return (
    <section>
      <h2 className="board-title">{title}</h2>
      <p className="lede outlook-lead">
        以下是各公司在太空鏈的位置、成長動能與主要風險。僅供研究參考，不是買賣建議。
      </p>
      <div className="outlook-grid">
        {rows.map((row) => (
          <article
            key={row.yahoo}
            className="card pad outlook-card"
            onClick={() => navigate(`/stock/${row.market}/${row.symbol}`)}
          >
            <div className="outlook-head">
              <div>
                <h3>
                  {row.nameZh} <span className="code inline">{row.symbol}</span>
                </h3>
                <div className="kicker">{row.theme}</div>
              </div>
              <OutlookPill tone={row.outlookTone} />
            </div>
            <p>{row.outlook || row.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
