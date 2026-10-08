export function DialGauge({
  percent,
  label,
}: {
  percent: number;
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  const r = 88;
  const c = 2 * Math.PI * r;
  const usable = c * 0.78;
  const filled = (pct / 100) * usable;

  return (
    <div className="dial">
      <svg viewBox="0 0 220 210" className="dial-svg" aria-hidden="true">
        <circle
          cx="110"
          cy="118"
          r={r}
          fill="none"
          stroke="#1b242c"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${usable} ${c}`}
          transform="rotate(130 110 118)"
        />
        <circle
          cx="110"
          cy="118"
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          transform="rotate(130 110 118)"
        />
      </svg>
      <div className="dial-copy">
        <div className="kicker">{label}</div>
        <div className="dial-value mono">{pct.toFixed(1)}%</div>
      </div>
    </div>
  );
}

export function NeedleGauge({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const angle = 180 - (pct / 100) * 180;

  return (
    <div className="needle">
      <svg viewBox="0 0 120 78" className="needle-svg" aria-hidden="true">
        <path
          d="M16 62 A44 44 0 0 1 104 62"
          fill="none"
          stroke="#24303a"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M16 62 A44 44 0 0 1 104 62"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="138"
          strokeDashoffset={138 - (138 * pct) / 100}
        />
        <g transform={`rotate(${angle} 60 62)`}>
          <line x1="60" y1="62" x2="60" y2="24" stroke="#eef2f5" strokeWidth="2" />
          <circle cx="60" cy="62" r="4" fill="var(--gold)" />
        </g>
      </svg>
      <div className="needle-label">{label}</div>
    </div>
  );
}
