from typing import Dict, Any, List, Optional
from datetime import datetime, date
import logging
from app.tools.base import BaseTool
from app.database.connection import execute_query
from app.security.sanitization import is_safe_read_query

logger = logging.getLogger("ai_service.tools.period_comparison")

class PeriodComparisonTool(BaseTool):
    name: str = "period_comparison"
    description: str = "Perform deterministic Month-over-Month (MoM) and period-over-period comparison on dataset records"

    def execute(
        self,
        organization_id: str,
        dataset_id: int,
        metric_column: Optional[str] = None,
        date_column: Optional[str] = None,
        reference_date: Optional[str] = "2026-11-08",
        **kwargs
    ) -> Dict[str, Any]:
        if not dataset_id:
            return {"success": False, "error": "dataset_id is required"}

        org_id_str = str(organization_id).strip()
        if org_id_str in ("1", "default", "primary"):
            org_id_str = "00000000-0000-0000-0000-000000000001"

        # 1. Inspect dataset metadata and schema
        ds_sql = """
            SELECT id, name, row_count, schema, metadata
            FROM datasets
            WHERE id = %s AND organization_id = %s
            LIMIT 1;
        """
        ds = execute_query(ds_sql, (dataset_id, org_id_str), fetch_one=True)
        if not ds:
            return {
                "success": False,
                "error": f"Dataset {dataset_id} not found or access denied for this organization."
            }

        ds_name = ds["name"]
        raw_schema = ds.get("schema") or []
        columns = []
        if isinstance(raw_schema, list):
            for item in raw_schema:
                if isinstance(item, dict):
                    columns.append({"name": item.get("name") or item.get("key"), "type": item.get("type", "string")})
                elif isinstance(item, str):
                    columns.append({"name": item, "type": "string"})

        # Sample row if schema lacks types
        sample_sql = "SELECT data FROM dataset_rows WHERE dataset_id = %s AND organization_id = %s LIMIT 1;"
        sample_row = execute_query(sample_sql, (dataset_id, org_id_str), fetch_one=True)
        sample_data = sample_row.get("data") if sample_row else {}

        # 2. Resolve Date Column
        effective_date_col = None
        if date_column:
            clean_input = "".join(c for c in date_column if c.isalnum() or c == "_")
            if any(c["name"].lower() == clean_input.lower() for c in columns) or clean_input in sample_data:
                effective_date_col = clean_input

        if not effective_date_col:
            date_candidates = ["date", "created_at", "timestamp", "order_date", "invoice_date", "period", "transaction_date"]
            for cand in date_candidates:
                for col in columns:
                    if cand in col["name"].lower():
                        effective_date_col = col["name"]
                        break
                if effective_date_col:
                    break
            if not effective_date_col and sample_data:
                for k in sample_data.keys():
                    if any(cand in k.lower() for cand in date_candidates):
                        effective_date_col = k
                        break

        if not effective_date_col:
            return {
                "success": False,
                "has_date_column": False,
                "dataset_name": ds_name,
                "error": "The selected dataset does not contain a usable date column."
            }

        # 3. Resolve Metric Column
        numeric_candidates = ["sales_amount", "revenue", "sales", "total_amount", "amount", "profit", "order_value", "units_sold"]
        effective_metric = None
        if metric_column:
            clean_m = "".join(c for c in metric_column if c.isalnum() or c == "_")
            effective_metric = clean_m

        if not effective_metric:
            for cand in numeric_candidates:
                for col in columns:
                    if cand == col["name"].lower() or cand in col["name"].lower():
                        effective_metric = col["name"]
                        break
                if effective_metric:
                    break

        if not effective_metric:
            # Fall back to first numeric column from sample data
            for k, v in sample_data.items():
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    effective_metric = k
                    break

        if not effective_metric:
            effective_metric = "sales_amount"

        # 4. Check Dataset Min/Max Date Bounds
        bounds_sql = f"""
            SELECT
                MIN((data->>%s)::text) AS min_date,
                MAX((data->>%s)::text) AS max_date,
                COUNT(*)::bigint AS total_rows
            FROM dataset_rows
            WHERE dataset_id = %s AND organization_id = %s;
        """
        bounds = execute_query(bounds_sql, (effective_date_col, effective_date_col, dataset_id, org_id_str), fetch_one=True) or {}
        min_date_str = bounds.get("min_date")
        max_date_str = bounds.get("max_date")
        total_rows = int(bounds.get("total_rows") or 0)

        # 5. Calculate Calendar Month-to-Date Periods (e.g. Nov 1–8, 2026 vs Oct 1–8, 2026)
        ref_dt = datetime.strptime(reference_date or "2026-11-08", "%Y-%m-%d").date()
        current_year = ref_dt.year
        current_month = ref_dt.month
        current_day = ref_dt.day

        # Current period: Nov 1 to Nov 8
        cur_start_str = f"{current_year:04d}-{current_month:02d}-01"
        cur_end_str = f"{current_year:04d}-{current_month:02d}-{current_day:02d}"

        # Previous period: Oct 1 to Oct 8
        prev_month = current_month - 1 if current_month > 1 else 12
        prev_year = current_year if current_month > 1 else current_year - 1
        prev_start_str = f"{prev_year:04d}-{prev_month:02d}-01"
        prev_end_str = f"{prev_year:04d}-{prev_month:02d}-{current_day:02d}"

        # Aggregate query
        agg_sql = f"""
            SELECT
                COUNT(*)::bigint AS count,
                COALESCE(SUM((data->>%s)::numeric), 0) AS total
            FROM dataset_rows
            WHERE dataset_id = %s
              AND organization_id = %s
              AND (data->>%s) IS NOT NULL
              AND (data->>%s) ~ '^[-]?[0-9]+([.][0-9]+)?$'
              AND (data->>%s)::date >= %s::date
              AND (data->>%s)::date <= %s::date;
        """

        cur_res = execute_query(agg_sql, (
            effective_metric, dataset_id, org_id_str,
            effective_metric, effective_metric,
            effective_date_col, cur_start_str,
            effective_date_col, cur_end_str
        ), fetch_one=True) or {"count": 0, "total": 0}

        prev_res = execute_query(agg_sql, (
            effective_metric, dataset_id, org_id_str,
            effective_metric, effective_metric,
            effective_date_col, prev_start_str,
            effective_date_col, prev_end_str
        ), fetch_one=True) or {"count": 0, "total": 0}

        cur_total = float(cur_res.get("total") or 0.0)
        cur_count = int(cur_res.get("count") or 0)
        prev_total = float(prev_res.get("total") or 0.0)
        prev_count = int(prev_res.get("count") or 0)

        # 6. Check Historical Recorded Months in Dataset
        # If both calendar periods are empty, query latest distinct recorded months (e.g. Feb 2026 vs Jan 2026)
        hist_sql = f"""
            SELECT
                SUBSTRING((data->>%s)::text, 1, 7) AS month_str,
                COUNT(*)::bigint AS count,
                COALESCE(SUM((data->>%s)::numeric), 0) AS total
            FROM dataset_rows
            WHERE dataset_id = %s
              AND organization_id = %s
              AND (data->>%s) IS NOT NULL
              AND (data->>%s) ~ '^[-]?[0-9]+([.][0-9]+)?$'
            GROUP BY month_str
            ORDER BY month_str DESC
            LIMIT 2;
        """
        hist_rows = execute_query(hist_sql, (
            effective_date_col, effective_metric,
            dataset_id, org_id_str,
            effective_metric, effective_metric
        )) or []

        has_historical_comparison = len(hist_rows) >= 2
        historical_data = None
        if has_historical_comparison:
            latest_m = hist_rows[0]
            prior_m = hist_rows[1]
            h_latest_total = float(latest_m["total"])
            h_latest_count = int(latest_m["count"])
            h_prior_total = float(prior_m["total"])
            h_prior_count = int(prior_m["count"])
            h_abs_diff = round(h_latest_total - h_prior_total, 2)
            if h_prior_total > 0:
                h_pct = round(((h_latest_total - h_prior_total) / h_prior_total) * 100, 2)
            elif h_prior_total == 0 and h_latest_total > 0:
                h_pct = 100.0
            else:
                h_pct = 0.0

            historical_data = {
                "latest_month": latest_m["month_str"],
                "latest_total": h_latest_total,
                "latest_count": h_latest_count,
                "prior_month": prior_m["month_str"],
                "prior_total": h_prior_total,
                "prior_count": h_prior_count,
                "absolute_difference": h_abs_diff,
                "percentage_change": h_pct
            }

        # Mathematical calculations for calendar periods
        abs_diff = round(cur_total - prev_total, 2)
        if prev_total > 0:
            pct_change = round(((cur_total - prev_total) / prev_total) * 100, 2)
        elif prev_total == 0 and cur_total > 0:
            pct_change = 100.0
        else:
            pct_change = 0.0

        cur_period_label = f"November 1–{current_day}, {current_year}"
        prev_period_label = f"October 1–{current_day}, {prev_year}"

        # Choose primary comparison chart
        if cur_count > 0 or prev_count > 0:
            chart_data = [
                {"period": prev_period_label, "value": prev_total, "records": prev_count},
                {"period": cur_period_label, "value": cur_total, "records": cur_count}
            ]
            primary_view = "calendar"
        elif historical_data:
            chart_data = [
                {"period": f"{historical_data['prior_month']} (Prior Recorded)", "value": historical_data["prior_total"], "records": historical_data["prior_count"]},
                {"period": f"{historical_data['latest_month']} (Latest Recorded)", "value": historical_data["latest_total"], "records": historical_data["latest_count"]}
            ]
            primary_view = "historical"
        else:
            chart_data = [
                {"period": prev_period_label, "value": 0, "records": 0},
                {"period": cur_period_label, "value": 0, "records": 0}
            ]
            primary_view = "empty"

        return {
            "success": True,
            "has_date_column": True,
            "dataset_id": dataset_id,
            "dataset_name": ds_name,
            "metric_column": effective_metric,
            "date_column": effective_date_col,
            "reference_date": str(ref_dt),
            "current_period": {
                "label": cur_period_label,
                "start_date": cur_start_str,
                "end_date": cur_end_str,
                "total": cur_total,
                "record_count": cur_count
            },
            "previous_period": {
                "label": prev_period_label,
                "start_date": prev_start_str,
                "end_date": prev_end_str,
                "total": prev_total,
                "record_count": prev_count
            },
            "absolute_difference": abs_diff,
            "percentage_change": pct_change,
            "dataset_date_range": {
                "min_date": min_date_str,
                "max_date": max_date_str,
                "total_rows": total_rows
            },
            "has_historical_comparison": has_historical_comparison,
            "historical_data": historical_data,
            "chart_data": chart_data,
            "primary_view": primary_view,
            "formula": "Percentage Change = ((Current Total - Previous Total) / Previous Total) * 100"
        }
