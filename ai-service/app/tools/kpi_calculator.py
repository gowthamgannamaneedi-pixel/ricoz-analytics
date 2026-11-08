from typing import Dict, Any, Optional
from app.tools.base import BaseTool
from app.tools.analytics_executor import AnalyticsExecutorTool
from app.database.connection import execute_query

class KPICalculatorTool(BaseTool):
    name: str = "kpi_calculator"
    description: str = "Calculate verified business KPIs (revenue, gross profit, margin, units) with exact mathematical formulas"

    def __init__(self):
        self.executor = AnalyticsExecutorTool()

    def execute(
        self,
        organization_id: str,
        dataset_id: int,
        kpi_name: str = "revenue",
        **kwargs
    ) -> Dict[str, Any]:
        clean_kpi = kpi_name.lower().strip()

        # Fetch dataset metadata
        ds_sql = "SELECT name, row_count, schema FROM datasets WHERE id = %s AND organization_id = %s LIMIT 1;"
        ds = execute_query(ds_sql, (dataset_id, organization_id), fetch_one=True)
        if not ds:
            return {"success": False, "error": f"Dataset {dataset_id} not found"}

        ds_name = ds["name"]
        schema = ds.get("schema") or []
        col_names = [col.get("name").lower() for col in schema if isinstance(col, dict) and col.get("name")]

        # Match relevant metric column
        if "revenue" in clean_kpi or "sales" in clean_kpi:
            metric_col = next((c for c in col_names if c in ["revenue", "sales", "total_amount", "amount", "order_value"]), "revenue")
            formula = f"SUM({metric_col})"
            result = self.executor.execute(organization_id, dataset_id, metric_column=metric_col, aggregation="SUM")
            unit = "₹"
        elif "unit" in clean_kpi or "quantity" in clean_kpi or "volume" in clean_kpi:
            metric_col = next((c for c in col_names if c in ["units", "quantity", "volume", "order_count"]), "units")
            formula = f"SUM({metric_col})"
            result = self.executor.execute(organization_id, dataset_id, metric_column=metric_col, aggregation="SUM")
            unit = ""
        elif "margin" in clean_kpi or "profit" in clean_kpi:
            rev_col = next((c for c in col_names if c in ["revenue", "sales", "amount"]), "revenue")
            cost_col = next((c for c in col_names if c in ["cost", "cogs", "expenses", "expense"]), None)
            if cost_col:
                rev_res = self.executor.execute(organization_id, dataset_id, metric_column=rev_col, aggregation="SUM")
                cost_res = self.executor.execute(organization_id, dataset_id, metric_column=cost_col, aggregation="SUM")
                total_rev = rev_res.get("value", 0.0)
                total_cost = cost_res.get("value", 0.0)
                profit = total_rev - total_cost
                margin_pct = round((profit / total_rev * 100), 2) if total_rev > 0 else 0.0
                return {
                    "success": True,
                    "dataset_id": dataset_id,
                    "dataset_name": ds_name,
                    "kpi": "Gross Margin",
                    "value": margin_pct,
                    "unit": "%",
                    "profit_value": round(profit, 2),
                    "formula": f"(SUM({rev_col}) - SUM({cost_col})) / SUM({rev_col}) * 100",
                    "provenance": {
                        "dataset_id": dataset_id,
                        "dataset_name": ds_name,
                        "row_count": ds["row_count"],
                        "columns": [rev_col, cost_col]
                    }
                }
            else:
                metric_col = rev_col
                formula = f"SUM({metric_col})"
                result = self.executor.execute(organization_id, dataset_id, metric_column=metric_col, aggregation="SUM")
                unit = "₹"
        elif "count" in clean_kpi or "order" in clean_kpi:
            formula = "COUNT(*)"
            result = self.executor.execute(organization_id, dataset_id, metric_column="*", aggregation="COUNT")
            unit = "orders"
        else:
            metric_col = col_names[0] if col_names else "revenue"
            formula = f"SUM({metric_col})"
            result = self.executor.execute(organization_id, dataset_id, metric_column=metric_col, aggregation="SUM")
            unit = ""

        if not result.get("success"):
            return result

        val = result.get("value", 0.0)
        return {
            "success": True,
            "dataset_id": dataset_id,
            "dataset_name": ds_name,
            "kpi": clean_kpi.upper(),
            "value": val,
            "unit": unit,
            "formula": formula,
            "provenance": {
                "dataset_id": dataset_id,
                "dataset_name": ds_name,
                "row_count": ds["row_count"],
                "columns": [result.get("metric_column", "")]
            }
        }
