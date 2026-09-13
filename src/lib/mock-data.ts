/**
 * Dummy data for the MVP preview — shaped exactly like qode-oneview's real
 * data contract (src/features/review/types.ts), so this is a believable
 * stand-in for what GET /api/mobile/* will actually return once
 * SPEC-mobile-dashboard.md's backend module is built, not an invented shape.
 * Field names, nesting and nullability all match the real `ReviewData`.
 *
 * Numbers are fictional. "These holdings are seeded for testing and belong
 * to nobody" — same disclosure qode-oneview's own QA data export carries.
 */

export type AssetType = 'stock' | 'mf' | 'etf' | 'invitReit' | 'bank' | 'deposit';
export type CapBand = 'large' | 'mid' | 'small' | 'micro' | 'unclassified';
export type BucketId = 'large' | 'mid' | 'small' | 'micro';
export type DriftBadge = 'green' | 'amber' | 'red';

export interface CurvePoint {
  date: string;
  value: number;
}

export interface Series {
  label: string;
  role: 'client' | 'strategy' | 'benchmark';
  points: CurvePoint[];
  end: number;
  color?: string;
}

export interface AssetCard {
  type: AssetType;
  label: string;
  value: number;
  count: number;
  countLabel: string;
  sharePercent: number;
}

export interface CapSlice {
  band: CapBand;
  label: string;
  percent: number;
  value: number;
}

export interface Holding {
  id: string;
  name: string;
  isin: string | null;
  type: AssetType;
  value: number;
  weightPercent: number;
  cap: CapBand;
  investedValue: number | null;
  unrealisedPnl: number | null;
  unrealisedPnlPercent: number | null;
  units: number | null;
  custodian: string | null;
  schemeCategory: string | null;
}

export interface MetricCard {
  key: string;
  label: string;
  value: number | null;
  strategyValue: number | null;
  benchmarkValue: number | null;
  unit: 'percent' | 'ratio' | 'multiple' | 'crore';
  better: 'higher' | 'lower';
}

export interface CapSection {
  id: BucketId;
  label: string;
  value: number;
  directValue: number;
  viaFundsValue: number;
  percentOfPortfolio: number;
  positions: number;
  top: { name: string; value: number; via: 'direct' | 'funds' | 'both' }[];
  strategy: { code: string; name: string } | null;
  benchmark: string | null;
  series: Series[];
  metrics: MetricCard[];
  insight: string;
}

export interface RaceBar {
  label: string;
  value: number;
  role: 'client' | 'strategy' | 'benchmark';
}

export interface Takeaway {
  label: string;
  percent: number | null;
  note: string;
  verdict: 'keep' | 'review' | 'act';
}

export interface Performance {
  investedLabel: string;
  invested: number;
  bars: RaceBar[];
  journey: Series[];
  takeaways: Takeaway[];
}

export interface FundXray {
  id: string;
  name: string;
  mandate: string | null;
  mandateBand: CapBand | null;
  value: number;
  exposure: { band: CapBand; percent: number }[];
  outsideMandatePercent: number | null;
  badge: DriftBadge;
  headline: string;
  detail: string;
  culprits: string[];
  holdings: { name: string; percent: number; band: CapBand; sector: string | null }[];
  asOf: string | null;
}

export interface Alert {
  kind: 'concentration' | 'drift' | 'cash' | 'coverage';
  title: string;
  body: string;
}

export interface Coverage {
  valued: number;
  total: number;
  valuePercent: number;
}

export interface CapContentRow {
  name: string;
  value: number;
  via: 'direct' | 'funds' | 'both';
  kind?: 'stock' | 'etf' | 'invitReit' | 'mf';
}

export interface WealthGapLeg {
  label: string;
  value: number;
  percent: number;
}

export interface WealthGap {
  amount: number;
  you: WealthGapLeg;
  benchmark: WealthGapLeg;
  qode: WealthGapLeg;
  benchmarkGap: number;
  alphaPotential: number;
  totalWealthGap: number;
  from: string;
  to: string;
}

export interface Sleeve {
  code: 'QAW' | 'QTF' | 'QGF';
  name: string;
  percent: number;
  role: string;
  color: string;
}

