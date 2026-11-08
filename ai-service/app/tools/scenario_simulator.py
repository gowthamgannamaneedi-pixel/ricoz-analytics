from typing import Dict, Any, List, Optional
from app.tools.base import BaseTool
from app.tools.analytics_executor import AnalyticsExecutorTool
from app.database.connection import execute_query

class ScenarioSimulatorTool(BaseTool):
    name: str = "scenario_simulator"
    description: str = "Execute deterministic counterfactual What-If simulations on real dataset metrics"

    def __init__(self):
        self.executor = AnalyticsExecutorTool()

    def execute(
        self,
        organization_id: str,
        dataset_id: int,
        price_change_pct: float = 0.0,
        volume_change_pct: float = 0.0,
        cogs_change_pct: float = 0.0,
        opex_change_pct: float = 0.0,
        conversion_change_pct: float = 0.0,
        dimension: Optional[str] = None,
        segment_adjustments: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        if not dataset_id:
            return {"success": False, "error": "dataset_id is required"}

        # Fetch dataset metadata
        ds_sql = "SELECT name, row_count, schema FROM datasets WHERE id = %s AND organization_id = %s LIMIT 1;"
        ds = execute_query(ds_sql, (dataset_id, organization_id), fetch_one=True)
        if not ds:
            return {"success": False, "error": f"Dataset {dataset_id} not found or access denied"}

        ds_name = ds["name"]
        schema = ds.get("schema") or []
        col_names = [col.get("name").lower() for col in schema if isinstance(col, dict) and col.get("name")]

        # Discover relevant columns
        rev_col = next((c for c in col_names if c in ["revenue", "sales", "total_amount", "amount", "order_value"]), None)
        cost_col = next((c for c in col_names if c in ["cost", "cogs", "expenses", "expense"]), None)
        qty_col = next((c for c in col_names if c in ["quantity", "units", "units_sold", "volume", "order_count"]), None)

        if not rev_col:
            # Fallback to first numeric column if revenue not explicitly named
            numeric_cols = [c.get("name") for c in schema if isinstance(c, dict) and c.get("type") in ["number", "numeric", "float", "integer"]]
            if numeric_cols:
                rev_col = numeric_cols[0]
            else:
                return {
                    "success": False,
                    "error": f"Dataset '{ds_name}' does not contain numeric revenue or financial metric columns required for scenario modeling.",
                    "available_columns": col_names
                }

        # 1. Compute baseline aggregates
        rev_res = self.executor.execute(organization_id, dataset_id, metric_column=rev_col, aggregation="SUM")
        baseline_revenue = float(rev_res.get("value", 0.0))

        baseline_cost = 0.0
        has_cost_column = bool(cost_col)
        if cost_col:
            cost_res = self.executor.execute(organization_id, dataset_id, metric_column=cost_col, aggregation="SUM")
            baseline_cost = float(cost_res.get("value", 0.0))
        else:
            # If cost not in dataset, use conservative 65% COGS baseline for margin modeling
            baseline_cost = round(baseline_revenue * 0.65, 2)

        baseline_units = 0
        if qty_col:
            qty_res = self.executor.execute(organization_id, dataset_id, metric_column=qty_col, aggregation="SUM")
            baseline_units = int(qty_res.get("value", 0))
        else:
            baseline_units = int(ds.get("row_count") or 1)

        baseline_profit = round(baseline_revenue - baseline_cost, 2)
        baseline_margin_pct = round((baseline_profit / baseline_revenue * 100), 2) if baseline_revenue > 0 else 0.0

        # 2. Compute financial levers scenario
        eff_vol_factor = (1.0 + (float(volume_change_pct) / 100.0)) * (1.0 + (float(conversion_change_pct) / 100.0))
        price_factor = 1.0 + (float(price_change_pct) / 100.0)
        cogs_factor = 1.0 + (float(cogs_change_pct) / 100.0)
        opex_factor = 1.0 + (float(opex_change_pct) / 100.0)

        simulated_revenue = max(0.0, round(baseline_revenue * price_factor * eff_vol_factor, 2))
        simulated_var_cost = max(0.0, round(baseline_cost * cogs_factor * eff_vol_factor, 2))
        baseline_opex = round(baseline_revenue * 0.15, 2)
        simulated_opex = max(0.0, round(baseline_opex * opex_factor, 2))
        simulated_cost = round(simulated_var_cost + (simulated_opex - baseline_opex), 2)
        simulated_profit = round(simulated_revenue - simulated_cost, 2)
        simulated_margin_pct = round((simulated_profit / simulated_revenue * 100), 2) if simulated_revenue > 0 else 0.0
        simulated_units = max(0, int(round(baseline_units * eff_vol_factor)))

        rev_delta = round(simulated_revenue - baseline_revenue, 2)
        rev_delta_pct = round((rev_delta / baseline_revenue * 100), 2) if baseline_revenue > 0 else 0.0
        profit_delta = round(simulated_profit - baseline_profit, 2)
        profit_delta_pct = round((profit_delta / abs(baseline_profit) * 100), 2) if baseline_profit != 0 else 0.0
        margin_delta_pct = round(simulated_margin_pct - baseline_margin_pct, 2)

        # 3. Optional: Dimensional segment breakdown if dimension requested
        dimensional_breakdown = []
        if dimension and dimension in col_names:
            group_res = self.executor.execute(organization_id, dataset_id, metric_column=rev_col, aggregation="SUM", group_by_column=dimension, limit=10)
            segments = group_res.get("results", [])

            adj_map = {}
            if segment_adjustments:
                for a in segment_adjustments:
                    if isinstance(a, dict) and a.get("segment"):
                        adj_map[str(a["segment"]).lower()] = float(a.get("deltaPercent", 0.0))

            for seg in segments:
                cat = seg["category"]
                base_seg_val = float(seg["value"])
                delta_p = adj_map.get(cat.lower(), 0.0)
                sim_seg_val = max(0.0, round(base_seg_val * (1.0 + delta_p / 100.0), 2))
                dimensional_breakdown.append({
                    "segment": cat,
                    "baseline_value": base_seg_val,
                    "simulated_value": sim_seg_val,
                    "delta_value": round(sim_seg_val - base_seg_val, 2),
                    "delta_percent": delta_p
                })

        return {
            "success": True,
            "dataset_id": dataset_id,
            "dataset_name": ds_name,
            "columns_tracked": {
                "revenue_column": rev_col,
                "cost_column": cost_col,
                "has_cost_column": has_cost_column,
                "quantity_column": qty_col
            },
            "baseline": {
                "revenue": baseline_revenue,
                "cost": baseline_cost,
                "gross_profit": baseline_profit,
                "gross_margin_pct": baseline_margin_pct,
                "units": baseline_units,
                "unit_symbol": "₹"
            },
            "simulated": {
                "revenue": simulated_revenue,
                "cost": simulated_cost,
                "gross_profit": simulated_profit,
                "gross_margin_pct": simulated_margin_pct,
                "units": simulated_units,
                "unit_symbol": "₹"
            },
            "variance": {
                "revenue_delta": rev_delta,
                "revenue_delta_pct": rev_delta_pct,
                "profit_delta": profit_delta,
                "profit_delta_pct": profit_delta_pct,
                "margin_delta_pct": margin_delta_pct
            },
            "assumptions": {
                "price_change_pct": price_change_pct,
                "volume_change_pct": volume_change_pct,
                "cogs_change_pct": cogs_change_pct,
                "opex_change_pct": opex_change_pct,
                "conversion_change_pct": conversion_change_pct
            },
            "dimensional_breakdown": dimensional_breakdown,
            "is_counterfactual_simulation": True,
            "deterministic": True
        }

