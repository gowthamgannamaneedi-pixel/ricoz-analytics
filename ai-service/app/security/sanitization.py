import re
from typing import Tuple

FORBIDDEN_SQL_PATTERNS = [
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|EXEC|EXECUTE|CREATE|GRANT|REVOKE)\b",
    r";\s*\w+",                 # Multiple statements
    r"--",                      # Line comments
    r"/\*.*?\*/",               # Block comments
    r"\bpg_sleep\b",            # Denial of service probes
    r"\bxp_cmdshell\b",
    r"\bCOPY\b"
]

def is_safe_read_query(sql: str) -> Tuple[bool, str]:
    """
    Validates that a SQL string is purely read-only (SELECT) and contains no dangerous mutations or injections.
    """
    if not sql or not sql.strip():
        return False, "Query cannot be empty"

    clean_sql = sql.strip()
    if not clean_sql.upper().startswith("SELECT"):
        return False, "Only read-only SELECT statements are permitted"

    for pattern in FORBIDDEN_SQL_PATTERNS:
        if re.search(pattern, clean_sql, re.IGNORECASE):
            return False, f"Prohibited SQL pattern detected: {pattern}"

    return True, ""

def sanitize_user_input(text: str) -> str:
    """
    Sanitizes user input string against prompt injection framing tokens.
    """
    if not text:
        return ""
    # Strip null bytes and excessive control chars
    clean = text.replace("\x00", "").strip()
    # Normalize excessive newlines
    clean = re.sub(r"\n{4,}", "\n\n", clean)
    return clean[:2000]

