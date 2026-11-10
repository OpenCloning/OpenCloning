"""make UIDs unique

Revision ID: 8deebdee4ca0
Revises: 995b57893b33
Create Date: 2026-06-05 08:37:44.311580

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = '8deebdee4ca0'
down_revision: Union[str, Sequence[str], None] = '995b57893b33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _rename_case_insensitive_uid_duplicates(
    conn,
    *,
    table: str,
    id_col: str = 'id',
    workspace_col: str = 'workspace_id',
    uid_col: str = 'uid',
) -> None:
    """Rename case-insensitive UID collisions, keeping the lowest-id row unchanged."""
    duplicate_groups = conn.execute(
        text(
            f"""
            SELECT {workspace_col}, lower({uid_col}) AS uid_lower
            FROM {table}
            WHERE {uid_col} IS NOT NULL
            GROUP BY {workspace_col}, lower({uid_col})
            HAVING COUNT(*) > 1
            """
        )
    ).fetchall()

    for workspace_id, uid_lower in duplicate_groups:
        # Get all UIDs in the workspace, lowercased
        used = {
            row[0]
            for row in conn.execute(
                text(
                    f"""
                    SELECT lower({uid_col})
                    FROM {table}
                    WHERE {workspace_col} = :workspace_id AND {uid_col} IS NOT NULL
                    """
                ),
                {'workspace_id': workspace_id},
            ).fetchall()
        }

        # Gets all rows in this collision group, oldest first
        # For instance, [(1, 'strain-a'), (2, 'STRAIN-A')]
        rows = conn.execute(
            text(
                f"""
                SELECT {id_col}, {uid_col}
                FROM {table}
                WHERE {workspace_col} = :workspace_id AND lower({uid_col}) = :uid_lower
                ORDER BY {id_col} ASC
                """
            ),
            {'workspace_id': workspace_id, 'uid_lower': uid_lower},
        ).fetchall()

        # Rename all but the oldest row in this collision group
        for row_id, current_uid in rows[1:]:
            n = 1
            while True:
                candidate = f'{current_uid}-dedupe{n}'
                if candidate.lower() not in used:
                    break
                n += 1
            # No need to indicate workspace, because we use the id as index
            conn.execute(
                text(f'UPDATE {table} SET {uid_col} = :new_uid WHERE {id_col} = :row_id'),
                {'new_uid': candidate, 'row_id': row_id},
            )
            used.add(candidate.lower())


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    for table in ('line', 'primer', 'sequence_sample'):
        _rename_case_insensitive_uid_duplicates(conn, table=table)

    op.drop_constraint(op.f('uq_line_workspace_uid'), 'line', type_='unique')
    op.create_index('uq_line_workspace_uid_ci', 'line', ['workspace_id', sa.literal_column('lower(uid)')], unique=True)
    op.drop_constraint(op.f('uq_primer_workspace_uid'), 'primer', type_='unique')
    op.create_index(
        'uq_primer_workspace_uid_ci', 'primer', ['workspace_id', sa.literal_column('lower(uid)')], unique=True
    )
    op.drop_constraint(op.f('uq_sequence_sample_workspace_uid'), 'sequence_sample', type_='unique')
    op.create_index(
        'uq_sequence_sample_workspace_uid_ci',
        'sequence_sample',
        ['workspace_id', sa.literal_column('lower(uid)')],
        unique=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('uq_sequence_sample_workspace_uid_ci', table_name='sequence_sample')
    op.create_unique_constraint(
        op.f('uq_sequence_sample_workspace_uid'),
        'sequence_sample',
        ['workspace_id', 'uid'],
        postgresql_nulls_not_distinct=False,
    )
    op.drop_index('uq_primer_workspace_uid_ci', table_name='primer')
    op.create_unique_constraint(
        op.f('uq_primer_workspace_uid'), 'primer', ['workspace_id', 'uid'], postgresql_nulls_not_distinct=False
    )
    op.drop_index('uq_line_workspace_uid_ci', table_name='line')
    op.create_unique_constraint(
        op.f('uq_line_workspace_uid'), 'line', ['workspace_id', 'uid'], postgresql_nulls_not_distinct=False
    )
