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
  sma,
  generateSignals,
  simulateGBM,
  verifyDoubleIntegral,
  type Kline,
  type FundingRate,
  type OpenInterest,
  type Signal,
} from "@/lib/quant";

// ─── Constants ───────────────────────────────────────────────────────────────

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
const TABS = ["Overview", "Volume & OI", "Funding", "Signals", "GBM", "Fondasi"] as const;
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

  // Fetch all data
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
    const ma7 = sma(prices, 7);
    const ma25 = sma(prices, 25);
    const signals = generateSignals(prices, 7, 25);
    return { prices, rets, vol, totalReturn, ma7, ma25, signals, last: prices[prices.length - 1] };
  }, [klines]);

  // GBM
  const gbmPaths = useMemo(() => {
    if (!stats) return [];
    return simulateGBM({ s0: stats.last, mu: 0.3, sigma: stats.vol, days: 90, paths: 30 });
  }, [stats]);

  // Integral
  const integralValue = useMemo(() => verifyDoubleIntegral(100), []);

  return (
    <main className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Quant Research</h1>
            <p className="text-xs text-zinc-500">Beta · Matematika untuk Analisis Koin</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm font-mono"
            >
              {SYMBOLS.map((s) => (
                <option key={s} value={s}>{s.replace("USDT", "/USDT")}</option>
              ))}
            </select>
            <button
              onClick={loadData}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg transition"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="mx-auto max-w-7xl px-4 flex gap-1 overflow-x-auto py-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                tab === t
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
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
            {tab === "Signals" && <SignalsTab klines={klines} stats={stats} />}
            {tab === "GBM" && <GBMTab gbmPaths={gbmPaths} stats={stats} />}
            {tab === "Fondasi" && <FondasiTab integralValue={integralValue} />}
          </>
        )}
      </div>

      <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-600">
        Beta · Data: Binance API · Bukan saran finansial · Quant Research Dashboard
      </footer>
    </main>
  );
}

// ─── Tab: Overview ───────────────────────────────────────────────────────────

