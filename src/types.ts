export type Market = "us" | "tw";

export type Stock = {
  id: string;
  market: Market;
  symbol: string;
  yahoo: string;
  tv: string;
  nameZh: string;
  nameEn: string;
  sector: string;
  summary: string;
};

export type Quote = {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume?: number;
  high?: number;
  low?: number;
  currency?: string;
  spark?: number[];
  updatedAt: string;
};

export type QuotesFile = {
  updatedAt: string;
  quotes: Record<string, Quote>;
};

export type TwRankRow = {
  rank?: number;
  code: string;
  name: string;
  close: number;
  change: number;
  changePercent: number;
  volume: number;
  value: number;
  trades: number;
  high?: number;
  low?: number;
  amplitude: number;
};

export type TwRankBoard =
  | "volume"
  | "value"
  | "gainers"
  | "losers"
  | "trades"
  | "amplitude"
  | "limitUp"
  | "limitDown"
  | "etfVolume";

export type TwRankingsFile = {
  updatedAt: string;
  sessionDate: string;
  market: string;
  listed: TwRankRow[];
  boards: Partial<Record<TwRankBoard, TwRankRow[]>>;
};

export type KdId = "strong" | "oversold" | "near" | "normal" | "hot";

export type OutlookTone = "positive" | "mixed" | "cautious";

export type ThemeRow = {
  rank: number;
  market: Market;
  symbol: string;
  yahoo: string;
  nameZh: string;
  nameEn: string;
  theme: string;
  note: string;
  outlook?: string;
  outlookTone?: OutlookTone;
  close: number;
  change: number;
  changePercent: number;
  change5d: number | null;
  volume?: number;
  k: number;
  d: number;
  kdId: KdId;
  kdLabel: string;
  rankChange: string;
  streak: number;
};

export type ThemeBoard = {
  id: string;
  market: Market;
  theme: string;
  title: string;
  rows: ThemeRow[];
  oversold: number;
};

export type ThemeBoardsFile = {
  updatedAt: string;
  method: string;
  boards: Record<string, ThemeBoard>;
  highlights: ThemeRow[];
  counts: Record<string, number>;
};

export type TwDividend = {
  yearRoc?: number;
  year?: number;
  progress?: string;
  cash?: number;
  stock?: number;
  surplusCash?: number;
  legalCash?: number;
  capitalCash?: number;
  surplusStock?: number;
  legalStock?: number;
  capitalStock?: number;
  boardDate?: string;
  meetingDate?: string;
  exDate?: string;
  payDate?: string;
};

export type TwFundamental = {
  code: string;
  name?: string;
  industry?: string;
  market?: string;
  shares?: number;
  pe?: number;
  pb?: number;
  yield?: number;
  revYm?: string;
  rev?: number;
  mom?: number;
  yoy?: number;
  ytd?: number;
  ytdYoy?: number;
  months?: Record<string, number>;
  div?: TwDividend;
};

export type TwFundamentalsFile = {
  updatedAt: string;
  revenueYm: string;
  stocks: Record<string, TwFundamental>;
};

export type RiskCurrency = "TWD" | "USD";

export type RiskPosition = {
  id: string;
  market: Market;
  symbol: string;
  yahoo: string;
  nameZh: string;
  shares: number;
};

export type RiskBook = {
  twHoldings: number;
  usHoldings: number;
  twdCash: number;
  usdCash: number;
  positions: RiskPosition[];
  hideValues: boolean;
  currency: RiskCurrency;
};

export type RiskSignal = {
  id: string;
  label: string;
  value: number | null;
  hint: string;
};
