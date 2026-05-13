# Matematika Quant Research — Beta

Dashboard riset quant untuk analisis koin crypto. Menghubungkan rumus matematika murni (integral ganda → ln 2) ke aplikasi nyata: log returns, volatilitas, dan simulasi GBM.

## Status: BETA

Tahap penelitian / latihan awal. Bukan saran finansial.

## Fitur

1. **Fondasi** — Verifikasi numerik `∫∫ 1/[(1−xy)(1+x)(1+y)] = ln 2` (Simpson 2D)
2. **Analisis live** — Harga, log returns, volatilitas tahunan dari Binance API (BTC/ETH/SOL/BNB)
3. **Simulasi GBM** — 30 path harga 90 hari ke depan pakai volatilitas live

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Recharts
- Binance public API (no auth, client-side)

## Local Dev

```bash
cd web
npm install
npm run dev
```

Buka http://localhost:3000

## Deploy ke Vercel

### Opsi A: Vercel CLI

```bash
cd web
npx vercel
# Ikuti prompt, root directory = web/
```

### Opsi B: Vercel Dashboard

1. Buka https://vercel.com/new
2. Import repo `LoOp575/Matematika`
3. **Root Directory**: `web`
4. **Framework Preset**: Next.js (auto-detect)
5. **Build Command**: `npm run build` (default)
6. Klik **Deploy**

Selesai. Tidak butuh env var apa pun.

## Kenapa client-side semua?

- Binance public klines API mengizinkan CORS dari browser
- Tidak butuh API key untuk data publik
- Compute (log return, GBM, integral) ringan → jalan smooth di browser
- Vercel deploy = static-friendly, fast cold start
