from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from .config import Config, require_database_url

# SQLite (aiosqlite) não suporta pool_size/max_overflow; aplica só para PostgreSQL
DATABASE_URL = require_database_url(Config.DATABASE_URL)
is_postgres = DATABASE_URL.startswith("postgresql")

engine_kwargs = {
    "future": True,
    "echo": Config.DB_ECHO,
}
if is_postgres:
    engine_kwargs.update(
        {
            "pool_size": Config.DB_POOL_SIZE,
            "max_overflow": Config.DB_MAX_OVERFLOW,
            "pool_pre_ping": True,
            "pool_recycle": Config.DB_POOL_RECYCLE,
        }
    )

engine = create_async_engine(DATABASE_URL, **engine_kwargs)
AsyncSessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_session():
    async with AsyncSessionLocal() as session:
        yield session
