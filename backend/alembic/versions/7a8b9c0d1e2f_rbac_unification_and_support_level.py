"""rbac_unification_and_support_level

Revision ID: 7a8b9c0d1e2f
Revises: 5eb32febd008
Create Date: 2026-09-27 18:15:00.000000

"""
from typing import Sequence, Union
import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision: str = '7a8b9c0d1e2f'
down_revision: Union[str, None] = '5eb32febd008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Ensure support_level and skill_group columns exist on users table
    conn = op.get_bind()
    
    # Check if support_level column exists
    res = conn.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='users' AND column_name='support_level';"
    )).fetchall()
    if not res:
        op.add_column('users', sa.Column('support_level', sa.String(length=10), nullable=True))

    # Check if skill_group column exists
    res_skill = conn.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='users' AND column_name='skill_group';"
    )).fetchall()
    if not res_skill:
        op.add_column('users', sa.Column('skill_group', sa.String(length=50), nullable=True))

    # 2. Safely map any old role names in 'roles' table
    conn.execute(text("UPDATE roles SET role_name = 'SUPPORT_AGENT' WHERE role_name = 'AGENT';"))
    conn.execute(text("UPDATE roles SET role_name = 'REQUESTER' WHERE role_name = 'CUSTOMER';"))

    # 3. Ensure the 4 standard roles exist
    standard_roles = [
        ("ADMIN", "Quản trị viên toàn hệ thống"),
        ("TEAM_LEAD", "Trưởng nhóm hỗ trợ kỹ thuật"),
        ("SUPPORT_AGENT", "Kỹ thuật viên hỗ trợ kỹ thuật L1/L2"),
        ("REQUESTER", "Người yêu cầu hỗ trợ / Khách hàng"),
    ]
    for r_name, r_desc in standard_roles:
        existing = conn.execute(text(f"SELECT id FROM roles WHERE role_name = '{r_name}';")).fetchall()
        if not existing:
            conn.execute(text(
                f"INSERT INTO roles (id, role_name, description, created_at, updated_at) "
                f"VALUES (:id, :role_name, :description, NOW(), NOW());"
            ), {"id": str(uuid.uuid4()), "role_name": r_name, "description": r_desc})


def downgrade() -> None:
    pass
