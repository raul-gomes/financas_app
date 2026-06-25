from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# from .core.database import connect_to_mongo, close_mongo_connection
from .logger import logger, log_with_context

from .routes.transacoes_routes import router as trasacoes_router
from .routes.categorias_routes import router as categorias_router
from .routes.dashboard_routes import router as dashboard_router
from .routes.limits_routes import router as limits_router
from .routes.contas_recorrentes_routes import router as recorrentes_router
from .routes.extracto_routes import router as extracto_router
from .routes.settings_routes import router as settings_router
from .routes.metas_routes import router as metas_router
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
    allow_origins=["http://localhost:8080", "http://localhost:8087", "http://172.25.208.1:8080", "http://172.17.160.1:8080", "http://192.168.15.2:8080/"],  # Em produção, especificar domínios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(trasacoes_router)
app.include_router(categorias_router)
app.include_router(dashboard_router)
app.include_router(limits_router)
app.include_router(recorrentes_router)
app.include_router(extracto_router)
app.include_router(settings_router)
app.include_router(metas_router)
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