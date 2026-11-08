import pytest
import os
import sys

# Ensure ai-service is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.agents.intent_router import IntentRouter
from app.agents.orchestrator import AgentOrchestrator
from app.tools.period_comparison import PeriodComparisonTool
from app.tools.data_quality import DataQualityTool
from app.tools.kpi_calculator import KPICalculatorTool
from app.schemas.query import QueryRequest

PRIMARY_ORG_UUID = "00000000-0000-0000-0000-000000000001"


class TestIntentRouter12Questions:
    def setup_method(self):
        self.router = IntentRouter()

    def test_intent_month_over_month(self):
        res1 = self.router.classify("Compare this month with last month.")
        assert res1["intent"] == "MONTH_OVER_MONTH_COMPARISON"

        res2 = self.router.classify("how is this month performing compared to last month?")
        assert res2["intent"] == "MONTH_OVER_MONTH_COMPARISON"

        res3 = self.router.classify("month over month growth")
        assert res3["intent"] == "MONTH_OVER_MONTH_COMPARISON"

    def test_intent_dataset_context(self):
        res = self.router.classify("Which dataset are you currently analyzing?")
        assert res["intent"] == "DATASET_CONTEXT_QUERY"

    def test_intent_data_quality_missing_and_duplicates(self):
        res1 = self.router.classify("Are there any missing values in this dataset?")
        assert res1["intent"] == "DATA_QUALITY_QUERY"

        res2 = self.router.classify("Are there any duplicate records in this dataset?")
        assert res2["intent"] == "DATA_QUALITY_QUERY"

    def test_intent_average_order_value(self):
        res = self.router.classify("What is our average order value?")
        assert res["intent"] == "AOV_QUERY"

    def test_intent_trends(self):
        res = self.router.classify("Show me monthly revenue trends.")
        assert res["intent"] == "TREND_QUERY"

    def test_intent_relationship(self):
        res = self.router.classify("What is the relationship between revenue and profit?")
        assert res["intent"] == "RELATIONSHIP_EXPLANATION"

    def test_intent_scenario(self):
        res = self.router.classify("What happens if supply costs increase by 5%?")
        assert res["intent"] == "SCENARIO_SIMULATION"

    def test_intent_total_revenue(self):
        res = self.router.classify("What was our total revenue?")
        assert res["intent"] == "KPI_QUERY"

    def test_intent_highest_sales_region(self):
        res = self.router.classify("Which region has the highest sales?")
        assert res["intent"] == "RANKING"

    def test_intent_lowest_revenue_product(self):
        res = self.router.classify("Which product generated the lowest revenue?")
        assert res["intent"] == "RANKING"

    def test_intent_top_3_regions(self):
        res = self.router.classify("Who are our top 3 regions by sales?")
        assert res["intent"] == "RANKING"


class TestPeriodComparisonTool:
    def setup_method(self):
        self.tool = PeriodComparisonTool()

    def test_execute_on_dataset_391(self):
        # Mixed Variance Telemetry is dataset 391
        res = self.tool.execute(dataset_id=391, organization_id=PRIMARY_ORG_UUID, metric_column="sales_amount")
        assert res["has_date_column"] is True
        assert res["date_column"] == "date"
        assert res["metric_column"] == "sales_amount"
        assert "current_period" in res
        assert "previous_period" in res
        # November 1-8 2026 vs October 1-8 2026
        assert res["current_period"]["label"] == "November 1–8, 2026"
        assert res["previous_period"]["label"] == "October 1–8, 2026"
        # Historical months detected: Feb 2026 and Jan 2026
        assert res["has_historical_comparison"] is True
        assert res["historical_data"] is not None
        hist = res["historical_data"]
        assert hist["latest_month"] == "2026-02"
        assert hist["prior_month"] == "2026-01"
        assert hist["latest_total"] == 80000.0
        assert hist["prior_total"] == 100000.0
        assert hist["absolute_difference"] == -20000.0
        assert hist["percentage_change"] == -20.0

    def test_execute_on_dataset_without_date_column(self):
        # Dataset 390 (Customer Directory) does not have a date column
        res = self.tool.execute(dataset_id=390, organization_id=PRIMARY_ORG_UUID, metric_column="sales_amount")
        assert res["has_date_column"] is False
        assert "does not contain a usable date column" in res["error"]


class TestDataQualityTool:
    def setup_method(self):
        self.tool = DataQualityTool()

    def test_check_quality_dataset_391(self):
        res = self.tool.execute(dataset_id=391, organization_id=PRIMARY_ORG_UUID)
        assert res["total_rows"] == 8
        assert res["duplicates"]["duplicate_record_count"] == 0
        assert res["missing_values"]["by_column"]["sales_amount"] == 0
        assert res["missing_values"]["by_column"]["profit"] == 0
        assert res["missing_values"]["by_column"]["region"] == 0


