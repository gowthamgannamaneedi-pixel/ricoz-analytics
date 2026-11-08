import numpy as np
from typing import Dict, Any, List
from app.tools.base import BaseTool
from app.database.connection import execute_query

class ForecastingTool(BaseTool):
    name: str = "forecasting"
    description: str = "Generate linear trend projections and forecast intervals based on historical time-series records"

    def execute(
        self,
        organization_id: str,
        dataset_id: int,
        metric_column: str = "revenue",
        horizon_periods: int = 4,
        **kwargs
    ) -> Dict[str, Any]:
        clean_col = "".join(c for c in metric_column if c.isalnum() or c == "_")
        
        sql = f"""
            SELECT (data->>%s)::numeric AS val
            FROM dataset_rows
            WHERE dataset_id = %s
              AND organization_id = %s
              AND (data->>%s) IS NOT NULL
              AND (data->>%s) ~ '^[-]?[0-9]+([.][0-9]+)?$'
            ORDER BY row_index ASC
            LIMIT 500;
        """
        rows = execute_query(sql, (clean_col, dataset_id, organization_id, clean_col, clean_col))
        if len(rows) < 5:
            return {
                "success": False,
                "insufficient_data": True,
                "error": "Forecasting requires at least 5 historical data points to generate statistically grounded projections."
            }

        history = [float(r["val"]) for r in rows]
        x = np.arange(len(history))
        y = np.array(history)

        # Linear trend fit (y = mx + b)
        slope, intercept = np.polyfit(x, y, 1)
        residuals = y - (slope * x + intercept)
        residual_std = float(np.std(residuals))

        # Project future points
        forecast_points = []
        last_idx = len(history)
        for i in range(1, horizon_periods + 1):
            future_x = last_idx + i
            projected = float(slope * future_x + intercept)
            forecast_points.append({
                "period": f"Period +{i}",
                "projected_value": round(projected, 2),
                "lower_bound": round(projected - 1.96 * residual_std, 2),
                "upper_bound": round(projected + 1.96 * residual_std, 2)
            })

        trend_direction = "upward" if slope > 0 else "downward" if slope < 0 else "neutral"

        return {
            "success": True,
            "dataset_id": dataset_id,
            "metric_column": clean_col,
            "historical_points": len(history),
            "trend_direction": trend_direction,
            "slope": round(float(slope), 4),
            "forecast_horizon": horizon_periods,
            "forecast": forecast_points
        }
