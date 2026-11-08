from typing import Dict, Any, List
from app.tools.base import BaseTool
from app.database.connection import execute_query

class SemanticRetrieverTool(BaseTool):
    name: str = "semantic_retriever"
    description: str = "Retrieve tenant-scoped knowledge documents, metric definitions, and semantic dataset metadata"

    def execute(self, organization_id: str, query: str = "", top_k: int = 5, **kwargs) -> Dict[str, Any]:
        if not query or not query.strip():
            return {"success": True, "documents": []}

        clean_query = query.strip()
        search_pattern = f"%{clean_query}%"

        # Search knowledge_documents table with strict tenant filtering
        sql = """
            SELECT id, document_type, title, content, metadata, created_at
            FROM knowledge_documents
            WHERE organization_id = %s
              AND (
                title ILIKE %s
                OR content ILIKE %s
                OR document_type ILIKE %s
              )
            ORDER BY created_at DESC
            LIMIT %s;
        """
        rows = execute_query(sql, (organization_id, search_pattern, search_pattern, search_pattern, top_k))
        
        documents = []
        for r in rows:
            documents.append({
                "id": str(r["id"]),
                "document_type": r["document_type"],
                "title": r["title"],
                "snippet": (r["content"] or "")[:300],
                "metadata": r["metadata"] or {}
            })

        # Also search metric definitions from metrics table
        metric_sql = """
            SELECT id, name, formula, description, type, unit
            FROM metrics
            WHERE organization_id = %s AND (name ILIKE %s OR description ILIKE %s)
            LIMIT %s;
        """
        metric_rows = execute_query(metric_sql, (organization_id, search_pattern, search_pattern, top_k))
        for m in metric_rows:
            documents.append({
                "id": str(m["id"]),
                "document_type": "metric_definition",
                "title": m["name"],
                "snippet": f"Metric {m['name']}: {m['description'] or ''}. Formula: {m['formula'] or m['type']}",
                "metadata": {"formula": m["formula"], "type": m["type"], "unit": m["unit"]}
            })

        return {
            "success": True,
            "count": len(documents),
            "documents": documents
        }
