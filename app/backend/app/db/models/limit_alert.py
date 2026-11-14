from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class LimitAlertORM(Base):
    __tablename__ = "limit_alerts"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "category_id",
            "month",
            "threshold",
            name="uq_limit_alerts_user_cat_month_threshold",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id = Column(
        Integer,
        ForeignKey("categorias.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # 'category' (limite de categoria) | 'credit_card' (cartão de crédito)
    scope = Column(String(32), nullable=False, default="category")
    # Mês no formato YYYY-MM
    month = Column(String(7), nullable=False)
    # Threshold cruzado: 70, 80, 90 ou 100
    threshold = Column(Integer, nullable=False)
    # True quando percent_used > 100 (limite estourou)
    exceeded = Column(Boolean, default=False, nullable=False)
    # Snapshot do percentual usado no momento do disparo
    percent_used = Column(Float, nullable=False, default=0.0)
    read_at = Column(DateTime, nullable=True)
    email_sent = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    category = relationship("CategoryORM", lazy="joined")

    @property
    def category_name(self) -> str:
        return self.category.name if self.category else ""
