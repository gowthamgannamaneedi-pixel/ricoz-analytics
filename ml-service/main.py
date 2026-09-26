"""
RicozAnalytics ML Service - FastAPI Application
Provides statistical & ML time-series forecasting and operational anomaly detection.
"""
import os
import sys
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from forecasting import generate_forecast
from anomaly_detection import detect_time_series_anomalies

app = FastAPI(
    title="RicozAnalytics ML Service",
    description="Python FastAPI service for advanced time-series forecasting and statistical anomaly detection",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# Request & Response Models
# ==============================================================================

class DataPoint(BaseModel):
    date: str
    value: float


class ForecastRequest(BaseModel):
    data: List[Dict[str, Any]] = Field(..., description="Historical time-series observation points")
    horizon: int = Field(default=30, ge=1, le=365, description="Number of future periods to predict")
    model_name: str = Field(default="linear_regression", description="Model: linear_regression, exponential_smoothing, arima, auto")
    interval: str = Field(default="daily", description="Series interval: hourly, daily, weekly, monthly, quarterly, yearly")
    date_col: str = Field(default="date", description="Name of timestamp column in data")
    value_col: str = Field(default="value", description="Name of metric value column in data")
    confidence_level: float = Field(default=0.95, ge=0.5, le=0.99, description="Confidence interval level")


class AnomalyRequest(BaseModel):
    data: List[Dict[str, Any]] = Field(..., description="Time-series observation points")
    date_col: str = Field(default="date", description="Name of timestamp column")
    value_col: str = Field(default="value", description="Name of metric value column")
    window_size: int = Field(default=5, ge=2, description="Rolling window size")
    threshold: float = Field(default=2.0, ge=1.0, description="Z-score anomaly threshold")


class CombinedPipelineRequest(BaseModel):
    data: List[Dict[str, Any]]
    horizon: int = 30
    model_name: str = "linear_regression"
    interval: str = "daily"
    date_col: str = "date"
    value_col: str = "value"
    confidence_level: float = 0.95
    anomaly_threshold: float = 2.0


# ==============================================================================
# API Endpoints
# ==============================================================================

@app.get("/ml/health")
def health_check():
    return {
        "success": True,
        "service": "RicozAnalytics ML Service",
        "status": "online",
        "version": "1.0.0",
        "models_available": ["linear_regression", "exponential_smoothing", "arima", "auto"],
        "anomaly_detection": "statistical_rolling_zscore"
    }


@app.post("/ml/forecast")
def create_forecast(req: ForecastRequest):
    try:
        result = generate_forecast(
            data=req.data,
            horizon=req.horizon,
            model_name=req.model_name,
            interval=req.interval,
            date_col=req.date_col,
            value_col=req.value_col,
            confidence_level=req.confidence_level
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forecasting calculation failed: {str(e)}"
        )


@app.post("/ml/anomalies")
def detect_anomalies(req: AnomalyRequest):
    try:
        anomalies = detect_time_series_anomalies(
            data=req.data,
            date_col=req.date_col,
            value_col=req.value_col,
            window_size=req.window_size,
            threshold=req.threshold
        )
        return {
            "success": True,
            "anomaly_count": len(anomalies),
            "anomalies": anomalies,
            "threshold_used": req.threshold,
            "window_size": req.window_size
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Anomaly detection failed: {str(e)}"
        )


@app.post("/ml/forecast-and-detect")
def forecast_and_detect(req: CombinedPipelineRequest):
    try:
        forecast_result = generate_forecast(
            data=req.data,
            horizon=req.horizon,
            model_name=req.model_name,
            interval=req.interval,
            date_col=req.date_col,
            value_col=req.value_col,
            confidence_level=req.confidence_level
        )
        
        anomalies = detect_time_series_anomalies(
            data=req.data,
            date_col=req.date_col,
            value_col=req.value_col,
            threshold=req.anomaly_threshold
        )

        return {
            **forecast_result,
            "anomalies": anomalies,
            "anomaly_count": len(anomalies)
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline computation failed: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
