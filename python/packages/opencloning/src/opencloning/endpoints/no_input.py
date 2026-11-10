from fastapi import Query, HTTPException
from pydna.dseqrecord import Dseqrecord
from pydna.dseq import Dseq
from pydna.primer import Primer as PydnaPrimer
from pydna.oligonucleotide_hybridization import oligonucleotide_hybridization as _oligonucleotide_hybridization
from pydantic import create_model, Field
from typing import Annotated

from opencloning.endpoints.endpoint_utils import format_products
from opencloning.pydantic_models import PrimerModel

from ..dna_functions import (
    format_sequence_genbank,
)
from opencloning_linkml.datamodel import (
    TextFileSequence,
    ManuallyTypedSource,
    OligoHybridizationSource,
    ManuallyTypedSequence,
)

from .. import request_examples
from ..get_router import get_router

router = get_router()


@router.post(
    '/manually_typed',
    response_model=create_model(
        'ManuallyTypedResponse', sources=(list[ManuallyTypedSource], ...), sequences=(list[TextFileSequence], ...)
    ),
)
def manually_typed(source: ManuallyTypedSource, sequence: ManuallyTypedSequence):
    """Return the sequence from a manually typed sequence"""
    if sequence.circular:
        seq = Dseqrecord(sequence.sequence, circular=sequence.circular)
    else:
        seq = Dseqrecord(
            Dseq.from_full_sequence_and_overhangs(
                sequence.sequence, sequence.overhang_crick_3prime, sequence.overhang_watson_3prime
            )
        )
    return {'sequences': [format_sequence_genbank(seq, source.output_name)], 'sources': [source]}


@router.post(
    '/oligonucleotide_hybridization',
    response_model=create_model(
        'OligoHybridizationResponse',
        sources=(list[OligoHybridizationSource], ...),
        sequences=(list[TextFileSequence], ...),
    ),
    openapi_extra={
        'requestBody': {
            'content': {'application/json': {'examples': request_examples.oligonucleotide_hybridization_examples}}
        }
    },
)
def oligonucleotide_hybridization(
    source: OligoHybridizationSource,
    primers: Annotated[list[PrimerModel], Field(min_length=1, max_length=2)],
    minimal_annealing: int = Query(20, description='The minimal annealing length for each primer.'),
):

    if len(source.input):
        fwd_primer = next((p for p in primers if p.id == source.input[0].sequence), None)
        rvs_primer = next((p for p in primers if p.id == source.input[1].sequence), None)
    else:
        fwd_primer = primers[0]
        rvs_primer = primers[1] if len(primers) > 1 else fwd_primer

    if fwd_primer is None or rvs_primer is None:
        raise HTTPException(404, 'Invalid oligo id.')

    fwd_primer = PydnaPrimer(fwd_primer.sequence, id=str(fwd_primer.id), name=fwd_primer.name)
    rvs_primer = PydnaPrimer(rvs_primer.sequence, id=str(rvs_primer.id), name=rvs_primer.name)

    # If the overhang is provided, the minimal annealing is set from that
    if source.overhang_crick_3prime is not None:
        ovhg_watson = len(fwd_primer.seq) - len(rvs_primer.seq) + source.overhang_crick_3prime
        minimal_annealing = len(fwd_primer.seq)
        if source.overhang_crick_3prime < 0:
            minimal_annealing += source.overhang_crick_3prime
        if ovhg_watson > 0:
            minimal_annealing -= ovhg_watson

    try:
        dseqs = _oligonucleotide_hybridization(fwd_primer, rvs_primer, minimal_annealing)
    except ValueError as e:
        raise HTTPException(400, *e.args)

    return format_products(
        source.id,
        dseqs,
        source if source.overhang_crick_3prime is not None else None,
        source.output_name,
        no_products_error_message='No pair of annealing oligos was found. Try changing the annealing settings.',
        wrong_completed_source_error_message='The provided source is not valid.',
    )
