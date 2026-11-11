import re
from typing import Dict, Any

class IntentRouter:
    """
    Classifies natural language business queries into operational execution paths:
    - CONVERSATIONAL: Greetings, platform capabilities, help
    - SALES_GROWTH_ANALYSIS: Multi-dimensional growth investigation (revenue, AOV, top/bottom segments, growth levers)
    - REVENUE_DECLINE_ANALYSIS: Multi-step investigation of sales drops, variance, underperforming segments, anomalies
    - PROFITABILITY_ANALYSIS: Gross margin, COGS, cost-to-revenue ratio, unit economics
    - RANKING: Top/bottom performers across products, regions, channels, categories
    - BREAKDOWN: Distribution by region, channel, product, category
    - SCENARIO_SIMULATION: Counterfactual What-If modeling (costs, prices, volume changes)
    - FORECAST: Predictive time-series projections
    - ANOMALY_INVESTIGATION: Statistical outliers, volatility, unusual spikes/dips
    - DATASET_EXPLORATION: Schema inspection, column coverage, identifying missing business attributes
    - KPI_QUERY: Exact single aggregations (total revenue, order counts, units)
    - GENERAL_BUSINESS_ADVICE: Conceptual definition of financial terms without active dataset context
    """

    CONVERSATIONAL_PATTERNS = [
        r"^(hi|hello|hey|hiya|howdy|greetings|good\s+(morning|afternoon|evening))\b",
        r"^(thanks|thank\s+you|appreciate\s+it|thx)\b",
        r"^(help|what\s+can\s+you\s+do|capabilities|who\s+are\s+you|guide)\b",
        r"^(bye|goodbye|see\s+you|farewell)\b"
    ]

    DATASET_EXPLORATION_PATTERNS = [
        r"\b(?:what|which)\s+(?:information|columns?|fields?|data|metrics?)\s+(?:is|are)?\s*(?:missing|lacking|untracked|not\s+tracked|available|present)\b",
        r"\bwhat\s+(?:does\s+this\s+dataset\s+contain|is\s+in\s+my\s+dataset|columns?\s+do\s+(?:we|i)\s+have)\b",
        r"\b(?:what\s+are\s+the\s+column\s+names|list\s+(?:the\s+)?columns?|column\s+names?|columns?\s+in\s+this\s+(?:table|dataset))\b",
        r"\bwhich\s+columns?\s+(?:contain|have)\s+numbers?\b",
        r"\b(?:numeric|numerical)\s+columns?\b",
        r"\bhow\s+many\s+columns?\s*(?:are\s+there|in\s+this\s+(?:table|dataset))?\b",
        r"\bhow\s+many\s+rows?\s*(?:are\s+in\s+this\s+dataset|in\s+this\s+dataset|are\s+there)?\b",
        r"\b(?:number|count)\s+of\s+(?:columns?|rows?|records?)\b",
        r"\bwhich\s+date\s+range\s+does\s+this\s+dataset\s+cover\b",
        r"\b(?:what\s+is\s+the\s+)?date\s+range\b",
        r"\b(?:dataset|schema)\s+(?:inspection|structure|overview|summary|coverage)\b"
    ]

    SALES_GROWTH_PATTERNS = [
        r"\bhow\s+(?:can|do|to|should)\s*(?:i|we)?\s*(?:increase|increse|boost|grow|improve|scale|maximize|accelerate)\s*(?:my|our|the|business|overall)?\s*(?:sales|revenue|turnover|growth)\b",
        r"\b(?:ways|ideas|strategies|how)\s+to\s+(?:grow|increase|increse|boost)\s+(?:sales|revenue)\b",
        r"\b(?:sales|revenue)\s+growth\s+(?:strategy|recommendations?|analysis|opportunities?)\b"
    ]

    REVENUE_DECLINE_PATTERNS = [
        r"\bwhy\s+did\s+(?:my|our|the)?\s*(?:revenue|sales|income|turnover)\s*(?:decrease|drop|fall|decline|plummet|plunge|slow\s+down)\b",
        r"\b(?:cause|reason|explanation)\s+for\s+(?:revenue|sales)\s+(?:drop|decline|decrease)\b",
        r"\bwhat\s+caused\s+(?:revenue|sales)\s+to\s+(?:drop|fall|decrease|decline)\b"
    ]

    SCENARIO_PATTERNS = [
        r"\bwhat\s+happens\s+if\b",
        r"\bwhat\s+if\b",
        r"\bsimulat(?:e|ion)\b",
        r"\bscenario\b",
        r"\bif\s+(?:operating\s+costs?|costs?|prices?|cogs|volume|expenses?)\s*(?:increase|decrease|rise|drop|change)\b"
    ]

    PROFITABILITY_PATTERNS = [
        r"\b(?:gross\s+profit\s+margin|gross\s+margin|profit\s+margin|margin\s+percentage|profitability)\b",
        r"\bwhat\s+is\s+(?:my|our)?\s*(?:gross\s+margin|profit\s+margin|operating\s+margin)\b"
    ]

    ANOMALY_PATTERNS = [
        r"\b(?:anomal|outlier|unusual|irregular|spike|dip|deviation)\b",
        r"\bidentify\s+unusual\s+(?:sales|revenue|order)?\s*patterns\b"
    ]

    FORECAST_PATTERNS = [
        r"\b(?:forecast|predict|project|future\s+trajectory|next\s+month|next\s+quarter)\b"
    ]

    MONTH_OVER_MONTH_PATTERNS = [
        r"\bcompare\s+(?:this\s+month|current\s+month)\s+(?:with|to|vs|against)\s+(?:last\s+month|previous\s+month)\b",
        r"\bcompare\s+(?:last\s+month|previous\s+month)\s+(?:with|to|vs|against)\s+(?:this\s+month|current\s+month)\b",
        r"\b(?:month[- ]over[- ]month|mom|monthly)\s+(?:comparison|change|growth|performance|variance|difference)\b",
        r"\bcompare\s+(?:the\s+)?(?:last|past)\s+(?:two|2)\s+months\b",
        r"\bcompare\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(?:with|to|and|vs)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\b",
        r"\bhow\s+(?:does|is)\s+(?:this\s+month|current\s+month)\s+(?:compare|performing\s+compared)\s+(?:to|with)\s+(?:last\s+month|previous\s+month)\b",
        r"\bcompare\s+this\s+month\b",
        r"\bcompare.*?\b(?:month|mom)\b"
    ]

    DATASET_CONTEXT_PATTERNS = [
        r"\b(?:which|what)\s+dataset\s+(?:are\s+you\s+(?:currently\s+)?analyzing|is\s+selected|are\s+we\s+looking\s+at|is\s+in\s+use|is\s+active)\b",
        r"\bwhich\s+dataset\s+are\s+you\s+analyzing\b",
        r"\bcurrent\s+dataset\b"
    ]

    TREND_PATTERNS = [
        r"\b(?:show|display|plot|view)?\s*(?:monthly|daily|weekly|quarterly)?\s*(?:revenue|sales)\s+trends?\b",
        r"\btrends?\s+(?:in|of|for)\s+(?:revenue|sales)\b"
    ]

    DATA_QUALITY_PATTERNS = [
        r"\b(?:are\s+there\s+any\s+)?(?:missing\s+values?|duplicate\s+records?|nulls?|duplicates?)\b",
        r"\bidentify\s+(?:missing|null|empty)\s+(?:values?|data|fields?|records?)\b",
        r"\bidentify\s+duplicate\s+(?:records?|rows?|entries|data)\b",
        r"\b(?:missing\s+values?|duplicate\s+records?|data\s+quality|data\s+cleanliness)\b"
    ]

    RELATIONSHIP_PATTERNS = [
        r"\b(?:what\s+is|explain)\s+(?:the\s+)?relationship\s+between\s+(?:revenue|sales)\s+and\s+(?:profit|margin|cost|cogs)\b",
        r"\bhow\s+(?:does|do)\s+(?:revenue|sales)\s+(?:relate|impact|affect)\s+(?:to\s+)?(?:profit|margin)\b"
    ]

    AOV_PATTERNS = [
        r"\b(?:average|avg)\s+order\s+value\b",
        r"\bwhat\s+is\s+(?:the\s+)?aov\b",
        r"\baov\b"
    ]

    RANKING_PATTERNS = [
        r"\bwhich\s+(?:product|region|channel|category|item|branch)\s+(?:has|had|generate[ds]?|records?|shows?)\s+(?:the\s+)?(?:highest|lowest|most|least)\s+(?:sales|revenue|profit|turnover|units)\b",
        r"\bwhich\s+(?:product|region|channel|category|item|branch)\s+(?:performs?\s+best|performs?\s+worst|is\s+the\s+top|contributes?\s+the\s+most|generates?\s+the\s+most)\b",
        r"\b(?:top|bottom|highest|lowest|best|worst|rank|ranking)\s+(?:three|3|five|5|ten|10)?\s*(?:performing\s+)?(?:products?|regions?|channels?|categories?|customers?|items?)\b"
    ]

    BREAKDOWN_PATTERNS = [
        r"\b(?:breakdown|distribution|split|share|contribution)\s+by\s+(?:region|channel|product|category)\b",
        r"\b(?:sales|revenue)\s+by\s+(?:region|channel|product|category)\b",
        r"\bcompare\s+(?:the\s+last\s+two\s+quarters|regions|channels|products)\b"
    ]

    FACTORS_PATTERNS = [
        r"\b(?:factors|drivers|correlations?)\s+(?:are\s+)?associated\s+with\s+(?:revenue|sales)\b",
        r"\bwhat\s+(?:drives|explains|influences)\s+(?:revenue|sales)\b"
    ]

    @classmethod
    def classify(cls, query: str, has_dataset_context: bool = False) -> Dict[str, Any]:
        text = (query or "").strip().lower()

        # 1. Conversational
        for pat in cls.CONVERSATIONAL_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "CONVERSATIONAL",
                    "requires_database": False,
                    "is_general_advice": False
                }

        # 2. Dataset Context Query (e.g. "which dataset are you currently analyzing")
        for pat in cls.DATASET_CONTEXT_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "DATASET_CONTEXT_QUERY",
                    "requires_database": True,
                    "is_general_advice": False
                }

        # 3. Month-over-Month / Period Comparison (CRITICAL: Checked before general breakdown)
        for pat in cls.MONTH_OVER_MONTH_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "MONTH_OVER_MONTH_COMPARISON",
                    "requires_database": True,
                    "is_general_advice": False
                }

        # 4. Data Quality Query (missing values, duplicate records)
        for pat in cls.DATA_QUALITY_PATTERNS:
            if re.search(pat, text):
                sub = "missing_values" if "missing" in text or "null" in text else "duplicates"
                return {
                    "intent": "DATA_QUALITY_QUERY",
                    "requires_database": True,
                    "is_general_advice": False,
                    "subtype": sub
                }

        # 5. Relationship Explanation (e.g. relationship between revenue and profit)
        for pat in cls.RELATIONSHIP_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "RELATIONSHIP_EXPLANATION",
                    "requires_database": True,
                    "is_general_advice": False
                }

        # 6. Trend Query (e.g. show monthly revenue trends)
        for pat in cls.TREND_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "TREND_QUERY",
                    "requires_database": True,
                    "is_general_advice": False
                }

        # 7. Average Order Value (AOV)
        for pat in cls.AOV_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "AOV_QUERY",
                    "requires_database": True,
                    "is_general_advice": False
                }

        # 8. Dataset Exploration (e.g. "what information is missing from my dataset")
        for pat in cls.DATASET_EXPLORATION_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "DATASET_EXPLORATION",
                    "requires_database": True,
                    "is_general_advice": False
                }

        # 3. Sales Growth Analysis (e.g. "how to increase my sales", "how to increse my sales")
        for pat in cls.SALES_GROWTH_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "SALES_GROWTH_ANALYSIS",
                    "requires_database": True,
                    "is_general_advice": False,
                    "topic": "sales_growth"
                }

        # 4. Revenue Decline Analysis (e.g. "why did my revenue decrease?")
        for pat in cls.REVENUE_DECLINE_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "REVENUE_DECLINE_ANALYSIS",
                    "requires_database": True,
                    "is_general_advice": False,
                    "topic": "revenue_decline"
                }

        # 5. What-If Scenario Simulation
        for pat in cls.SCENARIO_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "SCENARIO_SIMULATION",
                    "requires_database": True,
                    "is_general_advice": False
                }

        # 6. Profitability / Gross Margin Analysis
        for pat in cls.PROFITABILITY_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "PROFITABILITY_ANALYSIS",
                    "requires_database": True,
                    "is_general_advice": False
                }

        # 7. Anomaly Diagnostics
        for pat in cls.ANOMALY_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "ANOMALY_INVESTIGATION",
                    "requires_database": True,
                    "is_general_advice": False
                }

        # 8. Forecasting
        for pat in cls.FORECAST_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "FORECAST",
                    "requires_database": True,
                    "is_general_advice": False
                }

        # 9. Factors / Correlation Analysis
        for pat in cls.FACTORS_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "FACTORS_ANALYSIS",
                    "requires_database": True,
                    "is_general_advice": False
                }

        # 10. Ranking
        for pat in cls.RANKING_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "RANKING",
                    "requires_database": True,
                    "is_general_advice": False
                }

        # 11. Categorical Breakdown / Comparison
        for pat in cls.BREAKDOWN_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "BREAKDOWN",
                    "requires_database": True,
                    "is_general_advice": False
                }

        # 12. Standard KPI Query (total revenue, count of orders, etc.)
        kpi_keywords = ["total", "sum", "average", "avg", "count", "how much", "how many", "revenue", "sales", "volume", "orders"]
        if any(w in text for w in kpi_keywords):
            return {
                "intent": "KPI_QUERY",
                "requires_database": True,
                "is_general_advice": False
            }

        # 13. Fallback: If dataset is present or analytical query, inspect dataset
        if has_dataset_context or any(w in text for w in ["metric", "data", "performance", "trend"]):
            return {
                "intent": "KPI_QUERY",
                "requires_database": True,
                "is_general_advice": False
            }

        # Otherwise general conceptual advice
        return {
            "intent": "GENERAL_BUSINESS_ADVICE",
            "requires_database": False,
            "is_general_advice": True,
            "topic": "general"
        }
