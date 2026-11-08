import pytest
from app.agents.intent_router import IntentRouter

def test_intent_conversational():
    res = IntentRouter.classify("hello there")
    assert res["intent"] == "CONVERSATIONAL"
    assert res["requires_database"] is False

def test_intent_sales_growth():
    res = IntentRouter.classify("how to increase my sales")
    assert res["intent"] == "SALES_GROWTH_ANALYSIS"
    assert res["requires_database"] is True

def test_intent_sales_growth_typo():
    res = IntentRouter.classify("how to increse my sales")
    assert res["intent"] == "SALES_GROWTH_ANALYSIS"
    assert res["requires_database"] is True

def test_intent_revenue_decline():
    res = IntentRouter.classify("why did my revenue decrease")
    assert res["intent"] == "REVENUE_DECLINE_ANALYSIS"
    assert res["requires_database"] is True

def test_intent_dataset_exploration():
    res = IntentRouter.classify("what information is missing from my dataset")
    assert res["intent"] == "DATASET_EXPLORATION"
    assert res["requires_database"] is True

def test_intent_profitability():
    res = IntentRouter.classify("how can I improve my profit margin?")
    assert res["intent"] == "PROFITABILITY_ANALYSIS"
    assert res["requires_database"] is True

def test_intent_dataset_total_revenue():
    res = IntentRouter.classify("what is my total revenue?")
    assert res["intent"] == "KPI_QUERY"
    assert res["requires_database"] is True

def test_intent_dataset_regional_breakdown():
    res = IntentRouter.classify("which region generates the most revenue?")
    assert res["intent"] == "RANKING"
    assert res["requires_database"] is True

def test_intent_dataset_forecast():
    res = IntentRouter.classify("forecast next quarter sales")
    assert res["intent"] == "FORECAST"
    assert res["requires_database"] is True

def test_intent_scenario_simulation():
    res = IntentRouter.classify("what happens if operating costs increase by 10%?")
    assert res["intent"] == "SCENARIO_SIMULATION"
    assert res["requires_database"] is True
