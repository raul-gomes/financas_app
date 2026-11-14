"""Local user records keyed by the Supabase identity (``sub`` claim)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import UserORM


class IdentityConflictError(Exception):
    """The token's e-mail already belongs to a different Supabase account."""


async def get_or_create_user_from_supabase(db: AsyncSession, sub: str, email: str) -> UserORM:
    """Return the local user for a Supabase identity, creating or linking it.

    Lookup order: by ``sub``; then a legacy row with the same e-mail and no
    ``sub`` yet (linked now); else a new ``user``. The local e-mail follows
    Supabase. An e-mail already linked to another ``sub`` is refused.
    """
    user = (await db.execute(select(UserORM).where(UserORM.supabase_id == sub))).scalars().first()
    if user is not None:
        if user.email != email:
            user.email = email
            await db.commit()
            await db.refresh(user)
        return user

    by_email = (await db.execute(select(UserORM).where(UserORM.email == email))).scalars().first()
    if by_email is not None:
        if by_email.supabase_id is not None:
            raise IdentityConflictError(email)
        by_email.supabase_id = sub
        await db.commit()
        await db.refresh(by_email)
        return by_email

    # Every new sign-up is a 'user'; admin only by manual promotion in the database.
    user = UserORM(name="", email=email, supabase_id=sub, password_hash="", role="user")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
