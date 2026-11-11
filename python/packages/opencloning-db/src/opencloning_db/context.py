"""Lightweight value objects shared between the auth, persistence, and model layers."""

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from opencloning_db.models import User


@dataclass(frozen=True, slots=True)
class ReadContext:
    """Identity for workspace-scoped read operations."""

    workspace_id: int


@dataclass(frozen=True, slots=True)
class WriteContext(ReadContext):
    """Identity for any write/create operation: who is acting, in which workspace."""

    user: 'User'
