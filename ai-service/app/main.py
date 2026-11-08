from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import time

from app.config import settings
from app.database.connection import init_connection_pool, close_connection_pool
from app.api.routes.query import router as query_router
from app.api.routes.health import router as health_router
from app.api.routes.index import router as index_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
)
logger = logging.getLogger("ai_service.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting RicozAnalytics Python Agentic RAG Service...")
    try:
        init_connection_pool()
    except Exception as e:
        logger.error(f"PostgreSQL connection initialization failed: {e}")
    yield
    logger.info("Shutting down RicozAnalytics Python Agentic RAG Service...")
    close_connection_pool()

app = FastAPI(
    title="RicozAnalytics Agentic RAG Service",
    version="2.0.0",
    description="Enterprise Python-based Agentic RAG and deterministic analytics engine",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://localhost:5173", "https://ricoz-analytics.onrender.com", "https://ricoz-analytics.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging & timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = round((time.perf_counter() - start_time) * 1000, 2)
    response.headers["X-Process-Time-Ms"] = str(process_time)
    return response

# Include API Routers
app.include_router(health_router)
app.include_router(query_router)
app.include_router(index_router)

# Root endpoint
@app.get("/")
def root():
    return {
        "service": "RicozAnalytics Python Agentic RAG Service",
        "version": "2.0.0",
        "status": "online",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=False)
