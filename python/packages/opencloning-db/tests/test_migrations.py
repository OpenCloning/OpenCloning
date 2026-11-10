"""Tests for opencloning_db.migrations helpers."""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from opencloning_db.init_db import load_seed_data
from opencloning_db.models import Base, User
from opencloning_db.migrations import (
    _alembic_root,
    downgrade_to,
    migrate_to,
    truncate_application_tables,
)


def test_alembic_root_finds_ini_and_versions():
    root = _alembic_root()
    assert (root / 'alembic.ini').is_file()
    assert (root / 'alembic' / 'versions').is_dir()


def test_truncate_application_tables_preserves_alembic_version(postgres_test_engine_write):
    """TRUNCATE must not target alembic_version (not in ORM metadata)."""
    assert 'alembic_version' not in Base.metadata.tables

    load_seed_data(postgres_test_engine_write)

    with postgres_test_engine_write.connect() as conn:
        version_before = conn.execute(text('SELECT version_num FROM alembic_version')).scalar_one()

    with Session(postgres_test_engine_write) as session:
        assert session.query(User).count() > 0

    truncate_application_tables(postgres_test_engine_write)

    with postgres_test_engine_write.connect() as conn:
        version_after = conn.execute(text('SELECT version_num FROM alembic_version')).scalar_one()
    assert version_after == version_before

    with Session(postgres_test_engine_write) as session:
        assert session.query(User).count() == 0


