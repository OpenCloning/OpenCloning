from fastapi import Query, HTTPException, Response
from Bio.Restriction.Restriction_Dictionary import rest_dict
from opencloning.utils import validate_cloning_strategy_format_and_migrate
from opencloning_linkml._version import __version__ as schema_version
import os

from pydna.opencloning_models import id_mode
from ..dna_functions import (
    format_sequence_genbank,
    read_dsrecord_from_json,
)
from ..dna_utils import align_sanger_traces
from ..pydantic_models import (
    BaseCloningStrategy,
)
from opencloning_linkml.datamodel import TextFileSequence
from ..get_router import get_router
from .._version import __version__ as backend_version
from ..syntax import Syntax
from pydna.opencloning_models import CloningStrategy as PydnaCloningStrategy


router = get_router()


def version_to_int(version: str | None) -> int | None:
    if version is None:
        return None
    try:
        version = version.replace('v', '')
        # Pad to 2 digits
        int_vals = [val.zfill(2) for val in version.split('.')]
        return int(''.join(int_vals))
    except ValueError:
        return None


@router.get('/version')
async def get_version():
    opencloning_version = os.getenv('OPENCLONING_VERSION')
    return {
        'backend_version': backend_version,
        'schema_version': schema_version,
        'opencloning_version': opencloning_version,
        'opencloning_version_int': version_to_int(opencloning_version),
    }


@router.get('/restriction_enzyme_list', response_model=dict[str, list[str]])
async def get_restriction_enzyme_list():
    """Return the dictionary of restriction enzymes"""
    return {'enzyme_names': list(rest_dict.keys())}


@router.post(
    '/validate',
    summary='Validate a cloning strategy',
    responses={
        200: {
            'description': 'The cloning strategy is valid',
            'headers': {
                'x-warning': {
                    'description': 'A warning returned if the file either contains errors or is in a previous version of the model',
                    'schema': {'type': 'string'},
                },
            },
        },
        422: {
            'description': 'The cloning strategy is invalid',
        },
    },
)
def cloning_strategy_is_valid(data: dict, response: Response):
    """Validate a cloning strategy and migrate it to the latest version if necessary"""
    warnings = []
    cs = validate_cloning_strategy_format_and_migrate(data, warnings)
    if len(warnings) > 0:
        response.headers['x-warning'] = ';'.join(warnings)
        return cs
    return None


@router.post('/validate_syntax')
async def validate_syntax(syntax: Syntax):
    """Validate a syntax"""
    return Response(status_code=200)


@router.post('/normalize_cloning_strategy', response_model=BaseCloningStrategy)
def normalize_cloning_strategy(cs: BaseCloningStrategy):
    """Normalize a cloning strategy"""
    with id_mode(use_python_internal_id=False):
        cs_pydna = PydnaCloningStrategy.model_validate(cs.model_dump())
        return cs_pydna.normalize().model_dump()


@router.post('/rename_sequence', response_model=TextFileSequence)
def rename_sequence(
    sequence: TextFileSequence,
    name: str = Query(..., description='The new name of the sequence.', pattern=r'^[^\s]+$'),
):
    """Rename a sequence"""
    dseqr = read_dsrecord_from_json(sequence)
    return format_sequence_genbank(dseqr, name)


@router.post('/align_sanger', response_model=list[str])
def align_sanger(
    sequence: TextFileSequence,
    traces: list[str],
):
    """Align a list of sanger traces to a sequence"""

    dseqr = read_dsrecord_from_json(sequence)
    try:
        return align_sanger_traces(dseqr, traces)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
