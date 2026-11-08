from fastapi import APIRouter
from app.database.connection import check_db_health
from app.config import settings

router = APIRouter(prefix="/api/v1/ai", tags=["Health"])

@router.get("/health")
def get_service_health():
    db_ok = check_db_health()
    status_str = "healthy" if db_ok else "degraded"
    return {
        "status": status_str,
        "service": "ricoz-analytics-ai-service",
        "version": "2.0.0",
        "environment": settings.ENVIRONMENT,
        "database_connected": db_ok,
        "tools_loaded": [
            "dataset_discovery",
            "schema_inspector",
            "semantic_retriever",
            "analytics_executor",
            "kpi_calculator",
            "statistical_analysis",
            "forecasting",
            "business_recommendation_engine"
        ]
    }

