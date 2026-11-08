from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class QueryRequest(BaseModel):
    message: str = Field(..., description="User question in natural language")
    dataset_id: Optional[int] = Field(None, description="Explicit target dataset ID if selected in context")
    dashboard_id: Optional[int] = Field(None, description="Optional active dashboard ID")
    metric_id: Optional[int] = Field(None, description="Optional active metric ID")
    conversation_history: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Recent conversation turns")

class ProvenanceInfo(BaseModel):
    dataset_id: Optional[int] = None
    dataset_name: Optional[str] = None
    row_count: Optional[int] = None
    columns_used: List[str] = Field(default_factory=list)
    sql_executed: Optional[str] = None
    calculation_formula: Optional[str] = None
    execution_time_ms: float = 0.0

class ToolCallLog(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]
    success: bool
    execution_time_ms: float
    output_summary: Optional[str] = None

class QueryResponse(BaseModel):
    question: str
    answer: str
    intent: str
    is_general_advice: bool = False
    grounded: bool = False
    evidence_validated: bool = False
    insufficient_data: bool = False
    data: Optional[Dict[str, Any]] = None
    visualization: Optional[Dict[str, Any]] = None
    table_data: Optional[List[Dict[str, Any]]] = None
    provenance: Optional[ProvenanceInfo] = None
    tool_executions: List[ToolCallLog] = Field(default_factory=list)
    follow_up_questions: List[str] = Field(default_factory=list)
    analysis_status: str
    execution_time_ms: float
