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
