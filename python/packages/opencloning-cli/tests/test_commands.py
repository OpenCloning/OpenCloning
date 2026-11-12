"""Smoke tests for the Typer command surface."""

from __future__ import annotations

from opencloning_cli.stubs import RecordedStub
import os
import pytest
from sqlalchemy.orm import Session
from typer.testing import CliRunner

import opencloning_db.db as db_module
from opencloning_db.models import SequencingFile, User, Sequence
from opencloning_cli.main import app
from opencloning_db.migrations import reset_database

runner = CliRunner()


def _invoke(*args: str):
    # mix_stderr=False would be nicer on Click>=8.2 but Typer's CliRunner
    # surfaces both streams through result.output, which is enough for us.
    return runner.invoke(app, list(args))


def _count_users(config) -> int:
    with Session(db_module.get_engine(config)) as session:
        return session.query(User).count()


@pytest.fixture
def db_fixture(temp_workspace):
    _, config = temp_workspace
    engine = db_module.get_engine(config)
    reset_database(engine)
    return temp_workspace


class TestHelpAndTree:
    def test_root_help(self):
        result = _invoke('--help')
        assert result.exit_code == 0
        assert 'db' in result.output
        assert 'admin' in result.output

    def test_top_level_db_help(self):
        result = _invoke('db', '--help')
        assert result.exit_code == 0
        assert 'migrate' in result.output
        assert 'seed' in result.output
        assert 'stubs' in result.output

    def test_top_level_admin_help(self):
        result = _invoke('admin', '--help')
        assert result.exit_code == 0
        assert 'list-users' in result.output
        assert 'list-workspaces' in result.output
        assert 'assign-user' in result.output
        assert 'set-instance-admin' in result.output


class TestMigrateCommand:

    def test_success_human_output(self, db_fixture):
        _, config = db_fixture

        result = _invoke('db', 'migrate')

        assert result.exit_code == 0, result.output
        assert result.output.strip() == ''
        assert _count_users(config) == 0
        with Session(db_module.get_engine(config)) as session:
            assert session.query(SequencingFile).count() == 0
            assert session.query(Sequence).count() == 0


class TestSeedCommand:
    def test_requires_testing_mode(self, temp_workspace, monkeypatch):
        monkeypatch.delenv('OPENCLONING_TESTING', raising=False)
        result = _invoke('db', 'seed')

        assert result.exit_code == 1
        assert 'OPENCLONING_TESTING=1' in result.output

    def test_success_human_output(self, db_fixture, monkeypatch):
        _, config = db_fixture
        monkeypatch.setenv('OPENCLONING_TESTING', '1')

        result = _invoke('db', 'seed')

        assert result.exit_code == 0, result.output
        assert result.output.strip() == ''
        assert _count_users(config) > 0
        with Session(db_module.get_engine(config)) as session:
            assert session.query(SequencingFile).count() == 15
            assert session.query(Sequence).count() == 62


class TestStubCommand:

    def test_write_stubs(self, db_fixture, monkeypatch):
        workspace, _ = db_fixture
        monkeypatch.setenv('OPENCLONING_TESTING', '1')
        monkeypatch.chdir(workspace)
        result = _invoke('db', 'stubs')

        assert result.exit_code == 0, result.output
        out_dir = workspace / 'stubs' / 'db'
        files = sorted(out_dir.glob('*.json'))
        stub_files_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'opencloning_cli', 'stubs.py')
        with open(stub_files_path, 'r') as f:
            stub_files = f.read()
            yield_count = stub_files.count('yield')
        assert len(files) == yield_count

        for file in files:
            with open(file, 'r') as f:
                RecordedStub.model_validate_json(f.read())
