/**
 * Quant math primitives — versi browser dari script Python kita.
 * Includes: market data fetching, log returns, volatility, EMA, RSI, GBM, signals, integral verification.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type Kline = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type FundingRate = {
  time: number;
  symbol: string;
  rate: number;
};

export type OpenInterest = {
  time: number;
  oi: number;
};

export type Signal = {
  day: number;
  type: "BUY" | "SELL" | "NEUTRAL";
  reason: string;
};

// ─── API Endpoints ───────────────────────────────────────────────────────────

const SPOT_API = "https://api.binance.com/api/v3";
const FUTURES_API = "https://fapi.binance.com/fapi/v1";

// ─── Market Data ─────────────────────────────────────────────────────────────

/** Ambil candle harian dari Binance Spot (OHLCV). */
export async function fetchKlines(
  symbol = "BTCUSDT",
  interval = "1d",
  limit = 180
): Promise<Kline[]> {
  const url = `${SPOT_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance Spot API error: ${res.status}`);
  const raw = (await res.json()) as unknown[][];
  return raw.map((row) => ({
    time: row[0] as number,
    open: parseFloat(row[1] as string),
    high: parseFloat(row[2] as string),
    low: parseFloat(row[3] as string),
    close: parseFloat(row[4] as string),
    volume: parseFloat(row[5] as string),
  }));
}

/** Ambil funding rate history dari Binance Futures. */
export async function fetchFundingRate(
  symbol = "BTCUSDT",
  limit = 100
): Promise<FundingRate[]> {
  const url = `${FUTURES_API}/fundingRate?symbol=${symbol}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance Futures API error: ${res.status}`);
  const raw = (await res.json()) as { fundingTime: number; symbol: string; fundingRate: string }[];
  return raw.map((r) => ({
    time: r.fundingTime,
    symbol: r.symbol,
    rate: parseFloat(r.fundingRate),
  }));
}

/** Ambil Open Interest history dari Binance Futures. */
export async function fetchOpenInterest(
  symbol = "BTCUSDT",
  period = "1d",
  limit = 90
): Promise<OpenInterest[]> {
  const url = `${FUTURES_API}/openInterest/hist?symbol=${symbol}&period=${period}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance OI API error: ${res.status}`);
  const raw = (await res.json()) as { timestamp: number; sumOpenInterest: string }[];
  return raw.map((r) => ({
    time: r.timestamp,
    oi: parseFloat(r.sumOpenInterest),
  }));
}

// ─── Calculations ────────────────────────────────────────────────────────────

/** Log returns: r_t = ln(P_t / P_{t-1}). */
export function logReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    out.push(Math.log(prices[i] / prices[i - 1]));
  }
  return out;
}

/** Standar deviasi sample. */
export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance =
    xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Volatilitas tahunan (crypto = 365 hari). */
export function annualizedVolatility(
  returns: number[],
  periodsPerYear = 365
): number {
  return stdev(returns) * Math.sqrt(periodsPerYear);
}

/** Simple Moving Average (kept for backward compat). */
export function sma(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  return result;
}

/** Exponential Moving Average. */
export function ema(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      // seed with SMA for the first value
      const slice = prices.slice(0, period);
      const seed = slice.reduce((a, b) => a + b, 0) / period;
      result.push(seed);
    } else {
      const prev = result[i - 1];
      if (prev === null) {
        result.push(null);
      } else {
        result.push((prices[i] - prev) * multiplier + prev);
      }
    }
  }
  return result;
}

/**
 * RSI (Relative Strength Index) — 14-period default.
 * Returns array same length as prices (first `period` entries are null).
 */
