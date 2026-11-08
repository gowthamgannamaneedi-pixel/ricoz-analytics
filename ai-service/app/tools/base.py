import time
from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple
import logging

logger = logging.getLogger("ai_service.tools")

class BaseTool(ABC):
    name: str = "base_tool"
    description: str = "Base analytical tool"

    @abstractmethod
    def execute(self, organization_id: str, **kwargs) -> Dict[str, Any]:
        """
        Execute tool with tenant-scoped parameters.
        Must strictly isolate operations to organization_id.
        """
        pass

    def run_safe(self, organization_id: str, **kwargs) -> Tuple[Dict[str, Any], float, bool]:
        """
        Executes tool with timing, error capture, and logging.
        Returns: (result_dict, execution_time_ms, success_bool)
        """
        start = time.perf_counter()
        try:
            result = self.execute(organization_id=organization_id, **kwargs)
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            return result, duration_ms, True
        except Exception as e:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.error(f"Error executing tool {self.name}: {e}")
            return {"error": str(e), "success": False}, duration_ms, False
