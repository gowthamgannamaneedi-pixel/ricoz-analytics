"""
RicozAnalytics ML Service - Time-Series Forecasting Engine
Implements Linear Regression, Holt-Winters / Exponential Smoothing, and ARIMA with confidence intervals.
"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import warnings

# Suppress statsmodels convergence warnings during quick auto-fits
warnings.filterwarnings("ignore")

try:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing, SimpleExpSmoothing
    from statsmodels.tsa.arima.model import ARIMA
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False


def generate_future_dates(last_date_str: str, horizon: int, interval: str = "daily") -> List[str]:
    """
    Generate sequential future date strings matching the series frequency.
    """
    try:
        # Flexible date parser
        base_date = pd.to_datetime(last_date_str)
    except Exception:
        base_date = datetime.now()

    future_dates = []
    interval_clean = (interval or "daily").lower()

    for i in range(1, horizon + 1):
        if interval_clean in ["hourly", "hour", "1h"]:
            next_d = base_date + timedelta(hours=i)
            future_dates.append(next_d.strftime("%Y-%m-%d %H:%M"))
        elif interval_clean in ["weekly", "week", "1w"]:
            next_d = base_date + timedelta(weeks=i)
            future_dates.append(next_d.strftime("%Y-%m-%d"))
        elif interval_clean in ["monthly", "month", "1m"]:
            next_d = base_date + pd.DateOffset(months=i)
            future_dates.append(next_d.strftime("%Y-%m-%d"))
        elif interval_clean in ["quarterly", "quarter", "1q"]:
            next_d = base_date + pd.DateOffset(months=3 * i)
            future_dates.append(next_d.strftime("%Y-%m-%d"))
        elif interval_clean in ["yearly", "year", "annual"]:
            next_d = base_date + pd.DateOffset(years=i)
            future_dates.append(next_d.strftime("%Y-%m-%d"))
        else: # Default daily
            next_d = base_date + timedelta(days=i)
            future_dates.append(next_d.strftime("%Y-%m-%d"))

    return future_dates


def fit_linear_regression(
    y: np.ndarray,
    horizon: int,
    confidence_level: float = 0.95
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, Dict[str, float]]:
    """
    Fit linear trend model with statistical prediction confidence intervals.
    """
    n = len(y)
    X = np.arange(n).reshape(-1, 1)
    
    model = LinearRegression()
    model.fit(X, y)
    
    y_pred_in = model.predict(X)
    
    # Future prediction
    X_future = np.arange(n, n + horizon).reshape(-1, 1)
    preds = model.predict(X_future)
    
    # Residual Variance & Standard Error
    residuals = y - y_pred_in
    dof = max(1, n - 2)
    s_err = np.sqrt(np.sum(residuals ** 2) / dof)
    if s_err == 0:
        s_err = max(1e-4, np.mean(y) * 0.05)

    # Z / t critical value approximation for 95% = 1.96, 90% = 1.645, 99% = 2.576
    if confidence_level >= 0.98:
        z_crit = 2.576
    elif confidence_level <= 0.92:
        z_crit = 1.645
    else:
        z_crit = 1.96

    x_mean = np.mean(X)
    x_ss = np.sum((X - x_mean) ** 2)
    if x_ss == 0:
        x_ss = 1.0

    se_pred = s_err * np.sqrt(1 + (1.0 / n) + ((X_future.flatten() - x_mean) ** 2) / x_ss)
    margin = z_crit * se_pred
    
    lower = preds - margin
    upper = preds + margin

    mae = float(mean_absolute_error(y, y_pred_in))
    rmse = float(np.sqrt(mean_squared_error(y, y_pred_in)))
    r2 = float(r2_score(y, y_pred_in)) if np.var(y) > 0 else 1.0
    
    # Mean Absolute Percentage Error (handling zeros)
    denom = np.where(np.abs(y) > 1e-6, np.abs(y), 1.0)
    mape = float(np.mean(np.abs((y - y_pred_in) / denom)) * 100)

    metrics = {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(max(-1.0, min(1.0, r2)), 4),
        "mape": round(min(500.0, mape), 2),
        "aic": round(float(n * np.log(max(1e-6, np.mean(residuals**2))) + 2 * 2), 2)
    }

    return preds, lower, upper, metrics


def fit_holt_winters(
    y: np.ndarray,
    horizon: int,
    confidence_level: float = 0.95
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, Dict[str, float]]:
    """
    Fit Holt-Winters Exponential Smoothing model.
    """
    n = len(y)
    
    if not STATSMODELS_AVAILABLE or n < 4:
        return fit_linear_regression(y, horizon, confidence_level)

    try:
        # Use SimpleExpSmoothing or Holt additive trend based on sample size
        if n >= 6:
            hw_model = ExponentialSmoothing(
                y,
                trend="add",
                damped_trend=True if n > 12 else False,
                initialization_method="estimated"
            ).fit()
        else:
            hw_model = SimpleExpSmoothing(y, initialization_method="estimated").fit()

        preds = hw_model.forecast(horizon)
        in_sample = hw_model.fittedvalues

        residuals = y - in_sample
        std_res = float(np.std(residuals))
        if std_res == 0:
            std_res = max(1e-4, float(np.mean(y) * 0.05))

        z_crit = 1.96 if confidence_level <= 0.95 else 2.576
        # Uncertainty expands as square root of step horizon
        step_multipliers = np.sqrt(np.arange(1, horizon + 1))
        margin = z_crit * std_res * step_multipliers

        lower = preds - margin
        upper = preds + margin

        mae = float(mean_absolute_error(y, in_sample))
        rmse = float(np.sqrt(mean_squared_error(y, in_sample)))
        denom = np.where(np.abs(y) > 1e-6, np.abs(y), 1.0)
        mape = float(np.mean(np.abs((y - in_sample) / denom)) * 100)

        metrics = {
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "mape": round(min(500.0, mape), 2),
            "r2": round(max(-1.0, min(1.0, float(r2_score(y, in_sample)))), 4),
            "aic": round(float(getattr(hw_model, "aic", 0.0)), 2)
        }

        return preds, lower, upper, metrics

    except Exception:
        # Fallback to linear regression if statsmodels numerical convergence fails
        return fit_linear_regression(y, horizon, confidence_level)


def fit_arima(
    y: np.ndarray,
    horizon: int,
    confidence_level: float = 0.95
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, Dict[str, float]]:
    """
    Fit Auto-Regressive Integrated Moving Average (ARIMA) model.
    """
    n = len(y)
    if not STATSMODELS_AVAILABLE or n < 5:
        return fit_linear_regression(y, horizon, confidence_level)

    try:
        # Choose order (p,d,q) based on sample length
        order = (1, 1, 1) if n >= 10 else ((1, 1, 0) if n >= 6 else (1, 0, 0))
        arima_model = ARIMA(y, order=order).fit()
        
        forecast_res = arima_model.get_forecast(steps=horizon)
        preds = np.array(forecast_res.predicted_mean)
        
        alpha = max(0.01, min(0.20, 1.0 - confidence_level))
        conf_int = forecast_res.conf_int(alpha=alpha)
        
        if isinstance(conf_int, pd.DataFrame):
            lower = conf_int.iloc[:, 0].values
            upper = conf_int.iloc[:, 1].values
        else:
            lower = np.array(conf_int[:, 0])
            upper = np.array(conf_int[:, 1])

        in_sample = np.array(arima_model.fittedvalues)
        if len(in_sample) > 0 and order[1] > 0:
            # First difference drops 1st observation in some models
            in_sample_trimmed = in_sample[-len(y):]
            y_trimmed = y[-len(in_sample_trimmed):]
        else:
            in_sample_trimmed = in_sample
            y_trimmed = y

        mae = float(mean_absolute_error(y_trimmed, in_sample_trimmed))
        rmse = float(np.sqrt(mean_squared_error(y_trimmed, in_sample_trimmed)))
        denom = np.where(np.abs(y_trimmed) > 1e-6, np.abs(y_trimmed), 1.0)
        mape = float(np.mean(np.abs((y_trimmed - in_sample_trimmed) / denom)) * 100)

        metrics = {
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "mape": round(min(500.0, mape), 2),
            "r2": round(max(-1.0, min(1.0, float(r2_score(y_trimmed, in_sample_trimmed)))), 4),
            "aic": round(float(arima_model.aic), 2)
        }

        return preds, lower, upper, metrics

    except Exception:
        return fit_holt_winters(y, horizon, confidence_level)


def generate_forecast(
    data: List[Dict[str, Any]],
    horizon: int = 30,
    model_name: str = "linear_regression",
    interval: str = "daily",
    date_col: str = "date",
    value_col: str = "value",
    confidence_level: float = 0.95
) -> Dict[str, Any]:
    """
    Main entrypoint for generating structured time-series forecasts.
    """
    if not data or len(data) < 3:
        raise ValueError("Insufficient historical time-series data. At least 3 data points required.")

    df = pd.DataFrame(data)
    if value_col not in df.columns or date_col not in df.columns:
        raise ValueError(f"Columns '{date_col}' or '{value_col}' not found in provided dataset.")

    # Data Cleaning & Type Enforcement
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
    df = df.dropna(subset=[value_col]).reset_index(drop=True)

    if len(df) < 3:
        raise ValueError("Insufficient valid numeric observations for forecasting.")

    y = df[value_col].to_numpy(dtype=float)
    dates = df[date_col].astype(str).tolist()
    last_date = dates[-1]

    # Generate Future Dates
    future_dates = generate_future_dates(last_date, horizon, interval)

    model_clean = (model_name or "linear_regression").lower()
    chosen_model = model_clean

    if model_clean in ["linear_regression", "linear", "ols"]:
        preds, lower, upper, metrics = fit_linear_regression(y, horizon, confidence_level)
        chosen_model = "linear_regression"
    elif model_clean in ["exponential_smoothing", "holt_winters", "ets"]:
        preds, lower, upper, metrics = fit_holt_winters(y, horizon, confidence_level)
        chosen_model = "holt_winters" if model_clean == "holt_winters" else "exponential_smoothing"
    elif model_clean in ["arima", "sarima", "autoregressive"]:
        preds, lower, upper, metrics = fit_arima(y, horizon, confidence_level)
        chosen_model = "arima"
    elif model_clean in ["auto", "best"]:
        # Auto model selection: test LR, HW, ARIMA and select lowest MAPE
        p_lr, l_lr, u_lr, m_lr = fit_linear_regression(y, horizon, confidence_level)
        p_hw, l_hw, u_hw, m_hw = fit_holt_winters(y, horizon, confidence_level)
        p_ar, l_ar, u_ar, m_ar = fit_arima(y, horizon, confidence_level)

        candidates = [
            ("linear_regression", p_lr, l_lr, u_lr, m_lr),
            ("holt_winters", p_hw, l_hw, u_hw, m_hw),
            ("arima", p_ar, l_ar, u_ar, m_ar)
        ]
        # Sort by lowest MAPE
        candidates.sort(key=lambda c: c[4]["mape"])
        best = candidates[0]
        chosen_model, preds, lower, upper, metrics = best
    else:
        # Default
        preds, lower, upper, metrics = fit_linear_regression(y, horizon, confidence_level)
        chosen_model = "linear_regression"

    # Structure Historical Points
    historical_points = [
        {"date": dates[i], "value": round(float(y[i]), 2)}
        for i in range(len(y))
    ]

    # Structure Predictions List
    predictions_list = []
    for i in range(horizon):
        pred_val = round(float(preds[i]), 2)
        low_val = round(float(lower[i]), 2)
        up_val = round(float(upper[i]), 2)
        d_str = future_dates[i]

        predictions_list.append({
            "period": i + 1,
            "date": d_str,
            "predicted": pred_val,
            "predicted_value": pred_val,
            "lower_bound": low_val,
            "upper_bound": up_val
        })

    confidence_intervals = {
        "confidence_level": confidence_level,
        "bounds": [
            {"date": future_dates[i], "lower": round(float(lower[i]), 2), "upper": round(float(upper[i]), 2)}
            for i in range(horizon)
        ]
    }

    return {
        "success": True,
        "model": chosen_model,
        "interval": interval,
        "horizon": horizon,
        "historical_count": len(y),
        "historical_points": historical_points,
        "predictions": predictions_list,
        "confidence_intervals": confidence_intervals,
        "metrics": metrics,
        "generated_at": datetime.now().isoformat()
    }
