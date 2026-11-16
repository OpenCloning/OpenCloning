"""Sequencing files belong to sequence instances (samples), samples get a location, creator and creation date,
and instances keep a history of the sequences they pointed to

Revision ID: 3c5e8f1a9b27
Revises: eae106d3b1d2
Create Date: 2026-11-15 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = '3c5e8f1a9b27'
down_revision: Union[str, Sequence[str], None] = 'eae106d3b1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PLACEHOLDER_UID_PREFIX = 'unassigned-'


def _free_uid(candidate: str, used: set[str]) -> str:
    """Return *candidate*, or *candidate* with the first numeric suffix that is not in *used* (lowercase)."""
    uid = candidate
    n = 1
    while uid.lower() in used:
        uid = f'{candidate}-{n}'
        n += 1
    used.add(uid.lower())
    return uid


def _sample_for_file(file_name: str, samples: list[tuple[int, str]]) -> int | None:
    """Id of the sample whose uid is the longest one contained in *file_name* (case-insensitive),
    None if no uid is contained or several uids of the same length are."""
    name = file_name.lower()
    matches = [(len(uid), sample_id) for sample_id, uid in samples if uid.lower() in name]
    if not matches:
        return None
    longest = max(length for length, _ in matches)
    best = [sample_id for length, sample_id in matches if length == longest]
    return best[0] if len(best) == 1 else None


def _assign_files_to_samples(conn) -> None:
    """Move the sequencing files of each sequence to one of its samples, creating a placeholder sample when
    the sample a file belongs to cannot be told."""
    files_by_sequence: dict[int, list[tuple[int, str]]] = {}
    for file_id, sequence_id, name in conn.execute(
        text('SELECT id, sequence_id, original_name FROM sequencing_file ORDER BY id')
    ):
        files_by_sequence.setdefault(sequence_id, []).append((file_id, name))

    used_uids: dict[int, set[str]] = {}
    for workspace_id, uid in conn.execute(text('SELECT workspace_id, uid FROM sequence_sample')):
        used_uids.setdefault(workspace_id, set()).add(uid.lower())

    for sequence_id, files in files_by_sequence.items():
        samples = conn.execute(
            text("""
                SELECT ss.id, ss.uid
                FROM sequence_sample ss JOIN sequence_instance si ON si.id = ss.id
                WHERE si.sequence_id = :sequence_id
                ORDER BY ss.id
                """),
            {'sequence_id': sequence_id},
        ).fetchall()

        if len(samples) == 1:
            placement = {file_id: samples[0][0] for file_id, _ in files}
        else:
            placement = {file_id: _sample_for_file(name, samples) for file_id, name in files}

        if any(sample_id is None for sample_id in placement.values()):
            workspace_id, created_by_id = conn.execute(
                text('SELECT workspace_id, created_by_id FROM input_entity WHERE id = :id'),
                {'id': sequence_id},
            ).one()
            uid = _free_uid(f'{PLACEHOLDER_UID_PREFIX}{sequence_id}', used_uids.setdefault(workspace_id, set()))
            placeholder_id = conn.execute(
                text("""
                    INSERT INTO sequence_instance (sequence_id, type)
                    VALUES (:sequence_id, 'sequence_sample')
                    RETURNING id
                    """),
                {'sequence_id': sequence_id},
            ).scalar_one()
            conn.execute(
                text("""
                    INSERT INTO sequence_sample (id, workspace_id, uid, created_by_id)
                    VALUES (:id, :workspace_id, :uid, :created_by_id)
                    """),
                {'id': placeholder_id, 'workspace_id': workspace_id, 'uid': uid, 'created_by_id': created_by_id},
            )
            placement = {
                file_id: placeholder_id if sample_id is None else sample_id for file_id, sample_id in placement.items()
            }

        for file_id, sample_id in placement.items():
            conn.execute(
                text('UPDATE sequencing_file SET sequence_instance_id = :sample_id WHERE id = :file_id'),
                {'sample_id': sample_id, 'file_id': file_id},
            )


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()

    # Samples: location, creator and creation date (backfilled from their sequence)
    op.add_column('sequence_sample', sa.Column('location', sa.Text(), nullable=True))
    op.add_column(
        'sequence_sample',
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.add_column('sequence_sample', sa.Column('created_by_id', sa.Integer(), nullable=True))
    conn.execute(text("""
            UPDATE sequence_sample ss
            SET created_by_id = ie.created_by_id, created_at = ie.created_at
            FROM sequence_instance si JOIN input_entity ie ON ie.id = si.sequence_id
            WHERE si.id = ss.id
            """))
    op.alter_column('sequence_sample', 'created_by_id', nullable=False)
    op.create_foreign_key('sequence_sample_created_by_id_fkey', 'sequence_sample', 'user', ['created_by_id'], ['id'])

    op.create_table(
        'sequence_instance_reassignment',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('sequence_instance_id', sa.Integer(), nullable=False),
        sa.Column('from_sequence_id', sa.Integer(), nullable=False),
        sa.Column('to_sequence_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['sequence_instance_id'], ['sequence_instance.id']),
        sa.ForeignKeyConstraint(['from_sequence_id'], ['base_sequence.id']),
        sa.ForeignKeyConstraint(['to_sequence_id'], ['base_sequence.id']),
        sa.ForeignKeyConstraint(['created_by_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    # Sequencing files: from sequences to sequence instances
    op.add_column('sequencing_file', sa.Column('sequence_instance_id', sa.Integer(), nullable=True))
    _assign_files_to_samples(conn)
    op.alter_column('sequencing_file', 'sequence_instance_id', nullable=False)
    op.create_foreign_key(
        'sequencing_file_sequence_instance_id_fkey',
        'sequencing_file',
        'sequence_instance',
        ['sequence_instance_id'],
        ['id'],
    )
    op.drop_constraint('uq_sequencefile_sequenceid_originalname', 'sequencing_file', type_='unique')
    op.drop_column('sequencing_file', 'sequence_id')
    op.create_unique_constraint(
        'uq_sequencingfile_instanceid_originalname', 'sequencing_file', ['sequence_instance_id', 'original_name']
    )


def downgrade() -> None:
    """Downgrade schema. Placeholder samples created by the upgrade are kept, and files that would have
    the same name in the same sequence are renamed (prefixed with their sample uid or instance id)."""
    conn = op.get_bind()

    op.add_column('sequencing_file', sa.Column('sequence_id', sa.Integer(), nullable=True))
    conn.execute(text("""
            UPDATE sequencing_file sf
            SET sequence_id = si.sequence_id
            FROM sequence_instance si
            WHERE si.id = sf.sequence_instance_id
            """))
    on_templates = conn.execute(text("""
            SELECT count(*) FROM sequencing_file
            WHERE sequence_id NOT IN (SELECT id FROM sequence)
            """)).scalar_one()
    if on_templates:
        raise RuntimeError(
            f'{on_templates} sequencing files belong to instances of template sequences, '
            'which cannot have sequencing files before this revision. Delete or move them first.'
        )

    duplicates = conn.execute(text("""
            SELECT sf.id, sf.sequence_id, sf.original_name, COALESCE(ss.uid, sf.sequence_instance_id::text)
            FROM sequencing_file sf LEFT JOIN sequence_sample ss ON ss.id = sf.sequence_instance_id
            WHERE (sf.sequence_id, sf.original_name) IN (
                SELECT sequence_id, original_name FROM sequencing_file
                GROUP BY sequence_id, original_name HAVING count(*) > 1
            )
            ORDER BY sf.id
            """)).fetchall()
    used = {tuple(row) for row in conn.execute(text('SELECT sequence_id, original_name FROM sequencing_file'))}
    kept = set()
    for file_id, sequence_id, name, prefix in duplicates:
        if (sequence_id, name) not in kept:
            kept.add((sequence_id, name))
            continue
        new_name = f'{prefix}_{name}'
        n = 1
        while (sequence_id, new_name) in used:
            new_name = f'{prefix}_{n}_{name}'
            n += 1
        used.add((sequence_id, new_name))
        conn.execute(
            text('UPDATE sequencing_file SET original_name = :name WHERE id = :id'),
            {'name': new_name, 'id': file_id},
        )

    op.alter_column('sequencing_file', 'sequence_id', nullable=False)
    op.drop_constraint('uq_sequencingfile_instanceid_originalname', 'sequencing_file', type_='unique')
    op.drop_column('sequencing_file', 'sequence_instance_id')
    op.create_foreign_key('sequencing_file_sequence_id_fkey', 'sequencing_file', 'sequence', ['sequence_id'], ['id'])
    op.create_unique_constraint(
        'uq_sequencefile_sequenceid_originalname', 'sequencing_file', ['sequence_id', 'original_name']
    )

    op.drop_table('sequence_instance_reassignment')

    op.drop_constraint('sequence_sample_created_by_id_fkey', 'sequence_sample', type_='foreignkey')
    op.drop_column('sequence_sample', 'created_by_id')
    op.drop_column('sequence_sample', 'created_at')
    op.drop_column('sequence_sample', 'location')
