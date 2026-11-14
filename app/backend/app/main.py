from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# from .core.database import connect_to_mongo, close_mongo_connection
from .core.config import Config
from .logger import logger
from .routes.categories_routes import router as categories_router
from .routes.dashboard_routes import router as dashboard_router
from .routes.export_routes import router as export_router
from .routes.extract_routes import router as extract_router
from .routes.goals_routes import router as goals_router
from .routes.limits_routes import router as limits_router
from .routes.notifications_routes import router as notifications_router
from .routes.pluggy_routes import router as pluggy_router
from .routes.recurring_accounts_routes import router as recurring_accounts_router
from .routes.settings_routes import router as settings_router
from .routes.shopping_routes import router as shopping_router
from .routes.transactions_routes import router as transactions_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Job periódico de avaliação de limites (avisa por e-mail se habilitado).
    from .services.limit_alert_job import start_limit_alert_job, stop_limit_alert_job

    job_task = None
    try:
        job_task = await start_limit_alert_job()
    except Exception as e:
        logger.warning(f"Job de limites não iniciado: {e}")
    yield
    await stop_limit_alert_job(job_task)


def create_app(environment: str | None = None, cors_origins: list[str] | None = None) -> FastAPI:
    """Build the FastAPI app; API docs are disabled when environment is production."""
    env = (environment if environment is not None else Config.ENVIRONMENT).lower()
    origins = cors_origins if cors_origins is not None else Config.CORS_ORIGINS
    is_production = env == "production"
    application = FastAPI(
        title="API Financeira",
        description="API para gerenciamento de transações financeiras",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if is_production else "/docs",
        redoc_url=None if is_production else "/redoc",
        openapi_url=None if is_production else "/openapi.json",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(transactions_router)
    application.include_router(categories_router)
    application.include_router(dashboard_router)
    application.include_router(limits_router)
    application.include_router(recurring_accounts_router)
    application.include_router(extract_router)
    application.include_router(settings_router)
    application.include_router(goals_router)
    application.include_router(shopping_router)
    application.include_router(pluggy_router)
    application.include_router(export_router)
    application.include_router(notifications_router)
    return application


app = create_app()


@app.get("/", tags=["Root"])
async def root():
    """Endpoint raiz da api"""
    logger.info("Endpoint inicializado")
    return {"message": "API Financeira está funcionando!", "docs": "/docs", "redoc": "/redoc"}


@app.get("/health", tags=["Health"])
async def health():
    """Health check geral da api"""
    return {"status": "Healthy", "service": "api-financeira"}
