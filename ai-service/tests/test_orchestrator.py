import pytest
from app.agents.orchestrator import AgentOrchestrator
from app.schemas.query import QueryRequest

def test_orchestrator_sales_growth_multi_step():
    """
    Guarantees that 'how to increase my sales' executes multi-dimensional analysis,
    discovers datasets, runs tool calls, and produces actionable growth levers.
    """
    orchestrator = AgentOrchestrator()
    req = QueryRequest(message="how to increase my sales")
    context = {
        "organization_id": "00000000-0000-0000-0000-000000000001",
        "user_id": "1",
        "role": "admin"
    }
    res = orchestrator.process_query(req, context)
    
    assert res.intent == "SALES_GROWTH_ANALYSIS"
    assert res.grounded is True
    assert "Sales Growth Analysis" in res.answer
    assert "Recommended Growth Levers" in res.answer
    assert len(res.tool_executions) >= 2
    # Check that tool execution names are recorded
    tool_names = [t.tool_name for t in res.tool_executions]
    assert "dataset_discovery" in tool_names or "schema_inspector" in tool_names
    assert "business_recommendation_engine" in tool_names

def test_orchestrator_dataset_kpi_grounded():
    """
    Tests that KPI questions execute tools, calculate metrics, verify proof, and return provenance.
    """
    orchestrator = AgentOrchestrator()
    req = QueryRequest(message="what is my total revenue?")
    context = {
        "organization_id": "00000000-0000-0000-0000-000000000001",
        "user_id": "1",
        "role": "admin"
    }
    res = orchestrator.process_query(req, context)
    
    assert res.intent == "KPI_QUERY"
    assert res.grounded is True
    assert res.provenance is not None
    assert res.provenance.dataset_id is not None
    assert res.data.get("value") is not None
    assert "Verified" in res.answer

def test_orchestrator_dataset_exploration():
    """
    Tests that dataset exploration inspects columns and identifies missing business dimensions.
    """
    orchestrator = AgentOrchestrator()
    req = QueryRequest(message="what information is missing from my dataset?")
    context = {
        "organization_id": "00000000-0000-0000-0000-000000000001",
        "user_id": "1",
        "role": "admin"
    }
    res = orchestrator.process_query(req, context)

    assert res.intent == "DATASET_EXPLORATION"
    assert res.grounded is True
    assert "Dataset Schema & Coverage Inspection" in res.answer
    assert "Tracked Columns" in res.answer
