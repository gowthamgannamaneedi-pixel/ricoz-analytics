from app.agents.intent_router import IntentRouter

router = IntentRouter()
queries = [
    "How many columns are there in this table?",
    "How many rows are in this dataset?",
    "What are the column names?",
    "Which columns contain numbers?",
    "What is the total revenue?",
    "What is the average order value?",
    "Which date range does this dataset cover?",
    "How many duplicate or missing records are present?"
]

print("--- Testing IntentRouter ---")
for q in queries:
    res = router.classify(q)
    print(f'Query: "{q}"\n  -> Intent: {res.get("intent")}\n  -> NeedsDataset: {res.get("needs_dataset")}\n  -> Plan: {res.get("planned_tools")}\n')