class TestOrchestratorAll12Questions:
    def setup_method(self):
        self.orchestrator = AgentOrchestrator()
        self.tenant_context = {
            "organization_id": PRIMARY_ORG_UUID,
            "user_id": "test-admin",
            "role": "admin"
        }
        self.dataset_id = 391

    def test_q1_total_revenue(self):
        req = QueryRequest(message="What was our total revenue?", dataset_id=self.dataset_id)
        res = self.orchestrator.process_query(req, self.tenant_context)
        assert res.grounded is True
        assert "180,000.00" in res.answer

    def test_q2_compare_this_month_with_last_month(self):
        req = QueryRequest(message="Compare this month with last month.", dataset_id=self.dataset_id)
        res = self.orchestrator.process_query(req, self.tenant_context)
        assert res.grounded is True
        assert "Month-over-Month" in res.answer
        assert "November 1–8, 2026" in res.answer
        assert "October 1–8, 2026" in res.answer
        assert "2026-02" in res.answer
        assert "2026-01" in res.answer
        assert res.visualization is not None
        assert res.visualization["type"] == "bar"

    def test_q3_highest_sales_region(self):
        req = QueryRequest(message="Which region has the highest sales?", dataset_id=self.dataset_id)
        res = self.orchestrator.process_query(req, self.tenant_context)
        assert res.grounded is True
        assert "North" in res.answer
        assert "60,000.00" in res.answer

    def test_q4_lowest_revenue_product(self):
        req = QueryRequest(message="Which product generated the lowest revenue?", dataset_id=self.dataset_id)
        res = self.orchestrator.process_query(req, self.tenant_context)
        assert res.grounded is True
        assert "Apparel" in res.answer
        assert "65,000.00" in res.answer

    def test_q5_average_order_value(self):
        req = QueryRequest(message="What is our average order value?", dataset_id=self.dataset_id)
        res = self.orchestrator.process_query(req, self.tenant_context)
        assert res.grounded is True
        assert "22,500.00" in res.answer

    def test_q6_monthly_revenue_trends(self):
        req = QueryRequest(message="Show me monthly revenue trends.", dataset_id=self.dataset_id)
        res = self.orchestrator.process_query(req, self.tenant_context)
        assert res.grounded is True
        assert "2026-01" in res.answer
        assert "2026-02" in res.answer

    def test_q7_missing_values(self):
        req = QueryRequest(message="Are there any missing values in this dataset?", dataset_id=self.dataset_id)
        res = self.orchestrator.process_query(req, self.tenant_context)
        assert res.grounded is True
        assert "100.0%" in res.answer or "0 missing values" in res.answer

    def test_q8_duplicate_records(self):
        req = QueryRequest(message="Are there any duplicate records in this dataset?", dataset_id=self.dataset_id)
        res = self.orchestrator.process_query(req, self.tenant_context)
        assert res.grounded is True
        assert "0 duplicate" in res.answer

    def test_q9_revenue_profit_relationship(self):
        req = QueryRequest(message="What is the relationship between revenue and profit?", dataset_id=self.dataset_id)
        res = self.orchestrator.process_query(req, self.tenant_context)
        assert res.grounded is True
        assert "20.0%" in res.answer

    def test_q10_scenario_supply_costs_5pct(self):
        req = QueryRequest(message="What happens if supply costs increase by 5%?", dataset_id=self.dataset_id)
        res = self.orchestrator.process_query(req, self.tenant_context)
        assert res.grounded is True
        assert "Counterfactual Scenario Simulation" in res.answer

    def test_q11_which_dataset_analyzing(self):
        req = QueryRequest(message="Which dataset are you currently analyzing?", dataset_id=self.dataset_id)
        res = self.orchestrator.process_query(req, self.tenant_context)
        assert res.grounded is True
        assert "Mixed Variance Telemetry" in res.answer

    def test_q12_top_3_regions(self):
        req = QueryRequest(message="Who are our top 3 regions by sales?", dataset_id=self.dataset_id)
        res = self.orchestrator.process_query(req, self.tenant_context)
        assert res.grounded is True
        assert "North" in res.answer
        assert "South" in res.answer
        assert "West" in res.answer

    def test_edge_case_no_date_column_refusal(self):
        # Dataset 390 (Customer Directory) lacks date column
        req = QueryRequest(message="Compare this month with last month.", dataset_id=390)
        res = self.orchestrator.process_query(req, self.tenant_context)
        assert res.grounded is False
        assert res.insufficient_data is True
        assert "I cannot compare this month's performance with last month's because the selected dataset" in res.answer
        assert "does not contain a usable date column" in res.answer

    def test_cross_org_tenant_isolation(self):
        bad_context = {
            "organization_id": "99999999-9999-9999-9999-999999999999",
            "user_id": "hacker",
            "role": "viewer"
        }
        req = QueryRequest(message="What was our total revenue?", dataset_id=self.dataset_id)
        res = self.orchestrator.process_query(req, bad_context)
        assert res.grounded is False
        assert res.evidence_validated is False
        assert "Cross-tenant dataset access is strictly prevented" in res.answer or "not accessible" in res.answer
