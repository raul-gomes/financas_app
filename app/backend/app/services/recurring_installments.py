"""The one rule for a recurring account's installment state (backend-owned).

The browser never recomputes this: it reads ``current_installment``, ``is_ending_soon``
and ``can_renew`` from the API.
"""

from dataclasses import dataclass

DEFAULT_TOTAL_INSTALLMENTS = 12
"""Installments an account has when the total is missing."""

ENDING_SOON_FROM_INSTALLMENT = 10
"""An active account is 'ending soon' from this installment on ("10th of 12")."""

CAN_RENEW_MAX_REMAINING = 2
"""An active account can only be renewed with at most this many installments left."""


@dataclass(frozen=True)
class InstallmentState:
    """Installment state derived from the total, the remaining count and the active flag."""

    current_installment: int
    is_ending_soon: bool
    can_renew: bool


def installment_state(
    total: int | None, remaining: int | None, *, active: bool
) -> InstallmentState:
    """Computes which installment an account is at and what the UI may offer.

    Args:
        total: Installments in the plan (defaults to 12 when missing).
        remaining: Installments still ahead, from the current month on (missing counts as 0).
        active: Whether the account is active.

    Returns:
        The current installment (clamped to ``1..total``), whether the account is ending soon
        (active, at or past ``ENDING_SOON_FROM_INSTALLMENT`` and with installments left) and
        whether it can be renewed (inactive, or at most ``CAN_RENEW_MAX_REMAINING`` left).
    """
    total = total or DEFAULT_TOTAL_INSTALLMENTS
    remaining = remaining or 0
    current = min(total, max(1, total - remaining + 1))
    return InstallmentState(
        current_installment=current,
        is_ending_soon=active and remaining > 0 and current >= ENDING_SOON_FROM_INSTALLMENT,
        can_renew=(not active) or remaining <= CAN_RENEW_MAX_REMAINING,
    )
