import re
from typing import Dict, Any

class IntentRouter:
    """
    Classifies natural language business queries into operational execution paths:
    - GENERAL_BUSINESS_ADVICE: Pure strategic advice (no numbers fabricated)
    - DATASET_ANALYTICS: Specific calculation requiring database execution on dataset_rows
    - CONVERSATIONAL: Greetings, platform capabilities, help
    """

    CONVERSATIONAL_PATTERNS = [
        r"^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening))\b",
        r"^(thanks|thank\s+you|appreciate\s+it)\b",
        r"^(help|what\s+can\s+you\s+do|capabilities|who\s+are\s+you)\b"
    ]

    GENERAL_ADVICE_PATTERNS = [
        r"\bhow\s+(can|do|to|should)\s*(?:i|we)?\s*(increase|boost|grow|improve|scale|maximize)\s*(?:my|our|the|business|overall)?\s*(sales|revenue|profit|margin|retention|leads)\b",
        r"\bhow\s+(can|do|to|should)\s*(?:i|we)?\s*(reduce|cut|decrease|minimize|lower)\s*(?:my|our|the|business)?\s*(cost|costs|expenses|churn|waste)\b",
        r"\bwhat\s+(is|are)\s+a?\s*(good|best|effective)\s*(strategy|framework|approach|method|way)\b",
        r"\bexplain\s+(gross\s+margin|churn|retention|clv|cac|ebitda|burn\s+rate|roi|unit\s+economics)\b",
        r"\b(tips|ideas|advice|best\s+practices|strategies)\s+for\b"
    ]

    DATASET_METRIC_PATTERNS = [
        r"\b(total|sum|aggregate|calculate|what\s+is\s+my|show\s+me)\s+(revenue|sales|profit|margin|units|orders|volume)\b",
        r"\bwhich\s+(region|product|channel|category|branch|customer|salesperson)\s+(has|generates|sold|performed|is\s+the\s+best|is\s+the\s+top)\b",
        r"\b(top|highest|lowest|bottom|rank|ranking)\s+(regions?|products?|categories?|channels?|items?)\b",
        r"\b(breakdown|distribution|split)\s+by\s+(region|channel|product|category)\b",
        r"\b(trend|growth|over\s+time|monthly|quarterly|forecast|predict)\b",
        r"\b(compare|versus|vs|quarter\s+over\s+quarter|year\s+over\s+year)\b",
        r"\b(anomal|outlier|deviation|spike|dip)\b"
    ]

    @classmethod
    def classify(cls, query: str, has_dataset_context: bool = False) -> Dict[str, Any]:
        text = (query or "").strip().lower()

        # Check conversational first
        for pat in cls.CONVERSATIONAL_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "CONVERSATIONAL",
                    "requires_database": False,
                    "is_general_advice": False
                }

        # Check general advice
        # If user asks "how to increase my sales", it is general business advice
        for pat in cls.GENERAL_ADVICE_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "GENERAL_BUSINESS_ADVICE",
                    "requires_database": False,
                    "is_general_advice": True,
                    "topic": "sales_growth" if "sales" in text or "revenue" in text else "cost_reduction" if "cost" in text else "margin_improvement"
                }

        # Check dataset-specific analytics
        for pat in cls.DATASET_METRIC_PATTERNS:
            if re.search(pat, text):
                return {
                    "intent": "DATASET_ANALYTICS",
                    "requires_database": True,
                    "is_general_advice": False
                }

        # Default fallback:
        # If dataset is selected and query contains analytical words, treat as dataset analytics
        analytical_keywords = ["revenue", "sales", "cost", "margin", "region", "channel", "product", "order", "unit", "dataset", "table"]
        if any(w in text for w in analytical_keywords):
            return {
                "intent": "DATASET_ANALYTICS",
                "requires_database": True,
                "is_general_advice": False
            }

        # Otherwise conversational/clarification
        return {
            "intent": "GENERAL_BUSINESS_ADVICE",
            "requires_database": False,
            "is_general_advice": True,
            "topic": "general"
        }