export interface ReviewData {
  client: {
    name: string;
    firstName: string;
    asOf: string | null;
    navAsOf: string | null;
    holdingsCount: number;
    assetTypeCount: number;
  };
  totals: {
    securities: number;
    cash: number;
    portfolio: number;
  };
  assetCards: AssetCard[];
  capMix: CapSlice[];
  capContents: Partial<Record<CapBand, CapContentRow[]>>;
  capCoverage: Coverage;
  alerts: Alert[];
  holdings: Holding[];
  capSections: CapSection[];
  performance: Performance | null;
  gap: WealthGap;
  mixBlend: Sleeve[];
  xray: {
    funds: FundXray[];
    fundsHeld: number;
    fundsResolved: number;
  };
  reports: {
    sebiReg: string;
    contact: { email: string; phone: string };
  };
  riskProfile: {
    underFiveCr: { code: 'QAW' | 'QTF' | 'QGF'; title: string; description: string; percent: number }[];
    fiveCrPlus: { code: 'QAW' | 'QTF' | 'QGF'; title: string; description: string; percent: number }[];
  };
  profile: {
    name: string;
    phone: string;
    custId: string;
    panMasked: string;
    email: string;
    memberSince: string;
    holdingsCount: number;
    bankAccountCount: number;
    analysisAt: string;
    riskProfileAt: string | null;
    sources: { label: string; kind: string; count: number; lastSeen: string }[];
  };
}

function daily(startValue: number, days: number, drift: number, seed: number): CurvePoint[] {
  const points: CurvePoint[] = [];
  let value = 100;
  const start = new Date('2025-09-01');
  for (let i = 0; i < days; i++) {
    const wobble = Math.sin((i + seed) * 0.35) * 0.6 + Math.sin((i + seed) * 0.09) * 1.1;
    value = value * (1 + drift / days) + wobble * 0.04;
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    points.push({ date: d.toISOString().slice(0, 10), value: Number(value.toFixed(2)) });
  }
  return points;
}

const clientJourney = daily(100, 260, 0.1418, 1);
const strategyJourney = daily(100, 260, 0.2888, 7);
const benchmarkJourney = daily(100, 260, -0.0193, 13);

