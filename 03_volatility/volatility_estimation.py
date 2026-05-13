"""
Estimasi volatilitas dari log returns.

Volatilitas = standar deviasi dari log returns, lalu di-annualize.

    sigma_annual = sigma_daily * sqrt(N)

di mana N = jumlah periode per tahun.
- Saham: N = 252 (hari trading)
- Crypto: N = 365 (24/7)

Volatilitas adalah INPUT UTAMA untuk:
- Black-Scholes option pricing
- Value at Risk (VaR)
- Position sizing (Kelly criterion)
- GARCH model
"""

import numpy as np
import pandas as pd
import yfinance as yf


CRYPTO_DAYS_PER_YEAR = 365


def realized_volatility(returns: pd.Series, periods_per_year: int = CRYPTO_DAYS_PER_YEAR) -> float:
    """Volatilitas tahunan dari log returns harian."""
    return returns.std() * np.sqrt(periods_per_year)


def rolling_volatility(returns: pd.Series, window: int = 30) -> pd.Series:
    """Volatilitas rolling (window hari) yang di-annualize."""
    return returns.rolling(window).std() * np.sqrt(CRYPTO_DAYS_PER_YEAR)


def main() -> None:
    data = yf.download("BTC-USD", period="1y", progress=False, auto_adjust=True)
    prices = data["Close"].dropna().squeeze()
    rets = np.log(prices / prices.shift(1)).dropna()

    sigma = realized_volatility(rets)
    rolling = rolling_volatility(rets, window=30)

    print(f"Volatilitas tahunan BTC (1y) : {sigma:.2%}")
    print(f"Rolling 30d (terakhir)        : {rolling.iloc[-1]:.2%}")
    print(f"Rolling 30d (min/max)         : {rolling.min():.2%} / {rolling.max():.2%}")


if __name__ == "__main__":
    main()
