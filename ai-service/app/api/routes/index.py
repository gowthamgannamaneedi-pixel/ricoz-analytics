import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import psycopg2.extras
from app.security.auth import verify_service_token
from app.database.connection import execute_query
import logging

logger = logging.getLogger("ai_service.api.index")
router = APIRouter(prefix="/api/v1/ai", tags=["Indexing"])

class IndexDatasetRequest(BaseModel):
    dataset_id: int = Field(..., description="Target dataset ID to index")

@router.post("/index")
def index_dataset(
    req: IndexDatasetRequest,
    tenant_context: dict = Depends(verify_service_token)
):
    org_id = tenant_context["organization_id"]
    ds_id = req.dataset_id

    # Verify dataset belongs to tenant
    ds = execute_query(
        "SELECT id, name, description, schema, row_count FROM datasets WHERE id = %s AND organization_id = %s LIMIT 1;",
        (ds_id, org_id),
        fetch_one=True
    )
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found in this organization")

    # Insert or update dataset dictionary into knowledge_documents
    content_text = f"Dataset: {ds['name']}. Description: {ds['description'] or ''}. Row count: {ds['row_count']}. Columns: {[c.get('name') for c in ds.get('schema', []) if isinstance(c, dict)]}"
    
    upsert_sql = """
        INSERT INTO knowledge_documents (organization_id, document_type, title, source_id, content, metadata, updated_at)
        VALUES (%s, 'dataset_dictionary', %s, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING;
    """
    execute_query(
        upsert_sql,
        (org_id, f"Dictionary: {ds['name']}", str(ds_id), content_text, psycopg2.extras.Json({"dataset_id": ds_id, "row_count": ds["row_count"]}))
    )

    return {
        "success": True,
        "dataset_id": ds_id,
        "dataset_name": ds["name"],
        "indexed": True
    }
