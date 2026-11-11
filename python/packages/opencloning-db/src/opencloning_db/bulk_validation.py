"""Shared helpers for bulk upload / validate endpoints."""

from collections import Counter
from collections.abc import Callable, Sequence
from typing import Any

from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError


def frequency_duplicates(values: list[str]) -> set[str]:
    """Values that appear more than once (exact string equality on list items)."""
    return {value for value, count in Counter(values).items() if count > 1}


def bulk_conflict_response(rows: Sequence[BaseModel]) -> JSONResponse:
    """409 response body used by bulk endpoints when validation fails or commit races."""
    return JSONResponse(
        status_code=409,
        content=[row.model_dump(mode='json') for row in rows],
    )


def bulk_commit_or_conflict(
    session,
    entities: Sequence[Any],
    revalidate: Callable[[], Sequence[BaseModel]],
) -> JSONResponse | None:
    """
    Persist new entities in one transaction.

    On IntegrityError: rollback, return 409 with rows from ``revalidate()`` (same shape as validate-upload).
    On success: return None; caller should refresh entities and build the success response.
    """
    session.add_all(entities)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        return bulk_conflict_response(revalidate())
    return None
