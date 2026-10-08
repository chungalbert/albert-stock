import { Link } from "react-router-dom";
import { OutlookGrid } from "../components/OutlookGrid";
import { ThemeTable } from "../components/ThemeTable";
import { formatUpdatedAt } from "../lib/quotes";
import { namesOf } from "../lib/themes";
import { useThemeBoards } from "../lib/useData";

export function SpacePage() {
  const themes = useThemeBoards();

  const us = themes?.boards.usSpace;
  const tw = themes?.boards.twSpace;
  const oversold = [us, tw]
    .flatMap((board) => board?.rows ?? [])
    .filter((row) => row.kdId === "strong" || row.kdId === "oversold");
  const priority = oversold.slice(0, 3);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>太空股前景</h1>
          <p className="lede">
            美股看發射、衛星通訊、遙測與國防太空；台股看天線、測試、化合物半導體與高頻材料。KD
            超跌只是進出場節奏，前景分析看的是公司在產業鏈的位置。
          </p>
        </div>
        <div className="meta">
          更新 {formatUpdatedAt(themes?.updatedAt)}
          <div>{themes?.method}</div>
        </div>
      </div>

      <div className="grid-2">
        <article className="card index-card">
          <div className="kicker">美股太空 嚴格超跌</div>
          <div className="price">{themes?.counts.usSpace ?? "—"} 檔</div>
        </article>
        <article className="card index-card">
          <div className="kicker">台股太空 嚴格超跌</div>
          <div className="price">{themes?.counts.twSpace ?? "—"} 檔</div>
        </article>
      </div>

      <div className="panel alert">
        <b>今日重點：</b>
        {oversold.length === 0
          ? "太空池目前沒有 K 或 D 低於 20 的標的。"
          : (
            <>
              嚴格超跌 <b className="warn">{oversold.length} 檔</b>
              {namesOf(oversold) ? `：${namesOf(oversold)}` : ""}。
            </>
          )}
      </div>

      {priority.length > 0 && (
        <div className="panel">
          <b>優先對照前景：</b>
          {priority.map((row, index) => (
            <span key={row.yahoo}>
              {index > 0 ? "、" : ""}
              <Link className="chg up" to={`/stock/${row.market}/${row.symbol}`}>
                {row.nameZh}
              </Link>
              （K/D {row.k}/{row.d}）
            </span>
          ))}
        </div>
      )}

      {us && <ThemeTable board={us} />}
      {tw && <ThemeTable board={tw} />}
      {us && <OutlookGrid rows={us.rows} title="美股太空：逐家前景" />}
      {tw && <OutlookGrid rows={tw.rows} title="台股太空：逐家前景" />}

      <p className="note">
        本站資訊僅供參考，不構成投資建議。太空產業資本支出大、專案時程長，前景文字是產業位置判斷，不是目標價。
      </p>
    </section>
  );
}
