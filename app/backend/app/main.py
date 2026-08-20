from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# from .core.database import connect_to_mongo, close_mongo_connection
from .logger import logger, log_with_context

from .routes.transactions_routes import router as transactions_router
from .routes.categories_routes import router as categories_router
from .routes.dashboard_routes import router as dashboard_router
from .routes.limits_routes import router as limits_router
from .routes.recurring_accounts_routes import router as recurring_accounts_router
from .routes.extract_routes import router as extract_router
from .routes.settings_routes import router as settings_router
from .routes.goals_routes import router as goals_router
from .routes.shopping_routes import router as shopping_router
from .routes.pluggy_routes import router as pluggy_router
from .routes.export_routes import router as export_router

app = FastAPI(
    title="API Financeira",
    description='API para gerenciamento de transações financeiras',
    version='1.0.0',
)

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["http://localhost:8087", "http://localhost:8080", "http://localhost:8005"],  # Em producao, especificar dominios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions_router)
app.include_router(categories_router)
app.include_router(dashboard_router)
app.include_router(limits_router)
app.include_router(recurring_accounts_router)
app.include_router(extract_router)
app.include_router(settings_router)
app.include_router(goals_router)
app.include_router(shopping_router)
app.include_router(pluggy_router)
app.include_router(export_router)

@app.get('/', tags=['Root'])
async def root():
    '''Endpoint raiz da api'''
    logger.info('Endpoint inicializado')
    return {
        'message': 'API Financeira está funcionando!',
        'docs': '/docs',
        'redoc': '/redoc'
    }

@app.get('/health', tags=['Health'])
async def health():
    '''Health check geral da api'''
    return {
        'status': 'Healthy',
        'service': 'api-financeira'
    }