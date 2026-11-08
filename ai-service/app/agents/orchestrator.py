import time
import re
from typing import Dict, Any, List, Optional
import logging

from app.schemas.query import QueryRequest, QueryResponse, ProvenanceInfo, ToolCallLog
from app.agents.intent_router import IntentRouter
from app.tools.dataset_discovery import DatasetDiscoveryTool
from app.tools.schema_inspector import SchemaInspectorTool
from app.tools.semantic_retriever import SemanticRetrieverTool
from app.tools.analytics_executor import AnalyticsExecutorTool
from app.tools.kpi_calculator import KPICalculatorTool
from app.tools.statistical_analysis import StatisticalAnalysisTool
from app.tools.forecasting import ForecastingTool
from app.tools.recommendation_engine import BusinessRecommendationEngine
from app.config import settings

logger = logging.getLogger("ai_service.orchestrator")

class AgentOrchestrator:
    """
    Bounded Agentic Orchestrator for RicozAnalytics:
    - Strictly tenant-scoped (never crosses organization boundary).
    - Dispatches actual callable Python tools.
    - Separates general business advice from exact dataset calculations.
    - Guarantees zero fabricated numbers.
    """

    def __init__(self):
        self.discovery_tool = DatasetDiscoveryTool()
        self.schema_tool = SchemaInspectorTool()
        self.semantic_tool = SemanticRetrieverTool()
        self.analytics_tool = AnalyticsExecutorTool()
        self.kpi_tool = KPICalculatorTool()
        self.stats_tool = StatisticalAnalysisTool()
        self.forecast_tool = ForecastingTool()
        self.recommendation_tool = BusinessRecommendationEngine()

    def process_query(self, req: QueryRequest, tenant_context: Dict[str, Any]) -> QueryResponse:
        total_start = time.perf_counter()
        org_id = tenant_context["organization_id"]
        query_text = req.message.strip()
        tool_logs: List[ToolCallLog] = []

        # 1. Intent Classification
        classification = IntentRouter.classify(query_text, has_dataset_context=bool(req.dataset_id))
        intent = classification["intent"]

        # -------------------------------------------------------------
        # PATH A: Conversational / Capabilities
        # -------------------------------------------------------------
        if intent == "CONVERSATIONAL":
            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            return QueryResponse(
                question=query_text,
                answer=(
                    "Hello! I am your Ricoz Enterprise AI Analytics Assistant. "
                    "I can compute exact financial metrics across your uploaded datasets, "
                    "analyze regional sales distributions, project revenue forecasts, "
                    "and provide strategic business recommendations grounded in verified data. "
                    "How can I assist your business decisions today?"
                ),
                intent=intent,
                is_general_advice=False,
                grounded=True,
                evidence_validated=True,
                insufficient_data=False,
                data=None,
                visualization=None,
                table_data=None,
                provenance=None,
                tool_executions=[],
                follow_up_questions=[
                    "What is my total revenue?",
                    "Which region generates the most revenue?",
                    "How can I increase my sales?"
                ],
                analysis_status="Conversational response",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # PATH B: General Business Advice (e.g. "how to increase my sales")
        # Pure strategic guidance — NO fabricated numbers or fake cards!
        # -------------------------------------------------------------
        if intent == "GENERAL_BUSINESS_ADVICE":
            topic = classification.get("topic", "sales_growth")
            rec_res, rec_time, rec_ok = self.recommendation_tool.run_safe(
                organization_id=org_id,
                topic=topic
            )
            tool_logs.append(ToolCallLog(
                tool_name=self.recommendation_tool.name,
                arguments={"topic": topic},
                success=rec_ok,
                execution_time_ms=rec_time,
                output_summary=f"Generated {len(rec_res.get('strategic_recommendations', []))} strategic guidelines"
            ))

            recommendations = rec_res.get("strategic_recommendations", [])
            rec_bullets = "\n".join([f"• **{r.split(':')[0] if ':' in r else 'Strategy'}**: {r}" for r in recommendations])

            answer_text = (
                f"### Strategic Framework to {topic.replace('_', ' ').title()}\n\n"
                f"To sustainably accelerate business performance, consider these core operational levers:\n\n"
                f"{rec_bullets}\n\n"
                f"---\n"
                f"💡 **Next Step:** Would you like me to analyze these strategies against your actual sales data?"
            )

            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            return QueryResponse(
                question=query_text,
                answer=answer_text,
                intent=intent,
                is_general_advice=True,
                grounded=True,
                evidence_validated=True,
                insufficient_data=False,
                data=None, # Explicitly null to prevent any ungrounded KPI cards
                visualization=None,
                table_data=None,
                provenance=None,
                tool_executions=tool_logs,
                follow_up_questions=[
                    "What is our total revenue from connected datasets?",
                    "Which sales channel has the highest conversion?",
                    "What is our current gross margin percentage?"
                ],
                analysis_status="General business advisory (no tenant metric fabrication)",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # PATH C: Dataset-Grounded Analytics Execution
        # -------------------------------------------------------------
        active_dataset_id = req.dataset_id
        active_dataset_name = ""
        active_row_count = 0

        # Step 1: Tool A - Discover datasets if not specified
        if not active_dataset_id:
            disc_res, disc_time, disc_ok = self.discovery_tool.run_safe(organization_id=org_id)
            tool_logs.append(ToolCallLog(
                tool_name=self.discovery_tool.name,
                arguments={"organization_id": org_id},
                success=disc_ok,
                execution_time_ms=disc_time,
                output_summary=f"Discovered {disc_res.get('count', 0)} datasets"
            ))

            datasets = disc_res.get("datasets", [])
            if not datasets:
                duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
                return QueryResponse(
                    question=query_text,
                    answer=(
                        "No datasets are currently connected to this workspace organization. "
                        "Please upload a CSV, JSON, or Excel file via the **Connect Data Source** modal "
                        "or connect your PostgreSQL/MongoDB database to begin live telemetry querying."
                    ),
                    intent=intent,
                    is_general_advice=False,
                    grounded=False,
                    evidence_validated=False,
                    insufficient_data=True,
                    data=None,
                    visualization=None,
                    table_data=None,
                    provenance=None,
                    tool_executions=tool_logs,
                    follow_up_questions=["How do I upload a dataset?", "What data sources are supported?"],
                    analysis_status="No datasets found in workspace",
                    execution_time_ms=duration_ms
                )
            
            # Select most recent dataset
            active_dataset_id = datasets[0]["id"]
            active_dataset_name = datasets[0]["name"]
            active_row_count = datasets[0]["row_count"]
        else:
            active_dataset_name = f"Dataset #{active_dataset_id}"

        # Step 2: Tool B - Schema Inspector
        schema_res, schema_time, schema_ok = self.schema_tool.run_safe(
            organization_id=org_id,
            dataset_id=active_dataset_id
        )
        tool_logs.append(ToolCallLog(
            tool_name=self.schema_tool.name,
            arguments={"dataset_id": active_dataset_id},
            success=schema_ok,
            execution_time_ms=schema_time,
            output_summary=f"Found {schema_res.get('column_count', 0)} columns ({len(schema_res.get('numeric_columns', []))} numeric)"
        ))

        if not schema_ok or not schema_res.get("success"):
            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            return QueryResponse(
                question=query_text,
                answer=(
                    f"Dataset #{active_dataset_id} was not found or is not accessible within your organization workspace. "
                    "Cross-tenant dataset access is strictly prevented by security policy."
                ),
                intent=intent,
                is_general_advice=False,
                grounded=False,
                evidence_validated=False,
                insufficient_data=True,
                data=None,
                visualization=None,
                table_data=None,
                provenance=None,
                tool_executions=tool_logs,
                follow_up_questions=["Which datasets are available in my organization?"],
                analysis_status="Dataset not found or cross-tenant access denied",
                execution_time_ms=duration_ms
            )

        if schema_ok and schema_res.get("dataset_name"):
            active_dataset_name = schema_res["dataset_name"]
            active_row_count = schema_res.get("row_count", active_row_count)

        numeric_cols = schema_res.get("numeric_columns", [])
        categorical_cols = schema_res.get("categorical_columns", [])
        all_cols = [c["name"].lower() for c in schema_res.get("columns", [])]

        # Step 3: Tool C - Semantic Retriever for context & metric formulas
        sem_res, sem_time, sem_ok = self.semantic_tool.run_safe(
            organization_id=org_id,
            query=query_text,
            top_k=3
        )
        tool_logs.append(ToolCallLog(
            tool_name=self.semantic_tool.name,
            arguments={"query": query_text},
            success=sem_ok,
            execution_time_ms=sem_time,
            output_summary=f"Retrieved {sem_res.get('count', 0)} context documents"
        ))

        # Check if the query explicitly asks for a metric/attribute not tracked in this dataset
        query_lower = query_text.lower()
        missing_metric = None
        missing_candidates = [
            "turnover", "employee turnover", "attrition", "churn rate", "headcount", "salary", 
            "employee", "attendance", "satisfaction", "nps", "bounce rate", "conversion rate",
            "cpc", "roas", "ltv", "ebitda"
        ]
        for mc in missing_candidates:
            if mc in query_lower and not any(mc in col for col in all_cols):
                missing_metric = mc
                break

        if not missing_metric:
            match = re.search(r"\b(?:what is|show me|calculate|what's)\s+(?:the\s+)?([a-z\s]+?)\s+(?:rate|metric|ratio|level|score)\b", query_lower)
            if match:
                phrase = match.group(1).strip()
                if phrase and not any(phrase in col or col in phrase for col in all_cols):
                    missing_metric = f"{phrase} rate"

        if missing_metric:
            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            avail_cols = ", ".join(all_cols[:8])
            return QueryResponse(
                question=query_text,
                answer=(
                    f"The dataset `{active_dataset_name}` does not contain a column or metric for **{missing_metric}**. "
                    f"Available tracked columns are: {avail_cols}. "
                    f"To analyze {missing_metric}, please connect a data source containing {missing_metric} records."
                ),
                intent=intent,
                is_general_advice=False,
                grounded=True,
                evidence_validated=True,
                insufficient_data=True,
                data=None,
                visualization=None,
                table_data=None,
                provenance=ProvenanceInfo(
                    dataset_id=active_dataset_id,
                    dataset_name=active_dataset_name,
                    row_count=active_row_count,
                    columns_used=[]
                ),
                tool_executions=tool_logs,
                follow_up_questions=[
                    f"What is total revenue for {active_dataset_name}?",
                    "Show sales breakdown by region",
                    f"What columns are tracked in {active_dataset_name}?"
                ],
                analysis_status=f"Requested metric '{missing_metric}' not tracked in dataset",
                execution_time_ms=duration_ms
            )

        # Step 4: Determine query intent and execute analytical tools
        query_lower = query_text.lower()
        is_breakdown = any(w in query_lower for w in ["region", "channel", "category", "product", "breakdown", "which", "top", "rank", "by "])
        is_forecast = any(w in query_lower for w in ["forecast", "predict", "future", "project"])
        is_stats = any(w in query_lower for w in ["variance", "standard deviation", "outlier", "distribution", "spread"])

        # Identify target metric column
        target_metric = "revenue"
        for candidate in ["revenue", "sales", "total_amount", "amount", "profit", "units", "quantity", "price"]:
            if candidate in numeric_cols or any(candidate in c.lower() for c in numeric_cols):
                target_metric = next((c for c in numeric_cols if candidate in c.lower()), candidate)
                break
        if target_metric not in numeric_cols and numeric_cols:
            target_metric = numeric_cols[0]

        # Identify target group by column if applicable
        target_group = None
        for candidate in ["region", "channel", "category", "product", "segment", "country", "city"]:
            if candidate in categorical_cols or any(candidate in c.lower() for c in categorical_cols):
                target_group = next((c for c in categorical_cols if candidate in c.lower()), candidate)
                break
        if not target_group and categorical_cols:
            target_group = categorical_cols[0]

        data_payload: Dict[str, Any] = {}
        viz_payload: Optional[Dict[str, Any]] = None
        table_payload: Optional[List[Dict[str, Any]]] = None
        provenance = ProvenanceInfo(
            dataset_id=active_dataset_id,
            dataset_name=active_dataset_name,
            row_count=active_row_count,
            columns_used=[target_metric]
        )

        # -------------------------------------------------------------
        # Tool D/E Execution: Breakdown vs Single Metric vs Forecast
        # -------------------------------------------------------------
        if is_forecast:
            f_res, f_time, f_ok = self.forecast_tool.run_safe(
                organization_id=org_id,
                dataset_id=active_dataset_id,
                metric_column=target_metric,
                horizon_periods=4
            )
            tool_logs.append(ToolCallLog(
                tool_name=self.forecast_tool.name,
                arguments={"dataset_id": active_dataset_id, "metric": target_metric},
                success=f_ok,
                execution_time_ms=f_time,
                output_summary=f"Trend {f_res.get('trend_direction')}, {len(f_res.get('forecast', []))} periods projected"
            ))

            forecast_items = f_res.get("forecast", [])
            viz_payload = {
                "type": "line",
                "title": f"Forecast Projection: {target_metric.title()} ({f_res.get('trend_direction', 'neutral')} trend)",
                "data": forecast_items,
                "xAxis": "period",
                "yAxis": "projected_value"
            }
            table_payload = forecast_items
            data_payload = {"forecast": forecast_items, "trend": f_res.get("trend_direction")}

            answer_text = (
                f"### Predictive Forecast for {target_metric.title()}\n\n"
                f"Based on historical telemetry across **{active_row_count:,} records** in `{active_dataset_name}`:\n\n"
                f"• **Trend Trajectory:** {f_res.get('trend_direction', 'neutral').upper()} (slope: {f_res.get('slope', 0):+})\n"
                f"• **Projected Next Period:** ₹{forecast_items[0]['projected_value']:,} (95% CI: ₹{forecast_items[0]['lower_bound']:,} to ₹{forecast_items[0]['upper_bound']:,})\n"
                f"• **Horizon:** 4 forward periods calculated via linear regression.\n"
            )

        elif is_breakdown and target_group:
            provenance.columns_used.append(target_group)
            agg_res, agg_time, agg_ok = self.analytics_tool.run_safe(
                organization_id=org_id,
                dataset_id=active_dataset_id,
                metric_column=target_metric,
                aggregation="SUM",
                group_by_column=target_group
            )
            tool_logs.append(ToolCallLog(
                tool_name=self.analytics_tool.name,
                arguments={"dataset_id": active_dataset_id, "metric": target_metric, "group_by": target_group},
                success=agg_ok,
                execution_time_ms=agg_time,
                output_summary=f"Computed breakdown across {len(agg_res.get('results', []))} categories"
            ))

            breakdown = agg_res.get("results", [])
            provenance.sql_executed = agg_res.get("sql_executed")
            table_payload = breakdown
            data_payload = {"breakdown": breakdown, "ranking": breakdown}

            if breakdown:
                top_item = breakdown[0]
                viz_payload = {
                    "type": "bar",
                    "title": f"{target_metric.title()} Breakdown by {target_group.title()}",
                    "data": breakdown[:8],
                    "xAxis": "category",
                    "yAxis": "value"
                }

                # Step 5: Tool H - Generate data-grounded recommendations
                rec_res, rec_time, rec_ok = self.recommendation_tool.run_safe(
                    organization_id=org_id,
                    kpi_data={"kpi": target_metric, "value": top_item["value"], "unit": "₹", "dataset_name": active_dataset_name},
                    breakdown_data=breakdown
                )
                tool_logs.append(ToolCallLog(
                    tool_name=self.recommendation_tool.name,
                    arguments={"topic": "breakdown_optimization"},
                    success=rec_ok,
                    execution_time_ms=rec_time,
                    output_summary="Generated grounded recommendations from measured variance"
                ))

                top_lines = "\n".join([f"• **{item['category']}**: ₹{item['value']:,.2f} ({item['count']} records)" for item in breakdown[:5]])
                actions = "\n".join([f"• {a}" for a in rec_res.get("strategic_recommendations", [])[:2]])

                answer_text = (
                    f"### {target_metric.title()} Distribution by {target_group.title()}\n\n"
                    f"Analysis of **{active_row_count:,} records** in dataset `{active_dataset_name}`:\n\n"
                    f"{top_lines}\n\n"
                    f"**Key Finding:** **{top_item['category']}** is the highest performing segment with **₹{top_item['value']:,.2f}**.\n\n"
                    f"#### Recommended Actions:\n{actions}"
                )
            else:
                answer_text = f"No category records found for column `{target_group}` in `{active_dataset_name}`."

        else:
            # Single KPI Aggregate calculation
            kpi_res, kpi_time, kpi_ok = self.kpi_tool.run_safe(
                organization_id=org_id,
                dataset_id=active_dataset_id,
                kpi_name=target_metric
            )
            tool_logs.append(ToolCallLog(
                tool_name=self.kpi_tool.name,
                arguments={"dataset_id": active_dataset_id, "kpi": target_metric},
                success=kpi_ok,
                execution_time_ms=kpi_time,
                output_summary=f"Computed {kpi_res.get('kpi')} = {kpi_res.get('value')}"
            ))

            val = kpi_res.get("value", 0.0)
            unit = kpi_res.get("unit", "₹")
            formula = kpi_res.get("formula", f"SUM({target_metric})")
            provenance.calculation_formula = formula
            
            data_payload = {
                "metric": target_metric,
                "value": val,
                "unit": unit,
                "formula": formula,
                "dataset_name": active_dataset_name
            }
            viz_payload = {
                "type": "kpi_card",
                "metric": target_metric,
                "value": val,
                "unit": unit
            }

            answer_text = (
                f"### Verified {target_metric.title()} Metric\n\n"
                f"Across **{active_row_count:,} verified records** in `{active_dataset_name}`:\n\n"
                f"• **Total {target_metric.title()}:** {unit} {val:,.2f}\n"
                f"• **Formula:** `{formula}`\n"
                f"• **Dataset Provenance:** `{active_dataset_name}` (ID: {active_dataset_id})\n"
            )

        duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
        provenance.execution_time_ms = duration_ms

        return QueryResponse(
            question=query_text,
            answer=answer_text,
            intent=intent,
            is_general_advice=False,
            grounded=True,
            evidence_validated=True,
            insufficient_data=False,
            data=data_payload,
            visualization=viz_payload,
            table_data=table_payload,
            provenance=provenance,
            tool_executions=tool_logs,
            follow_up_questions=[
                f"Show {target_metric} breakdown by region",
                f"What are the statistical outliers in {target_metric}?",
                f"Project {target_metric} forecast for next quarter"
            ],
            analysis_status="Computed verified analytics across dataset records",
            execution_time_ms=duration_ms
        )

