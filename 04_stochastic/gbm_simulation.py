"""
Geometric Brownian Motion (GBM) — model harga aset standar.

SDE:
    dS_t = mu * S_t * dt + sigma * S_t * dW_t

Solusi eksak (pakai Itô's lemma — STOKASTIK KALKULUS):
    S_t = S_0 * exp((mu - sigma^2/2) * t + sigma * W_t)

Perhatikan `exp` dan koreksi `-sigma^2/2` — ini muncul karena
integrasi stokastik (analog dengan teknik integrasi di rumus
double integral, tapi diperluas ke proses random).

Dipakai untuk:
- Monte Carlo option pricing
- Skenario stress testing
- Backtest strategi
"""

import numpy as np
import matplotlib.pyplot as plt


def simulate_gbm(
    s0: float,
    mu: float,
    sigma: float,
    t_years: float,
    n_steps: int,
    n_paths: int,
    seed: int | None = 42,
) -> np.ndarray:
    """
    Simulasi GBM dengan Euler-Maruyama (versi log-eksak).

    Returns array shape (n_paths, n_steps + 1).
    """
    rng = np.random.default_rng(seed)
    dt = t_years / n_steps
    # Increments Brownian: dW ~ N(0, dt)
    dW = rng.standard_normal(size=(n_paths, n_steps)) * np.sqrt(dt)

    # Log-price increments: (mu - sigma^2/2) dt + sigma dW
    log_increments = (mu - 0.5 * sigma**2) * dt + sigma * dW
    log_paths = np.concatenate(
        [np.zeros((n_paths, 1)), np.cumsum(log_increments, axis=1)], axis=1
    )
    return s0 * np.exp(log_paths)


def main() -> None:
    # Parameter contoh untuk BTC: drift 30%/tahun, volatilitas 60%/tahun
    paths = simulate_gbm(
        s0=60_000,
        mu=0.30,
        sigma=0.60,
        t_years=1.0,
        n_steps=365,
        n_paths=1000,
    )

    final_prices = paths[:, -1]
    print(f"Harga awal           : 60,000")
    print(f"Mean harga 1 tahun   : {final_prices.mean():,.0f}")
    print(f"Median harga 1 tahun : {np.median(final_prices):,.0f}")
    print(f"P5 / P95             : {np.percentile(final_prices, 5):,.0f} / {np.percentile(final_prices, 95):,.0f}")

    # Plot 50 path pertama
    plt.figure(figsize=(10, 5))
    plt.plot(paths[:50].T, alpha=0.5, linewidth=0.8)
    plt.title("GBM: 50 simulasi harga BTC selama 1 tahun")
    plt.xlabel("Hari")
    plt.ylabel("Harga (USD)")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig("04_stochastic/gbm_paths.png", dpi=100)
    print("\nPlot disimpan ke 04_stochastic/gbm_paths.png")


if __name__ == "__main__":
    main()
