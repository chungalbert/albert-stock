import { useNavigate } from "react-router-dom";
import type { ThemeBoard, ThemeRow } from "../types";
import { formatPercent, formatPrice, formatVolume } from "../lib/quotes";
import { formatLots } from "../lib/rankings";
import { OutlookPill } from "./OutlookGrid";

function chgClass(value?: number | null) {
  if (value == null || value === 0) return "chg flat";
  return value > 0 ? "chg up" : "chg down";
}

function volumeText(row: ThemeRow) {
  return row.market === "tw" ? formatLots(row.volume) : formatVolume(row.volume);
}

export function KdPill({ id, label }: { id: string; label: string }) {
  return <span className={`pill ${id}`}>{label}</span>;
}

export function ThemeTable({ board }: { board: ThemeBoard }) {
  const navigate = useNavigate();

  return (
    <section>
      <h2 className="board-title">{board.title}</h2>
      <div className="table-wrap wide">
        <table className="theme-table">
          <thead>
            <tr>
              <th>排名</th>
              <th>公司</th>
              <th>細分題材</th>
              <th className="num">股價</th>
              <th className="num">漲跌幅</th>
              <th className="num">K</th>
              <th className="num">D</th>
              <th>KD狀態</th>
              <th className="num">近5日</th>
              <th className="num">成交量</th>
              <th>名次變化</th>
              <th>連續上榜</th>
              <th>前景</th>
              <th>催化／風險</th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((row) => (
              <tr
                key={`${board.id}-${row.yahoo}`}
                onClick={() => navigate(`/stock/${row.market}/${row.symbol}`)}
              >
                <td className="rank">{row.rank}</td>
                <td>
                  <b>{row.nameZh}</b>
                  <span className="code">{row.symbol}</span>
                </td>
                <td>{row.theme}</td>
                <td className="num">{formatPrice(row.close)}</td>
                <td className={`num ${chgClass(row.changePercent)}`}>
                  {formatPercent(row.changePercent)}
                </td>
                <td className="num">{row.k}</td>
                <td className="num">{row.d}</td>
                <td>
                  <KdPill id={row.kdId} label={row.kdLabel} />
                </td>
                <td className={`num ${chgClass(row.change5d)}`}>
                  {formatPercent(row.change5d ?? undefined)}
                </td>
                <td className="num">{volumeText(row)}</td>
                <td>{row.rankChange}</td>
                <td>
                  <b>{row.streak}天</b>
                </td>
                <td>
                  <OutlookPill tone={row.outlookTone} />
                </td>
                <td className="idea">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