function OverviewTab({ klines, stats }: { klines: Kline[]; stats: Stats }) {
  const priceData = klines.map((k, i) => ({
    date: fmtDate(k.time),
    price: k.close,
    ma7: stats.ma7[i],
    ma25: stats.ma25[i],
  }));

  const returnData = stats.rets.map((r, i) => ({ day: i + 1, ret: r }));

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Harga Sekarang" value={`$${stats.last.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
        <Card
          label="Log Return 180d"
          value={`${(stats.totalReturn * 100).toFixed(2)}%`}
          color={stats.totalReturn >= 0 ? "emerald" : "red"}
        />
        <Card label="Volatilitas Tahunan" value={`${(stats.vol * 100).toFixed(1)}%`} color="amber" />
        <Card label="Data Points" value={`${klines.length} hari`} />
      </div>

      {/* Price + MA Chart */}
      <ChartCard title="Harga + Moving Average (MA7 & MA25)">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={priceData}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#52525b" fontSize={10} />
            <YAxis stroke="#52525b" fontSize={10} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
            <Line type="monotone" dataKey="price" stroke="#10b981" dot={false} strokeWidth={2} name="Price" />
            <Line type="monotone" dataKey="ma7" stroke="#f59e0b" dot={false} strokeWidth={1.5} strokeDasharray="4 2" name="MA7" />
            <Line type="monotone" dataKey="ma25" stroke="#8b5cf6" dot={false} strokeWidth={1.5} strokeDasharray="4 2" name="MA25" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Log Returns */}
      <ChartCard title="Log Returns Harian: r = ln(P_t / P_{t-1})">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={returnData}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke="#52525b" fontSize={10} />
            <YAxis stroke="#52525b" fontSize={10} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
            <ReferenceLine y={0} stroke="#52525b" />
            <Bar dataKey="ret" fill="#f59e0b" radius={[2, 2, 0, 0]} name="Return" />
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
          label="Volume 24h (terakhir)"
          value={klines.length > 0 ? formatLargeNumber(klines[klines.length - 1].volume) : "-"}
        />
        <Card
          label="Open Interest (terakhir)"
          value={oi.length > 0 ? formatLargeNumber(oi[oi.length - 1].oi) : "N/A"}
          color="purple"
        />
      </div>

      <ChartCard title="Volume Harian (dalam koin)">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={volData}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#52525b" fontSize={10} />
            <YAxis stroke="#52525b" fontSize={10} tickFormatter={formatLargeNumber} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
            <Bar dataKey="volume" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Volume" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {oiData.length > 0 && (
        <ChartCard title="Open Interest (Futures)">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={oiData}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#52525b" fontSize={10} />
              <YAxis stroke="#52525b" fontSize={10} tickFormatter={formatLargeNumber} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
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
    rate: f.rate * 100, // to percentage
  }));

  const avgRate = data.length > 0 ? data.reduce((a, b) => a + b.rate, 0) / data.length : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card
          label="Funding Rate (terakhir)"
          value={data.length > 0 ? `${data[data.length - 1].rate.toFixed(4)}%` : "N/A"}
          color={data.length > 0 && data[data.length - 1].rate > 0 ? "emerald" : "red"}
        />
        <Card label="Avg Funding Rate" value={`${avgRate.toFixed(4)}%`} color="amber" />
        <Card label="Data Points" value={`${data.length}`} />
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="text-xs text-zinc-400 mb-2">
          <strong>Funding Rate &gt; 0:</strong> Long pays short (bullish sentiment, tapi bisa overheated).
          <br />
          <strong>Funding Rate &lt; 0:</strong> Short pays long (bearish sentiment, tapi bisa oversold).
        </p>
      </div>

      <ChartCard title="Funding Rate History (%)">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#52525b" fontSize={10} />
            <YAxis stroke="#52525b" fontSize={10} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
            <ReferenceLine y={0} stroke="#52525b" strokeWidth={2} />
            <Bar dataKey="rate" name="Funding %" radius={[2, 2, 0, 0]} fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ─── Tab: Signals ────────────────────────────────────────────────────────────

