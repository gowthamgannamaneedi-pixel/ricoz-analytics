"""
RicozAnalytics ML Service - Statistical Anomaly Detection Engine
Implements rolling window mean, standard deviation, and Z-score thresholding.
"""
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd


def detect_time_series_anomalies(
    data: List[Dict[str, Any]],
    date_col: str = "date",
    value_col: str = "value",
    window_size: int = 5,
    threshold: float = 2.0
) -> List[Dict[str, Any]]:
    """
    Detect statistical anomalies in a numeric time series using rolling Z-score.
    
    Parameters:
    - data: List of dicts with timestamp and numeric value.
    - date_col: Name of key for timestamp/date.
    - value_col: Name of key for numeric metric value.
    - window_size: Rolling window period for baseline estimation.
    - threshold: Z-score threshold multiplier (standard: 2.0 - 3.0).
    
    Returns:
    List of detected anomaly records with severity, expected value, and score.
    """
    if not data or len(data) < 3:
        return []

    df = pd.DataFrame(data)
    if value_col not in df.columns or date_col not in df.columns:
        return []

    # Ensure numeric conversion
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
    df = df.dropna(subset=[value_col]).reset_index(drop=True)

    if len(df) < 3:
        return []

    # Effective window
    effective_window = max(3, min(window_size, len(df) // 2))

    # Robust Baseline & Dispersion using Median and MAD (Median Absolute Deviation)
    med = float(df[value_col].median())
    abs_dev = (df[value_col] - med).abs()
    mad = float(abs_dev.median())
    # Normal consistency factor for MAD is 1.4826
    robust_std = 1.4826 * mad if mad > 1e-4 else float(df[value_col].std() or 1.0)
    if np.isnan(robust_std) or robust_std == 0:
        robust_std = max(1e-4, float(np.mean(np.abs(df[value_col])) * 0.05))

    # Rolling median for local trend baseline
    df["rolling_median"] = df[value_col].rolling(window=effective_window, min_periods=2, center=True).median().fillna(med)

    expected = df["rolling_median"]
    df["deviation"] = df[value_col] - expected
    df["effective_z"] = (df["deviation"].abs() / robust_std).fillna(0)

    anomalies = []
    for idx, row in df.iterrows():
        z = float(row["effective_z"])
        if z >= threshold:
            val = float(row[value_col])
            exp = float(expected.iloc[idx])
            dev = float(val - exp)
            
            # Severity classification
            if z >= 3.5:
                severity = "critical"
            elif z >= 2.5:
                severity = "high"
            elif z >= 2.0:
                severity = "medium"
            else:
                severity = "low"

            direction = "spike" if dev > 0 else "dip"

            anomalies.append({
                "index": int(idx),
                "timestamp": str(row[date_col]),
                "actual_value": round(val, 2),
                "expected_value": round(exp, 2),
                "deviation": round(dev, 2),
                "anomaly_score": round(z, 2),
                "severity": severity,
                "direction": direction,
                "is_anomaly": True
            })

    return anomalies
