"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  fetchKlines,
  logReturns,
  annualizedVolatility,
  simulateGBM,
  verifyDoubleIntegral,
  type Kline,
} from "@/lib/quant";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];

export default function Page() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [klines, setKlines] = useState<Kline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verifikasi integral ganda — compute sekali di mount
  const integralValue = useMemo(() => verifyDoubleIntegral(150), []);
  const ln2 = Math.log(2);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchKlines(symbol, "1d", 180)
      .then((data) => {
        if (!cancelled) setKlines(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const stats = useMemo(() => {
    if (klines.length < 2) return null;
    const prices = klines.map((k) => k.close);
    const rets = logReturns(prices);
    const vol = annualizedVolatility(rets);
    const totalReturn = rets.reduce((a, b) => a + b, 0);
    return {
      prices,
      rets,
      vol,
      totalReturn,
      first: prices[0],
      last: prices[prices.length - 1],
    };
  }, [klines]);

  // GBM simulation — pakai parameter dari data live
  const gbmPaths = useMemo(() => {
    if (!stats) return [];
    return simulateGBM({
      s0: stats.last,
      mu: 0.3,
      sigma: stats.vol,
      days: 90,
      paths: 30,
    });
  }, [stats]);

  const priceChartData = useMemo(
    () =>
      klines.map((k) => ({
        date: new Date(k.time).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
        }),
        price: k.close,
      })),
    [klines]
  );

  const returnsChartData = useMemo(() => {
    if (!stats) return [];
    return stats.rets.map((r, i) => ({
      day: i + 1,
      return: r,
    }));
  }, [stats]);

  const gbmChartData = useMemo(() => {
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-amber-400">
          BETA · Quant Research Dashboard
        </p>
        <h1 className="text-3xl font-bold">Matematika untuk Analisis Koin</h1>
        <p className="text-zinc-400 max-w-2xl">
          Dari integral ganda{" "}
          <code className="text-emerald-400">∫∫ 1/[(1−xy)(1+x)(1+y)] = ln 2</code>{" "}
          ke aplikasi nyata: log returns, volatilitas, dan simulasi harga GBM.
        </p>
      </header>

      {/* Section 1: Foundation */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-xl font-semibold mb-4">
          1. Fondasi: Verifikasi Numerik
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat label="Integral Numerik" value={integralValue.toFixed(8)} />
          <Stat label="ln(2) Eksak" value={ln2.toFixed(8)} />
          <Stat
            label="Selisih"
            value={Math.abs(integralValue - ln2).toExponential(2)}
            accent="text-amber-400"
          />
        </div>
        <p className="text-sm text-zinc-400 mt-4">
          `ln` yang sama ini dipakai untuk hitung log return harga koin di bawah.
        </p>
      </section>

      {/* Section 2: Live Analysis */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">2. Analisis Koin (Live Binance)</h2>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="text-zinc-400">Loading data...</p>}
        {error && <p className="text-red-400">Error: {error}</p>}

        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat
                label="Harga Sekarang"
                value={`$${stats.last.toLocaleString()}`}
              />
              <Stat
                label="Total Log Return (180d)"
                value={`${(stats.totalReturn * 100).toFixed(2)}%`}
                accent={
                  stats.totalReturn >= 0 ? "text-emerald-400" : "text-red-400"
                }
              />
              <Stat
                label="Volatilitas Tahunan"
                value={`${(stats.vol * 100).toFixed(2)}%`}
                accent="text-amber-400"
              />
              <Stat label="Jumlah Hari" value={stats.rets.length.toString()} />
            </div>

            <div className="h-72">
              <h3 className="text-sm text-zinc-400 mb-2">Harga Close Harian</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceChartData}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
                  <YAxis stroke="#71717a" fontSize={11} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #3f3f46",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#10b981"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="h-64">
              <h3 className="text-sm text-zinc-400 mb-2">
                Log Returns Harian: r = ln(P_t / P_t-1)
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={returnsChartData}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="day" stroke="#71717a" fontSize={11} />
                  <YAxis stroke="#71717a" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #3f3f46",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="return"
                    stroke="#f59e0b"
                    dot={false}
                    strokeWidth={1}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>

      {/* Section 3: GBM */}
      {stats && gbmPaths.length > 0 && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
          <h2 className="text-xl font-semibold">
            3. Simulasi Geometric Brownian Motion (90 hari ke depan)
          </h2>
          <p className="text-sm text-zinc-400">
            S_t = S_0 · exp((μ − σ²/2)t + σW_t) — pakai σ live = {(stats.vol * 100).toFixed(1)}%, μ = 30%, 30 path.
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gbmChartData}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{
                    background: "#18181b",
                    border: "1px solid #3f3f46",
                  }}
                />
                {gbmPaths.map((_, i) => (
                  <Line
                    key={i}
                    type="monotone"
                    dataKey={`p${i}`}
                    stroke="#8b5cf6"
                    strokeOpacity={0.35}
                    dot={false}
                    strokeWidth={1}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <footer className="text-xs text-zinc-500 pt-8 border-t border-zinc-800">
        Beta · Data: Binance public API · Bukan saran finansial
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-md bg-zinc-900 border border-zinc-800 p-4">
      <div className="text-xs text-zinc-400 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-mono mt-1 ${accent ?? "text-zinc-100"}`}>
        {value}
      </div>
    </div>
  );
}
