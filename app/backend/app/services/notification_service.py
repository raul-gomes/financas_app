"""Notifications service: limit alerts of the authenticated user, ready for the UI.

Layering (see AGENTS.md): route -> service -> repository. Every query is scoped by ``user.id``
from the verified token. Marking as read only changes loaded rows: the unit of work commits
once when the route returns.
"""

from app.core.unit_of_work import UnitOfWork
from app.db.models.user import UserORM
from app.db.repositories.limit_alert import LimitAlertRepository
from app.schemas.notifications import MarkReadResponse, NotificationItem, NotificationsResponse


class NotificationService:
    """Use cases over the authenticated user's limit alerts."""

    def __init__(self, uow: UnitOfWork, user: UserORM) -> None:
        """Binds the service to the request's unit of work and authenticated user."""
        self.uow = uow
        self.user = user
        self.repo = LimitAlertRepository(uow.session)

    async def list_notifications(self) -> NotificationsResponse:
        """Unread count (badge) plus every alert with severity and message computed here."""
        alerts = await self.repo.list_by_user(self.user.id)
        unread = await self.repo.unread_count(self.user.id)
        return NotificationsResponse(
            unread_count=unread,
            items=[NotificationItem.from_alert(alert) for alert in alerts],
        )

    async def mark_read(self, alert_id: int) -> MarkReadResponse:
        """Marks one of the user's alerts as read; an unknown id is ``success=False``, not an error."""
        alert = await self.repo.mark_read(alert_id, self.user.id)
        if alert is None:
            return MarkReadResponse(success=False, updated=0)
        return MarkReadResponse(success=True, updated=1)

    async def mark_all_read(self) -> MarkReadResponse:
        """Marks every unread alert of the user as read."""
        updated = await self.repo.mark_all_read(self.user.id)
        return MarkReadResponse(success=True, updated=updated)
