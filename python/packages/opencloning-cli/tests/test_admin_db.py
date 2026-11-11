"""Unit tests for direct-database admin helpers."""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

import opencloning_db.db as db_module
from opencloning_db.models import User, Workspace, WorkspaceMembership, WorkspaceRole
from opencloning_cli import admin_db

from opencloning_db.migrations import reset_database


@pytest.fixture
def admin_db_session(temp_workspace):
    _, config = temp_workspace
    engine = db_module.get_engine(config)
    reset_database(engine)
    with Session(engine) as session:
        user = User(
            email='alice@example.com',
            display_name='Alice',
            auth_provider='test',
            external_subject='alice',
        )
        workspace = Workspace(name='Lab')
        session.add_all([user, workspace])
        session.flush()
        session.add(
            WorkspaceMembership(
                user_id=user.id,
                workspace_id=workspace.id,
                role=WorkspaceRole.owner,
            )
        )
        session.commit()
        yield session, user, workspace


def test_list_user_emails(admin_db_session):
    emails = admin_db.list_user_emails()
    assert emails == ['alice@example.com']


def test_list_workspaces(admin_db_session):
    _, _, workspace = admin_db_session
    workspaces = admin_db.list_workspaces()
    assert workspaces == [{'id': workspace.id, 'name': 'Lab'}]


def test_assign_user_creates_membership(admin_db_session):
    session, _, workspace = admin_db_session
    other = User(
        email='bob@example.com',
        display_name='Bobby',
        auth_provider='test',
        external_subject='bob',
    )
    session.add(other)
    session.commit()

    result = admin_db.assign_user_to_workspace('bob@example.com', workspace.id, 'editor')
    assert result == {
        'user_id': other.id,
        'workspace_id': workspace.id,
        'role': 'editor',
    }

    membership = session.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.user_id == other.id,
            WorkspaceMembership.workspace_id == workspace.id,
        )
    )
    assert membership is not None
    assert membership.role == WorkspaceRole.editor


def test_assign_user_not_found(admin_db_session):
    _, _, workspace = admin_db_session
    with pytest.raises(RuntimeError, match='User not found'):
        admin_db.assign_user_to_workspace('missing@example.com', workspace.id, 'viewer')


def test_assign_user_workspace_not_found(admin_db_session):
    with pytest.raises(RuntimeError, match='Workspace not found'):
        admin_db.assign_user_to_workspace('alice@example.com', 999999, 'viewer')


def test_assign_user_invalid_role(admin_db_session):
    _, _, workspace = admin_db_session
    with pytest.raises(RuntimeError, match='Invalid role'):
        admin_db.assign_user_to_workspace('alice@example.com', workspace.id, 'superuser')


def test_set_user_instance_admin_grant(admin_db_session):
    session, user, _ = admin_db_session
    assert user.is_instance_admin is False

    result = admin_db.set_user_instance_admin('alice@example.com', is_instance_admin=True)
    assert result == {
        'user_id': user.id,
        'email': 'alice@example.com',
        'is_instance_admin': True,
    }

    session.expire(user)
    assert user.is_instance_admin is True


def test_set_user_instance_admin_revoke(admin_db_session):
    session, user, _ = admin_db_session
    user.is_instance_admin = True
    session.commit()

    result = admin_db.set_user_instance_admin('alice@example.com', is_instance_admin=False)
    assert result == {
        'user_id': user.id,
        'email': 'alice@example.com',
        'is_instance_admin': False,
    }

    session.expire(user)
    assert user.is_instance_admin is False


def test_set_user_instance_admin_not_found(admin_db_session):
    with pytest.raises(RuntimeError, match='User not found'):
        admin_db.set_user_instance_admin('missing@example.com', is_instance_admin=True)


def test_user_lookup_does_not_match_substrings(admin_db_session):
    # Safeguard for the future, in case by accident we setup
    # ilike, or similar in a query.
    session, alice, workspace = admin_db_session
    session.delete(alice)
    attacker = User(
        email='alice@example.com.attacker.com',
        display_name='Attacker',
        auth_provider='test',
        external_subject='attacker',
    )
    session.add(attacker)
    session.commit()

    with pytest.raises(RuntimeError, match='User not found'):
        admin_db.set_user_instance_admin('alice@example.com', is_instance_admin=True)
    with pytest.raises(RuntimeError, match='User not found'):
        admin_db.assign_user_to_workspace('alice@example.com', workspace.id, 'owner')

    session.expire(attacker)
    assert attacker.is_instance_admin is False


def test_user_lookup_is_case_insensitive(admin_db_session):
    session, user, _ = admin_db_session
    result = admin_db.set_user_instance_admin('  Alice@Example.COM ', is_instance_admin=True)
    assert result['user_id'] == user.id
