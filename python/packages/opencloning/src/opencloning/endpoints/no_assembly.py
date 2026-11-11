from fastapi import Query, HTTPException
from pydna.dseqrecord import Dseqrecord
from pydantic import create_model, Field
from typing import Annotated

from opencloning.endpoints.endpoint_utils import (
    check_unambiguous_overhangs,
    format_products,
    parse_restriction_enzymes,
)
from opencloning.temp_functions import get_enzymes_from_source

from ..dna_functions import (
    format_sequence_genbank,
    read_dsrecord_from_json,
)
from opencloning_linkml.datamodel import (
    RestrictionEnzymeDigestionSource,
    TextFileSequence,
    PolymeraseExtensionSource,
    ReverseComplementSource,
)
from ..get_router import get_router

router = get_router()


@router.post(
    '/restriction',
    response_model=create_model(
        'RestrictionEnzymeDigestionResponse',
        sources=(list[RestrictionEnzymeDigestionSource], ...),
        sequences=(list[TextFileSequence], ...),
    ),
)
def restriction(
    source: RestrictionEnzymeDigestionSource,
    sequences: Annotated[list[TextFileSequence], Field(min_length=1, max_length=1)],
    restriction_enzymes: Annotated[list[str], Query(default_factory=list)],
):
    completed_source = source if (source.left_edge is not None or source.right_edge is not None) else None
    # There should be 1 or 2 enzymes in the request if the source does not have cuts
    if completed_source is None:
        enzymes = parse_restriction_enzymes(restriction_enzymes)
        if len(enzymes) not in [1, 2]:
            raise HTTPException(422, 'There should be 1 or 2 restriction enzymes in the request.')
    else:
        if len(restriction_enzymes) != 0:
            raise HTTPException(422, 'There should be no restriction enzymes in the request if source is populated.')
        enzymes = parse_restriction_enzymes(get_enzymes_from_source(completed_source))

    seqr = read_dsrecord_from_json(sequences[0])
    check_unambiguous_overhangs([seqr], enzymes)

    cutsites = seqr.seq.get_cutsites(*enzymes)
    cutting_enzymes = set(e for _, e in cutsites if e is not None)
    enzymes_not_cutting = set(enzymes) - set(cutting_enzymes)
    if len(enzymes_not_cutting):
        raise HTTPException(400, 'These enzymes do not cut: ' + ', '.join(map(str, enzymes_not_cutting)))

    try:
        products = seqr.cut(*enzymes)
    except ValueError as e:
        raise HTTPException(400, *e.args)

    return format_products(
        source.id,
        products,
        completed_source,
        source.output_name,
        wrong_completed_source_error_message='Invalid restriction enzyme pair.',
    )


@router.post(
    '/polymerase_extension',
    response_model=create_model(
        'PolymeraseExtensionResponse',
        sources=(list[PolymeraseExtensionSource], ...),
        sequences=(list[TextFileSequence], ...),
    ),
)
def polymerase_extension(
    source: PolymeraseExtensionSource,
    sequences: Annotated[list[TextFileSequence], Field(min_length=1, max_length=1)],
):
    """Return the sequence from a polymerase extension reaction"""

    dseq = read_dsrecord_from_json(sequences[0])

    if dseq.circular:
        raise HTTPException(400, 'The sequence must be linear.')

    if dseq.seq.ovhg == dseq.seq.watson_ovhg == 0:
        raise HTTPException(400, 'The sequence must have an overhang.')

    out_sequence = Dseqrecord(dseq.seq.fill_in(), features=dseq.features)

    return {'sequences': [format_sequence_genbank(out_sequence, source.output_name)], 'sources': [source]}


@router.post(
    '/reverse_complement',
    response_model=create_model(
        'ReverseComplementResponse',
        sources=(list[ReverseComplementSource], ...),
        sequences=(list[TextFileSequence], ...),
    ),
)
def reverse_complement(
    source: ReverseComplementSource,
    sequences: Annotated[list[TextFileSequence], Field(min_length=1, max_length=1)],
):
    dseq = read_dsrecord_from_json(sequences[0])
    out_sequence = dseq.reverse_complement()
    seq_name = source.output_name if source.output_name is not None else dseq.name + '_rc'
    return {'sequences': [format_sequence_genbank(out_sequence, seq_name)], 'sources': [source]}