class TestMigration_8deebdee4ca0:

    _EXPECTED_UIDS_AFTER_MIGRATION = {
        'line': {'strain-a', 'STRAIN-A-dedupe1', 'unique-line'},
        'primer': {'ml7', 'ML7-dedupe1', 'unique-primer'},
        'sequence_sample': {'sample-1', 'SAMPLE-1-dedupe1', 'unique-sample'},
    }

    def _seed_workspace_case_insensitive_uid_collisions(
        self,
        conn,
        *,
        workspace_id: int,
        user_id: int,
    ) -> None:
        """Seed one workspace with case-only UID duplicates (valid under pre-migration constraints)."""
        id_base = workspace_id * 100

        conn.execute(
            text(
                """
                INSERT INTO line (workspace_id, uid, created_by_id)
                VALUES (:workspace_id, 'strain-a', :user_id),
                    (:workspace_id, 'STRAIN-A', :user_id),
                    (:workspace_id, 'unique-line', :user_id)
                """
            ),
            {'workspace_id': workspace_id, 'user_id': user_id},
        )

        conn.execute(
            text(
                """
                INSERT INTO input_entity (id, workspace_id, type, name, created_by_id)
                VALUES (:id1, :workspace_id, 'primer', 'primer-1', :user_id),
                    (:id2, :workspace_id, 'primer', 'primer-2', :user_id),
                    (:id3, :workspace_id, 'primer', 'primer-unique', :user_id)
                """
            ),
            {
                'id1': id_base + 1,
                'id2': id_base + 2,
                'id3': id_base + 3,
                'workspace_id': workspace_id,
                'user_id': user_id,
            },
        )
        conn.execute(
            text(
                """
                INSERT INTO primer (id, workspace_id, uid, sequence)
                VALUES (:id1, :workspace_id, 'ml7', 'ACGT'),
                    (:id2, :workspace_id, 'ML7', 'ACGT'),
                    (:id3, :workspace_id, 'unique-primer', 'ACGT')
                """
            ),
            {'id1': id_base + 1, 'id2': id_base + 2, 'id3': id_base + 3, 'workspace_id': workspace_id},
        )

        seq_id = id_base + 10
        conn.execute(
            text(
                """
                INSERT INTO input_entity (id, workspace_id, type, name, created_by_id)
                VALUES (:seq_id, :workspace_id, 'sequence', 'plasmid-seq', :user_id)
                """
            ),
            {'seq_id': seq_id, 'workspace_id': workspace_id, 'user_id': user_id},
        )
        conn.execute(
            text('INSERT INTO base_sequence (id, sequence_type) VALUES (:seq_id, \'plasmid\')'),
            {'seq_id': seq_id},
        )
        conn.execute(
            text(
                """
                INSERT INTO sequence (id, overhang_crick_3prime, overhang_watson_3prime, seguid, file_content)
                VALUES (:seq_id, 0, 0, :seguid, '')
                """
            ),
            {'seq_id': seq_id, 'seguid': f'MIGTESTSEG{workspace_id}'},
        )
        instance_ids = [
            conn.execute(
                text(
                    """
                    INSERT INTO sequence_instance (sequence_id, type)
                    VALUES (:seq_id, 'sequence_sample')
                    RETURNING id
                    """
                ),
                {'seq_id': seq_id},
            ).scalar_one()
            for _ in range(3)
        ]
        conn.execute(
            text(
                """
                INSERT INTO sequence_sample (id, workspace_id, uid)
                VALUES (:id1, :workspace_id, 'sample-1'),
                    (:id2, :workspace_id, 'SAMPLE-1'),
                    (:id3, :workspace_id, 'unique-sample')
                """
            ),
            {
                'id1': instance_ids[0],
                'id2': instance_ids[1],
                'id3': instance_ids[2],
                'workspace_id': workspace_id,
            },
        )

    def _seed_case_insensitive_uid_collisions(self, conn) -> None:
        """Insert minimal rows with case-only UID duplicates in workspaces 1 and 2."""
        user_id = conn.execute(
            text(
                """
                INSERT INTO "user" (email, display_name, password_hash, is_instance_admin)
                VALUES ('migration@test.com', 'Migr', NULL, false)
                RETURNING id
                """
            )
        ).scalar_one()
        for workspace_id in (1, 2):
            conn.execute(
                text('INSERT INTO workspace (id, name) VALUES (:workspace_id, :name)'),
                {'workspace_id': workspace_id, 'name': f'migration-ws-{workspace_id}'},
            )
            self._seed_workspace_case_insensitive_uid_collisions(conn, workspace_id=workspace_id, user_id=user_id)

    def test_make_uids_unique_migration_renames_case_insensitive_duplicates(self, postgres_test_engine_write):
        """Migration renames CI UID collisions per workspace; unique UIDs are left unchanged."""
        engine = postgres_test_engine_write
        downgrade_to(engine, '995b57893b33')

        with engine.begin() as conn:
            self._seed_case_insensitive_uid_collisions(conn)

        migrate_to(engine, '8deebdee4ca0')

        with engine.connect() as conn:
            for workspace_id in (1, 2):
                line_uids = {
                    row[0]
                    for row in conn.execute(
                        text('SELECT uid FROM line WHERE workspace_id = :workspace_id'),
                        {'workspace_id': workspace_id},
                    ).fetchall()
                }
                primer_uids = {
                    row[0]
                    for row in conn.execute(
                        text('SELECT uid FROM primer WHERE workspace_id = :workspace_id'),
                        {'workspace_id': workspace_id},
                    ).fetchall()
                }
                sample_uids = {
                    row[0]
                    for row in conn.execute(
                        text('SELECT uid FROM sequence_sample WHERE workspace_id = :workspace_id'),
                        {'workspace_id': workspace_id},
                    ).fetchall()
                }
                assert line_uids == self._EXPECTED_UIDS_AFTER_MIGRATION['line']
                assert primer_uids == self._EXPECTED_UIDS_AFTER_MIGRATION['primer']
                assert sample_uids == self._EXPECTED_UIDS_AFTER_MIGRATION['sequence_sample']

            indexes = {
                row[0]
                for row in conn.execute(
                    text(
                        """
                        SELECT indexname FROM pg_indexes
                        WHERE indexname IN (
                            'uq_line_workspace_uid_ci',
                            'uq_primer_workspace_uid_ci',
                            'uq_sequence_sample_workspace_uid_ci'
                        )
                        """
                    )
                ).fetchall()
            }

        assert indexes == {
            'uq_line_workspace_uid_ci',
            'uq_primer_workspace_uid_ci',
            'uq_sequence_sample_workspace_uid_ci',
        }

        with engine.begin() as conn:
            with pytest.raises(IntegrityError):
                conn.execute(
                    text(
                        """
                        INSERT INTO line (workspace_id, uid, created_by_id)
                        VALUES (1, 'Strain-A', 1)
                        """
                    )
                )