export function rsi(prices: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = [];

  if (prices.length < period + 1) {
    return prices.map(() => null);
  }

  // Calculate gains and losses
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // First value uses SMA of gains/losses
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Fill nulls for insufficient data
  for (let i = 0; i <= period; i++) {
    result.push(null);
  }

  // First RSI value
  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + firstRS));

  // Subsequent values use smoothed averages
  for (let i = period + 1; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

/** Generate trading signals based on EMA25/EMA120 crossover + RSI confirmation. */
export function generateSignals(
  prices: number[],
  shortPeriod = 25,
  longPeriod = 120
): Signal[] {
  const shortEMA = ema(prices, shortPeriod);
  const longEMA = ema(prices, longPeriod);
  const rsiValues = rsi(prices, 14);
  const rets = logReturns(prices);
  const signals: Signal[] = [];

  for (let i = 1; i < prices.length; i++) {
    const s = shortEMA[i];
    const l = longEMA[i];
    const sPrev = shortEMA[i - 1];
    const lPrev = longEMA[i - 1];
    const currentRSI = rsiValues[i];

    if (s === null || l === null || sPrev === null || lPrev === null) {
      signals.push({ day: i, type: "NEUTRAL", reason: "Insufficient data" });
      continue;
    }

    // EMA crossover with RSI confirmation
    if (sPrev <= lPrev && s > l) {
      const rsiNote = currentRSI !== null ? ` (RSI: ${currentRSI.toFixed(0)})` : "";
      if (currentRSI !== null && currentRSI > 70) {
        signals.push({ day: i, type: "NEUTRAL", reason: `EMA25 > EMA120 but RSI overbought${rsiNote}` });
      } else {
        signals.push({ day: i, type: "BUY", reason: `EMA25 crosses above EMA120${rsiNote}` });
      }
    } else if (sPrev >= lPrev && s < l) {
      const rsiNote = currentRSI !== null ? ` (RSI: ${currentRSI.toFixed(0)})` : "";
      if (currentRSI !== null && currentRSI < 30) {
        signals.push({ day: i, type: "NEUTRAL", reason: `EMA25 < EMA120 but RSI oversold${rsiNote}` });
      } else {
        signals.push({ day: i, type: "SELL", reason: `EMA25 crosses below EMA120${rsiNote}` });
      }
    } else {
      // Volatility regime check
      const recentVol = i >= 15 ? stdev(rets.slice(Math.max(0, i - 15), i)) * Math.sqrt(365) : 0;
      if (recentVol > 0.8 && currentRSI !== null && currentRSI > 75) {
        signals.push({ day: i, type: "SELL", reason: `High vol + RSI overbought (${(recentVol * 100).toFixed(0)}% ann, RSI ${currentRSI.toFixed(0)})` });
      } else if (currentRSI !== null && currentRSI < 25) {
        signals.push({ day: i, type: "BUY", reason: `RSI extreme oversold (${currentRSI.toFixed(0)})` });
      } else {
        signals.push({ day: i, type: "NEUTRAL", reason: "" });
      }
    }
  }
  return signals;
}

// ─── Simulation ──────────────────────────────────────────────────────────────

/**
 * Simulasi Geometric Brownian Motion.
 * S_t = S_0 * exp((mu - sigma^2/2)*t + sigma*W_t)
 */
export function simulateGBM(params: {
  s0: number;
  mu: number;
  sigma: number;
  days: number;
  paths: number;
}): number[][] {
  const { s0, mu, sigma, days, paths } = params;
  const dt = 1 / 365;
  const drift = (mu - 0.5 * sigma * sigma) * dt;
  const diffusion = sigma * Math.sqrt(dt);

  const out: number[][] = [];
  for (let p = 0; p < paths; p++) {
    const path = [s0];
    for (let t = 1; t <= days; t++) {
      const z = gaussianRandom();
      const next = path[t - 1] * Math.exp(drift + diffusion * z);
      path.push(next);
    }
    out.push(path);
  }
  return out;
}

/** Box-Muller transform untuk N(0,1). */
function gaussianRandom(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─── Foundation ──────────────────────────────────────────────────────────────

/**
 * Verifikasi numerik integral ganda = ln(2) pakai Simpson's 1/3 Rule (2D).
 * int_0^1 int_0^1 1 / [(1 - xy)(1 + x)(1 + y)] dx dy
 *
 * n HARUS genap (Simpson's rule requirement).
 */
export function verifyDoubleIntegral(n = 100): number {
  // Pastikan n genap
  if (n % 2 !== 0) n += 1;

  const h = 1 / n;
  const f = (x: number, y: number) => {
    const denom = (1 - x * y) * (1 + x) * (1 + y);
    if (Math.abs(denom) < 1e-15) return 0;
    return 1 / denom;
  };

  // Simpson's composite rule weight
  const weight = (i: number, N: number): number => {
    if (i === 0 || i === N) return 1;
    if (i % 2 === 1) return 4;
    return 2;
  };

  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const x = i * h;
    const wx = weight(i, n);
    for (let j = 0; j <= n; j++) {
      const y = j * h;
      const wy = weight(j, n);
      sum += wx * wy * f(x, y);
    }
  }

  return (sum * h * h) / 9;
}


// ─── Forecast (Human-Readable GBM Output) ────────────────────────────────────

/** Forecast horizons in days */
export type Horizon = 7 | 30 | 90;

export type Forecast = {
  horizon: Horizon;
  current: number;
  median: number; // 50th percentile
  p10: number; // bearish scenario
  p90: number; // bullish scenario
  probUp: number; // probability price > current (0-1)
  probUp10pct: number; // probability price > current * 1.10
  probDown10pct: number; // probability price < current * 0.90
  expectedReturn: number; // (median - current) / current
};

/** Pick percentile from a sorted ascending array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(p * (sorted.length - 1)))
  );
  return sorted[idx];
}

/**
 * Run Monte Carlo GBM and compute human-readable forecast statistics
 * for a specific horizon. Use sigma from realized volatility, mu from
 * recent log-return drift annualized. Returns a Forecast describing
 * the distribution of terminal prices.
 */
export function computeForecast(
  prices: number[],
  horizon: Horizon,
  paths = 5000
): Forecast {
  const current = prices.length > 0 ? prices[prices.length - 1] : 0;

  // Empty / degenerate input → return neutral forecast.
  if (prices.length < 2 || current <= 0) {
    return {
      horizon,
      current,
      median: current,
      p10: current,
      p90: current,
      probUp: 0.5,
      probUp10pct: 0,
      probDown10pct: 0,
      expectedReturn: 0,
    };
  }

  const rets = logReturns(prices);

  // Annualised drift from recent (last 60d) mean log return; clamp to
  // a sane range so a noisy lookback can't blow up the cone.
  const lookback = Math.min(60, rets.length);
  const recent = rets.slice(-lookback);
  const meanDaily = recent.reduce((a, b) => a + b, 0) / recent.length;
  const muAnnualRaw = meanDaily * 365;
  const muAnnual = Math.max(-1.5, Math.min(1.5, muAnnualRaw));

  const sigmaAnnual = annualizedVolatility(rets);

  // Run Monte Carlo and collect terminal prices.
  const sims = simulateGBM({
    s0: current,
    mu: muAnnual,
    sigma: sigmaAnnual,
    days: horizon,
    paths,
  });
  const terminals: number[] = sims.map((p) => p[p.length - 1]);
  const sorted = [...terminals].sort((a, b) => a - b);

  const median = percentile(sorted, 0.5);
  const p10 = percentile(sorted, 0.1);
  const p90 = percentile(sorted, 0.9);

  let upCount = 0;
  let up10Count = 0;
  let down10Count = 0;
  for (const t of terminals) {
    if (t > current) upCount++;
    if (t > current * 1.1) up10Count++;
    if (t < current * 0.9) down10Count++;
  }

  return {
    horizon,
    current,
    median,
    p10,
    p90,
    probUp: upCount / terminals.length,
    probUp10pct: up10Count / terminals.length,
    probDown10pct: down10Count / terminals.length,
    expectedReturn: (median - current) / current,
  };
}

// ─── Composite Signal (Human-Readable) ───────────────────────────────────────

export type CompositeReason = {
  factor: string;
  impact: number; // signed contribution to score (centered at 0)
  note: string; // plain Indonesian explanation
};

export type CompositeSignal = {
  score: number; // 0-100, where 50 = neutral, >65 = BUY, <35 = SELL
  action: "BUY" | "HOLD" | "SELL" | "STRONG_BUY" | "STRONG_SELL";
  confidence: number; // 0-100
  reasons: CompositeReason[];
  summary: string; // plain Indonesian explanation
};

/** Map raw composite score (0-100) to action label. */
function actionFromScore(score: number): CompositeSignal["action"] {
  if (score >= 80) return "STRONG_BUY";
  if (score >= 65) return "BUY";
  if (score > 35) return "HOLD";
  if (score > 20) return "SELL";
  return "STRONG_SELL";
}

/**
 * Composite signal combining EMA crossover, RSI, funding rate, and
 * volatility regime into a single 0-100 score with plain-Indonesian
 * reasoning. Designed to be human-readable, not financial advice.
 */
export function computeCompositeSignal(
  prices: number[],
  fundingRate: number | null
): CompositeSignal {
  const reasons: CompositeReason[] = [];

  // Start neutral.
  let score = 50;
  let confidenceContrib = 0;

  // ── EMA25 vs EMA120 (range: -30 .. +30) ─────────────────────────────────
  const ema25Arr = ema(prices, 25);
  const ema120Arr = ema(prices, 120);
  const lastEma25 = ema25Arr[ema25Arr.length - 1];
  const lastEma120 = ema120Arr[ema120Arr.length - 1];

  if (lastEma25 !== null && lastEma120 !== null && lastEma120 > 0) {
    const distancePct = ((lastEma25 - lastEma120) / lastEma120) * 100;
    // Saturate at ±10% distance → ±30 pts.
    const emaImpact = Math.max(-30, Math.min(30, distancePct * 3));
    score += emaImpact;
    confidenceContrib += Math.abs(emaImpact);

    let note: string;
    if (emaImpact > 15) {
      note = `EMA25 ${distancePct.toFixed(1)}% di atas EMA120 → tren naik kuat`;
    } else if (emaImpact > 3) {
      note = `EMA25 sedikit di atas EMA120 (${distancePct.toFixed(1)}%) → tren naik mulai terbentuk`;
    } else if (emaImpact > -3) {
      note = `EMA25 ≈ EMA120 (${distancePct.toFixed(1)}%) → tren mendatar, belum jelas`;
    } else if (emaImpact > -15) {
      note = `EMA25 sedikit di bawah EMA120 (${distancePct.toFixed(1)}%) → tren turun mulai terbentuk`;
    } else {
      note = `EMA25 ${Math.abs(distancePct).toFixed(1)}% di bawah EMA120 → tren turun kuat`;
    }
    reasons.push({
      factor: "EMA25 vs EMA120",
      impact: emaImpact,
      note,
    });
  } else {
    reasons.push({
      factor: "EMA25 vs EMA120",
      impact: 0,
      note: "Data EMA belum cukup → faktor diabaikan",
    });
  }

  // ── RSI (range: -20 .. +20) ─────────────────────────────────────────────
  const rsiArr = rsi(prices, 14);
  const lastRSI = rsiArr[rsiArr.length - 1];

  if (lastRSI !== null) {
    let rsiImpact = 0;
    let note = "";
    if (lastRSI < 30) {
      // Oversold: contrarian bullish
      rsiImpact = ((30 - lastRSI) / 30) * 20; // up to +20
      note = `RSI ${lastRSI.toFixed(0)} → oversold, peluang rebound`;
    } else if (lastRSI > 70) {
      // Overbought: contrarian bearish
      rsiImpact = -(((lastRSI - 70) / 30) * 20); // down to -20
      note = `RSI ${lastRSI.toFixed(0)} → overbought, hati-hati koreksi`;
    } else if (lastRSI < 45) {
      rsiImpact = ((45 - lastRSI) / 15) * 5; // mild bullish lean
      note = `RSI ${lastRSI.toFixed(0)} → momentum melemah, mendekati oversold`;
    } else if (lastRSI > 55) {
      rsiImpact = -(((lastRSI - 55) / 15) * 5);
      note = `RSI ${lastRSI.toFixed(0)} → momentum sehat, belum overbought`;
    } else {
      note = `RSI ${lastRSI.toFixed(0)} → netral, momentum seimbang`;
    }
    rsiImpact = Math.max(-20, Math.min(20, rsiImpact));
    score += rsiImpact;
    confidenceContrib += Math.abs(rsiImpact);
    reasons.push({ factor: "RSI(14)", impact: rsiImpact, note });
  } else {
    reasons.push({
      factor: "RSI(14)",
      impact: 0,
      note: "Data RSI belum cukup → faktor diabaikan",
    });
  }

  // ── Funding Rate (range: -15 .. +15) ────────────────────────────────────
  if (fundingRate !== null && Number.isFinite(fundingRate)) {
    const fundPct = fundingRate * 100; // funding in %
    // Typical neutral band ±0.01%. Beyond ±0.05% is extreme.
    let fundImpact = 0;
    let note = "";
    if (fundPct > 0.05) {
      fundImpact = -Math.min(15, ((fundPct - 0.05) / 0.05) * 15 + 5);
      note = `Funding rate ${fundPct.toFixed(3)}% → posisi long terlalu crowded`;
    } else if (fundPct > 0.02) {
      fundImpact = -((fundPct - 0.02) / 0.03) * 5;
      note = `Funding rate ${fundPct.toFixed(3)}% → bias long, sentimen sedikit panas`;
    } else if (fundPct < -0.05) {
      fundImpact = Math.min(15, ((-fundPct - 0.05) / 0.05) * 15 + 5);
      note = `Funding rate ${fundPct.toFixed(3)}% → short crowded, peluang short squeeze`;
    } else if (fundPct < -0.02) {
      fundImpact = ((-fundPct - 0.02) / 0.03) * 5;
      note = `Funding rate ${fundPct.toFixed(3)}% → bias short, sentimen agak takut`;
    } else {
      note = `Funding rate ${fundPct.toFixed(3)}% → sentimen netral, tidak crowded`;
    }
    fundImpact = Math.max(-15, Math.min(15, fundImpact));
    score += fundImpact;
    confidenceContrib += Math.abs(fundImpact);
    reasons.push({ factor: "Funding rate", impact: fundImpact, note });
  } else {
    reasons.push({
      factor: "Funding rate",
      impact: 0,
      note: "Funding rate tidak tersedia → faktor diabaikan",
    });
  }

  // ── Volatility regime (range: -10 .. +10) ───────────────────────────────
  if (prices.length >= 2) {
    const rets = logReturns(prices);
    const sigma = annualizedVolatility(rets);
    const sigmaPct = sigma * 100;
    let volImpact = 0;
    let note = "";
    if (sigmaPct > 100) {
      volImpact = -10;
      note = `Volatilitas ${sigmaPct.toFixed(0)}% (sangat tinggi) → siap-siap pergerakan ekstrem`;
    } else if (sigmaPct > 70) {
      volImpact = -((sigmaPct - 70) / 30) * 10;
      note = `Volatilitas ${sigmaPct.toFixed(0)}% (tinggi) → siap-siap pergerakan besar`;
    } else if (sigmaPct < 30) {
      volImpact = 5;
      note = `Volatilitas ${sigmaPct.toFixed(0)}% (rendah) → pasar tenang, breakout potensial`;
    } else {
      volImpact = 2;
      note = `Volatilitas ${sigmaPct.toFixed(0)}% (normal) → kondisi pasar standar`;
    }
    volImpact = Math.max(-10, Math.min(10, volImpact));
    score += volImpact;
    confidenceContrib += Math.abs(volImpact) * 0.5;
    reasons.push({ factor: "Volatility regime", impact: volImpact, note });
  }

  // Clamp final score.
  score = Math.max(0, Math.min(100, score));

  const action = actionFromScore(score);

  // Confidence: how strongly factors agreed (max possible = 30+20+15+10*0.5 = 70).
  const confidence = Math.max(
    0,
    Math.min(100, Math.round((confidenceContrib / 70) * 100))
  );

  // Plain-Indonesian summary.
  let summary = "";
  switch (action) {
    case "STRONG_BUY":
      summary =
        "Sinyal bullish kuat: tren naik, momentum sehat, sentimen mendukung. Pertimbangkan akumulasi bertahap dengan position sizing terkontrol.";
      break;
    case "BUY":
      summary =
        "Tren bullish dengan konfirmasi momentum. Pertimbangkan entry dengan position sizing kecil, terutama jika volatilitas elevated.";
      break;
    case "HOLD":
      summary =
        "Sinyal campuran: tren belum jelas atau faktor saling meniadakan. Lebih baik wait & see, hindari posisi agresif.";
      break;
    case "SELL":
      summary =
        "Tren bearish dengan konfirmasi momentum. Kurangi eksposur, atau pertimbangkan hedging. Hindari membeli berdasarkan FOMO.";
      break;
    case "STRONG_SELL":
      summary =
        "Sinyal bearish kuat: tren turun, momentum lemah, sentimen overheated. Disiplin cut-loss dan jaga modal.";
      break;
  }

  return { score, action, confidence, reasons, summary };
}
