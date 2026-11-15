"""Single backend rule for a recurring account's installment state."""

import pytest

from app.services.recurring_installments import (
    CAN_RENEW_MAX_REMAINING,
    ENDING_SOON_FROM_INSTALLMENT,
    installment_state,
)


def test_constants_match_the_rules_promised_to_users():
    assert ENDING_SOON_FROM_INSTALLMENT == 10
    assert CAN_RENEW_MAX_REMAINING == 2


@pytest.mark.parametrize(
    ("remaining", "current"),
    [(12, 1), (8, 5), (3, 10), (1, 12), (0, 12), (20, 1)],
)
def test_current_installment_is_clamped_to_the_total(remaining, current):
    assert installment_state(12, remaining, active=True).current_installment == current


@pytest.mark.parametrize(
    ("remaining", "active", "ending_soon"),
    [
        (4, True, False),  # 9th installment
        (3, True, True),  # 10th installment
        (1, True, True),
        (0, True, False),  # nothing left
        (3, False, False),  # inactive never ends soon
    ],
)
def test_ending_soon_needs_active_10th_installment_and_something_left(
    remaining, active, ending_soon
):
    assert installment_state(12, remaining, active=active).is_ending_soon is ending_soon


@pytest.mark.parametrize(
    ("remaining", "active", "can_renew"),
    [
        (3, True, False),
        (2, True, True),
        (0, True, True),
        (11, False, True),  # inactive can always be reactivated
    ],
)
def test_can_renew_when_inactive_or_nearly_finished(remaining, active, can_renew):
    assert installment_state(12, remaining, active=active).can_renew is can_renew
