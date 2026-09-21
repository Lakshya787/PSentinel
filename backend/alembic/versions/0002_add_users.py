"""0002_add_users — users table for phone+password MVP auth.

Adds:
  users (id UUID PK, name, phone UNIQUE, password_hash, role, created_at)

Roles: FARMER | VET | DVO
No OTP / email verification — MVP only.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id",            PG_UUID(as_uuid=False), primary_key=True),
        sa.Column("name",          sa.String(120), nullable=False),
        sa.Column("phone",         sa.String(20),  nullable=False),
        sa.Column("password_hash", sa.String(128), nullable=False),
        sa.Column("role",          sa.String(20),  nullable=False, server_default="FARMER"),
        sa.Column("created_at",    sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("phone", name="uq_users_phone"),
    )
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_table("users")
