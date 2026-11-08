from typing import Dict, Any, List
from app.tools.base import BaseTool
from app.database.connection import execute_query

class SchemaInspectorTool(BaseTool):
    name: str = "schema_inspector"
    description: str = "Inspect column names, data types, sample values, and summary statistics of a specific dataset"

    def execute(self, organization_id: str, dataset_id: int = None, **kwargs) -> Dict[str, Any]:
        if not dataset_id:
            return {"success": False, "error": "dataset_id is required"}

        # Fetch dataset record
        sql = """
            SELECT id, name, description, row_count, column_count, schema, metadata
            FROM datasets
            WHERE id = %s AND organization_id = %s
            LIMIT 1;
        """
        dataset = execute_query(sql, (dataset_id, organization_id), fetch_one=True)
        if not dataset:
            return {"success": False, "error": f"Dataset {dataset_id} not found in this organization"}

        # Fetch sample rows from dataset_rows to inspect actual JSONB structure
        sample_sql = """
            SELECT data
            FROM dataset_rows
            WHERE dataset_id = %s AND organization_id = %s
            ORDER BY row_index ASC
            LIMIT 5;
        """
        sample_rows = execute_query(sample_sql, (dataset_id, organization_id))
        sample_records = [r["data"] for r in sample_rows if isinstance(r.get("data"), dict)]

        # Extract columns and infer numeric vs categorical vs temporal
        raw_schema = dataset.get("schema") or []
        columns = []
        if isinstance(raw_schema, list) and len(raw_schema) > 0:
            for item in raw_schema:
                if isinstance(item, dict):
                    columns.append({
                        "name": item.get("name") or item.get("key"),
                        "type": item.get("type", "string"),
                        "nullable": item.get("nullable", True)
                    })
                elif isinstance(item, str):
                    columns.append({"name": item, "type": "string", "nullable": True})
        elif sample_records:
            first = sample_records[0]
            for k, v in first.items():
                inferred_type = "number" if isinstance(v, (int, float)) else "boolean" if isinstance(v, bool) else "string"
                columns.append({"name": k, "type": inferred_type, "nullable": True})

        numeric_cols = [c["name"] for c in columns if c["type"] in ["number", "numeric", "integer", "float", "double"]]
        categorical_cols = [c["name"] for c in columns if c["name"] not in numeric_cols]

        return {
            "success": True,
            "dataset_id": dataset["id"],
            "dataset_name": dataset["name"],
            "row_count": int(dataset["row_count"] or 0),
            "column_count": len(columns),
            "columns": columns,
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols,
            "sample_rows": sample_records
        }

