import pytest
from app.security.sanitization import is_safe_read_query, sanitize_user_input

def test_safe_read_query_permits_select():
    safe, err = is_safe_read_query("SELECT sum((data->>'revenue')::numeric) FROM dataset_rows WHERE dataset_id = 1;")
    assert safe is True
    assert err == ""

def test_safe_read_query_blocks_insert():
    safe, err = is_safe_read_query("INSERT INTO users (email) VALUES ('hacked@test.com');")
    assert safe is False
    assert "Only read-only SELECT" in err or "Prohibited" in err

def test_safe_read_query_blocks_drop():
    safe, err = is_safe_read_query("SELECT 1; DROP TABLE datasets;")
    assert safe is False
    assert "Prohibited" in err

def test_safe_read_query_blocks_update():
    safe, err = is_safe_read_query("UPDATE organizations SET plan = 'enterprise';")
    assert safe is False

def test_sanitize_user_input_removes_null_bytes():
    dirty = "how to increase sales\x00; DROP TABLE datasets;"
    clean = sanitize_user_input(dirty)
    assert "\x00" not in clean
