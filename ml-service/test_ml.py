"""
RicozAnalytics ML Service - Standalone Test Suite
Verifies Linear Regression, Holt-Winters, ARIMA, confidence intervals, and anomaly detection.
"""
import sys
import unittest
from datetime import datetime, timedelta
import numpy as np

from forecasting import generate_forecast, fit_linear_regression, fit_holt_winters, fit_arima
from anomaly_detection import detect_time_series_anomalies


class TestMLForecastingService(unittest.TestCase):

    def setUp(self):
        # 30-day realistic revenue time series with trend and noise
        np.random.seed(42)
        base_date = datetime(2026, 1, 1)
        self.sample_data = []
        for i in range(30):
            d_str = (base_date + timedelta(days=i)).strftime("%Y-%m-%d")
            # Upward trend + weekly seasonality + minor noise
            val = 10000 + 250 * i + 1000 * np.sin(2 * np.pi * i / 7) + np.random.normal(0, 150)
            self.sample_data.append({"date": d_str, "value": round(float(val), 2)})

        # Series with known anomaly spike and dip
        self.anomaly_data = [d.copy() for d in self.sample_data]
        self.anomaly_data[10]["value"] = 35000.0  # Massive spike
        self.anomaly_data[22]["value"] = 1000.0   # Massive dip

    def test_01_linear_regression_forecast(self):
        result = generate_forecast(
            data=self.sample_data,
            horizon=14,
            model_name="linear_regression",
            interval="daily"
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["model"], "linear_regression")
        self.assertEqual(len(result["predictions"]), 14)
        self.assertEqual(len(result["confidence_intervals"]["bounds"]), 14)
        
        # Verify confidence intervals envelope the predictions
        for p in result["predictions"]:
            self.assertLessEqual(p["lower_bound"], p["predicted_value"])
            self.assertGreaterEqual(p["upper_bound"], p["predicted_value"])

        # Check metrics
        self.assertIn("mae", result["metrics"])
        self.assertIn("rmse", result["metrics"])
        self.assertIn("r2", result["metrics"])
        self.assertGreater(result["metrics"]["r2"], 0.5)

    def test_02_holt_winters_forecast(self):
        result = generate_forecast(
            data=self.sample_data,
            horizon=7,
            model_name="exponential_smoothing",
            interval="daily"
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["model"], "exponential_smoothing")
        self.assertEqual(len(result["predictions"]), 7)
        for p in result["predictions"]:
            self.assertLessEqual(p["lower_bound"], p["predicted_value"])
            self.assertGreaterEqual(p["upper_bound"], p["predicted_value"])

    def test_03_arima_forecast(self):
        result = generate_forecast(
            data=self.sample_data,
            horizon=10,
            model_name="arima",
            interval="daily"
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["model"], "arima")
        self.assertEqual(len(result["predictions"]), 10)
        for p in result["predictions"]:
            self.assertLessEqual(p["lower_bound"], p["predicted_value"])
            self.assertGreaterEqual(p["upper_bound"], p["predicted_value"])

    def test_04_auto_model_selection(self):
        result = generate_forecast(
            data=self.sample_data,
            horizon=5,
            model_name="auto",
            interval="daily"
        )
        self.assertTrue(result["success"])
        self.assertIn(result["model"], ["linear_regression", "exponential_smoothing", "holt_winters", "arima"])

    def test_05_statistical_anomaly_detection(self):
        anomalies = detect_time_series_anomalies(
            data=self.anomaly_data,
            window_size=5,
            threshold=2.0
        )
        self.assertGreaterEqual(len(anomalies), 2)
        
        # Check spike at index 10
        spike = next((a for a in anomalies if a["index"] == 10), None)
        self.assertIsNotNone(spike)
        self.assertEqual(spike["direction"], "spike")
        self.assertIn(spike["severity"], ["high", "critical"])

        # Check dip at index 22
        dip = next((a for a in anomalies if a["index"] == 22), None)
        self.assertIsNotNone(dip)
        self.assertEqual(dip["direction"], "dip")

    def test_06_insufficient_data_error(self):
        with self.assertRaises(ValueError):
            generate_forecast(
                data=[{"date": "2026-01-01", "value": 100}, {"date": "2026-01-02", "value": 110}],
                horizon=5
            )

    def test_07_custom_weekly_and_monthly_intervals(self):
        weekly_res = generate_forecast(
            data=self.sample_data[:10],
            horizon=4,
            interval="weekly"
        )
        self.assertEqual(len(weekly_res["predictions"]), 4)

        monthly_res = generate_forecast(
            data=self.sample_data[:10],
            horizon=6,
            interval="monthly"
        )
        self.assertEqual(len(monthly_res["predictions"]), 6)


if __name__ == "__main__":
    unittest.main(verbosity=2)
