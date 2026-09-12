from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import UserORM


async def get_or_create_user_from_supabase(
    db: AsyncSession, sub: str, email: str
) -> UserORM:
    result = await db.execute(
        select(UserORM).where(UserORM.email == email)
    )
    user = result.scalars().first()
    if not user:
        # Todo novo cadastro nasce como 'user'; admin somente via promoção manual no banco.
        user = UserORM(name="", email=email, password_hash="", role="user")
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user
