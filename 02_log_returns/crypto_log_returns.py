"""
Log returns dari harga crypto.

Rumus:
    r_t = ln(P_t / P_{t-1})

Kenapa pakai log return (bukan persentase biasa)?
1. Time-additive: r_total = r_1 + r_2 + ... + r_n
2. Lebih simetris (return -50% lalu +50% != balik ke 100%, tapi log return ya)
3. Asumsi normalitas lebih masuk akal (input model Black-Scholes, GARCH, dll)

Ini adalah `ln` yang SAMA dengan hasil integral di 01_foundations.
"""

import numpy as np
import pandas as pd
import yfinance as yf


def fetch_prices(ticker: str = "BTC-USD", period: str = "1y") -> pd.Series:
    """Ambil harga close harian dari Yahoo Finance."""
    data = yf.download(ticker, period=period, progress=False, auto_adjust=True)
    return data["Close"].dropna().squeeze()


def log_returns(prices: pd.Series) -> pd.Series:
    """Hitung log returns: r = ln(P_t / P_{t-1})."""
    return np.log(prices / prices.shift(1)).dropna()


def main() -> None:
    prices = fetch_prices("BTC-USD", "6mo")
    rets = log_returns(prices)

    print(f"Periode      : {prices.index[0].date()} - {prices.index[-1].date()}")
    print(f"Jumlah hari  : {len(rets)}")
    print(f"Mean return  : {rets.mean():.6f}")
    print(f"Std return   : {rets.std():.6f}")
    print(f"Min / Max    : {rets.min():.4f} / {rets.max():.4f}")
    print(f"Total return : {rets.sum():.4f} (= ln(P_end/P_start))")


if __name__ == "__main__":
    main()