function SignalsTab({ klines, stats }: { klines: Kline[]; stats: Stats }) {
  const activeSignals = stats.signals.filter((s) => s.type !== "NEUTRAL");
  const lastSignals = activeSignals.slice(-10).reverse();

  const priceWithSignals = klines.map((k, i) => {
    const sig = stats.signals[i - 1]; // signals start at index 1
    return {
      date: fmtDate(k.time),
      price: k.close,
      buy: sig?.type === "BUY" ? k.close : null,
      sell: sig?.type === "SELL" ? k.close : null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card label="Total Signals" value={`${activeSignals.length}`} />
        <Card label="Buy Signals" value={`${activeSignals.filter((s) => s.type === "BUY").length}`} color="emerald" />
        <Card label="Sell Signals" value={`${activeSignals.filter((s) => s.type === "SELL").length}`} color="red" />
      </div>

      <ChartCard title="Price + Buy/Sell Signals (MA7/MA25 Crossover + Vol Regime)">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={priceWithSignals}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#52525b" fontSize={10} />
            <YAxis stroke="#52525b" fontSize={10} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
            <Line type="monotone" dataKey="price" stroke="#71717a" dot={false} strokeWidth={1.5} name="Price" />
            <Line type="monotone" dataKey="buy" stroke="#10b981" dot={{ r: 5, fill: "#10b981" }} strokeWidth={0} name="Buy" connectNulls={false} />
            <Line type="monotone" dataKey="sell" stroke="#ef4444" dot={{ r: 5, fill: "#ef4444" }} strokeWidth={0} name="Sell" connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Signal Log */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">10 Sinyal Terakhir</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {lastSignals.length === 0 && <p className="text-zinc-500 text-sm">Belum ada sinyal aktif</p>}
          {lastSignals.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                s.type === "BUY" ? "bg-emerald-900/20 border border-emerald-800/30" : "bg-red-900/20 border border-red-800/30"
              }`}
            >
              <span className={`font-bold ${s.type === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                {s.type}
              </span>
              <span className="text-zinc-400">Day {s.day}</span>
              <span className="text-zinc-500 text-xs">{s.reason}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-amber-800/30 bg-amber-900/10 p-4">
        <p className="text-xs text-amber-400">
          <strong>Strategi:</strong> MA7 × MA25 crossover + volatility regime filter (&gt;80% annualized = sell signal).
          Ini basic — bukan rekomendasi trading. Tahap penelitian.
        </p>
      </div>
    </div>
  );
}

// ─── Tab: GBM ────────────────────────────────────────────────────────────────

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
  const mean = finalPrices.reduce((a, b) => a + b, 0) / finalPrices.length;
  const sorted = [...finalPrices].sort((a, b) => a - b);
  const p5 = sorted[Math.floor(sorted.length * 0.05)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Harga Awal" value={`$${stats.last.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Card label="Mean 90d" value={`$${mean.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="emerald" />
        <Card label="P5 (worst)" value={`$${p5?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "-"}`} color="red" />
        <Card label="P95 (best)" value={`$${p95?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "-"}`} color="purple" />
      </div>

      <ChartCard title={`Simulasi GBM — 30 path, 90 hari (σ=${(stats.vol * 100).toFixed(1)}%, μ=30%)`}>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={gbmData}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke="#52525b" fontSize={10} />
            <YAxis stroke="#52525b" fontSize={10} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
            {gbmPaths.map((_, i) => (
              <Line
                key={i}
                type="monotone"
                dataKey={`p${i}`}
                stroke="#8b5cf6"
                strokeOpacity={0.4}
                dot={false}
                strokeWidth={1}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="text-xs text-zinc-400">
          <strong>Formula:</strong> S_t = S_0 · exp((μ − σ²/2)·t + σ·W_t)
          <br />
          Koreksi <code>−σ²/2</code> dari <strong>Itô&apos;s lemma</strong> (stokastik kalkulus).
          Ini yang menghubungkan integral di fondasi ke model harga.
        </p>
      </div>
    </div>
  );
}

// ─── Tab: Fondasi ────────────────────────────────────────────────────────────

function FondasiTab({ integralValue }: { integralValue: number }) {
  const ln2 = Math.log(2);
  const diff = Math.abs(integralValue - ln2);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card label="Integral Numerik" value={integralValue.toFixed(10)} />
        <Card label="ln(2) Eksak" value={ln2.toFixed(10)} color="emerald" />
        <Card label="Selisih (Error)" value={diff.toExponential(3)} color="amber" />
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
        <h3 className="text-lg font-semibold">Rumus yang diverifikasi:</h3>
        <div className="bg-zinc-800 rounded-lg p-4 font-mono text-center text-emerald-400">
          ∫₀¹ ∫₀¹ 1 / [(1 − xy)(1 + x)(1 + y)] dx dy = ln 2
        </div>
        <div className="space-y-2 text-sm text-zinc-400">
          <p><strong>Metode:</strong> Simpson&apos;s 1/3 Rule (Composite, 2D), n=100 grid points per axis.</p>
          <p><strong>Koneksi ke quant:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><code>ln</code> yang sama → log returns harga koin</li>
            <li>Teknik integrasi → option pricing (Black-Scholes integral form)</li>
            <li>Pecahan parsial → dekomposisi sinyal time series</li>
            <li>Itô calculus (perpanjangan integral) → model GBM di tab sebelah</li>
          </ul>
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
    "text-zinc-100";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</div>
      <div className={`text-lg font-mono font-semibold ${colorClass} truncate`}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-zinc-400 text-sm">Loading market data...</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-800/50 bg-red-900/10 p-4">
      <p className="text-red-400 text-sm">Error: {message}</p>
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

// Stats type (used in component props)
type Stats = {
  prices: number[];
  rets: number[];
  vol: number;
  totalReturn: number;
  ma7: (number | null)[];
  ma25: (number | null)[];
  signals: Signal[];
  last: number;
};
