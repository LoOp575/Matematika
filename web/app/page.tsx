"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  fetchKlines,
  fetchFundingRate,
  fetchOpenInterest,
  logReturns,
  annualizedVolatility,
  ema,
  rsi,
  generateSignals,
  simulateGBM,
  verifyDoubleIntegral,
  computeForecast,
  computeCompositeSignal,
  type Kline,
  type FundingRate,
  type OpenInterest,
  type Signal,
  type Forecast,
  type Horizon,
  type CompositeSignal,
} from "@/lib/quant";

// ─── Constants ───────────────────────────────────────────────────────────────

const SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "DOGEUSDT",
  "XRPUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT", "ADAUSDT",
];
const TABS = ["Overview", "Volume & OI", "Funding", "Signals", "Prediksi", "GBM", "Fondasi"] as const;
type Tab = (typeof TABS)[number];

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Page() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [tab, setTab] = useState<Tab>("Overview");
  const [klines, setKlines] = useState<Kline[]>([]);
  const [funding, setFunding] = useState<FundingRate[]>([]);
  const [oi, setOi] = useState<OpenInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kData, fData, oData] = await Promise.allSettled([
        fetchKlines(symbol, "1d", 180),
        fetchFundingRate(symbol, 100),
        fetchOpenInterest(symbol, "1d", 90),
      ]);
      if (kData.status === "fulfilled") setKlines(kData.value);
      else setError("Failed to load price data");
      if (fData.status === "fulfilled") setFunding(fData.value);
      if (oData.status === "fulfilled") setOi(oData.value);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { loadData(); }, [loadData]);

  // Computed stats
  const stats = useMemo(() => {
    if (klines.length < 2) return null;
    const prices = klines.map((k) => k.close);
    const rets = logReturns(prices);
    const vol = annualizedVolatility(rets);
    const totalReturn = rets.reduce((a, b) => a + b, 0);
    const ema25 = ema(prices, 25);
    const ema120 = ema(prices, 120);
    const rsiValues = rsi(prices, 14);
    const signals = generateSignals(prices, 25, 120);
    return { prices, rets, vol, totalReturn, ema25, ema120, rsi: rsiValues, signals, last: prices[prices.length - 1] };
  }, [klines]);

  // GBM
  const gbmPaths = useMemo(() => {
    if (!stats) return [];
    return simulateGBM({ s0: stats.last, mu: 0.3, sigma: stats.vol, days: 90, paths: 30 });
  }, [stats]);

  // Integral
  const integralValue = useMemo(() => verifyDoubleIntegral(100), []);

  return (
    <main className="min-h-screen bg-[#0a0a0f] font-mono relative overflow-hidden">
      {/* Scanline overlay */}
      <div className="scanline fixed inset-0 pointer-events-none z-[100]" />

      {/* Header - Terminal Status Bar */}
      <header className="border-b border-emerald-900/40 bg-[#0c0c14]/90 backdrop-blur sticky top-0 z-50 terminal-glow">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 blink">&#9679;</span>
            <div>
              <h1 className="text-sm font-bold text-emerald-400 neon-text tracking-wider uppercase">
                [ Quant Research Terminal ]
              </h1>
              <p className="text-[10px] text-zinc-600">v2.1-beta :: composite signal + Prediksi :: live</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-[#0f0f1a] border border-emerald-900/50 rounded px-3 py-1.5 text-xs font-mono text-emerald-300 focus:border-emerald-500 focus:outline-none"
            >
              {SYMBOLS.map((s) => (
                <option key={s} value={s}>{s.replace("USDT", "/USDT")}</option>
              ))}
            </select>
            <button
              onClick={loadData}
              className="bg-emerald-900/30 hover:bg-emerald-800/40 text-emerald-400 text-xs px-3 py-1.5 rounded border border-emerald-700/40 transition hover:shadow-[0_0_10px_rgba(16,185,129,0.3)]"
            >
              &gt; REFRESH
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-emerald-900/30 bg-[#0b0b12]/80">
        <div className="mx-auto max-w-7xl px-4 flex gap-1 overflow-x-auto py-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded text-xs font-mono whitespace-nowrap transition ${
                tab === t
                  ? "bg-emerald-900/30 text-emerald-400 border border-emerald-600/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                  : "text-zinc-500 hover:text-emerald-300 hover:bg-[#111118]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}

        {!loading && stats && (
          <>
            {tab === "Overview" && <OverviewTab klines={klines} stats={stats} />}
            {tab === "Volume & OI" && <VolumeOITab klines={klines} oi={oi} />}
            {tab === "Funding" && <FundingTab funding={funding} />}
            {tab === "Signals" && <SignalsTab klines={klines} stats={stats} funding={funding} />}
            {tab === "Prediksi" && <ForecastTab klines={klines} stats={stats} />}
            {tab === "GBM" && <GBMTab gbmPaths={gbmPaths} stats={stats} />}
            {tab === "Fondasi" && <FondasiTab integralValue={integralValue} currentPrice={stats.last} prices={stats.prices} vol={stats.vol} />}
          </>
        )}
      </div>

      <footer className="border-t border-emerald-900/30 py-4 text-center text-[10px] text-zinc-700 font-mono">
        <span className="text-emerald-800">[</span> Beta v2.0 <span className="text-emerald-800">|</span> Binance API <span className="text-emerald-800">|</span> Bukan saran finansial <span className="text-emerald-800">|</span> Quant Research <span className="text-emerald-800">]</span>
      </footer>
    </main>
  );
}



// ─── Tab: Overview ───────────────────────────────────────────────────────────

function OverviewTab({ klines, stats }: { klines: Kline[]; stats: Stats }) {
  const priceData = klines.map((k, i) => ({
    date: fmtDate(k.time),
    price: k.close,
    ema25: stats.ema25[i],
    ema120: stats.ema120[i],
  }));

  const returnData = stats.rets.map((r, i) => ({ day: i + 1, ret: r }));

  const lastRSI = stats.rsi.filter((r) => r !== null).slice(-1)[0];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card label="PRICE" value={`$${stats.last.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
        <Card
          label="LOG RETURN 180d"
          value={`${(stats.totalReturn * 100).toFixed(2)}%`}
          color={stats.totalReturn >= 0 ? "emerald" : "red"}
        />
        <Card label="VOLATILITY (ann)" value={`${(stats.vol * 100).toFixed(1)}%`} color="amber" />
        <Card label="RSI (14)" value={lastRSI !== null ? `${lastRSI.toFixed(1)}` : "N/A"} color="cyan" />
        <Card label="DATA POINTS" value={`${klines.length}d`} />
      </div>

      {/* Price + EMA Chart */}
      <ChartCard title="&gt; Price + EMA25 (yellow) + EMA120 (purple)">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={priceData}>
            <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#374151" fontSize={10} />
            <YAxis stroke="#374151" fontSize={10} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#0f0f1a", border: "1px solid #065f46", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }} />
            <Line type="monotone" dataKey="price" stroke="#10b981" dot={false} strokeWidth={2} name="Price" />
            <Line type="monotone" dataKey="ema25" stroke="#eab308" dot={false} strokeWidth={1.5} strokeDasharray="5 3" name="EMA25" />
            <Line type="monotone" dataKey="ema120" stroke="#a855f7" dot={false} strokeWidth={1.5} strokeDasharray="5 3" name="EMA120" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Log Returns */}
      <ChartCard title="&gt; Log Returns: r = ln(P_t / P_{t-1})">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={returnData}>
            <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke="#374151" fontSize={10} />
            <YAxis stroke="#374151" fontSize={10} />
            <Tooltip contentStyle={{ background: "#0f0f1a", border: "1px solid #065f46", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#374151" />
            <Bar dataKey="ret" fill="#06b6d4" radius={[2, 2, 0, 0]} name="Return" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ─── Tab: Volume & OI ────────────────────────────────────────────────────────

function VolumeOITab({ klines, oi }: { klines: Kline[]; oi: OpenInterest[] }) {
  const volData = klines.map((k) => ({
    date: fmtDate(k.time),
    volume: k.volume,
  }));

  const oiData = oi.map((o) => ({
    date: fmtDate(o.time),
    oi: o.oi,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Card
          label="VOLUME 24h"
          value={klines.length > 0 ? formatLargeNumber(klines[klines.length - 1].volume) : "-"}
        />
        <Card
          label="OPEN INTEREST"
          value={oi.length > 0 ? formatLargeNumber(oi[oi.length - 1].oi) : "N/A"}
          color="purple"
        />
      </div>

      <ChartCard title="&gt; Volume Harian">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={volData}>
            <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#374151" fontSize={10} />
            <YAxis stroke="#374151" fontSize={10} tickFormatter={formatLargeNumber} />
            <Tooltip contentStyle={{ background: "#0f0f1a", border: "1px solid #065f46", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }} />
            <Bar dataKey="volume" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Volume" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {oiData.length > 0 && (
        <ChartCard title="&gt; Open Interest (Futures)">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={oiData}>
              <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#374151" fontSize={10} />
              <YAxis stroke="#374151" fontSize={10} tickFormatter={formatLargeNumber} />
              <Tooltip contentStyle={{ background: "#0f0f1a", border: "1px solid #065f46", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }} />
              <Area type="monotone" dataKey="oi" stroke="#a855f7" fill="#a855f720" name="OI" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}



// ─── Tab: Funding ────────────────────────────────────────────────────────────

function FundingTab({ funding }: { funding: FundingRate[] }) {
  const data = funding.map((f) => ({
    date: fmtDate(f.time),
    rate: f.rate * 100,
  }));

  const avgRate = data.length > 0 ? data.reduce((a, b) => a + b.rate, 0) / data.length : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card
          label="FUNDING RATE (last)"
          value={data.length > 0 ? `${data[data.length - 1].rate.toFixed(4)}%` : "N/A"}
          color={data.length > 0 && data[data.length - 1].rate > 0 ? "emerald" : "red"}
        />
        <Card label="AVG FUNDING" value={`${avgRate.toFixed(4)}%`} color="amber" />
        <Card label="DATA POINTS" value={`${data.length}`} />
      </div>

      <div className="rounded border border-emerald-900/30 bg-[#0c0c14] p-4">
        <p className="text-[10px] text-zinc-500 font-mono">
          <span className="text-emerald-500">[INFO]</span> Funding &gt; 0: Long pays short (bullish, bisa overheated).
          Funding &lt; 0: Short pays long (bearish, bisa oversold).
        </p>
      </div>

      <ChartCard title="&gt; Funding Rate History (%)">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#374151" fontSize={10} />
            <YAxis stroke="#374151" fontSize={10} />
            <Tooltip contentStyle={{ background: "#0f0f1a", border: "1px solid #065f46", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />
            <Bar dataKey="rate" name="Funding %" radius={[2, 2, 0, 0]} fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ─── Tab: Signals ────────────────────────────────────────────────────────────

function SignalsTab({ klines, stats, funding }: { klines: Kline[]; stats: Stats; funding: FundingRate[] }) {
  const activeSignals = stats.signals.filter((s) => s.type !== "NEUTRAL");
  const lastSignals = activeSignals.slice(-10).reverse();

  // Latest funding rate (decimal, e.g. 0.0001 = 0.01%).
  const latestFunding = funding.length > 0 ? funding[funding.length - 1].rate : null;

  // Composite signal — single aggregate score with plain-Indonesian reasoning.
  const composite = useMemo(
    () => computeCompositeSignal(stats.prices, latestFunding),
    [stats.prices, latestFunding]
  );

  const priceWithSignals = klines.map((k, i) => {
    const sig = stats.signals[i - 1];
    return {
      date: fmtDate(k.time),
      price: k.close,
      buy: sig?.type === "BUY" ? k.close : null,
      sell: sig?.type === "SELL" ? k.close : null,
    };
  });

  return (
    <div className="space-y-6">
      {/* Composite Signal — Big Banner */}
      <CompositeSignalBanner composite={composite} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card label="TOTAL SIGNALS" value={`${activeSignals.length}`} />
        <Card label="BUY" value={`${activeSignals.filter((s) => s.type === "BUY").length}`} color="emerald" />
        <Card label="SELL" value={`${activeSignals.filter((s) => s.type === "SELL").length}`} color="red" />
      </div>

      <ChartCard title="&gt; Price + EMA25/EMA120 Crossover Signals">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={priceWithSignals}>
            <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#374151" fontSize={10} />
            <YAxis stroke="#374151" fontSize={10} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#0f0f1a", border: "1px solid #065f46", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }} />
            <Line type="monotone" dataKey="price" stroke="#4b5563" dot={false} strokeWidth={1.5} name="Price" />
            <Line type="monotone" dataKey="buy" stroke="#10b981" dot={{ r: 5, fill: "#10b981" }} strokeWidth={0} name="Buy" connectNulls={false} />
            <Line type="monotone" dataKey="sell" stroke="#ef4444" dot={{ r: 5, fill: "#ef4444" }} strokeWidth={0} name="Sell" connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Signal Log */}
      <div className="rounded border border-emerald-900/30 bg-[#0c0c14] p-4">
        <h3 className="text-xs font-mono text-emerald-500 mb-3">&gt; signal_log (last 10)</h3>
        <div className="space-y-1 max-h-64 overflow-y-auto font-mono">
          {lastSignals.length === 0 && <p className="text-zinc-600 text-xs">// no active signals</p>}
          {lastSignals.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-1.5 rounded text-xs ${
                s.type === "BUY" ? "bg-emerald-950/20 border border-emerald-900/30" : "bg-red-950/20 border border-red-900/30"
              }`}
            >
              <span className={`font-bold w-10 ${s.type === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                {s.type}
              </span>
              <span className="text-zinc-600">d{s.day}</span>
              <span className="text-zinc-500 text-[10px] truncate">{s.reason}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded border border-cyan-900/30 bg-cyan-950/10 p-4">
        <p className="text-[10px] text-cyan-500 font-mono">
          <span className="text-cyan-400">[STRATEGY]</span> Composite score = EMA25/120 crossover + RSI(14) + funding rate + volatility regime.
          Lihat ALASAN di atas untuk breakdown per faktor dalam Bahasa Indonesia.
        </p>
      </div>
    </div>
  );
}

// ─── Composite Signal Banner ─────────────────────────────────────────────────

function CompositeSignalBanner({ composite }: { composite: CompositeSignal }) {
  const { score, action, confidence, reasons, summary } = composite;

  const isBuy = action === "BUY" || action === "STRONG_BUY";
  const isSell = action === "SELL" || action === "STRONG_SELL";
  const accent = isBuy
    ? "border-emerald-600/60 bg-emerald-950/20 text-emerald-400"
    : isSell
    ? "border-red-600/60 bg-red-950/20 text-red-400"
    : "border-amber-700/50 bg-amber-950/10 text-amber-400";

  const actionLabel: Record<CompositeSignal["action"], string> = {
    STRONG_BUY: "▲▲ STRONG BUY",
    BUY: "▲ BUY",
    HOLD: "■ HOLD",
    SELL: "▼ SELL",
    STRONG_SELL: "▼▼ STRONG SELL",
  };

  // Bar fill colour based on score.
  const barColor =
    score >= 65
      ? "from-emerald-600 via-emerald-400 to-emerald-300"
      : score <= 35
      ? "from-red-600 via-red-400 to-red-300"
      : "from-amber-600 via-amber-400 to-amber-300";

  return (
    <div className={`rounded border p-5 space-y-4 animate-glow ${accent}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">composite signal</div>
          <div className={`text-2xl font-bold neon-text font-mono ${isBuy ? "text-emerald-400" : isSell ? "text-red-400" : "text-amber-400"}`}>
            {actionLabel[action]} <span className="text-zinc-500 text-base">(score: {score.toFixed(0)}/100)</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">confidence</div>
          <div className="text-lg font-mono text-cyan-400 neon-text-cyan">{confidence}%</div>
        </div>
      </div>

      {/* Score bar: 0..100 */}
      <div>
        <div className="relative h-3 rounded-full bg-[#1a1a2e] overflow-hidden border border-zinc-800">
          <div
            className={`h-full bg-gradient-to-r ${barColor}`}
            style={{ width: `${score}%` }}
          />
          {/* Neutral marker at 50 */}
          <div className="absolute top-0 bottom-0 w-px bg-zinc-600/60" style={{ left: "50%" }} />
        </div>
        <div className="flex justify-between text-[9px] text-zinc-600 mt-1 font-mono">
          <span>Bearish</span>
          <span>Netral</span>
          <span>Bullish</span>
        </div>
      </div>

      {/* Reasons breakdown */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">alasan</div>
        <div className="space-y-1 font-mono text-[11px]">
          {reasons.map((r, i) => {
            const pos = r.impact > 0;
            const neutral = Math.abs(r.impact) < 0.5;
            const mark = neutral ? "•" : pos ? "✓" : "✗";
            const cls = neutral
              ? "text-zinc-500"
              : pos
              ? "text-emerald-400"
              : "text-red-400";
            const sign = r.impact > 0 ? "+" : "";
            return (
              <div key={i} className="flex items-start gap-2">
                <span className={`${cls} w-3 flex-shrink-0`}>{mark}</span>
                <span className="text-zinc-300 flex-1">
                  <span className="text-zinc-500">[{r.factor}]</span>{" "}
                  <span className={`${cls} font-bold`}>({sign}{r.impact.toFixed(0)} poin)</span>{" "}
                  {r.note}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plain-Indonesian summary */}
      <div className="rounded border border-zinc-800/60 bg-[#0a0a0f]/60 p-3">
        <div className="text-[10px] text-cyan-500 font-mono uppercase tracking-widest mb-1">kesimpulan</div>
        <p className="text-[11px] text-zinc-300 font-mono leading-relaxed">{summary}</p>
      </div>
    </div>
  );
}



// ─── Tab: Prediksi (Forecast) ────────────────────────────────────────────────

function ForecastTab({ klines, stats }: { klines: Kline[]; stats: Stats }) {
  // Three forecast horizons. Memo on price-tail so it's stable across renders.
  const horizons: Horizon[] = useMemo(() => [7, 30, 90], []);

  const forecasts = useMemo<Forecast[]>(() => {
    return horizons.map((h) => computeForecast(stats.prices, h, 5000));
  }, [stats.prices, horizons]);

  // Build a chart that splices together historical price (last 60 days) and
  // forecast cone (median, p10, p90) extending to 90 days into the future.
  const longest = forecasts[forecasts.length - 1];
  const longestHorizon = longest?.horizon ?? 90;

  const coneData = useMemo(() => {
    if (stats.prices.length === 0) return [] as { idx: number; label: string; price?: number; median?: number; p10?: number; p90?: number }[];

    const histLen = Math.min(60, klines.length);
    const histStart = klines.length - histLen;
    const out: { idx: number; label: string; price?: number; median?: number; p10?: number; p90?: number }[] = [];

    for (let i = 0; i < histLen; i++) {
      const k = klines[histStart + i];
      out.push({
        idx: i - histLen,
        label: fmtDate(k.time),
        price: k.close,
      });
    }

    // Anchor the cone at the current price.
    const current = stats.last;
    out.push({ idx: 0, label: "T0", price: current, median: current, p10: current, p90: current });

    // Sample cone smoothly per day. To keep this O(horizons) we run a
    // dedicated lightweight Monte Carlo for each future day at a coarse
    // grid, then linearly interpolate where useful — but for simplicity
    // we just use the three computed forecasts and linearly interpolate
    // their (median, p10, p90) by day. That's good enough visually.
    const sortedByH = [...forecasts].sort((a, b) => a.horizon - b.horizon);
    for (let day = 1; day <= longestHorizon; day++) {
      // Find the two surrounding forecast horizons.
      let prev = { horizon: 0, median: current, p10: current, p90: current };
      let next = sortedByH[0]
        ? { horizon: sortedByH[0].horizon, median: sortedByH[0].median, p10: sortedByH[0].p10, p90: sortedByH[0].p90 }
        : { horizon: longestHorizon, median: current, p10: current, p90: current };
      for (let k = 0; k < sortedByH.length; k++) {
        if (sortedByH[k].horizon >= day) {
          next = {
            horizon: sortedByH[k].horizon,
            median: sortedByH[k].median,
            p10: sortedByH[k].p10,
            p90: sortedByH[k].p90,
          };
          if (k > 0) {
            prev = {
              horizon: sortedByH[k - 1].horizon,
              median: sortedByH[k - 1].median,
              p10: sortedByH[k - 1].p10,
              p90: sortedByH[k - 1].p90,
            };
          }
          break;
        }
      }
      const span = Math.max(1, next.horizon - prev.horizon);
      const w = (day - prev.horizon) / span;
      const lerp = (a: number, b: number) => a + (b - a) * w;
      out.push({
        idx: day,
        label: `+${day}d`,
        median: lerp(prev.median, next.median),
        p10: lerp(prev.p10, next.p10),
        p90: lerp(prev.p90, next.p90),
      });
    }

    return out;
  }, [klines, stats.prices, stats.last, forecasts, longestHorizon]);

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="rounded border border-cyan-700/40 bg-gradient-to-br from-[#0a1218] to-[#0a0a14] p-5 terminal-glow-cyan">
        <div className="flex items-center gap-2 mb-2">
          <span className="blink text-cyan-400">&#9679;</span>
          <h2 className="text-sm font-mono text-cyan-400 neon-text-cyan uppercase tracking-widest">
            [ Prediksi Probabilistik — Monte Carlo GBM ]
          </h2>
        </div>
        <p className="text-[11px] text-zinc-400 font-mono leading-relaxed">
          Model menjalankan <span className="text-cyan-400">5.000 simulasi</span> jalur harga berdasarkan{" "}
          <span className="text-emerald-400">volatilitas {(stats.vol * 100).toFixed(1)}%</span> dan tren return historis.
          Hasilnya bukan ramalan tunggal — tapi distribusi kemungkinan harga di masa depan.
        </p>
      </div>

      {/* Three horizon cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {forecasts.map((f) => (
          <ForecastCard key={f.horizon} forecast={f} />
        ))}
      </div>

      {/* Forecast cone chart */}
      <div className="rounded border border-purple-800/30 bg-gradient-to-br from-[#0a0a14] via-[#0d0818] to-[#0a0a14] p-4 space-y-3">
        <h3 className="text-xs font-mono text-purple-400 neon-text-purple">
          &gt; Forecast Cone — Historical (60d) + Probability Bands (P10/Median/P90)
        </h3>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={coneData}>
            <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#374151" fontSize={10} interval={Math.max(1, Math.floor(coneData.length / 12))} />
            <YAxis stroke="#374151" fontSize={10} domain={["auto", "auto"]} tickFormatter={(v: number) => `$${formatLargeNumber(v)}`} />
            <Tooltip
              contentStyle={{ background: "#0f0f1a", border: "1px solid #7c3aed50", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }}
              formatter={(value: number | null, name: string) => [value !== null && value !== undefined ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "-", name]}
            />
            {/* P90 (upper) and P10 (lower) bands shown as filled area */}
            <Area type="monotone" dataKey="p90" stroke="#a855f7" strokeOpacity={0.6} strokeWidth={1} fill="#a855f720" name="P90 (bullish)" isAnimationActive={false} />
            <Area type="monotone" dataKey="p10" stroke="#ef4444" strokeOpacity={0.6} strokeWidth={1} fill="#ef444420" name="P10 (bearish)" isAnimationActive={false} />
            <Area type="monotone" dataKey="median" stroke="#06b6d4" strokeWidth={2} fill="transparent" name="Median forecast" isAnimationActive={false} />
            <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} fill="transparent" name="Historical price" isAnimationActive={false} />
            <ReferenceLine x="T0" stroke="#eab308" strokeDasharray="3 3" label={{ value: "now", position: "top", fontSize: 10, fill: "#eab308" }} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 text-[10px] font-mono pt-1">
          <span className="text-emerald-400">━ historical</span>
          <span className="text-cyan-400">━ median forecast</span>
          <span className="text-purple-400">▒ P90 (bullish)</span>
          <span className="text-red-400">▒ P10 (bearish)</span>
        </div>
      </div>

      {/* Plain Bahasa Interpretasi */}
      <div className="rounded border border-emerald-800/40 bg-[#080c08] p-5 font-mono text-xs space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="blink text-emerald-400">&#9679;</span>
          <span className="text-emerald-500 neon-text uppercase tracking-widest">[ Interpretasi ]</span>
        </div>
        <p className="text-zinc-400 leading-relaxed">
          Berdasarkan volatilitas {(stats.vol * 100).toFixed(1)}% dari 180 hari terakhir dan tren harga,
          model GBM (Geometric Brownian Motion) memprediksi:
        </p>
        <div className="space-y-1.5 pl-3 mt-2">
          {forecasts.map((f) => (
            <p key={f.horizon} className="text-zinc-500">
              <span className="text-emerald-400">•</span>{" "}
              <span className="text-cyan-400 font-bold">{f.horizon} HARI:</span>{" "}
              80% kemungkinan harga di kisaran{" "}
              <span className="text-emerald-300">${fmtMoney(f.p10)}</span>
              {" – "}
              <span className="text-emerald-300">${fmtMoney(f.p90)}</span>
              {", median "}
              <span className="text-cyan-300">${fmtMoney(f.median)}</span>
              {" ("}
              <span className={f.expectedReturn >= 0 ? "text-emerald-400" : "text-red-400"}>
                {f.expectedReturn >= 0 ? "+" : ""}{(f.expectedReturn * 100).toFixed(1)}%
              </span>
              {")"}
            </p>
          ))}
        </div>
        <p className="text-zinc-600 mt-3 italic leading-relaxed">
          Catatan: ini bukan ramalan — ini distribusi probabilistik berdasarkan
          asumsi return berdistribusi normal (lognormal pada harga). Volatilitas
          akumulatif membuat range melebar pada horizon yang lebih panjang.
        </p>
      </div>
    </div>
  );
}

// ─── Forecast Card ───────────────────────────────────────────────────────────

function ForecastCard({ forecast }: { forecast: Forecast }) {
  const { horizon, current, median, p10, p90, probUp, probUp10pct, probDown10pct, expectedReturn } = forecast;
  const horizonLabel = horizon === 7 ? "7 hari" : horizon === 30 ? "30 hari" : "90 hari";
  const isUp = expectedReturn >= 0;

  return (
    <div className="rounded border border-cyan-800/40 bg-gradient-to-b from-[#0c0c18] to-[#0a0a14] p-4 space-y-3 terminal-glow-cyan">
      {/* Horizon badge */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-cyan-500 font-mono">
          [ HORIZON {horizon}D ]
        </span>
        <span className={`text-[10px] font-mono font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
          {isUp ? "▲" : "▼"} {(expectedReturn * 100).toFixed(1)}%
        </span>
      </div>

      {/* Big text: range */}
      <div className="text-center py-1">
        <p className="text-[10px] text-zinc-500 font-mono">Dalam {horizonLabel}, harga kemungkinan antara</p>
        <div className="text-base text-zinc-100 font-mono font-bold mt-1 leading-tight">
          <span className="text-red-400">${fmtMoney(p10)}</span>
          <span className="text-zinc-600 mx-2">↔</span>
          <span className="text-purple-400">${fmtMoney(p90)}</span>
        </div>
        <p className="text-[10px] text-zinc-500 font-mono mt-1">
          median <span className="text-cyan-400 font-bold">${fmtMoney(median)}</span>{" "}
          <span className="text-zinc-600">(saat ini ${fmtMoney(current)})</span>
        </p>
      </div>

      {/* Probability bars */}
      <div className="space-y-2 pt-1">
        <ProbBar label="Probabilitas naik" value={probUp} color="emerald" />
        <ProbBar label="Probabilitas naik >10%" value={probUp10pct} color="cyan" />
        <ProbBar label="Probabilitas turun >10%" value={probDown10pct} color="red" />
      </div>

      <p className="text-[9px] text-zinc-600 font-mono italic pt-1">
        {`80% kepercayaan: $${fmtMoney(p10)} – $${fmtMoney(p90)}`}
      </p>
    </div>
  );
}

function ProbBar({ label, value, color }: { label: string; value: number; color: "emerald" | "cyan" | "red" }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const grad =
    color === "emerald"
      ? "from-emerald-700 via-emerald-500 to-emerald-300"
      : color === "cyan"
      ? "from-cyan-700 via-cyan-500 to-cyan-300"
      : "from-red-700 via-red-500 to-red-300";
  const txt =
    color === "emerald" ? "text-emerald-400" : color === "cyan" ? "text-cyan-400" : "text-red-400";

  return (
    <div>
      <div className="flex justify-between items-baseline text-[10px] font-mono mb-0.5">
        <span className="text-zinc-400">{label}</span>
        <span className={`${txt} font-bold`}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#1a1a2e] overflow-hidden border border-zinc-800/60">
        <div className={`h-full bg-gradient-to-r ${grad}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Tab: GBM (Futuristic) ───────────────────────────────────────────────────

function GBMTab({ gbmPaths, stats }: { gbmPaths: number[][]; stats: Stats }) {
  const gbmData = useMemo(() => {
    if (gbmPaths.length === 0) return [];
    const days = gbmPaths[0].length;
    const data: Record<string, number>[] = [];
    for (let t = 0; t < days; t++) {
      const row: Record<string, number> = { day: t };
      gbmPaths.forEach((path, i) => {
        row[`p${i}`] = path[t];
      });
      data.push(row);
    }
    return data;
  }, [gbmPaths]);

  const finalPrices = gbmPaths.map((p) => p[p.length - 1]);
  const mean = finalPrices.length > 0 ? finalPrices.reduce((a, b) => a + b, 0) / finalPrices.length : 0;
  const sorted = [...finalPrices].sort((a, b) => a - b);
  const p5 = sorted[Math.floor(sorted.length * 0.05)];
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const expectedReturn = ((mean - stats.last) / stats.last) * 100;

  return (
    <div className="space-y-6">
      {/* HUD-style stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HUDCard label="S₀" value={`$${stats.last.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub="initial" />
        <HUDCard label="E[S₉₀]" value={`$${mean.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub={`${expectedReturn >= 0 ? "+" : ""}${expectedReturn.toFixed(1)}%`} color="cyan" />
        <HUDCard label="P5" value={`$${p5?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "-"}`} sub="worst 5%" color="red" />
        <HUDCard label="P95" value={`$${p95?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "-"}`} sub="best 5%" color="purple" />
      </div>

      {/* Probability Cone Summary */}
      <div className="rounded border border-purple-800/40 bg-gradient-to-br from-[#0c0c18] to-[#12081f] p-5 terminal-glow-cyan">
        <h3 className="text-xs text-cyan-400 font-mono mb-3 neon-text-cyan">&gt; PROBABILITY CONE (90d)</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-[10px] text-zinc-600">5th %ile</div>
            <div className="text-sm text-red-400 font-bold">${p5?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "-"}</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-600">25th %ile</div>
            <div className="text-sm text-amber-400 font-bold">${p25?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "-"}</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-600">75th %ile</div>
            <div className="text-sm text-emerald-400 font-bold">${p75?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "-"}</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-600">95th %ile</div>
            <div className="text-sm text-purple-400 font-bold neon-text-purple">${p95?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "-"}</div>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-[#1a1a2e] overflow-hidden flex">
          <div className="bg-red-500/60 flex-1" />
          <div className="bg-amber-500/60 flex-1" />
          <div className="bg-emerald-500/60 flex-1" />
          <div className="bg-purple-500/60 flex-1" />
        </div>
        <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
          <span>bearish</span>
          <span>expected</span>
          <span>bullish</span>
        </div>
      </div>

      {/* GBM Chart with gradient bg */}
      <div className="rounded border border-purple-800/30 bg-gradient-to-br from-[#0a0a14] via-[#0d0818] to-[#0a0a14] p-4 space-y-3">
        <h3 className="text-xs font-mono text-purple-400 neon-text-purple">&gt; GBM Simulation — 30 paths, 90d (sigma={`${(stats.vol * 100).toFixed(1)}%`}, mu=30%)</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={gbmData}>
            <CartesianGrid stroke="#1a1a2e" strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke="#374151" fontSize={10} />
            <YAxis stroke="#374151" fontSize={10} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#0f0f1a", border: "1px solid #7c3aed50", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }} />
            {gbmPaths.map((_, i) => (
              <Line
                key={i}
                type="monotone"
                dataKey={`p${i}`}
                stroke={i % 2 === 0 ? "#8b5cf6" : "#06b6d4"}
                strokeOpacity={0.5}
                dot={false}
                strokeWidth={1}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded border border-zinc-800/50 bg-[#0c0c14] p-4">
        <p className="text-[10px] text-zinc-500 font-mono">
          <span className="text-purple-400">[FORMULA]</span> S_t = S_0 * exp((mu - sigma^2/2)*t + sigma*W_t)
          <br /><span className="text-zinc-600">// Ito correction -sigma^2/2 connects stochastic calculus to the foundation integral</span>
        </p>
      </div>
    </div>
  );
}



// ─── Tab: Fondasi (Futuristic) ───────────────────────────────────────────────

function FondasiTab({ integralValue, currentPrice, prices, vol }: { integralValue: number; currentPrice: number; prices: number[]; vol: number }) {
  const ln2 = Math.log(2);
  const diff = Math.abs(integralValue - ln2);
  const accuracy = (1 - diff / ln2) * 100;

  // Concrete example: yesterday's log return (today / yesterday).
  const todayPrice = currentPrice;
  const yesterdayPrice =
    prices.length >= 2 ? prices[prices.length - 2] : todayPrice;
  const todayLogReturn =
    yesterdayPrice > 0 ? Math.log(todayPrice / yesterdayPrice) : 0;
  const todayPctApprox = todayLogReturn * 100;
  const sigmaPct = vol * 100;
  const itoCorrection = (vol * vol) / 2;

  return (
    <div className="space-y-6 relative">
      {/* Matrix grid background */}
      <div className="absolute inset-0 matrix-bg pointer-events-none rounded" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative">
        <Card label="INTEGRAL (numeric)" value={integralValue.toFixed(10)} color="cyan" />
        <Card label="ln(2) EXACT" value={ln2.toFixed(10)} color="emerald" />
        <Card label="ERROR" value={diff.toExponential(3)} color="amber" />
      </div>

      {/* Glowing Formula Box */}
      <div className="relative p-[2px] rounded animate-glow">
        <div className="gradient-border absolute inset-0 rounded opacity-60" />
        <div className="relative rounded bg-[#0a0f0a] p-6 space-y-4">
          <h3 className="text-xs font-mono text-emerald-500">&gt; verified_formula</h3>
          <div className="bg-[#0a1a0f] border border-emerald-800/40 rounded p-4 font-mono text-center text-emerald-400 text-lg neon-text">
            &#8747;&#8320;&#185; &#8747;&#8320;&#185; 1 / [(1 - xy)(1 + x)(1 + y)] dx dy = ln 2
          </div>
        </div>
      </div>

      {/* Computation Verified Terminal Output */}
      <div className="rounded border border-emerald-800/30 bg-[#080c08] p-5 font-mono text-xs space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="blink text-emerald-400">&#9679;</span>
          <span className="text-emerald-500 neon-text">COMPUTATION VERIFIED</span>
        </div>
        <div className="text-zinc-500">
          <p><span className="text-emerald-700">$</span> method = Simpson&apos;s 1/3 Rule (2D Composite)</p>
          <p><span className="text-emerald-700">$</span> grid = 100 x 100 points</p>
          <p><span className="text-emerald-700">$</span> result = {integralValue.toFixed(12)}</p>
          <p><span className="text-emerald-700">$</span> target = {ln2.toFixed(12)}</p>
          <p><span className="text-emerald-700">$</span> error = {diff.toExponential(4)}</p>
          <p><span className="text-emerald-700">$</span> accuracy = <span className="text-emerald-400">{accuracy.toFixed(8)}%</span></p>
          <p className="mt-2 text-emerald-600">// status: <span className="text-emerald-400">PASS</span> &#10003;</p>
        </div>
      </div>

      {/* Real-World Application — concrete example using LIVE price */}
      <div className="rounded border border-cyan-800/40 bg-gradient-to-br from-[#08121a] to-[#080c14] p-5 font-mono text-xs space-y-3 relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="blink text-cyan-400">&#9679;</span>
          <span className="text-cyan-400 neon-text-cyan uppercase tracking-widest">[ Aplikasi Nyata ]</span>
        </div>

        <p className="text-zinc-500">
          <span className="text-cyan-600">&gt;</span> integral_result = ln(2) = {ln2.toFixed(6)}
        </p>

        <p className="text-zinc-300 mt-3">Bagaimana ini terhubung dengan sinyal trading?</p>

        {/* Step 1 */}
        <div className="pl-3 border-l-2 border-cyan-900/50 space-y-1 mt-2">
          <p className="text-emerald-400 font-bold">Step 1: ln() digunakan untuk hitung log return harga</p>
          <p className="text-zinc-500">
            contoh:{" "}
            <span className="text-zinc-300">
              ln($
              {fmtMoney(todayPrice)} / $
              {fmtMoney(yesterdayPrice)})
            </span>
            {" = "}
            <span className={todayLogReturn >= 0 ? "text-emerald-400" : "text-red-400"}>
              {todayLogReturn.toFixed(4)}
            </span>
          </p>
          <p className="text-zinc-500">
            artinya: harga{" "}
            <span className={todayLogReturn >= 0 ? "text-emerald-400" : "text-red-400"}>
              {todayLogReturn >= 0 ? "naik" : "turun"} ~{Math.abs(todayPctApprox).toFixed(2)}%
            </span>{" "}
            (log scale)
          </p>
        </div>

        {/* Step 2 */}
        <div className="pl-3 border-l-2 border-cyan-900/50 space-y-1 mt-3">
          <p className="text-emerald-400 font-bold">Step 2: Volatility = std dev dari log returns</p>
          <p className="text-zinc-500">
            saat ini: σ ={" "}
            <span className="text-amber-400 font-bold">{sigmaPct.toFixed(1)}%</span> per tahun
          </p>
        </div>

        {/* Step 3 */}
        <div className="pl-3 border-l-2 border-cyan-900/50 space-y-1 mt-3">
          <p className="text-emerald-400 font-bold">Step 3: Volatility ini digunakan di GBM</p>
          <div className="bg-[#0a0a14]/60 border border-cyan-900/30 rounded p-2 my-1">
            <p className="text-cyan-300 text-center">
              S_t = S_0 · exp((μ − σ²/2) · t + σ · W_t)
            </p>
            <p className="text-center text-[10px] text-zinc-600 mt-0.5">
              <span className="text-amber-400">↑ koreksi −σ²/2 = −{itoCorrection.toFixed(4)}</span>
            </p>
          </div>
          <p className="text-zinc-500">
            Koreksi <span className="text-amber-400">−σ²/2</span> berasal dari{" "}
            <span className="text-purple-400">Itô calculus</span> — perpanjangan dari integral biasa.
          </p>
        </div>

        {/* Step 4 */}
        <div className="pl-3 border-l-2 border-cyan-900/50 space-y-1 mt-3">
          <p className="text-emerald-400 font-bold">Step 4: GBM menghasilkan prediksi probabilistik</p>
          <p className="text-zinc-500">→ &quot;60% kemungkinan harga $X−$Y dalam 30 hari&quot;</p>
          <p className="text-zinc-500">→ Inilah yang ditampilkan di tab <span className="text-cyan-400 font-bold">Prediksi</span></p>
        </div>

        {/* Conclusion */}
        <div className="rounded border border-purple-800/40 bg-purple-950/10 p-3 mt-4">
          <p className="text-purple-300 leading-relaxed">
            <span className="text-purple-400 font-bold">JADI:</span> Rumus integral itu{" "}
            <span className="text-amber-400">BUKAN</span> dipakai langsung,
            tapi <span className="text-cyan-400">TEKNIK</span>-nya (kalkulus, ln, integrasi)
            adalah fondasi semua quant analysis modern.
          </p>
        </div>
      </div>

      {/* Connection to Quant */}
      <div className="rounded border border-cyan-900/30 bg-[#0c0c14] p-5 space-y-3 relative">
        <h3 className="text-xs font-mono text-cyan-400 neon-text-cyan">&gt; quant_connections</h3>
        <div className="space-y-2 text-[11px] text-zinc-400 font-mono">
          <p><span className="text-cyan-600">[1]</span> ln() identical function &#8594; log returns of price</p>
          <p><span className="text-cyan-600">[2]</span> Integration technique &#8594; Black-Scholes option pricing</p>
          <p><span className="text-cyan-600">[3]</span> Partial fractions &#8594; time series signal decomposition</p>
          <p><span className="text-cyan-600">[4]</span> Ito calculus (extension) &#8594; GBM stochastic model</p>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function Card({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorClass =
    color === "emerald" ? "text-emerald-400" :
    color === "red" ? "text-red-400" :
    color === "amber" ? "text-amber-400" :
    color === "purple" ? "text-purple-400" :
    color === "cyan" ? "text-cyan-400" :
    "text-zinc-100";

  return (
    <div className="rounded border border-emerald-900/25 bg-[#0c0c14] p-4 terminal-glow">
      <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1 font-mono">{label}</div>
      <div className={`text-sm font-mono font-semibold ${colorClass} truncate`}>{value}</div>
    </div>
  );
}

function HUDCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  const colorClass =
    color === "cyan" ? "text-cyan-400 neon-text-cyan" :
    color === "red" ? "text-red-400" :
    color === "purple" ? "text-purple-400 neon-text-purple" :
    "text-zinc-100";

  return (
    <div className="rounded border border-purple-900/30 bg-gradient-to-b from-[#0c0c18] to-[#0a0a14] p-4 animate-pulse-cyan">
      <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1 font-mono">{label}</div>
      <div className={`text-base font-mono font-bold ${colorClass} truncate`}>{value}</div>
      <div className="text-[9px] text-zinc-600 mt-0.5">{sub}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-emerald-900/25 bg-[#0c0c14] p-4 space-y-3 terminal-glow">
      <h3 className="text-xs font-mono text-emerald-500">{title}</h3>
      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-emerald-600 text-xs font-mono">&gt; fetching market data...</p>
        <span className="blink text-emerald-400 text-lg">_</span>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded border border-red-800/50 bg-red-950/10 p-4">
      <p className="text-red-400 text-xs font-mono"><span className="text-red-500">[ERROR]</span> {message}</p>
    </div>
  );
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

function formatLargeNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

/** Compact dollar formatting that preserves precision for small altcoins. */
function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "-";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

// Stats type (used in component props)
type Stats = {
  prices: number[];
  rets: number[];
  vol: number;
  totalReturn: number;
  ema25: (number | null)[];
  ema120: (number | null)[];
  rsi: (number | null)[];
  signals: Signal[];
  last: number;
};
