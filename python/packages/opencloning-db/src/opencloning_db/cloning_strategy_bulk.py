"""Shared validation and sync helpers for bulk cloning-strategy upload endpoints."""

import json

from fastapi import HTTPException
from opencloning.utils import validate_cloning_strategy_format_and_migrate
from sqlalchemy.orm import Session

from opencloning_db.apimodels import CloningStrategySyncResult
from opencloning_db.context import ReadContext
from opencloning_db.db import sync_cloning_strategy_with_db


def parse_cloning_strategy_file(content: bytes) -> tuple[dict | None, list[str]]:
    """Parse uploaded file bytes as JSON. Warnings are not produced here."""
    try:
        return json.loads(content), []
    except json.JSONDecodeError:
        return None, ['Cloning strategy is not valid JSON']


def validate_and_sync_cloning_strategy_dict(
    data: dict,
    session: Session,
    ctx: ReadContext,
    *,
    file_name: str | None = None,
    match_by_sequence: bool = True,
) -> CloningStrategySyncResult:
    parsing_warnings: list[str] = []
    try:
        cs = validate_cloning_strategy_format_and_migrate(data, parsing_warnings)
    except HTTPException as e:
        return CloningStrategySyncResult(file_name=file_name, parsing_errors=[e.detail])

    try:
        sync_result = sync_cloning_strategy_with_db(cs, session, ctx=ctx, match_by_sequence=match_by_sequence)
    except ValueError as e:
        return CloningStrategySyncResult(
            file_name=file_name,
            parsing_errors=['Cloning strategy is not correct: ' + str(e)],
        )
    sync_result.file_name = file_name
    sync_result.parsing_warnings = parsing_warnings
    return sync_result
