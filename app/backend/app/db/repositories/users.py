"""Local user records keyed by the Supabase identity (``sub`` claim)."""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import UserORM


class IdentityConflictError(Exception):
    """The token's e-mail already belongs to a different Supabase account."""


async def _find_by_sub(db: AsyncSession, sub: str) -> UserORM | None:
    """The local user already linked to this Supabase identity, if any."""
    return (await db.execute(select(UserORM).where(UserORM.supabase_id == sub))).scalars().first()


async def get_or_create_user_from_supabase(db: AsyncSession, sub: str, email: str) -> UserORM:
    """Return the local user for a Supabase identity, creating or linking it.

    Lookup order: by ``sub``; then a legacy row with the same e-mail and no
    ``sub`` yet (linked now); else a new ``user``. The local e-mail follows
    Supabase. An e-mail already linked to another ``sub`` is refused.

    The app fires several requests at once on the first login, so another request may
    link or create the same user between these steps: a row already linked to this same
    ``sub`` is returned, and a unique-constraint race on insert re-reads by ``sub``
    instead of failing (only a different identity owning the e-mail is a conflict).
    """
    user = await _find_by_sub(db, sub)
    if user is not None:
        if user.email != email:
            user.email = email
            await db.commit()
            await db.refresh(user)
        return user

    by_email = (await db.execute(select(UserORM).where(UserORM.email == email))).scalars().first()
    if by_email is not None:
        if by_email.supabase_id == sub:
            return by_email
        if by_email.supabase_id is not None:
            raise IdentityConflictError(email)
        by_email.supabase_id = sub
        await db.commit()
        await db.refresh(by_email)
        return by_email

    # Every new sign-up is a 'user'; admin only by manual promotion in the database.
    user = UserORM(name="", email=email, supabase_id=sub, role="user")
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await _find_by_sub(db, sub)
        if existing is None:
            raise IdentityConflictError(email) from None
        return existing
    await db.refresh(user)
    return user
