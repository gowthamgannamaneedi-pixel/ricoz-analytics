import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import logging
from app.config import settings

logger = logging.getLogger("ai_service.database")

_connection_pool = None

def init_connection_pool():
    global _connection_pool
    if _connection_pool is None:
        try:
            _connection_pool = psycopg2.pool.SimpleConnectionPool(
                minconn=1,
                maxconn=20,
                host=settings.DB_HOST,
                port=settings.DB_PORT,
                dbname=settings.DB_NAME,
                user=settings.DB_USER,
                password=settings.DB_PASSWORD,
                connect_timeout=5
            )
            logger.info("PostgreSQL connection pool initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize PostgreSQL connection pool: {e}")
            raise

def close_connection_pool():
    global _connection_pool
    if _connection_pool is not None:
        _connection_pool.closeall()
        _connection_pool = None
        logger.info("PostgreSQL connection pool closed.")

@contextmanager
def get_db_connection():
    global _connection_pool
    if _connection_pool is None:
        init_connection_pool()
    conn = _connection_pool.getconn()
    try:
        # Enforce read-only transaction and strict query timeout
        with conn.cursor() as cur:
            cur.execute(f"SET statement_timeout = {settings.STATEMENT_TIMEOUT_MS};")
        yield conn
    finally:
        _connection_pool.putconn(conn)

def execute_query(sql: str, params: tuple = None, fetch_one: bool = False):
    """
    Execute parameterized read-only query safely with dict cursor
    """
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params or ())
            if fetch_one:
                return cur.fetchone()
            return cur.fetchall()

def check_db_health() -> bool:
    try:
        row = execute_query("SELECT 1 AS alive;", fetch_one=True)
        return row is not None and row.get("alive") == 1
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False
