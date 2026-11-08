import pytest
from app.tools.recommendation_engine import BusinessRecommendationEngine
from app.tools.dataset_discovery import DatasetDiscoveryTool
from app.tools.schema_inspector import SchemaInspectorTool
from app.tools.analytics_executor import AnalyticsExecutorTool
from app.tools.kpi_calculator import KPICalculatorTool
from app.tools.statistical_analysis import StatisticalAnalysisTool
from app.tools.forecasting import ForecastingTool

def test_recommendation_engine_sales():
    engine = BusinessRecommendationEngine()
    res = engine.execute(organization_id="00000000-0000-0000-0000-000000000001", topic="sales_growth")
    assert res["success"] is True
    assert len(res["strategic_recommendations"]) > 0

def test_dataset_discovery_tool():
    tool = DatasetDiscoveryTool()
    res = tool.execute(organization_id="00000000-0000-0000-0000-000000000001")
    assert res["success"] is True
    assert "count" in res
    assert "datasets" in res

def test_schema_inspector_tool():
    tool = SchemaInspectorTool()
    # Discover a dataset first
    disc = DatasetDiscoveryTool().execute("00000000-0000-0000-0000-000000000001")
    if disc["count"] > 0:
        ds_id = disc["datasets"][0]["id"]
        schema = tool.execute("00000000-0000-0000-0000-000000000001", dataset_id=ds_id)
        assert schema["success"] is True
        assert "columns" in schema
