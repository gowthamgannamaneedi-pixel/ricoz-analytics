from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger("ai_service.planner")

class ExecutionPlan:
    def __init__(self, intent: str, question: str):
        self.intent = intent
        self.question = question
        self.steps: List[Dict[str, Any]] = []
        self.target_metric: Optional[str] = None
        self.dimension: Optional[str] = None
        self.secondary_dimension: Optional[str] = None
        self.date_column: Optional[str] = None
        self.cost_column: Optional[str] = None
        self.missing_requirements: List[str] = []

    def add_step(self, tool_name: str, args: Dict[str, Any], purpose: str):
        self.steps.append({
            "tool": tool_name,
            "args": args,
            "purpose": purpose
        })

class AgentPlanner:
    """
    Dynamic schema-aware planner.
    Analyzes user intent and actual dataset schema to construct an adaptive, multi-step execution plan.
    Never executes irrelevant tools just to fill response space.
    """

    @classmethod
    def create_plan(
        cls,
        intent: str,
        question: str,
        dataset_id: int,
        schema_info: Dict[str, Any]
    ) -> ExecutionPlan:
        plan = ExecutionPlan(intent, question)
        columns = schema_info.get("columns", [])
        numeric_cols = schema_info.get("numeric_columns", [])
        categorical_cols = schema_info.get("categorical_columns", [])
        col_names = [c["name"].lower() for c in columns if isinstance(c, dict) and c.get("name")]
        
        # 1. Resolve Primary Metric
        rev_candidates = ["revenue", "sales", "total_amount", "amount", "order_value", "turnover", "invoiced_amount"]
        primary_metric = None
        for cand in rev_candidates:
            if cand in col_names:
                primary_metric = cand
                break
            for nc in numeric_cols:
                if cand in nc.lower():
                    primary_metric = nc
                    break
            if primary_metric:
                break
        if not primary_metric and numeric_cols:
            primary_metric = numeric_cols[0]
        plan.target_metric = primary_metric

        # 2. Resolve Cost Column (for profitability)
        cost_candidates = ["cost", "cogs", "expenses", "expense", "operating_cost"]
        cost_col = None
        for cand in cost_candidates:
            if cand in col_names:
                cost_col = cand
                break
            for nc in numeric_cols:
                if cand in nc.lower():
                    cost_col = nc
                    break
            if cost_col:
                break
        plan.cost_column = cost_col

        # 3. Resolve Dimensions (product, category, region, channel)
        prod_candidates = ["product", "item", "sku", "service", "product_name"]
        region_candidates = ["region", "territory", "city", "state", "zone", "location", "country"]
        channel_candidates = ["channel", "sales_channel", "platform", "source", "medium"]

        dim_candidates = []
        for cand in prod_candidates + region_candidates + channel_candidates:
            for cc in categorical_cols:
                if cand in cc.lower() and cc not in dim_candidates:
                    dim_candidates.append(cc)

        if not dim_candidates and categorical_cols:
            dim_candidates = categorical_cols

        plan.dimension = dim_candidates[0] if dim_candidates else None
        plan.secondary_dimension = dim_candidates[1] if len(dim_candidates) > 1 else None

        # 4. Resolve Date Column
        date_candidates = ["date", "created_at", "timestamp", "order_date", "invoice_date", "period", "month"]
        for cand in date_candidates:
            for c in columns:
                if cand in c["name"].lower():
                    plan.date_column = c["name"]
                    break
            if plan.date_column:
                break

        # 5. Build Intent-Specific Multi-Step Plan
        if intent == "SALES_GROWTH_ANALYSIS":
            if primary_metric:
                plan.add_step("kpi_calculator", {"dataset_id": dataset_id, "kpi_name": primary_metric}, "Compute baseline sales performance and volume")
            else:
                plan.missing_requirements.append("No numeric sales/revenue column found in dataset.")

            if plan.dimension and primary_metric:
                plan.add_step("analytics_executor", {"dataset_id": dataset_id, "metric_column": primary_metric, "group_by_column": plan.dimension, "aggregation": "SUM"}, f"Analyze performance across {plan.dimension} to identify leaders and laggards")

            if plan.secondary_dimension and primary_metric:
                plan.add_step("analytics_executor", {"dataset_id": dataset_id, "metric_column": primary_metric, "group_by_column": plan.secondary_dimension, "aggregation": "SUM"}, f"Analyze performance across {plan.secondary_dimension}")

            plan.add_step("recommendation_engine", {"topic": "sales_growth"}, "Formulate actionable growth levers (pricing corridor, bundle assortment, regional allocation)")

        elif intent == "REVENUE_DECLINE_ANALYSIS":
            if primary_metric:
                plan.add_step("kpi_calculator", {"dataset_id": dataset_id, "kpi_name": primary_metric}, "Compute total sales baseline")
                if plan.date_column:
                    plan.add_step("analytics_executor", {"dataset_id": dataset_id, "metric_column": primary_metric, "date_column": plan.date_column, "aggregation": "SUM"}, "Analyze period-over-period revenue progression")
                if plan.dimension:
                    plan.add_step("analytics_executor", {"dataset_id": dataset_id, "metric_column": primary_metric, "group_by_column": plan.dimension, "aggregation": "SUM"}, f"Decompose sales variance by {plan.dimension}")
                plan.add_step("statistical_analysis", {"dataset_id": dataset_id, "metric_column": primary_metric}, "Detect anomalous drops or high variance records")
                plan.add_step("recommendation_engine", {"topic": "turnaround"}, "Generate root-cause mitigation and revenue turnaround recommendations")

        elif intent == "PROFITABILITY_ANALYSIS":
            if primary_metric and cost_col:
                plan.add_step("kpi_calculator", {"dataset_id": dataset_id, "kpi_name": "margin"}, "Compute gross profit and gross margin %")
            elif primary_metric:
                plan.add_step("kpi_calculator", {"dataset_id": dataset_id, "kpi_name": primary_metric}, "Compute revenue (cost column missing)")
                plan.missing_requirements.append("Dataset does not contain a Cost/COGS column. Gross margin cannot be computed directly.")

        elif intent == "SCENARIO_SIMULATION":
            plan.add_step("scenario_simulator", {"dataset_id": dataset_id}, "Simulate counterfactual adjustments on baseline revenue and costs")

        elif intent == "FORECAST":
            if primary_metric:
                plan.add_step("forecasting", {"dataset_id": dataset_id, "metric_column": primary_metric}, "Generate trend-line regression forecast")
            else:
                plan.missing_requirements.append("Numeric metric required for forecasting.")

        elif intent == "ANOMALY_INVESTIGATION":
            if primary_metric:
                plan.add_step("statistical_analysis", {"dataset_id": dataset_id, "metric_column": primary_metric}, "Calculate mean, standard deviation, and identify 2-sigma outliers")

        elif intent == "RANKING" or intent == "BREAKDOWN":
            target_dim = plan.dimension or "category"
            if primary_metric:
                plan.add_step("analytics_executor", {"dataset_id": dataset_id, "metric_column": primary_metric, "group_by_column": target_dim, "aggregation": "SUM"}, f"Rank {target_dim} by {primary_metric}")

        elif intent == "DATASET_EXPLORATION":
            # Handled via schema and missing attribute analysis
            pass

        else: # KPI_QUERY
            if primary_metric:
                plan.add_step("kpi_calculator", {"dataset_id": dataset_id, "kpi_name": primary_metric}, f"Compute {primary_metric} aggregation")

        return plan
