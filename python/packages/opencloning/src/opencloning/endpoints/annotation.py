from fastapi import Query
from pydantic import create_model

from ..get_router import get_router
from opencloning_linkml.datamodel import TextFileSequence, AnnotationSource
from ..dna_functions import (
    read_dsrecord_from_json,
    annotate_with_plannotate as _annotate_with_plannotate,
    format_sequence_genbank,
)
from pydna.gateway import find_gateway_sites
from ..app_settings import settings

router = get_router()


@router.post('/annotation/get_gateway_sites', response_model=dict[str, list[str]])
def get_gateway_sites(
    sequence: TextFileSequence, greedy: bool = Query(False, description='Whether to use the greedy algorithm.')
) -> dict[str, list[str]]:
    """
    Get a dictionary with the names of the gateway sites present in the sequence and their locations as strings.
    """
    dseqr = read_dsrecord_from_json(sequence)
    sites_dict = find_gateway_sites(dseqr, greedy)
    for site in sites_dict:
        sites_dict[site] = [str(loc) for loc in sites_dict[site]]
    return sites_dict


if settings.PLANNOTATE_URL is not None:

    @router.post(
        '/annotate/plannotate',
        summary='Annotate a sequence with Plannotate',
        response_model=create_model(
            'PlannotateResponse',
            sources=(list[AnnotationSource], ...),
            sequences=(list[TextFileSequence], ...),
        ),
    )
    async def annotate_with_plannotate(
        sequence: TextFileSequence,
        source: AnnotationSource,
    ):
        input_seqr = read_dsrecord_from_json(sequence)
        # Make a request submitting sequence as a file:
        seqr, annotations, version = await _annotate_with_plannotate(
            sequence.file_content,
            f'{sequence.id}.gb',
            settings.PLANNOTATE_URL + 'annotate',
            settings.PLANNOTATE_TIMEOUT,
        )

        source.annotation_report = annotations
        source.annotation_tool = 'plannotate'
        source.annotation_tool_version = version
        seqr.name = input_seqr.name + '_annotated'

        return {'sources': [source], 'sequences': [format_sequence_genbank(seqr, source.output_name)]}
