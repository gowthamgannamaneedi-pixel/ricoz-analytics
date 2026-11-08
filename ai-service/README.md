# RicozAnalytics — Python Agentic RAG Microservice

Production-grade Python FastAPI analytical microservice integrated into RicozAnalytics. Replaces ungrounded LLM mock responses with bounded agentic orchestration, tenant-scoped semantic retrieval, and safe deterministic analytical execution.

## Features

- **Bounded Agent Orchestrator:** Intent-routed loop dispatching actual callable analytical tools with zero infinite loops.
- **Tenant Isolation:** Enforces strict multi-tenant boundary via service-to-service authentication (`X-Service-Token`) and database scoping (`WHERE organization_id = %s`).
- **Zero Fabricated Numbers:** Pure general business advice for strategic queries (e.g. "how to increase my sales") without fake KPI cards; verified deterministic SQL calculations on real `dataset_rows` for analytical queries.
- **8 Production Analytical Tools:**
  1. `DatasetDiscoveryTool`: Tenant-scoped dataset discovery.
  2. `SchemaInspectorTool`: Column type detection and metadata extraction.
  3. `SemanticRetrieverTool`: Semantic retrieval from `knowledge_documents` and metrics.
  4. `AnalyticsExecutorTool`: Parameterized read-only SQL on `dataset_rows` with strict statement inspection.
  5. `KPICalculatorTool`: Exact financial KPI formulas (Revenue, Gross Margin, Units).
  6. `StatisticalAnalysisTool`: Variance, standard deviation, and 2-sigma outlier detection.
  7. `ForecastingTool`: Linear regression forecasting with 95% confidence intervals.
  8. `BusinessRecommendationEngine`: Actionable strategies distinguishing facts from recommendations.

## Quickstart

```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
```

## Running Tests

```bash
pytest tests/
```

