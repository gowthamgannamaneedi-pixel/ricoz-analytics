from typing import Dict, Any, List
from app.tools.base import BaseTool
from app.database.connection import execute_query

class DatasetDiscoveryTool(BaseTool):
    name: str = "dataset_discovery"
    description: str = "Discover datasets accessible to the authenticated tenant organization"

    def execute(self, organization_id: str, **kwargs) -> Dict[str, Any]:
        sql = """
            SELECT id, name, description, row_count, column_count, schema, created_at, updated_at
            FROM datasets
            WHERE organization_id = %s
            ORDER BY updated_at DESC NULLS LAST, created_at DESC;
        """
        rows = execute_query(sql, (organization_id,))
        datasets = []
        for r in rows:
            datasets.append({
                "id": r["id"],
                "name": r["name"],
                "description": r["description"] or "",
                "row_count": int(r["row_count"] or 0),
                "column_count": int(r["column_count"] or 0),
                "columns": [col.get("name") for col in r.get("schema", []) if isinstance(col, dict)] if r.get("schema") else [],
                "created_at": r["created_at"].isoformat() if r.get("created_at") else None
            })
        return {
            "success": True,
            "count": len(datasets),
            "datasets": datasets
        }
