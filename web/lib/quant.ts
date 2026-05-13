/**
 * Quant math primitives — versi browser dari script Python kita.
 */

export type Kline = { time: number; close: number };

const BINANCE_API = "https://api.binance.com/api/v3/klines";

/** Ambil candle harian dari Binance public API (no auth, CORS friendly). */
export async function fetchKlines(
  symbol = "BTCUSDT",
  interval = "1d",
  limit = 180
): Promise<Kline[]> {
  const url = `${BINANCE_API}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
  const raw = (await res.json()) as unknown[][];
  // Index 0 = openTime, index 4 = close
  return raw.map((row) => ({
    time: row[0] as number,
    close: parseFloat(row[4] as string),
  }));
}

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
export function annualizedVolatility(returns: number[], periodsPerYear = 365): number {
  return stdev(returns) * Math.sqrt(periodsPerYear);
}

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
  seed?: number;
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

/**
 * Verifikasi numerik integral ganda = ln(2) pakai Simpson 2D.
 * ∫₀¹ ∫₀¹ 1 / [(1 - xy)(1 + x)(1 + y)] dx dy
 */
export function verifyDoubleIntegral(n = 200): number {
  const h = 1 / n;
  const f = (x: number, y: number) =>
    1 / ((1 - x * y) * (1 + x) * (1 + y));

  // Simpson 1/3 weights
  const w = (i: number) => {
    if (i === 0 || i === n) return 1;
    return i % 2 === 0 ? 2 : 4;
  };

  let sum = 0;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      // Hindari titik singular x=y=1
      const x = i === n ? 1 - 1e-9 : i * h;
      const y = j === n ? 1 - 1e-9 : j * h;
      sum += w(i) * w(j) * f(x, y);
    }
  }
  return (sum * h * h) / 9;
}
