import { Link } from "react-router-dom";
import { IndexCards } from "../components/IndexCards";
import { ThemeTable } from "../components/ThemeTable";
import { indices } from "../data/stocks";
import { formatUpdatedAt } from "../lib/quotes";
import { namesOf } from "../lib/themes";
import { useQuotes, useThemeBoards } from "../lib/useData";

export function HomePage() {
  const data = useQuotes();
  const themes = useThemeBoards();

  const quotes = data?.quotes ?? {};
  const usAi = themes?.boards.usAi;
  const usAuto = themes?.boards.usAuto;
  const usSpace = themes?.boards.usSpace;
  const twAi = themes?.boards.twAi;
  const twAuto = themes?.boards.twAuto;
  const twSpace = themes?.boards.twSpace;
  const strict = (themes?.highlights ?? []).filter(
    (row) => row.kdId === "strong" || row.kdId === "oversold",
  );
  const priority = strict.slice(0, 3);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>美股／台股 題材 KD 超跌榜</h1>
          <p className="lede">
            AI、車電、太空題材池 + KD(9,3,3)。K&lt;20 或 D&lt;20 視為嚴格超跌。不含 A 股。
          </p>
        </div>
        <div className="meta">
          更新 {formatUpdatedAt(themes?.updatedAt || data?.updatedAt)}
          <div>{themes?.method}</div>
        </div>
      </div>

      <IndexCards items={indices} quotes={quotes} />

      <div className="grid-4">
        <article className="card index-card">
          <div className="kicker">美股 AI 嚴格超跌</div>
          <div className="price">{themes?.counts.usAi ?? "—"} 檔</div>
        </article>
        <article className="card index-card">
          <div className="kicker">美股 車電 嚴格超跌</div>
          <div className="price">{themes?.counts.usAuto ?? "—"} 檔</div>
        </article>
        <article className="card index-card">
          <div className="kicker">台股 AI 嚴格超跌</div>
          <div className="price">{themes?.counts.twAi ?? "—"} 檔</div>
        </article>
        <article className="card index-card">
          <div className="kicker">台股 車電 嚴格超跌</div>
          <div className="price">{themes?.counts.twAuto ?? "—"} 檔</div>
        </article>
      </div>
      <div className="grid-2">
        <article className="card index-card">
          <div className="kicker">美股 太空 嚴格超跌</div>
          <div className="price">{themes?.counts.usSpace ?? "—"} 檔</div>
        </article>
        <article className="card index-card">
          <div className="kicker">台股 太空 嚴格超跌</div>
          <div className="price">{themes?.counts.twSpace ?? "—"} 檔</div>
        </article>
      </div>

      <div className="panel alert">
        <b>今日重點：</b>
        {strict.length === 0 ? (
          "目前題材池裡沒有 K 或 D 低於 20 的標的。"
        ) : (
          <>
            嚴格超跌共 <b className="warn">{strict.length} 檔</b>
            {namesOf(strict) ? `：${namesOf(strict)}` : ""}。
          </>
        )}
      </div>

      {priority.length > 0 && (
        <div className="panel">
          <b>最值得優先盯：</b>
          {priority.map((row, index) => (
            <span key={row.yahoo}>
              {index > 0 ? "、" : ""}
              <Link className="chg up" to={`/stock/${row.market}/${row.symbol}`}>
                {row.nameZh}
              </Link>
              （K/D {row.k}/{row.d}、{row.kdLabel}）
            </span>
          ))}
        </div>
      )}

      {usAi && <ThemeTable board={usAi} />}
      {usAuto && <ThemeTable board={usAuto} />}
      {usSpace && <ThemeTable board={usSpace} />}
      {twAi && <ThemeTable board={twAi} />}
      {twAuto && <ThemeTable board={twAuto} />}
      {twSpace && <ThemeTable board={twSpace} />}

      <p className="note">
        本站資訊僅供參考，不構成投資建議。太空股的逐家前景在「太空」頁。成交量排行仍在台股頁。研報目標價尚未接入。
      </p>
    </section>
  );
}
