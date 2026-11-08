import pytest
from app.agents.intent_router import IntentRouter

def test_intent_conversational():
    res = IntentRouter.classify("hello there")
    assert res["intent"] == "CONVERSATIONAL"
    assert res["requires_database"] is False

def test_intent_general_advice_sales():
    res = IntentRouter.classify("how to increase my sales")
    assert res["intent"] == "GENERAL_BUSINESS_ADVICE"
    assert res["requires_database"] is False
    assert res["is_general_advice"] is True
    assert res["topic"] == "sales_growth"

def test_intent_general_advice_margin():
    res = IntentRouter.classify("how can I improve my profit margin?")
    assert res["intent"] == "GENERAL_BUSINESS_ADVICE"
    assert res["is_general_advice"] is True

def test_intent_dataset_total_revenue():
    res = IntentRouter.classify("what is my total revenue?")
    assert res["intent"] == "DATASET_ANALYTICS"
    assert res["requires_database"] is True

def test_intent_dataset_regional_breakdown():
    res = IntentRouter.classify("which region generates the most revenue?")
    assert res["intent"] == "DATASET_ANALYTICS"
    assert res["requires_database"] is True

def test_intent_dataset_forecast():
    res = IntentRouter.classify("forecast next quarter sales")
    assert res["intent"] == "DATASET_ANALYTICS"
    assert res["requires_database"] is True

