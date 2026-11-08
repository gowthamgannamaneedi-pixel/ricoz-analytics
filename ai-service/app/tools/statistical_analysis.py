import numpy as np
from typing import Dict, Any, List
from app.tools.base import BaseTool
from app.database.connection import execute_query

class StatisticalAnalysisTool(BaseTool):
    name: str = "statistical_analysis"
    description: str = "Compute descriptive statistics, variance, standard deviation, and detect outliers on dataset columns"

    def execute(
        self,
        organization_id: str,
        dataset_id: int,
        metric_column: str = "revenue",
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
            LIMIT 5000;
        """
        rows = execute_query(sql, (clean_col, dataset_id, organization_id, clean_col, clean_col))
        if not rows:
            return {"success": False, "error": f"No numeric data found for column {clean_col}"}

        values = np.array([float(r["val"]) for r in rows])
        count = len(values)
        if count == 0:
            return {"success": False, "error": "Zero records available for analysis"}

        mean = float(np.mean(values))
        std_dev = float(np.std(values))
        variance = float(np.var(values))
        min_val = float(np.min(values))
        max_val = float(np.max(values))
        median = float(np.median(values))

        # Detect Outliers (Values outside 2 standard deviations)
        lower_bound = mean - 2 * std_dev
        upper_bound = mean + 2 * std_dev
        outliers = values[(values < lower_bound) | (values > upper_bound)]

        return {
            "success": True,
            "dataset_id": dataset_id,
            "metric_column": clean_col,
            "sample_size": count,
            "mean": round(mean, 2),
            "median": round(median, 2),
            "standard_deviation": round(std_dev, 2),
            "variance": round(variance, 2),
            "min": round(min_val, 2),
            "max": round(max_val, 2),
            "outliers_count": len(outliers),
            "outlier_threshold_low": round(lower_bound, 2),
            "outlier_threshold_high": round(upper_bound, 2)
        }
