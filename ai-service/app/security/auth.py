from fastapi import Header, HTTPException, status
from app.config import settings
import logging

logger = logging.getLogger("ai_service.security")

def verify_service_token(
    x_service_token: str = Header(None, alias="X-Service-Token"),
    x_organization_id: str = Header(None, alias="X-Organization-Id"),
    x_user_id: str = Header(None, alias="X-User-Id"),
    x_user_role: str = Header("viewer", alias="X-User-Role")
):
    """
    Validates internal service-to-service authorization token.
    Prevents direct unauthorized public requests.
    """
    if not x_service_token or x_service_token != settings.AI_SERVICE_SECRET:
        logger.warning("Rejected request with invalid or missing X-Service-Token.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized service request. Invalid service token."
        )

    if not x_organization_id or not x_organization_id.strip():
        logger.warning("Rejected request with missing X-Organization-Id.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required tenant organization context (X-Organization-Id)."
        )

    return {
        "organization_id": x_organization_id.strip(),
        "user_id": x_user_id.strip() if x_user_id else None,
        "role": x_user_role.strip().lower()
    }