export const mockReviewData: ReviewData = {
  client: {
    name: 'Aarav Mehta',
    firstName: 'Aarav',
    asOf: '2026-09-07',
    navAsOf: '2026-09-04',
    holdingsCount: 14,
    assetTypeCount: 3,
  },

  totals: {
    securities: 3_842_600,
    cash: 372_900,
    portfolio: 4_215_500,
  },

  assetCards: [
    { type: 'stock', label: 'Stocks', value: 1_986_400, count: 7, countLabel: '7 holdings', sharePercent: 47.1 },
    { type: 'mf', label: 'Mutual Funds', value: 1_524_200, count: 5, countLabel: '5 funds', sharePercent: 36.2 },
    { type: 'etf', label: 'ETFs', value: 332_000, count: 2, countLabel: '2 holdings', sharePercent: 7.9 },
    { type: 'bank', label: 'Bank & Deposits', value: 372_900, count: 1, countLabel: '1 account', sharePercent: 8.8 },
  ],

  capMix: [
    { band: 'large', label: 'Large Cap', percent: 52.4, value: 2_208_900 },
    { band: 'mid', label: 'Mid Cap', percent: 23.1, value: 973_800 },
    { band: 'small', label: 'Small Cap', percent: 12.6, value: 531_150 },
    { band: 'unclassified', label: 'Others', percent: 11.9, value: 501_650 },
  ],

  // The rows behind the donut's accordion legend — sums exactly to each
  // capMix slice, same rule qode-oneview's Overview.tsx states in its own
  // comment ("the donut and its explanation can never disagree").
  capContents: {
    large: [
      { name: 'Reliance Industries', value: 486_200, via: 'direct', kind: 'stock' },
      { name: 'Parag Parikh Flexi Cap Fund', value: 340_500, via: 'funds', kind: 'mf' },
      { name: 'HDFC Bank', value: 358_900, via: 'direct', kind: 'stock' },
      { name: 'Infosys', value: 298_400, via: 'direct', kind: 'stock' },
      { name: 'Tata Consultancy Services', value: 274_100, via: 'direct', kind: 'stock' },
      { name: 'ICICI Bank', value: 231_800, via: 'direct', kind: 'stock' },
      { name: 'SBI Nifty Index Fund', value: 142_300, via: 'funds', kind: 'mf' },
      { name: 'Nippon India Nifty BeES', value: 116_700, via: 'direct', kind: 'etf' },
    ],
    mid: [
      { name: 'Mirae Asset Midcap Fund', value: 398_100, via: 'funds', kind: 'mf' },
      { name: 'Persistent Systems', value: 187_500, via: 'direct', kind: 'stock' },
      { name: 'Cummins India', value: 149_500, via: 'direct', kind: 'stock' },
      { name: 'Persistent Systems (via fund)', value: 238_700, via: 'both', kind: 'stock' },
    ],
    small: [
      { name: 'Quant Small Cap Fund', value: 298_600, via: 'funds', kind: 'mf' },
      { name: 'IRB Infrastructure (via fund)', value: 232_550, via: 'funds', kind: 'mf' },
    ],
    unclassified: [
      { name: 'HDFC Bank — Savings A/C', value: 372_900, via: 'direct', kind: 'stock' },
      { name: 'ICICI Prudential Gold ETF', value: 128_750, via: 'direct', kind: 'etf' },
    ],
  },

  capCoverage: {
    valued: 6,
    total: 7,
    valuePercent: 91.4,
  },

  alerts: [
    {
      kind: 'concentration',
      title: 'Concentration alert',
      body: 'Reliance Industries alone is 11.5% of your portfolio — more than any single mutual fund position.',
    },
    {
      kind: 'coverage',
      title: 'Cost basis missing',
      body: '2 of your 14 holdings arrived with no reported cost — their gain/loss is unknown, not zero.',
    },
  ],

  holdings: [
    { id: 'h1', name: 'Reliance Industries', isin: 'INE002A01018', type: 'stock', value: 486_200, weightPercent: 11.5, cap: 'large', investedValue: 401_500, unrealisedPnl: 84_700, unrealisedPnlPercent: 21.1, units: 158, custodian: 'Zerodha', schemeCategory: null },
    { id: 'h2', name: 'HDFC Bank', isin: 'INE040A01034', type: 'stock', value: 358_900, weightPercent: 8.5, cap: 'large', investedValue: 312_000, unrealisedPnl: 46_900, unrealisedPnlPercent: 15.0, units: 212, custodian: 'Zerodha', schemeCategory: null },
    { id: 'h3', name: 'Infosys', isin: 'INE009A01021', type: 'stock', value: 298_400, weightPercent: 7.1, cap: 'large', investedValue: 275_000, unrealisedPnl: 23_400, unrealisedPnlPercent: 8.5, units: 165, custodian: 'Zerodha', schemeCategory: null },
    { id: 'h4', name: 'Tata Consultancy Services', isin: 'INE467B01029', type: 'stock', value: 274_100, weightPercent: 6.5, cap: 'large', investedValue: null, unrealisedPnl: null, unrealisedPnlPercent: null, units: 68, custodian: 'Zerodha', schemeCategory: null },
    { id: 'h5', name: 'ICICI Bank', isin: 'INE090A01021', type: 'stock', value: 231_800, weightPercent: 5.5, cap: 'large', investedValue: 198_400, unrealisedPnl: 33_400, unrealisedPnlPercent: 16.8, units: 178, custodian: 'Groww', schemeCategory: null },
    { id: 'h6', name: 'Persistent Systems', isin: 'INE262H01013', type: 'stock', value: 187_500, weightPercent: 4.4, cap: 'mid', investedValue: 142_000, unrealisedPnl: 45_500, unrealisedPnlPercent: 32.0, units: 92, custodian: 'Groww', schemeCategory: null },
    { id: 'h7', name: 'Cummins India', isin: 'INE298A01020', type: 'stock', value: 149_500, weightPercent: 3.5, cap: 'mid', investedValue: null, unrealisedPnl: null, unrealisedPnlPercent: null, units: 41, custodian: 'Groww', schemeCategory: null },
    { id: 'h8', name: 'Parag Parikh Flexi Cap Fund', isin: 'INF879O01019', type: 'mf', value: 612_400, weightPercent: 14.5, cap: 'large', investedValue: 480_000, unrealisedPnl: 132_400, unrealisedPnlPercent: 27.6, units: 6821.4, custodian: 'CAMS', schemeCategory: 'Flexi Cap Fund' },
    { id: 'h9', name: 'Mirae Asset Midcap Fund', isin: 'INF769K01AX5', type: 'mf', value: 398_100, weightPercent: 9.4, cap: 'mid', investedValue: 340_000, unrealisedPnl: 58_100, unrealisedPnlPercent: 17.1, units: 9840.2, custodian: 'CAMS', schemeCategory: 'Mid Cap Fund' },
    { id: 'h10', name: 'Quant Small Cap Fund', isin: 'INF966L01838', type: 'mf', value: 298_600, weightPercent: 7.1, cap: 'small', investedValue: 210_000, unrealisedPnl: 88_600, unrealisedPnlPercent: 42.2, units: 4102.9, custodian: 'KFin', schemeCategory: 'Small Cap Fund' },
    { id: 'h11', name: 'SBI Nifty Index Fund', isin: 'INF200K01VT0', type: 'mf', value: 142_300, weightPercent: 3.4, cap: 'large', investedValue: 130_000, unrealisedPnl: 12_300, unrealisedPnlPercent: 9.5, units: 5210.0, custodian: 'CAMS', schemeCategory: 'Index Fund' },
    { id: 'h12', name: 'ICICI Prudential Gold ETF', isin: 'INF109KB1G96', type: 'etf', value: 187_400, weightPercent: 4.4, cap: 'unclassified', investedValue: 156_000, unrealisedPnl: 31_400, unrealisedPnlPercent: 20.1, units: 3120, custodian: 'Zerodha', schemeCategory: 'Gold ETF' },
    { id: 'h13', name: 'Nippon India Nifty BeES', isin: 'INF204KB14I2', type: 'etf', value: 144_600, weightPercent: 3.4, cap: 'large', investedValue: null, unrealisedPnl: null, unrealisedPnlPercent: null, units: 640, custodian: 'Zerodha', schemeCategory: 'Index ETF' },
    { id: 'h14', name: 'HDFC Bank — Savings A/C', isin: null, type: 'bank', value: 372_900, weightPercent: 8.8, cap: 'unclassified', investedValue: null, unrealisedPnl: null, unrealisedPnlPercent: null, units: null, custodian: 'HDFC Bank', schemeCategory: null },
  ],

  capSections: [
    {
      id: 'large',
      label: 'Large Cap',
      value: 2_208_900,
      directValue: 1_649_400,
      viaFundsValue: 559_500,
      percentOfPortfolio: 52.4,
      positions: 6,
      top: [
        { name: 'Reliance Industries', value: 486_200, via: 'direct' },
        { name: 'Parag Parikh Flexi Cap Fund', value: 340_500, via: 'funds' },
        { name: 'HDFC Bank', value: 358_900, via: 'direct' },
      ],
      strategy: { code: 'QAW', name: 'Qode All Weather' },
      benchmark: 'NIFTY 100',
      series: [],
      metrics: [
        { key: 'cagr', label: 'CAGR', value: 15.8, strategyValue: 19.4, benchmarkValue: 12.1, unit: 'percent', better: 'higher' },
        { key: 'maxDrawdown', label: 'Max Drawdown', value: -14.2, strategyValue: -9.6, benchmarkValue: -18.3, unit: 'percent', better: 'higher' },
      ],
      insight: 'Your large cap sleeve is ahead of NIFTY 100 but trails the Qode All Weather strategy over the same window.',
    },
    {
      id: 'mid',
      label: 'Mid Cap',
      value: 973_800,
      directValue: 337_000,
      viaFundsValue: 636_800,
      percentOfPortfolio: 23.1,
      positions: 4,
      top: [
        { name: 'Mirae Asset Midcap Fund', value: 398_100, via: 'funds' },
        { name: 'Persistent Systems', value: 187_500, via: 'direct' },
        { name: 'Cummins India', value: 149_500, via: 'direct' },
      ],
      strategy: { code: 'QTF', name: 'Qode Tactical Fund' },
      benchmark: 'NIFTY Midcap 150',
      series: [],
      metrics: [
        { key: 'cagr', label: 'CAGR', value: 22.4, strategyValue: 24.9, benchmarkValue: 18.7, unit: 'percent', better: 'higher' },
        { key: 'maxDrawdown', label: 'Max Drawdown', value: -21.5, strategyValue: -16.2, benchmarkValue: -24.8, unit: 'percent', better: 'higher' },
      ],
      insight: 'Mid cap is your fastest-growing sleeve this year, running close to Qode Tactical Fund.',
    },
    {
      id: 'small',
      label: 'Small Cap',
      value: 531_150,
      directValue: 0,
      viaFundsValue: 531_150,
      percentOfPortfolio: 12.6,
      positions: 1,
      top: [{ name: 'Quant Small Cap Fund', value: 298_600, via: 'funds' }],
      strategy: { code: 'QGF', name: 'Qode Growth Fund' },
      benchmark: 'NIFTY Smallcap 250',
      series: [],
      metrics: [
        { key: 'cagr', label: 'CAGR', value: 28.1, strategyValue: 31.6, benchmarkValue: 22.9, unit: 'percent', better: 'higher' },
        { key: 'maxDrawdown', label: 'Max Drawdown', value: -29.8, strategyValue: -22.1, benchmarkValue: -33.4, unit: 'percent', better: 'higher' },
      ],
      insight: 'Your only small cap exposure is through Quant Small Cap Fund — no direct small cap holdings.',
    },
  ],

  performance: {
    investedLabel: '7 Sept 2025',
    invested: 3_685_000,
    bars: [
      { label: 'NIFTY 500', value: -1.93, role: 'benchmark' },
      { label: 'You', value: 14.18, role: 'client' },
      { label: 'Your Qode Mix', value: 28.88, role: 'strategy' },
    ],
    journey: [
      { label: 'NIFTY 500', role: 'benchmark', points: benchmarkJourney, end: benchmarkJourney[benchmarkJourney.length - 1].value },
      { label: 'You', role: 'client', points: clientJourney, end: clientJourney[clientJourney.length - 1].value },
      { label: 'Your Qode Mix', role: 'strategy', points: strategyJourney, end: strategyJourney[strategyJourney.length - 1].value },
    ],
    takeaways: [
      { label: 'Beat the benchmark', percent: 16.11, note: 'Your portfolio outran NIFTY 500 by 16.11 points over the last year.', verdict: 'keep' },
      { label: 'Behind the Qode mix', percent: -14.70, note: 'The Qode blend would have finished ₹5,44,000 higher on the same starting value.', verdict: 'review' },
      { label: 'Concentration', percent: 11.5, note: 'Reliance Industries alone is 11.5% of your portfolio.', verdict: 'review' },
    ],
  },

  // "Where the gap is" — Benchmark Gap + Alpha Potential = Total Wealth Gap,
  // all three legs computed from the same starting amount, matching
  // from-analysis.ts's WealthGap exactly.
  gap: {
    amount: 3_685_000,
    you: { label: 'You', value: 4_206_900, percent: 14.18 },
    benchmark: { label: 'NIFTY 500', value: 3_614_900, percent: -1.93 },
    qode: { label: 'Your Qode Mix', value: 4_749_300, percent: 28.88 },
    benchmarkGap: -592_000,
    alphaPotential: 1_134_400,
    totalWealthGap: 542_400,
    from: '7 Sept 2025',
    to: '7 Sept 2026',
  },

  // Your money, split the way it sits today — large cap mapped to Qode All
  // Weather, mid to Qode Tactical Fund, small to Qode Growth Fund, matching
  // Performance.tsx's "yourBlend" derivation from the capMix donut.
  mixBlend: [
    { code: 'QAW', name: 'Qode All Weather', percent: 67.4, role: 'The core. Built to hold up across market conditions rather than to win any one of them.', color: '#008455' },
    { code: 'QTF', name: 'Qode Tactical Fund', percent: 15.3, role: "The tactical sleeve, moving with the market's own signal rather than sitting still.", color: '#550E0E' },
    { code: 'QGF', name: 'Qode Growth Fund', percent: 17.3, role: 'The growth sleeve, in smaller companies — more return on offer, and more of a ride.', color: '#0A3452' },
  ],

  xray: {
    funds: [
      {
        id: 'f1',
        name: 'Parag Parikh Flexi Cap Fund',
        mandate: 'Flexi Cap Fund',
        mandateBand: null,
        value: 612_400,
        exposure: [
          { band: 'large', percent: 55.6 },
          { band: 'mid', percent: 21.3 },
          { band: 'small', percent: 8.1 },
          { band: 'unclassified', percent: 15.0 },
        ],
        outsideMandatePercent: null,
        badge: 'green',
        headline: 'Broad, flexi-cap mandate — no drift to flag.',
        detail: 'A flexi cap fund can hold any market cap by design, so there is no fixed band to drift from.',
        culprits: [],
        holdings: [
          { name: 'HDFC Bank', percent: 8.9, band: 'large', sector: 'Financials' },
          { name: 'Bajaj Holdings', percent: 6.7, band: 'large', sector: 'Financials' },
          { name: 'Coal India', percent: 5.4, band: 'large', sector: 'Energy' },
          { name: 'ITC', percent: 4.8, band: 'large', sector: 'FMCG' },
          { name: 'Alphabet Inc (US)', percent: 4.1, band: 'unclassified', sector: 'Technology' },
        ],
        asOf: '2026-08-31',
      },
      {
        id: 'f2',
        name: 'Mirae Asset Midcap Fund',
        mandate: 'Mid Cap Fund',
        mandateBand: 'mid',
        value: 398_100,
        exposure: [
          { band: 'mid', percent: 74.2 },
          { band: 'large', percent: 12.4 },
          { band: 'small', percent: 13.4 },
        ],
        outsideMandatePercent: 25.8,
        badge: 'amber',
        headline: 'A quarter of the fund sits outside its stated mid-cap mandate.',
        detail: '25.8% of disclosed holdings are large or small cap rather than mid — not unusual for a mid cap fund, but worth knowing.',
        culprits: ['Trent Ltd (large)', 'Persistent Systems (large)'],
        holdings: [
          { name: 'Persistent Systems', percent: 6.2, band: 'large', sector: 'Technology' },
          { name: 'Coforge', percent: 5.1, band: 'mid', sector: 'Technology' },
          { name: 'Max Healthcare', percent: 4.7, band: 'mid', sector: 'Healthcare' },
        ],
        asOf: '2026-08-31',
      },
      {
        id: 'f3',
        name: 'Quant Small Cap Fund',
        mandate: 'Small Cap Fund',
        mandateBand: 'small',
        value: 298_600,
        exposure: [
          { band: 'small', percent: 68.9 },
          { band: 'mid', percent: 24.3 },
          { band: 'large', percent: 6.8 },
        ],
        outsideMandatePercent: 31.1,
        badge: 'amber',
        headline: 'Nearly a third of the fund sits above small cap.',
        detail: '31.1% of disclosed holdings are mid or large cap, above what the fund name alone would suggest.',
        culprits: ['IRB Infrastructure (mid)'],
        holdings: [
          { name: 'IRB Infrastructure', percent: 4.9, band: 'mid', sector: 'Infrastructure' },
          { name: 'Reliance Power', percent: 3.8, band: 'small', sector: 'Energy' },
        ],
        asOf: '2026-08-31',
      },
    ],
    fundsHeld: 5,
    fundsResolved: 3,
  },

  reports: {
    sebiReg: 'INH000000000',
    contact: { email: 'invest@qodeinvest.com', phone: '+91 22 4972 6800' },
  },

  riskProfile: {
    underFiveCr: [
      { code: 'QAW', title: 'Qode All Weather', description: 'The core — steady across market conditions.', percent: 62 },
      { code: 'QGF', title: 'Qode Growth Fund', description: 'The growth sleeve, in smaller companies.', percent: 38 },
    ],
    fiveCrPlus: [
      { code: 'QAW', title: 'Qode All Weather', description: 'The core — steady across market conditions.', percent: 50 },
      { code: 'QTF', title: 'Qode Tactical Fund', description: "The tactical sleeve, moving with the market's own signal.", percent: 20 },
      { code: 'QGF', title: 'Qode Growth Fund', description: 'The growth sleeve, in smaller companies.', percent: 30 },
    ],
  },

  profile: {
    name: 'Aarav Mehta',
    phone: '9324042685',
    custId: '9324042685@finvu',
    panMasked: 'XXXXX4821F',
    email: 'aarav.mehta@example.com',
    memberSince: '2025-11-12',
    holdingsCount: 14,
    bankAccountCount: 1,
    analysisAt: '2026-09-07',
    riskProfileAt: '2026-06-02',
    sources: [
      { label: 'Zerodha', kind: 'Demat', count: 5, lastSeen: '2026-09-07' },
      { label: 'Groww', kind: 'Demat', count: 2, lastSeen: '2026-09-07' },
      { label: 'CAMS', kind: 'Mutual fund RTA', count: 4, lastSeen: '2026-09-04' },
      { label: 'KFin Technologies', kind: 'Mutual fund RTA', count: 1, lastSeen: '2026-09-04' },
      { label: 'HDFC Bank', kind: 'Bank', count: 1, lastSeen: '2026-09-06' },
    ],
  },
};
