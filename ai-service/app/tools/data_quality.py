from typing import Dict, Any, List, Optional
from app.tools.base import BaseTool
from app.database.connection import execute_query

class DataQualityTool(BaseTool):
    name: str = "data_quality"
    description: str = "Inspect missing values, nulls, and duplicate records across dataset rows"

    def execute(
        self,
        organization_id: str,
        dataset_id: int,
        inspection_type: str = "all", # "missing_values", "duplicates", "all"
        **kwargs
    ) -> Dict[str, Any]:
        if not dataset_id:
            return {"success": False, "error": "dataset_id is required"}

        org_id_str = str(organization_id).strip()
        if org_id_str in ("1", "default", "primary"):
            org_id_str = "00000000-0000-0000-0000-000000000001"

        # 1. Fetch dataset metadata
        ds_sql = "SELECT id, name, row_count, schema FROM datasets WHERE id = %s AND organization_id = %s LIMIT 1;"
        ds = execute_query(ds_sql, (dataset_id, org_id_str), fetch_one=True)
        if not ds:
            return {"success": False, "error": f"Dataset {dataset_id} not found"}

        ds_name = ds["name"]
        raw_schema = ds.get("schema") or []
        columns = [c.get("name") for c in raw_schema if isinstance(c, dict) and c.get("name")]

        # Sample row if schema missing
        if not columns:
            sample_row = execute_query(
                "SELECT data FROM dataset_rows WHERE dataset_id = %s AND organization_id = %s LIMIT 1;",
                (dataset_id, org_id_str), fetch_one=True
            )
            if sample_row and isinstance(sample_row.get("data"), dict):
                columns = list(sample_row["data"].keys())

        # Total rows
        cnt_row = execute_query(
            "SELECT COUNT(*)::bigint AS total FROM dataset_rows WHERE dataset_id = %s AND organization_id = %s;",
            (dataset_id, org_id_str), fetch_one=True
        )
        total_rows = int(cnt_row.get("total") or 0)

        # 2. Check Missing Values per Column
        missing_by_col = {}
        total_missing = 0
        for col in columns:
            clean_c = "".join(c for c in col if c.isalnum() or c == "_")
            sql = f"""
                SELECT COUNT(*)::bigint AS missing_count
                FROM dataset_rows
                WHERE dataset_id = %s
                  AND organization_id = %s
                  AND ((data->>%s) IS NULL OR (data->>%s) = '' OR LOWER(data->>%s) IN ('null', 'none', 'nan', 'n/a'));
            """
            res = execute_query(sql, (dataset_id, org_id_str, clean_c, clean_c, clean_c), fetch_one=True)
            m_count = int(res.get("missing_count") or 0)
            missing_by_col[col] = m_count
            total_missing += m_count

        # 3. Check Duplicate Records
        dup_sql = """
            SELECT COUNT(*)::bigint AS duplicate_records
            FROM (
                SELECT data, COUNT(*) AS count
                FROM dataset_rows
                WHERE dataset_id = %s AND organization_id = %s
                GROUP BY data
                HAVING COUNT(*) > 1
            ) sub;
        """
        dup_res = execute_query(dup_sql, (dataset_id, org_id_str), fetch_one=True)
        dup_count = int(dup_res.get("duplicate_records") or 0)

        completeness_pct = round(((total_rows * len(columns) - total_missing) / (total_rows * len(columns)) * 100), 2) if total_rows > 0 and columns else 100.0

        return {
            "success": True,
            "dataset_id": dataset_id,
            "dataset_name": ds_name,
            "total_rows": total_rows,
            "total_columns": len(columns),
            "columns": columns,
            "missing_values": {
                "total_missing": total_missing,
                "completeness_percentage": completeness_pct,
                "by_column": missing_by_col
            },
            "duplicates": {
                "duplicate_record_count": dup_count,
                "uniqueness_percentage": 100.0 if dup_count == 0 else round((1 - dup_count / total_rows) * 100, 2)
            }
        }
