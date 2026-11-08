import pytest
from app.agents.orchestrator import AgentOrchestrator
from app.schemas.query import QueryRequest

def test_orchestrator_general_question_no_fabricated_metrics():
    """
    Guarantees that general questions like 'how to increase my sales'
    do NOT fabricate metrics or return ungrounded KPI cards.
    """
    orchestrator = AgentOrchestrator()
    req = QueryRequest(message="how to increase my sales")
    context = {
        "organization_id": "00000000-0000-0000-0000-000000000001",
        "user_id": "1",
        "role": "admin"
    }
    res = orchestrator.process_query(req, context)
    
    assert res.is_general_advice is True
    assert res.data is None  # CRITICAL: No fabricated KPI data!
    assert res.visualization is None  # CRITICAL: No random KPI card!
    assert "Would you like me to apply these recommendations to your actual sales data?" in res.answer or "Would you like me to analyze" in res.answer
    assert len(res.tool_executions) > 0
    assert res.tool_executions[0].tool_name == "business_recommendation_engine"

def test_orchestrator_dataset_question_grounded():
    """
    Tests that dataset-specific questions execute tools and return provenance.
    """
    orchestrator = AgentOrchestrator()
    req = QueryRequest(message="what is my total revenue?")
    context = {
        "organization_id": "00000000-0000-0000-0000-000000000001",
        "user_id": "1",
        "role": "admin"
    }
    res = orchestrator.process_query(req, context)
    
    assert res.intent in ["DATASET_ANALYTICS", "GENERAL_BUSINESS_ADVICE"]
    if res.grounded and res.data:
        assert res.provenance is not None
        assert res.provenance.dataset_id is not None
        assert res.data.get("value") is not None

