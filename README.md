# Matematika untuk Quant Research Crypto

Repo ini menghubungkan matematika murni (integral, kalkulus) ke aplikasi nyata di **quantitative research** untuk analisis koin crypto.

## Motivasi

Rumus ini:

$$\int_0^1 \int_0^1 \frac{1}{(1-xy)(1+x)(1+y)}\,dx\,dy = \ln 2$$

Bukan dipakai langsung di trading. Tapi **teknik dan konsep di baliknya** (integral, `ln`, pecahan parsial, integrasi parsial) adalah fondasi quant research:

- `ln` → **log returns** harga koin
- Integral → **expected value**, **option pricing**
- Stokastik kalkulus → **model harga** (GBM, Heston, jump-diffusion)
- Pecahan parsial → **filter sinyal**, **dekomposisi time series**

## Struktur

| Folder | Topik | Koneksi ke Quant |
|---|---|---|
| `01_foundations/` | Integral ganda → `ln 2` | Bukti numerik, fondasi |
| `02_log_returns/` | Hitung `ln(P_t/P_{t-1})` | Log returns crypto |
| `03_volatility/` | Std dev dari returns | Input Black-Scholes |
| `04_stochastic/` | Geometric Brownian Motion | Model harga aset |

## Setup

```bash
pip install -r requirements.txt
```

## Roadmap Belajar

1. **Foundations** (sekarang) — verifikasi rumus, paham `ln`
2. **Statistik time series** — ARIMA, GARCH
3. **Stokastik kalkulus** — Itô's lemma, SDE
4. **Option pricing** — Black-Scholes, Monte Carlo
5. **Backtesting & risk** — Sharpe, VaR, drawdown
