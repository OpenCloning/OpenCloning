"""Map verified OIDC identities to local ``User`` rows.

Flow
----
1. Return an existing user linked to ``(auth_provider, external_subject)``.
2. Else link a legacy password-era user with the same email (one-time migration).
3. Else create a user and default workspace (just-in-time provisioning).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from opencloning_db.utils import normalize_email
from opencloning_db.auth.oidc import OidcIdentity
from opencloning_db.config import Config
from opencloning_db.models import User, Workspace, WorkspaceMembership, WorkspaceRole


def resolve_oidc_user(session: Session, config: Config, identity: OidcIdentity) -> User:
    """Return the local user for an externally authenticated identity."""
    user = _find_linked_user(session, identity)
    if user is not None:
        return user

    if identity.email:
        legacy = _link_legacy_user(session, identity)
        if legacy is not None:
            return legacy

    return _provision_new_user(session, identity)


def _find_linked_user(session: Session, identity: OidcIdentity) -> User | None:
    return session.scalar(
        select(User).where(
            User.auth_provider == identity.provider,
            User.external_subject == identity.subject,
        )
    )


def _link_legacy_user(session: Session, identity: OidcIdentity) -> User | None:
    if not identity.email:
        raise ValueError('Legacy user email is required')

    legacy = session.scalar(
        select(User)
        .where(
            User.email == normalize_email(identity.email),
            User.auth_provider.is_(None),
            User.external_subject.is_(None),
        )
        .with_for_update()
    )
    if legacy is None:
        return None
    legacy.auth_provider = identity.provider
    legacy.external_subject = identity.subject
    session.commit()
    session.refresh(legacy)
    return legacy


def _provision_new_user(session: Session, identity: OidcIdentity) -> User:
    user = _create_user_with_default_workspace(
        session,
        email=identity.email,
        display_name=identity.display_name,
        auth_provider=identity.provider,
        external_subject=identity.subject,
    )
    session.commit()
    session.refresh(user)
    return user


def _create_user_with_default_workspace(
    session: Session,
    *,
    email: str | None,
    display_name: str,
    auth_provider: str,
    external_subject: str,
) -> User:
    user = User(
        email=normalize_email(email) if email else None,
        display_name=display_name,
        auth_provider=auth_provider,
        external_subject=external_subject,
    )
    workspace = Workspace(name=f"{display_name}'s workspace")
    session.add(user)
    session.add(workspace)
    session.flush()
    session.add(
        WorkspaceMembership(
            user_id=user.id,
            workspace_id=workspace.id,
            role=WorkspaceRole.owner,
        )
    )
    return user
