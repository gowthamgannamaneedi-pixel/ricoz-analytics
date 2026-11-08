from fastapi import APIRouter, Depends, HTTPException
from app.schemas.query import QueryRequest, QueryResponse
from app.security.auth import verify_service_token
from app.agents.orchestrator import AgentOrchestrator
import logging

logger = logging.getLogger("ai_service.api.query")
router = APIRouter(prefix="/api/v1/ai", tags=["Analytical Query"])

orchestrator = AgentOrchestrator()

@router.post("/query", response_model=QueryResponse)
def execute_ai_query(
    req: QueryRequest,
    tenant_context: dict = Depends(verify_service_token)
):
    """
    Main Agentic RAG Analytical Query Endpoint:
    - Validates service-to-service authentication.
    - Isolates all queries strictly to tenant organization context.
    - Executes actual callable Python analytical tools.
    - Distinguishes general business advice from exact dataset calculations.
    """
    try:
        return orchestrator.process_query(req, tenant_context)
    except Exception as e:
        logger.error(f"Error in execute_ai_query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

