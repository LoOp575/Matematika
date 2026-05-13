"""
Verifikasi numerik rumus integral ganda:

    ∫₀¹ ∫₀¹ 1 / [(1 - xy)(1 + x)(1 + y)] dx dy = ln 2

Kenapa ini fondasi quant?
- `ln 2` muncul dari integrasi. `ln` yang SAMA dipakai untuk
  hitung log returns harga koin: r = ln(P_t / P_{t-1}).
- Teknik integral numerik di sini (scipy.integrate) dipakai juga
  untuk option pricing (Black-Scholes integral form).
"""

import numpy as np
from scipy import integrate


def integrand(y: float, x: float) -> float:
    """Fungsi di dalam integral: 1 / [(1 - xy)(1 + x)(1 + y)]."""
    return 1.0 / ((1.0 - x * y) * (1.0 + x) * (1.0 + y))


def main() -> None:
    # dblquad: integrasi ganda numerik
    # urutan argumen: integrand(y, x), x_lo, x_hi, y_lo, y_hi
    result, error = integrate.dblquad(
        integrand,
        0, 1,           # batas x
        0, 1,           # batas y
        epsabs=1e-12,
    )

    print(f"Hasil numerik : {result:.12f}")
    print(f"ln(2) eksak   : {np.log(2):.12f}")
    print(f"Selisih       : {abs(result - np.log(2)):.2e}")
    print(f"Error estimasi: {error:.2e}")


if __name__ == "__main__":
    main()
