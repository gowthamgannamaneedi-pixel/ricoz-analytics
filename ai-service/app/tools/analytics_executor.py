from typing import Dict, Any, List, Optional
from app.tools.base import BaseTool
from app.database.connection import execute_query
from app.security.sanitization import is_safe_read_query
from app.config import settings

class AnalyticsExecutorTool(BaseTool):
    name: str = "analytics_executor"
    description: str = "Execute safe, parameterized analytical aggregation queries on structured dataset rows"

    def execute(
        self,
        organization_id: str,
        dataset_id: int,
        metric_column: str = "revenue",
        aggregation: str = "SUM",
        group_by_column: Optional[str] = None,
        date_column: Optional[str] = None,
        limit: int = 100,
        **kwargs
    ) -> Dict[str, Any]:
        if not dataset_id:
            return {"success": False, "error": "dataset_id is required"}

        # Validate aggregation function
        allowed_aggs = ["SUM", "COUNT", "AVG", "MIN", "MAX"]
        agg_func = aggregation.upper().strip()
        if agg_func not in allowed_aggs:
            agg_func = "SUM"

        # Sanitize column names: only alphanumeric and underscores
        clean_metric = "".join(c for c in metric_column if c.isalnum() or c == "_")
        clean_group = "".join(c for c in group_by_column if c.isalnum() or c == "_") if group_by_column else None
        clean_date = "".join(c for c in date_column if c.isalnum() or c == "_") if date_column else None

        row_limit = min(limit, settings.MAX_RESULT_ROWS)

        # 1. Simple Aggregate (no GROUP BY)
        if not clean_group and not clean_date:
            if agg_func == "COUNT":
                sql = """
                    SELECT COUNT(*)::bigint AS aggregate_value
                    FROM dataset_rows
                    WHERE dataset_id = %s AND organization_id = %s;
                """
            else:
                sql = f"""
                    SELECT {agg_func}((data->>%s)::numeric) AS aggregate_value
                    FROM dataset_rows
                    WHERE dataset_id = %s
                      AND organization_id = %s
                      AND (data->>%s) IS NOT NULL
                      AND (data->>%s) ~ '^[-]?[0-9]+([.][0-9]+)?$';
                """
            
            params = (clean_metric, dataset_id, organization_id, clean_metric, clean_metric) if agg_func != "COUNT" else (dataset_id, organization_id)
            safe, err_msg = is_safe_read_query(sql)
            if not safe:
                return {"success": False, "error": err_msg}

            row = execute_query(sql, params, fetch_one=True)
            val = float(row["aggregate_value"]) if row and row.get("aggregate_value") is not None else 0.0

            return {
                "success": True,
                "dataset_id": dataset_id,
                "aggregation": agg_func,
                "metric_column": clean_metric,
                "value": round(val, 2),
                "sql_executed": sql.strip()
            }

        # 2. Grouped Aggregate (e.g. GROUP BY region, channel, category)
        group_field = clean_group or clean_date
        sql = f"""
            SELECT (data->>%s) AS category,
                   {agg_func}((data->>%s)::numeric) AS aggregate_value,
                   COUNT(*)::bigint AS count
            FROM dataset_rows
            WHERE dataset_id = %s
              AND organization_id = %s
              AND (data->>%s) IS NOT NULL
              AND (data->>%s) IS NOT NULL
              AND (data->>%s) ~ '^[-]?[0-9]+([.][0-9]+)?$'
            GROUP BY (data->>%s)
            ORDER BY aggregate_value DESC NULLS LAST
            LIMIT %s;
        """
        params = (
            group_field, clean_metric,
            dataset_id, organization_id,
            group_field, clean_metric, clean_metric,
            group_field, row_limit
        )

        safe, err_msg = is_safe_read_query(sql)
        if not safe:
            return {"success": False, "error": err_msg}

        rows = execute_query(sql, params)
        breakdown = []
        for r in rows:
            breakdown.append({
                "category": r["category"] or "Unknown",
                "value": round(float(r["aggregate_value"]), 2) if r.get("aggregate_value") is not None else 0.0,
                "count": int(r.get("count") or 0)
            })

        return {
            "success": True,
            "dataset_id": dataset_id,
            "aggregation": agg_func,
            "metric_column": clean_metric,
            "group_by": group_field,
            "results": breakdown,
            "sql_executed": sql.strip()
        }
