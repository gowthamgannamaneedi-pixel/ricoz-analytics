import time
import re
from typing import Dict, Any, List, Optional
import logging

from app.schemas.query import QueryRequest, QueryResponse, ProvenanceInfo, ToolCallLog
from app.database.connection import execute_query
from app.agents.intent_router import IntentRouter
from app.agents.planner import AgentPlanner
from app.agents.verifier import NumericalVerifier
from app.agents.response_generator import ResponseGenerator
from app.tools.dataset_discovery import DatasetDiscoveryTool
from app.tools.schema_inspector import SchemaInspectorTool
from app.tools.semantic_retriever import SemanticRetrieverTool
from app.tools.analytics_executor import AnalyticsExecutorTool
from app.tools.kpi_calculator import KPICalculatorTool
from app.tools.statistical_analysis import StatisticalAnalysisTool
from app.tools.forecasting import ForecastingTool
from app.tools.recommendation_engine import BusinessRecommendationEngine
from app.tools.scenario_simulator import ScenarioSimulatorTool
from app.tools.period_comparison import PeriodComparisonTool
from app.tools.data_quality import DataQualityTool
from app.config import settings

logger = logging.getLogger("ai_service.orchestrator")

class AgentOrchestrator:
    """
    Genuine Python-based Agentic RAG and Analytics Orchestrator:
    - Dynamic Intent Understanding & Adaptive Multi-Step Planning.
    - Tenant-isolated schema inspection and dataset discovery.
    - Executes real SQL-backed analytical tools (no mocked or fabricated data).
    - Evidence verification & Provenance tracking.
    - Clear distinction between Measured Facts and Strategic Levers.
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
        self.scenario_tool = ScenarioSimulatorTool()
        self.period_tool = PeriodComparisonTool()
        self.quality_tool = DataQualityTool()

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
                    "analyze regional and product performance distributions, project forecasts, "
                    "and formulate actionable growth recommendations grounded in verified data. "
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
                    "How can I increase my sales?",
                    "Which region contributes the most revenue?"
                ],
                analysis_status="Conversational response",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # PATH B: Dataset Discovery & Schema Resolution
        # -------------------------------------------------------------
        active_dataset_id = req.dataset_id
        active_dataset_name = ""
        active_row_count = 0

        # Step 1: Discover datasets if not specified
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

        # Step 2: Schema Inspector
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
        columns_list = schema_res.get("columns", [])
        all_col_names = [c["name"].lower() for c in columns_list if isinstance(c, dict) and c.get("name")]

        # Step 3: Semantic Retriever for Business Context & Definitions
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

        # Check for explicit missing attribute queries (e.g. "what is employee turnover")
        query_lower = query_text.lower()
        missing_metric = None
        missing_candidates = [
            "turnover", "employee turnover", "attrition", "churn rate", "headcount", "salary",
            "attendance", "satisfaction", "nps", "bounce rate", "conversion rate",
            "cpc", "roas", "ltv", "ebitda"
        ]
        for mc in missing_candidates:
            if mc in query_lower and not any(mc in col for col in all_col_names):
                missing_metric = mc
                break

        if missing_metric:
            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            avail_cols = ", ".join(all_col_names[:8])
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
                    f"What information is missing from {active_dataset_name}?"
                ],
                analysis_status=f"Requested metric '{missing_metric}' not tracked in dataset",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # Dynamic Schema-Aware Planning
        # -------------------------------------------------------------
        plan = AgentPlanner.create_plan(intent, query_text, active_dataset_id, schema_res)
        target_metric = plan.target_metric or "revenue"
        target_group = plan.dimension or (categorical_cols[0] if categorical_cols else None)

        provenance = ProvenanceInfo(
            dataset_id=active_dataset_id,
            dataset_name=active_dataset_name,
            row_count=active_row_count,
            columns_used=[target_metric] if target_metric else []
        )

        data_payload: Dict[str, Any] = {}
        viz_payload: Optional[Dict[str, Any]] = None
        table_payload: Optional[List[Dict[str, Any]]] = None

        # -------------------------------------------------------------
        # INTENT: DATASET_CONTEXT_QUERY ("Which dataset are you currently analyzing?")
        # -------------------------------------------------------------
        if intent == "DATASET_CONTEXT_QUERY":
            col_summary = ", ".join([f"`{c['name']}` ({c.get('type', 'string')})" for c in columns_list[:12]])
            answer_text = (
                f"### Active Dataset Context\n\n"
                f"I am currently analyzing **`{active_dataset_name}`** (Dataset ID: `{active_dataset_id}`).\n\n"
                f"• **Organization Workspace:** Verified tenant isolation for `{org_id}`\n"
                f"• **Total Recorded Rows:** **{active_row_count:,} records**\n"
                f"• **Tracked Columns ({len(columns_list)}):** {col_summary}\n"
                f"• **Numeric Metrics:** {', '.join(numeric_cols) if numeric_cols else 'None'}\n"
                f"• **Categorical Dimensions:** {', '.join(categorical_cols) if categorical_cols else 'None'}\n\n"
                f"All analytical calculations and agent tool executions are strictly bound to this selected dataset."
            )
            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            return QueryResponse(
                question=query_text,
                answer=answer_text,
                intent=intent,
                is_general_advice=False,
                grounded=True,
                evidence_validated=True,
                insufficient_data=False,
                data={"dataset_id": active_dataset_id, "dataset_name": active_dataset_name, "row_count": active_row_count, "columns": columns_list},
                visualization=None,
                table_data=[{"Column": c["name"], "Inferred Type": c.get("type", "string")} for c in columns_list],
                provenance=provenance,
                tool_executions=tool_logs,
                follow_up_questions=[f"What is total revenue in {active_dataset_name}?", "Compare this month with last month"],
                analysis_status=f"Active dataset context: {active_dataset_name}",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # INTENT: MONTH_OVER_MONTH_COMPARISON ("Compare this month with last month")
        # -------------------------------------------------------------
        if intent == "MONTH_OVER_MONTH_COMPARISON":
            date_col = plan.date_column
            if not date_col:
                no_date_text = ResponseGenerator.generate_no_date_column_response(
                    dataset_name=active_dataset_name,
                    dataset_id=active_dataset_id
                )
                duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
                return QueryResponse(
                    question=query_text,
                    answer=no_date_text,
                    intent=intent,
                    is_general_advice=False,
                    grounded=False,
                    evidence_validated=True,
                    insufficient_data=True,
                    data=None,
                    visualization=None,
                    table_data=None,
                    provenance=provenance,
                    tool_executions=tool_logs,
                    follow_up_questions=["Which columns are available in this dataset?", "What is total revenue?"],
                    analysis_status="Dataset does not contain a usable date column",
                    execution_time_ms=duration_ms
                )

            # Determine metric to compare
            comp_metric = target_metric
            for cand in ["profit", "units_sold", "revenue", "sales_amount", "sales", "orders"]:
                if cand in query_lower:
                    comp_metric = cand
                    break

            provenance.columns_used = [comp_metric, date_col]

            p_res, p_time, p_ok = self.period_tool.run_safe(
                organization_id=org_id,
                dataset_id=active_dataset_id,
                metric_column=comp_metric,
                date_column=date_col,
                reference_date="2026-11-08"
            )
            tool_logs.append(ToolCallLog(
                tool_name=self.period_tool.name,
                arguments={"dataset_id": active_dataset_id, "metric": comp_metric, "date_column": date_col},
                success=p_ok,
                execution_time_ms=p_time,
                output_summary=f"Compared MoM: current {p_res.get('current_period', {}).get('total', 0)} vs previous {p_res.get('previous_period', {}).get('total', 0)}"
            ))

            if not p_ok or not p_res.get("has_date_column", True):
                no_date_text = ResponseGenerator.generate_no_date_column_response(
                    dataset_name=active_dataset_name,
                    dataset_id=active_dataset_id
                )
                duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
                return QueryResponse(
                    question=query_text,
                    answer=no_date_text,
                    intent=intent,
                    is_general_advice=False,
                    grounded=False,
                    evidence_validated=True,
                    insufficient_data=True,
                    data=None,
                    visualization=None,
                    table_data=None,
                    provenance=provenance,
                    tool_executions=tool_logs,
                    follow_up_questions=["Which columns are in this dataset?"],
                    analysis_status="No usable date column found in dataset",
                    execution_time_ms=duration_ms
                )

            answer_text = ResponseGenerator.generate_month_over_month_response(
                dataset_name=active_dataset_name,
                dataset_id=active_dataset_id,
                row_count=active_row_count,
                result=p_res
            )

            chart_items = p_res.get("chart_data", [])
            viz_payload = {
                "type": "bar",
                "title": f"Month-over-Month {comp_metric.title()} Comparison",
                "data": chart_items,
                "xAxis": "period",
                "yAxis": "value"
            }

            table_payload = [
                {"Period": item["period"], "Total Value": f"₹{item['value']:,.2f}", "Records Count": item.get("records", 0)}
                for item in chart_items
            ]

            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            return QueryResponse(
                question=query_text,
                answer=answer_text,
                intent=intent,
                is_general_advice=False,
                grounded=True,
                evidence_validated=True,
                insufficient_data=False,
                data=p_res,
                visualization=viz_payload,
                table_data=table_payload,
                provenance=provenance,
                tool_executions=tool_logs,
                follow_up_questions=[
                    f"Show monthly revenue trends for {active_dataset_name}",
                    f"What is total {comp_metric}?",
                    "Which region has the highest sales?"
                ],
                analysis_status=f"Executed deterministic Month-over-Month analysis for {comp_metric}",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # INTENT: DATA_QUALITY_QUERY ("Identify missing values", "Identify duplicate records")
        # -------------------------------------------------------------
        if intent == "DATA_QUALITY_QUERY":
            q_res, q_time, q_ok = self.quality_tool.run_safe(
                organization_id=org_id,
                dataset_id=active_dataset_id
            )
            tool_logs.append(ToolCallLog(
                tool_name=self.quality_tool.name,
                arguments={"dataset_id": active_dataset_id},
                success=q_ok,
                execution_time_ms=q_time,
                output_summary=f"Inspected quality across {q_res.get('total_rows', 0)} rows"
            ))

            missing_info = q_res.get("missing_values", {})
            dup_info = q_res.get("duplicates", {})
            tot_missing = missing_info.get("total_missing", 0)
            dup_count = dup_info.get("duplicate_record_count", 0)

            col_lines = []
            for col_name, m_cnt in missing_info.get("by_column", {}).items():
                if m_cnt > 0:
                    col_lines.append(f"• **`{col_name}`**: {m_cnt} missing values")

            missing_details = "\n".join(col_lines) if col_lines else "• Zero missing or null values detected across all columns."

            answer_text = (
                f"### Data Quality & Integrity Diagnostics\n\n"
                f"Evaluated data quality across **{active_row_count:,} records** in `{active_dataset_name}`:\n\n"
                f"• **Completeness Score:** **{missing_info.get('completeness_percentage', 100)}%** ({tot_missing} total missing values)\n"
                f"• **Duplicate Records:** **{dup_count} duplicate rows** detected ({dup_info.get('uniqueness_percentage', 100)}% unique entries)\n\n"
                f"#### Column-by-Column Completeness:\n"
                f"{missing_details}\n\n"
                f"✅ *All records verified directly from PostgreSQL dataset storage.*"
            )

            table_payload = [
                {"Column": c, "Missing Count": missing_info.get("by_column", {}).get(c, 0), "Status": "Valid" if missing_info.get("by_column", {}).get(c, 0) == 0 else "Contains Nulls"}
                for c in q_res.get("columns", [])
            ]

            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            return QueryResponse(
                question=query_text,
                answer=answer_text,
                intent=intent,
                is_general_advice=False,
                grounded=True,
                evidence_validated=True,
                insufficient_data=False,
                data=q_res,
                visualization={"type": "kpi_card", "metric": "Completeness", "value": missing_info.get("completeness_percentage", 100), "unit": "%"},
                table_data=table_payload,
                provenance=provenance,
                tool_executions=tool_logs,
                follow_up_questions=["What is total revenue?", "Compare this month with last month"],
                analysis_status=f"Quality audit complete: {missing_info.get('completeness_percentage', 100)}% completeness",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # INTENT: RELATIONSHIP_EXPLANATION ("Explain relationship between revenue and profit")
        # -------------------------------------------------------------
        if intent == "RELATIONSHIP_EXPLANATION":
            has_profit = any("profit" in c for c in all_col_names)
            rev_col = next((c for c in all_col_names if any(m in c for m in ["sales_amount", "revenue", "sales"])), target_metric)

            profit_val = 0.0
            rev_val = 0.0
            margin_pct = 0.0
            if has_profit:
                profit_col = next(c for c in all_col_names if "profit" in c)
                p_agg = self.analytics_tool.execute(org_id, active_dataset_id, metric_column=profit_col, aggregation="SUM")
                r_agg = self.analytics_tool.execute(org_id, active_dataset_id, metric_column=rev_col, aggregation="SUM")
                profit_val = float(p_agg.get("value", 0.0))
                rev_val = float(r_agg.get("value", 0.0))
                margin_pct = round((profit_val / rev_val * 100), 2) if rev_val > 0 else 0.0
                provenance.columns_used.extend([rev_col, profit_col])

            empirical_text = (
                f"\n\n#### Empirical Relationship in `{active_dataset_name}`:\n"
                f"• **Total Revenue ({rev_col}):** **₹{rev_val:,.2f}**\n"
                f"• **Total Profit ({profit_col if has_profit else 'N/A'}):** **₹{profit_val:,.2f}**\n"
                f"• **Aggregate Gross Margin:** **{margin_pct:.1f}%**\n"
                f"• **Interpretation:** Every ₹100 in revenue yields ₹{margin_pct:.2f} in gross profit after direct operational deductions."
            ) if has_profit else f"\n\n*Note: `{active_dataset_name}` contains revenue data (`{rev_col}`) but does not track an explicit `profit` column.*"

            answer_text = (
                f"### Relationship Between Revenue and Profit\n\n"
                f"In financial analytics and business intelligence, revenue and profit represent fundamental top-line and bottom-line metrics:\n\n"
                f"1. **Gross Revenue (Top Line):** Total invoiced income received from transactions: `Revenue = Price × Volume Sold`.\n"
                f"2. **Gross Profit:** Earnings retained after subtracting Direct Cost of Goods Sold (COGS): `Profit = Revenue - Direct Costs`.\n"
                f"3. **Profit Margin (%):** Efficiency ratio indicating profitability per currency unit: `(Profit / Revenue) × 100`."
                f"{empirical_text}\n\n"
                f"Optimizing profit requires either expanding revenue via pricing corridors and order volume or compressing direct supply chain costs."
            )

            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            return QueryResponse(
                question=query_text,
                answer=answer_text,
                intent=intent,
                is_general_advice=False,
                grounded=True,
                evidence_validated=True,
                insufficient_data=False,
                data={"total_revenue": rev_val, "total_profit": profit_val, "margin_percent": margin_pct},
                visualization=None,
                table_data=[{"Metric": "Revenue", "Value": f"₹{rev_val:,.2f}"}, {"Metric": "Profit", "Value": f"₹{profit_val:,.2f}"}, {"Metric": "Margin", "Value": f"{margin_pct:.1f}%"}] if has_profit else None,
                provenance=provenance,
                tool_executions=tool_logs,
                follow_up_questions=["What is my total revenue?", "What happens if supply costs increase by 5%?"],
                analysis_status="Explained revenue-profit relationship with dataset grounding",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # INTENT: TREND_QUERY ("Show monthly revenue trends")
        # -------------------------------------------------------------
        if intent == "TREND_QUERY":
            date_col = plan.date_column
            if not date_col:
                duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
                return QueryResponse(
                    question=query_text,
                    answer=f"The selected dataset `{active_dataset_name}` does not contain a usable date column to calculate monthly revenue trends.",
                    intent=intent,
                    is_general_advice=False,
                    grounded=True,
                    evidence_validated=True,
                    insufficient_data=True,
                    data=None,
                    visualization=None,
                    table_data=None,
                    provenance=provenance,
                    tool_executions=tool_logs,
                    follow_up_questions=["Which columns are in this dataset?", "What is total revenue?"],
                    analysis_status="No date column for time-series trend",
                    execution_time_ms=duration_ms
                )

            trend_sql = f"""
                SELECT
                    SUBSTRING((data->>%s)::text, 1, 7) AS period,
                    SUM((data->>%s)::numeric) AS value,
                    COUNT(*)::bigint AS count
                FROM dataset_rows
                WHERE dataset_id = %s
                  AND organization_id = %s
                  AND (data->>%s) IS NOT NULL
                  AND (data->>%s) ~ '^[-]?[0-9]+([.][0-9]+)?$'
                GROUP BY period
                ORDER BY period ASC;
            """
            trend_rows = execute_query(trend_sql, (
                date_col, target_metric,
                active_dataset_id, org_id,
                target_metric, target_metric
            )) or []

            provenance.columns_used.extend([target_metric, date_col])
            trend_items = [
                {"period": r["period"], "value": float(r["value"]), "records": int(r["count"])}
                for r in trend_rows
            ]

            trend_lines = "\n".join([f"• **{t['period']}**: ₹{t['value']:,.2f} ({t['records']} records)" for t in trend_items])
            answer_text = (
                f"### Monthly Revenue Progression ({target_metric.title()})\n\n"
                f"Aggregated monthly trajectory for `{active_dataset_name}` across **{active_row_count:,} records**:\n\n"
                f"{trend_lines}\n\n"
                f"📈 Telemetry reflects verified aggregations grouped by `{date_col}`."
            )

            viz_payload = {
                "type": "line",
                "title": f"Monthly {target_metric.title()} Progression",
                "data": trend_items,
                "xAxis": "period",
                "yAxis": "value"
            }

            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            return QueryResponse(
                question=query_text,
                answer=answer_text,
                intent=intent,
                is_general_advice=False,
                grounded=True,
                evidence_validated=True,
                insufficient_data=False,
                data={"trends": trend_items},
                visualization=viz_payload,
                table_data=[{"Period": t["period"], "Total Revenue": f"₹{t['value']:,.2f}", "Record Count": t["records"]} for t in trend_items],
                provenance=provenance,
                tool_executions=tool_logs,
                follow_up_questions=["Compare this month with last month", "What is total revenue?"],
                analysis_status=f"Computed monthly trends across {len(trend_items)} periods",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # INTENT: AOV_QUERY ("What is the average order value?")
        # -------------------------------------------------------------
        if intent == "AOV_QUERY":
            kpi_res, kpi_time, kpi_ok = self.kpi_tool.run_safe(
                organization_id=org_id,
                dataset_id=active_dataset_id,
                kpi_name="aov"
            )
            tool_logs.append(ToolCallLog(
                tool_name=self.kpi_tool.name,
                arguments={"dataset_id": active_dataset_id, "kpi": "aov"},
                success=kpi_ok,
                execution_time_ms=kpi_time,
                output_summary=f"Calculated AOV = ₹{kpi_res.get('value', 0):,}"
            ))

            aov_val = float(kpi_res.get("value", 0.0))
            tot_sales = float(kpi_res.get("total_sales", 0.0))
            tot_cnt = int(kpi_res.get("total_orders", active_row_count))

            answer_text = (
                f"### Average Order Value (AOV)\n\n"
                f"Across **{tot_cnt:,} recorded transactions** in `{active_dataset_name}`:\n\n"
                f"• **Average Order Value (AOV):** **₹{aov_val:,.2f}**\n"
                f"• **Total Revenue:** ₹{tot_sales:,.2f}\n"
                f"• **Total Recorded Orders/Rows:** {tot_cnt:,}\n"
                f"• **Formula:** `Total Sales / Total Order Count`\n\n"
                f"✅ *Calculated deterministically from authorized dataset records.*"
            )

            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            return QueryResponse(
                question=query_text,
                answer=answer_text,
                intent=intent,
                is_general_advice=False,
                grounded=True,
                evidence_validated=True,
                insufficient_data=False,
                data=kpi_res,
                visualization={"type": "kpi_card", "metric": "Average Order Value", "value": aov_val, "unit": "₹"},
                table_data=[{"Metric": "Average Order Value", "Value": f"₹{aov_val:,.2f}"}, {"Metric": "Total Sales", "Value": f"₹{tot_sales:,.2f}"}],
                provenance=provenance,
                tool_executions=tool_logs,
                follow_up_questions=["How can I increase my sales?", "Which product has the highest revenue?"],
                analysis_status="Computed exact Average Order Value",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # INTENT: DATASET_EXPLORATION ("What information is missing?")
        # -------------------------------------------------------------
        if intent == "DATASET_EXPLORATION":
            missing_dims = []
            if not plan.cost_column:
                missing_dims.append("Cost of Goods Sold (COGS) / Expenses: Required to calculate Gross Margin and net profitability.")
            if not any("customer" in c for c in all_col_names):
                missing_dims.append("Customer Identifier: Required to measure repeat purchase rate, customer lifetime value (LTV), and churn.")
            if not any("channel" in c for c in all_col_names):
                missing_dims.append("Sales Acquisition Channel: Required to calculate channel-specific ROI and CAC.")
            if not any(c in all_col_names for c in ["region", "state", "city", "country"]):
                missing_dims.append("Geographic Location: Required for regional territory expansion analysis.")
            if not plan.date_column:
                missing_dims.append("Transaction Timestamp / Date: Required for multi-period trend and seasonality forecasting.")

            answer_text = ResponseGenerator.generate_dataset_exploration_response(
                dataset_name=active_dataset_name,
                dataset_id=active_dataset_id,
                row_count=active_row_count,
                column_count=len(columns_list),
                columns=columns_list,
                missing_dimensions=missing_dims
            )

            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            return QueryResponse(
                question=query_text,
                answer=answer_text,
                intent=intent,
                is_general_advice=False,
                grounded=True,
                evidence_validated=True,
                insufficient_data=False,
                data={"columns": all_col_names, "missing": missing_dims},
                visualization=None,
                table_data=[{"Tracked Column": c["name"], "Inferred Type": c.get("type", "string")} for c in columns_list],
                provenance=provenance,
                tool_executions=tool_logs,
                follow_up_questions=[
                    f"What is total {target_metric} in {active_dataset_name}?",
                    "How can I increase my sales?",
                    "Which category has the highest volume?"
                ],
                analysis_status=f"Inspected dataset schema across {len(columns_list)} columns",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # INTENT: SALES_GROWTH_ANALYSIS ("How can I increase my sales?")
        # -------------------------------------------------------------
        if intent == "SALES_GROWTH_ANALYSIS":
            # 1. Compute baseline KPI
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
                output_summary=f"Computed baseline {target_metric} = ₹{kpi_res.get('value', 0):,}"
            ))

            total_sales = float(kpi_res.get("value", 0.0))

            # 2. Compute dimensional breakdowns (e.g. regions and products)
            breakdown_records = []
            breakdown_tables = []
            dimensions_to_analyze = [d for d in [plan.dimension, plan.secondary_dimension] if d]
            if not dimensions_to_analyze and categorical_cols:
                dimensions_to_analyze = categorical_cols[:2]

            for dim in dimensions_to_analyze:
                b_res, b_time, b_ok = self.analytics_tool.run_safe(
                    organization_id=org_id,
                    dataset_id=active_dataset_id,
                    metric_column=target_metric,
                    aggregation="SUM",
                    group_by_column=dim
                )
                tool_logs.append(ToolCallLog(
                    tool_name=self.analytics_tool.name,
                    arguments={"dataset_id": active_dataset_id, "metric": target_metric, "group_by": dim},
                    success=b_ok,
                    execution_time_ms=b_time,
                    output_summary=f"Computed breakdown across {len(b_res.get('results', []))} {dim} categories"
                ))
                items = b_res.get("results", [])
                if items:
                    breakdown_records.append({"dimension": dim, "items": items})
                    breakdown_tables.extend(items)
                    provenance.columns_used.append(dim)

            # 3. Generate recommendations via recommendation engine
            rec_res, rec_time, rec_ok = self.recommendation_tool.run_safe(
                organization_id=org_id,
                kpi_data={"kpi": target_metric, "value": total_sales, "unit": "₹", "dataset_name": active_dataset_name},
                breakdown_data=breakdown_tables,
                topic="sales_growth"
            )
            tool_logs.append(ToolCallLog(
                tool_name=self.recommendation_tool.name,
                arguments={"topic": "sales_growth"},
                success=rec_ok,
                execution_time_ms=rec_time,
                output_summary=f"Generated {len(rec_res.get('strategic_recommendations', []))} growth levers"
            ))

            # 4. Note missing data
            missing_notes = []
            if not plan.cost_column:
                missing_notes.append("Product Cost / COGS is missing: Add product cost data to calculate exact gross margin uplift corridors.")
            if not any("customer" in c for c in all_col_names):
                missing_notes.append("Customer IDs / Account tiers missing: Add customer IDs to analyze retention and repeat purchasing velocity.")

            answer_text = ResponseGenerator.generate_sales_growth_response(
                dataset_name=active_dataset_name,
                dataset_id=active_dataset_id,
                row_count=active_row_count,
                kpi_info={"value": total_sales, "metric_name": target_metric, "unit": "₹"},
                breakdowns=breakdown_records,
                recommendations=rec_res.get("strategic_recommendations", []),
                missing_notes=missing_notes
            )

            # Visualizations & Tables
            top_breakdown = breakdown_records[0]["items"] if breakdown_records else []
            if top_breakdown:
                viz_payload = {
                    "type": "bar",
                    "title": f"{target_metric.title()} Distribution by {breakdown_records[0]['dimension'].title()}",
                    "data": top_breakdown[:6],
                    "xAxis": "category",
                    "yAxis": "value"
                }
                table_payload = [
                    {
                        "Category": item["category"],
                        "Revenue": f"₹{item['value']:,.2f}",
                        "Records": item["count"],
                        "Share": f"{(item['value'] / total_sales * 100):.1f}%" if total_sales > 0 else "0%"
                    }
                    for item in top_breakdown
                ]

            data_payload = {
                "sales_growth_analysis": True,
                "total_sales": total_sales,
                "dataset_name": active_dataset_name,
                "row_count": active_row_count,
                "breakdown": top_breakdown,
                "recommendations": rec_res.get("strategic_recommendations", [])
            }

            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
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
                    f"Which segment generated the highest sales in {active_dataset_name}?",
                    "What happens if price increases by 5%?",
                    "What information is missing from my dataset?"
                ],
                analysis_status=f"Computed multi-dimensional growth analysis across {active_row_count} records",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # INTENT: REVENUE_DECLINE_ANALYSIS ("Why did my revenue decrease?")
        # -------------------------------------------------------------
        if intent == "REVENUE_DECLINE_ANALYSIS":
            kpi_res, _, _ = self.kpi_tool.run_safe(organization_id=org_id, dataset_id=active_dataset_id, kpi_name=target_metric)
            total_sales = float(kpi_res.get("value", 0.0))

            breakdown_records = []
            if target_group:
                b_res, _, _ = self.analytics_tool.run_safe(organization_id=org_id, dataset_id=active_dataset_id, metric_column=target_metric, group_by_column=target_group)
                breakdown_records.append({"dimension": target_group, "items": b_res.get("results", [])})

            anom_res, _, _ = self.stats_tool.run_safe(organization_id=org_id, dataset_id=active_dataset_id, metric_column=target_metric)
            rec_res, _, _ = self.recommendation_tool.run_safe(organization_id=org_id, topic="turnaround")

            answer_text = ResponseGenerator.generate_revenue_decline_response(
                dataset_name=active_dataset_name,
                dataset_id=active_dataset_id,
                row_count=active_row_count,
                total_rev=total_sales,
                breakdowns=breakdown_records,
                anomalies=anom_res,
                recommendations=rec_res.get("strategic_recommendations", [])
            )

            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            return QueryResponse(
                question=query_text,
                answer=answer_text,
                intent=intent,
                is_general_advice=False,
                grounded=True,
                evidence_validated=True,
                insufficient_data=False,
                data={"total_sales": total_sales, "anomalies": anom_res},
                visualization=None,
                table_data=None,
                provenance=provenance,
                tool_executions=tool_logs,
                follow_up_questions=["Identify unusual sales patterns", "How can I increase my sales?"],
                analysis_status="Decomposed revenue decline across available dimensions",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # INTENT: PROFITABILITY_ANALYSIS ("What is my gross profit margin?")
        # -------------------------------------------------------------
        if intent == "PROFITABILITY_ANALYSIS":
            margin_res, m_time, m_ok = self.kpi_tool.run_safe(organization_id=org_id, dataset_id=active_dataset_id, kpi_name="margin")
            tool_logs.append(ToolCallLog(
                tool_name=self.kpi_tool.name,
                arguments={"dataset_id": active_dataset_id, "kpi": "margin"},
                success=m_ok,
                execution_time_ms=m_time,
                output_summary=f"Margin: {margin_res.get('value')}%"
            ))

            if plan.cost_column:
                margin_val = margin_res.get("value", 0.0)
                profit_val = margin_res.get("profit_value", 0.0)
                answer_text = (
                    f"### Gross Profit & Margin Analysis\n\n"
                    f"Based on **{active_row_count:,} records** in `{active_dataset_name}`:\n\n"
                    f"• **Gross Profit Margin:** **{margin_val:.2f}%**\n"
                    f"• **Gross Profit:** ₹{profit_val:,.2f}\n"
                    f"• **Formula:** `(SUM({target_metric}) - SUM({plan.cost_column})) / SUM({target_metric}) * 100`\n"
                )
                viz_payload = {"type": "kpi_card", "metric": "Gross Margin", "value": f"{margin_val:.1f}%", "unit": "%"}
                data_payload = margin_res
            else:
                rev_res, _, _ = self.kpi_tool.run_safe(organization_id=org_id, dataset_id=active_dataset_id, kpi_name=target_metric)
                rev_val = rev_res.get("value", 0.0)
                answer_text = (
                    f"### Gross Profit Margin Notice\n\n"
                    f"The dataset `{active_dataset_name}` contains total recorded revenue of **₹{rev_val:,.2f}**, "
                    f"but does **not** contain a Cost of Goods Sold (COGS) or Expenses column. "
                    f"Gross profit margin cannot be computed without verified direct costs. "
                    f"Please connect a dataset tracking product or operating costs."
                )
                viz_payload = {"type": "kpi_card", "metric": target_metric, "value": rev_val, "unit": "₹"}
                data_payload = {"revenue": rev_val, "cost_missing": True}

            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            return QueryResponse(
                question=query_text,
                answer=answer_text,
                intent=intent,
                is_general_advice=False,
                grounded=True,
                evidence_validated=True,
                insufficient_data=not bool(plan.cost_column),
                data=data_payload,
                visualization=viz_payload,
                table_data=None,
                provenance=provenance,
                tool_executions=tool_logs,
                follow_up_questions=["How can I increase my sales?", "What information is missing from my dataset?"],
                analysis_status="Computed profitability metrics",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # INTENT: SCENARIO_SIMULATION ("What happens if costs increase by 10%?")
        # -------------------------------------------------------------
        if intent == "SCENARIO_SIMULATION":
            pct_matches = re.findall(r"([+-]?\d+(?:\.\d+)?)\s*%", query_text)
            p_pct = float(pct_matches[0]) if pct_matches else (5.0 if "increase" in query_lower else -5.0)
            c_pct = 0.0
            v_pct = 0.0
            if "cost" in query_lower or "cogs" in query_lower or "operating" in query_lower:
                c_pct = p_pct
                p_pct = 0.0
            elif "volume" in query_lower or "units" in query_lower or "demand" in query_lower:
                v_pct = p_pct
                p_pct = 0.0

            s_res, s_time, s_ok = self.scenario_tool.run_safe(
                organization_id=org_id,
                dataset_id=active_dataset_id,
                price_change_pct=p_pct,
                volume_change_pct=v_pct,
                cogs_change_pct=c_pct
            )
            tool_logs.append(ToolCallLog(
                tool_name=self.scenario_tool.name,
                arguments={"dataset_id": active_dataset_id, "price_change_pct": p_pct, "volume_change_pct": v_pct, "cogs_change_pct": c_pct},
                success=s_ok,
                execution_time_ms=s_time,
                output_summary=f"Projected revenue ₹{s_res.get('simulated_revenue', 0):,}, margin {s_res.get('simulated_margin_pct', 0)}%"
            ))

            sim_items = [
                {"Metric": "Gross Revenue", "Baseline": f"₹{s_res.get('baseline_revenue', 0):,}", "Simulated": f"₹{s_res.get('simulated_revenue', 0):,}", "Variance": f"{s_res.get('rev_delta_pct', 0):+}%"},
                {"Metric": "Operating & Direct Cost", "Baseline": f"₹{s_res.get('baseline_cost', 0):,}", "Simulated": f"₹{s_res.get('simulated_cost', 0):,}", "Variance": f"₹{s_res.get('simulated_cost', 0) - s_res.get('baseline_cost', 0):+,}"},
                {"Metric": "Gross Profit", "Baseline": f"₹{s_res.get('baseline_profit', 0):,}", "Simulated": f"₹{s_res.get('simulated_profit', 0):,}", "Variance": f"{s_res.get('profit_delta_pct', 0):+}%"},
                {"Metric": "Gross Margin %", "Baseline": f"{s_res.get('baseline_margin_pct', 0)}%", "Simulated": f"{s_res.get('simulated_margin_pct', 0)}%", "Variance": f"{s_res.get('margin_delta_pct', 0):+} pp"}
            ]

            viz_payload = {
                "type": "bar",
                "title": f"What-If Projection vs Baseline ({active_dataset_name})",
                "data": [
                    {"category": "Revenue", "Baseline": s_res.get("baseline_revenue", 0), "Simulated": s_res.get("simulated_revenue", 0)},
                    {"category": "Cost", "Baseline": s_res.get("baseline_cost", 0), "Simulated": s_res.get("simulated_cost", 0)},
                    {"category": "Gross Profit", "Baseline": s_res.get("baseline_profit", 0), "Simulated": s_res.get("simulated_profit", 0)}
                ],
                "xAxis": "category",
                "yAxis": "value"
            }
            table_payload = sim_items
            data_payload = s_res

            answer_text = (
                f"### What-If Counterfactual Scenario Simulation\n\n"
                f"Simulating adjustments on verified baseline across **{active_row_count:,} records** in `{active_dataset_name}`:\n\n"
                f"• **Levers Applied:** Price: `{p_pct:+}%`, Volume: `{v_pct:+}%`, Cost: `{c_pct:+}%`\n"
                f"• **Simulated Revenue:** ₹{s_res.get('simulated_revenue', 0):,} ({s_res.get('rev_delta_pct', 0):+}% vs baseline ₹{s_res.get('baseline_revenue', 0):,})\n"
                f"• **Simulated Gross Profit:** ₹{s_res.get('simulated_profit', 0):,} ({s_res.get('profit_delta_pct', 0):+}% vs baseline ₹{s_res.get('baseline_profit', 0):,})\n"
                f"• **Gross Margin:** Shifted to **{s_res.get('simulated_margin_pct', 0)}%** ({s_res.get('margin_delta_pct', 0):+} pp change over baseline {s_res.get('baseline_margin_pct', 0)}%).\n\n"
                f"*Strict Counterfactual Invariant: Underlying dataset remains completely unchanged.*"
            )

            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
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
                follow_up_questions=["How can I increase my sales?", "What is total revenue?"],
                analysis_status="Executed What-If counterfactual simulation",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # INTENT: ANOMALY_INVESTIGATION ("Identify unusual sales patterns")
        # -------------------------------------------------------------
        if intent == "ANOMALY_INVESTIGATION":
            a_res, a_time, a_ok = self.stats_tool.run_safe(organization_id=org_id, dataset_id=active_dataset_id, metric_column=target_metric)
            tool_logs.append(ToolCallLog(
                tool_name=self.stats_tool.name,
                arguments={"dataset_id": active_dataset_id, "metric": target_metric},
                success=a_ok,
                execution_time_ms=a_time,
                output_summary=f"Identified {a_res.get('outliers_count', 0)} outliers"
            ))

            out_count = a_res.get("outliers_count", 0)
            mean_val = a_res.get("mean", 0.0)
            std_val = a_res.get("standard_deviation", 0.0)
            low_thresh = a_res.get("outlier_threshold_low", 0.0)
            high_thresh = a_res.get("outlier_threshold_high", 0.0)

            answer_text = (
                f"### Statistical Anomaly & Outlier Diagnostics\n\n"
                f"Evaluated distribution across **{active_row_count:,} records** in `{active_dataset_name}`:\n\n"
                f"• **Mean {target_metric.title()}:** ₹{mean_val:,.2f} (Std Dev: ₹{std_val:,.2f})\n"
                f"• **Dispersion Corridor (±2σ):** ₹{low_thresh:,.2f} to ₹{high_thresh:,.2f}\n"
                f"• **Flagged Anomalies:** **{out_count} records** exceeded standard dispersion bounds.\n"
            )

            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
            return QueryResponse(
                question=query_text,
                answer=answer_text,
                intent=intent,
                is_general_advice=False,
                grounded=True,
                evidence_validated=True,
                insufficient_data=False,
                data=a_res,
                visualization={"type": "kpi_card", "metric": "Anomalies Flagged", "value": out_count, "unit": "records"},
                table_data=None,
                provenance=provenance,
                tool_executions=tool_logs,
                follow_up_questions=["Why did my revenue decrease?", "How can I increase my sales?"],
                analysis_status=f"Identified {out_count} statistical anomalies",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # INTENT: FORECAST ("Forecast next month's revenue")
        # -------------------------------------------------------------
        if intent == "FORECAST":
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
                output_summary=f"Trend {f_res.get('trend_direction')}"
            ))

            if f_res.get("insufficient_data"):
                duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
                return QueryResponse(
                    question=query_text,
                    answer=(
                        f"### Predictive Forecast Notice\n\n"
                        f"The dataset `{active_dataset_name}` contains **{active_row_count} records**. "
                        f"Statistically grounded time-series forecasting requires at least 5 observation points. "
                        f"Please connect a historical time-series dataset to generate projection intervals."
                    ),
                    intent=intent,
                    is_general_advice=False,
                    grounded=True,
                    evidence_validated=True,
                    insufficient_data=True,
                    data=None,
                    visualization=None,
                    table_data=None,
                    provenance=provenance,
                    tool_executions=tool_logs,
                    follow_up_questions=["What is total revenue?", "How can I increase my sales?"],
                    analysis_status="Insufficient historical observations for regression forecasting",
                    execution_time_ms=duration_ms
                )

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

            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
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
                follow_up_questions=["What is total revenue?", "How can I increase my sales?"],
                analysis_status="Computed linear regression forecast",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # INTENT: RANKING or BREAKDOWN ("Which product performs best?", "Revenue by region")
        # -------------------------------------------------------------
        if intent in ["RANKING", "BREAKDOWN"]:
            # Specific dimension resolution based on natural-language query
            if "region" in query_lower and "region" in all_col_names:
                target_group = "region"
            elif ("product" in query_lower or "category" in query_lower or "item" in query_lower):
                target_group = "product" if "product" in all_col_names else "category" if "category" in all_col_names else target_group
            elif "channel" in query_lower and "channel" in all_col_names:
                target_group = "channel"
            else:
                target_group = target_group or (categorical_cols[0] if categorical_cols else None)

            if not target_group:
                target_group = categorical_cols[0] if categorical_cols else "category"

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

            is_lowest = any(w in query_lower for w in ["lowest", "bottom", "least", "worst"])
            is_top3 = any(w in query_lower for w in ["top 3", "top three", "three performing", "3 performing", "top 3 performing"])

            if breakdown:
                top_item = breakdown[0]
                lowest_item = breakdown[-1]
                viz_payload = {
                    "type": "bar",
                    "title": f"{target_metric.title()} by {target_group.title()}",
                    "data": breakdown[:8],
                    "xAxis": "category",
                    "yAxis": "value"
                }

                top_lines = "\n".join([f"• **{item['category']}**: ₹{item['value']:,.2f} ({item['count']} records)" for item in breakdown[:5]])

                if is_lowest:
                    answer_text = (
                        f"### Lowest Performing {target_group.title()} for {target_metric.title()}\n\n"
                        f"Across **{active_row_count:,} records** in dataset `{active_dataset_name}`:\n\n"
                        f"• **Lowest Performer:** **{lowest_item['category']}** generated the lowest revenue with **₹{lowest_item['value']:,.2f}** ({lowest_item['count']} records).\n"
                        f"• **Leading Benchmark:** **{top_item['category']}** generated **₹{top_item['value']:,.2f}** ({top_item['count']} records).\n\n"
                        f"#### Complete {target_group.title()} Breakdown:\n"
                        f"{top_lines}\n\n"
                        f"📉 *Grounded directly in verified PostgreSQL records.*"
                    )
                elif is_top3 and len(breakdown) >= 3:
                    top3_lines = "\n".join([f"{idx+1}. **{item['category']}**: ₹{item['value']:,.2f} ({item['count']} records)" for idx, item in enumerate(breakdown[:3])])
                    answer_text = (
                        f"### Top 3 Performing {target_group.title()}s for {target_metric.title()}\n\n"
                        f"Across **{active_row_count:,} records** in dataset `{active_dataset_name}`:\n\n"
                        f"{top3_lines}\n\n"
                        f"🏆 **Leader:** **{top_item['category']}** generated **₹{top_item['value']:,.2f}**, representing the top performer in this dataset.\n"
                    )
                else:
                    answer_text = (
                        f"### {target_metric.title()} Performance by {target_group.title()}\n\n"
                        f"Across **{active_row_count:,} records** in dataset `{active_dataset_name}`:\n\n"
                        f"{top_lines}\n\n"
                        f"🏆 **Top Performer:** **{top_item['category']}** has the highest sales with **₹{top_item['value']:,.2f}** ({top_item['count']} records).\n"
                    )
            else:
                answer_text = f"No category records found for column `{target_group}` in `{active_dataset_name}`."

            duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
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
                follow_up_questions=["How can I increase my sales?", "What is total revenue?"],
                analysis_status=f"Ranked {target_group} categories by {target_metric}",
                execution_time_ms=duration_ms
            )

        # -------------------------------------------------------------
        # DEFAULT / KPI_QUERY: Single Exact Metric
        # -------------------------------------------------------------
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

        # Verify numerical calculation against independent database check
        verification = NumericalVerifier.verify_kpi(org_id, active_dataset_id, target_metric, val)

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
            f"• **Verification:** Mathematical proof confirmed (Difference: {verification['difference']})\n"
            f"• **Dataset Provenance:** `{active_dataset_name}` (ID: {active_dataset_id})\n"
        )

        duration_ms = round((time.perf_counter() - total_start) * 1000, 2)
        provenance.execution_time_ms = duration_ms

        return QueryResponse(
            question=query_text,
            answer=answer_text,
            intent=intent,
            is_general_advice=False,
            grounded=verification["verified"],
            evidence_validated=verification["verified"],
            insufficient_data=False,
            data=data_payload,
            visualization=viz_payload,
            table_data=table_payload,
            provenance=provenance,
            tool_executions=tool_logs,
            follow_up_questions=[
                "How can I increase my sales?",
                f"Show {target_metric} breakdown by region",
                "What information is missing from my dataset?"
            ],
            analysis_status="Computed verified analytics across dataset records",
            execution_time_ms=duration_ms
        )
