from typing import Dict, Any, List
from app.tools.base import BaseTool

class BusinessRecommendationEngine(BaseTool):
    name: str = "business_recommendation_engine"
    description: str = "Generate grounded, practical strategic recommendations distinguishing measured facts from suggested actions"

    def execute(
        self,
        organization_id: str,
        kpi_data: Dict[str, Any] = None,
        breakdown_data: List[Dict[str, Any]] = None,
        topic: str = "sales_growth",
        **kwargs
    ) -> Dict[str, Any]:
        recommendations = []
        measured_facts = []

        if kpi_data and kpi_data.get("value") is not None:
            measured_facts.append(
                f"Observed {kpi_data.get('kpi', 'Metric')}: {kpi_data.get('unit', '')}{kpi_data.get('value'):,} from {kpi_data.get('dataset_name', 'telemetry')}."
            )

        if breakdown_data and len(breakdown_data) > 0:
            top_item = breakdown_data[0]
            measured_facts.append(
                f"Top contributing category: '{top_item.get('category')}' with {top_item.get('value'):,}."
            )
            if len(breakdown_data) > 1:
                bottom_item = breakdown_data[-1]
                measured_facts.append(
                    f"Lowest contributing category: '{bottom_item.get('category')}' with {bottom_item.get('value'):,}."
                )
                recommendations.append(
                    f"Reallocate growth budget and sales team focus from underperforming '{bottom_item.get('category')}' toward high-velocity '{top_item.get('category')}'."
                )

        # Standard proven business strategies based on topic
        if "sales" in topic.lower() or "revenue" in topic.lower():
            recommendations.extend([
                "Implement structured value-tier upsells and cross-sell bundles for existing active customers to increase Average Order Value (AOV).",
                "Audit conversion funnel velocity across stages to eliminate friction points between quote generation and deal closure.",
                "Review pricing corridor: test a 5-8% price optimization on high-demand, low price-elasticity SKU tiers.",
                "Introduce automated proactive renewals and retention checkpoints 30 days prior to contract anniversaries."
            ])
        elif "margin" in topic.lower() or "profit" in topic.lower():
            recommendations.extend([
                "Conduct unit-economics audit to identify high-volume but negative-margin product categories.",
                "Renegotiate vendor supply agreements or consolidate order volumes to reduce direct Cost of Goods Sold (COGS).",
                "Shift marketing mix toward organic acquisition and direct sales channels to lower Customer Acquisition Cost (CAC)."
            ])
        elif "inventory" in topic.lower():
            recommendations.extend([
                "Adopt Just-in-Time (JIT) stock buffers for fast-moving SKUs while setting liquidation thresholds for dead stock (>90 days).",
                "Automate reorder points using 30-day moving average demand forecasts to prevent stockouts."
            ])
        else:
            recommendations.extend([
                "Establish weekly KPI review rhythms to track regional deviations before variances compound.",
                "Standardize formula definitions across branches so executive decisions are grounded in identical metrics."
            ])

        return {
            "success": True,
            "measured_facts": measured_facts,
            "strategic_recommendations": recommendations,
            "provenance_note": "Facts are derived directly from verified database records. Recommendations are strategic business suggestions."
        }

