"""
forecast.py — GPR-based grid carbon intensity forecasting
==========================================================

Model: Gaussian Process Regression (scikit-learn)
Kernel: RBF (smooth long-term trend) + WhiteKernel (observation noise)

Why GPR for grid intensity:
  - Works well on small datasets (typically 20–25 years per country)
  - Returns a full predictive distribution → confidence bands on chart
  - RBF kernel captures smooth "energy transition" curves naturally
  - WhiteKernel absorbs year-to-year noise (policy shocks, fuel price spikes)

Output per country:
  years         — list of forecast years
  mean          — predicted g CO₂/kWh
  lower         — 95% confidence lower bound
  upper         — 95% confidence upper bound
  last_actual   — last historical value (for chart continuity)
  last_year     — last historical year
  trend         — "improving" | "worsening" | "stable"
  model_score   — R² on training data (quality indicator)
"""

import numpy as np
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel, ConstantKernel
from sklearn.preprocessing import StandardScaler


FORECAST_YEARS = 10        # how many years ahead to project
CONFIDENCE_Z   = 1.96      # 95% confidence interval


def _build_kernel():
    """
    Composite kernel:
      ConstantKernel × RBF  — captures smooth underlying trend
      WhiteKernel           — models observation noise
    """
    return (
        ConstantKernel(1.0, (0.1, 10.0))
        * RBF(length_scale=5.0, length_scale_bounds=(2.0, 20.0))
        + WhiteKernel(noise_level=1.0, noise_level_bounds=(1e-3, 50.0))
    )


def forecast_country(years: list[int], values: list[float], horizon: int = FORECAST_YEARS):
    """
    Fit a GPR model on historical (years, values) and return a forecast.

    Parameters
    ----------
    years  : list of int   — historical years, e.g. [2000, 2001, ..., 2023]
    values : list of float — g CO₂/kWh for each year (None → skipped)
    horizon: int           — number of years to forecast ahead

    Returns
    -------
    dict with keys: years, mean, lower, upper, last_year, last_actual,
                    trend, model_score, error (on failure)
    """
    # Filter out None / NaN pairs
    clean = [(y, v) for y, v in zip(years, values) if v is not None and not np.isnan(float(v))]
    if len(clean) < 4:
        return {"error": "Insufficient data (need ≥ 4 years)"}

    X_raw = np.array([c[0] for c in clean], dtype=float).reshape(-1, 1)
    y_raw = np.array([c[1] for c in clean], dtype=float)

    # Scale X to zero-mean / unit-variance for numerical stability
    x_scaler = StandardScaler()
    y_scaler = StandardScaler()
    X = x_scaler.fit_transform(X_raw)
    y = y_scaler.fit_transform(y_raw.reshape(-1, 1)).ravel()

    # Fit GPR
    gpr = GaussianProcessRegressor(
        kernel=_build_kernel(),
        n_restarts_optimizer=5,
        normalize_y=False,     # we already scaled
        alpha=0.0              # WhiteKernel handles noise
    )
    try:
        gpr.fit(X, y)
    except Exception as e:
        return {"error": f"GPR fit failed: {str(e)}"}

    # Model quality on training data
    try:
        score = float(gpr.score(X, y))
    except Exception:
        score = None

    # Build forecast horizon
    last_year   = int(X_raw.max())
    future_yrs  = np.arange(last_year + 1, last_year + horizon + 1, dtype=float)
    all_yrs_raw = np.concatenate([X_raw.ravel(), future_yrs]).reshape(-1, 1)
    all_yrs_sc  = x_scaler.transform(all_yrs_raw)

    # Predict mean + std
    y_pred_sc, y_std_sc = gpr.predict(all_yrs_sc, return_std=True)

    # Inverse-transform back to original scale
    y_pred = y_scaler.inverse_transform(y_pred_sc.reshape(-1, 1)).ravel()
    # std in original scale ≈ std_scaled × scaler.scale_
    y_std  = y_std_sc * y_scaler.scale_[0]

    # Confidence bounds — clip at 0 (can't have negative intensity)
    y_lower = np.maximum(0, y_pred - CONFIDENCE_Z * y_std)
    y_upper = np.maximum(0, y_pred + CONFIDENCE_Z * y_std)

    # Slice just the forecast portion
    n_hist      = len(X_raw)
    fc_years    = [int(v) for v in all_yrs_raw.ravel()[n_hist:]]
    fc_mean     = [round(float(v), 2) for v in y_pred[n_hist:]]
    fc_lower    = [round(float(v), 2) for v in y_lower[n_hist:]]
    fc_upper    = [round(float(v), 2) for v in y_upper[n_hist:]]

    # Trend direction: compare last 3 historical vs end of forecast
    trend_delta = fc_mean[-1] - float(y_raw[-1])
    if   trend_delta < -5:   trend = "improving"
    elif trend_delta >  5:   trend = "worsening"
    else:                    trend = "stable"

    return {
        "years":        fc_years,
        "mean":         fc_mean,
        "lower":        fc_lower,
        "upper":        fc_upper,
        "last_year":    last_year,
        "last_actual":  round(float(y_raw[-1]), 2),
        "trend":        trend,
        "model_score":  round(score, 3) if score is not None else None,
        "horizon":      horizon,
    }


def forecast_all(grid_data: dict, horizon: int = FORECAST_YEARS) -> dict:
    """
    Run forecast for every country in grid_data.

    grid_data: { "USA": { "2000": { "corrected": 450, ... }, ... }, ... }
    Returns:   { "USA": { years, mean, lower, upper, ... }, ... }
    """
    results = {}
    for country, year_dict in grid_data.items():
        years  = sorted(int(y) for y in year_dict)
        values = [year_dict[str(y)].get("corrected") or year_dict[str(y)].get("raw")
                  for y in years]
        results[country] = forecast_country(years, values, horizon)
    return results