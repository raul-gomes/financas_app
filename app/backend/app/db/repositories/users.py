from sqlalchemy import select, func
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
        # Primeiro usuário registrado vira admin (bootstrap); os demais nascem 'user'.
        result = await db.execute(select(func.count(UserORM.id)))
        total_users = result.scalar() or 0
        role = "admin" if total_users == 0 else "user"
        user = UserORM(name="", email=email, password_hash="", role=role)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user
