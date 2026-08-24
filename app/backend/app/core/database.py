from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from .config import Config
from app.db.base import Base

# SQLite (aiosqlite) não suporta pool_size/max_overflow; aplica só para PostgreSQL
is_postgres = Config.DATABASE_URL.startswith('postgresql')

engine_kwargs = {
    'future': True,
    'echo': Config.DB_ECHO,
}
if is_postgres:
    engine_kwargs.update({
        'pool_size': Config.DB_POOL_SIZE,
        'max_overflow': Config.DB_MAX_OVERFLOW,
        'pool_pre_ping': True,
        'pool_recycle': Config.DB_POOL_RECYCLE,
    })

engine = create_async_engine(Config.DATABASE_URL, **engine_kwargs)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

sync_engine = create_engine(
    Config.DATABASE_URL.replace('+aiosqlite', '').replace('+asyncpg', ''),
    echo=False,
    future=True,
)

async def get_session():
    async with AsyncSessionLocal() as session:
        yield session