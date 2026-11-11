from fastapi import Query, HTTPException, Response
from typing import Union
import copy
import warnings
from pydna.dseqrecord import Dseqrecord
from pydna.primer import Primer as PydnaPrimer
from pydantic import create_model, Field
from typing import Annotated
from opencloning.endpoints.endpoint_utils import (
    check_unambiguous_overhangs,
    format_products,
    parse_restriction_enzymes,
)
from opencloning.temp_functions import is_assembly_complete, minimal_assembly_overlap
from opencloning.pydantic_models import PrimerModel
from ..dna_functions import (
    read_dsrecord_from_json,
)


from opencloning_linkml.datamodel import (
    CRISPRSource,
    CreLoxRecombinationSource,
    PCRSource,
    LigationSource,
    GibsonAssemblySource,
    InFusionSource,
    InVivoAssemblySource,
    OverlapExtensionPCRLigationSource,
    HomologousRecombinationSource,
    RestrictionAndLigationSource,
    GatewaySource,
    TextFileSequence,
    RecombinaseSource,
)

from pydna.assembly2 import (
    pcr_assembly as _pcr_assembly,
    ligation_assembly as _ligation_assembly,
    gibson_assembly as _gibson_assembly,
    in_fusion_assembly as _in_fusion_assembly,
    in_vivo_assembly as _in_vivo_assembly,
    fusion_pcr_assembly as _fusion_pcr_assembly,
    restriction_ligation_assembly as _restriction_ligation_assembly,
    homologous_recombination_integration as _homologous_recombination_integration,
    gateway_assembly as _gateway_assembly,
    crispr_integration as _crispr_integration,
    cre_lox_integration as _cre_lox_integration,
    cre_lox_excision_or_inversion as _cre_lox_excision_or_inversion,
    recombinase_integration as _recombinase_integration,
    recombinase_excision_or_inversion as _recombinase_excision_or_inversion,
    recombinase_assembly as _recombinase_assembly,
)
from pydna.cre_lox import annotate_loxP_sites

from pydna.gateway import annotate_gateway_sites
from pydna.recombinase import RecombinaseCollection, Recombinase
from ..get_router import get_router

router = get_router()


@router.post(
    '/crispr',
    response_model=create_model(
        'CrisprResponse',
        sources=(list[CRISPRSource], ...),
        sequences=(list[TextFileSequence], ...),
    ),
)
def crispr(
    source: CRISPRSource,
    guides: Annotated[list[PrimerModel], Field(min_length=1)],
    sequences: Annotated[list[TextFileSequence], Field(min_length=2, max_length=2)],
    minimal_homology: int = Query(40, description='The minimum homology between the template and the insert.', ge=5),
):
    """Return the sequence after performing CRISPR editing by Homology directed repair
    TODO: Support repair through NHEJ
    TODO: Check support for circular DNA targets
    """
    template, insert = [read_dsrecord_from_json(seq) for seq in sequences]
    guides = [PydnaPrimer(guide.sequence, id=str(guide.id), name=guide.name) for guide in guides]

    completed_source = source if is_assembly_complete(source) else None
    if completed_source is not None:
        minimal_homology = minimal_assembly_overlap(source)

    try:
        products = _crispr_integration(template, [insert], guides, minimal_homology)
    except ValueError as e:
        raise HTTPException(400, *e.args)

    return format_products(
        source.id,
        products,
        completed_source,
        source.output_name,
        no_products_error_message=f'No suitable products produced with provided primers and {minimal_homology} bps of homology',
    )


@router.post(
    '/ligation',
    response_model=create_model(
        'LigationResponse', sources=(list[LigationSource], ...), sequences=(list[TextFileSequence], ...)
    ),
)
def ligation(
    source: LigationSource,
    sequences: Annotated[list[TextFileSequence], Field(min_length=1)],
    blunt: bool = Query(False, description='Use blunt ligation as well as sticky ends.'),
    allow_partial_overlap: bool = Query(False, description='Allow for partially overlapping sticky ends.'),
    circular_only: bool = Query(False, description='Only return circular assemblies.'),
):

    fragments = [read_dsrecord_from_json(seq) for seq in sequences]

    # If the assembly is known, the blunt parameter is ignored, and we set the algorithm type from the assembly
    # (blunt ligations have locations of length zero)
    # Also, we allow partial overlap to be more permissive
    completed_source = source if is_assembly_complete(source) else None
    if completed_source:
        blunt = minimal_assembly_overlap(source) == 0
        allow_partial_overlap = True
    try:
        products = _ligation_assembly(
            fragments, allow_blunt=blunt, allow_partial_overlap=allow_partial_overlap, circular_only=circular_only
        )
    except ValueError as e:
        raise HTTPException(400, *e.args)

    return format_products(
        source.id, products, completed_source, source.output_name, no_products_error_message='No ligations were found.'
    )


@router.post(
    '/pcr',
    response_model=create_model(
        'PCRResponse', sources=(list[PCRSource], ...), sequences=(list[TextFileSequence], ...)
    ),
)
def pcr(
    source: PCRSource,
    sequences: Annotated[list[TextFileSequence], Field(min_length=1, max_length=1)],
    primers: Annotated[list[PrimerModel], Field(min_length=2, max_length=2)],
    minimal_annealing: int = Query(
        14,
        description='The minimal amount of bases that must match between the primer and the sequence, excluding mismatches.',
    ),
    allowed_mismatches: int = Query(0, description='The number of mismatches allowed'),
):

    pydna_sequences = [read_dsrecord_from_json(s) for s in sequences]
    pydna_primers = [PydnaPrimer(p.sequence, id=str(p.id), name=p.name) for p in primers]

    # TODO: This may have to be re-written if we allow mismatches
    # If an assembly is provided, we ignore minimal_annealing
    # What happens if annealing is zero? That would mean
    # mismatch in the 3' of the primer, which maybe should
    # not be allowed.
    completed_source = source if is_assembly_complete(source) else None
    if completed_source is not None:
        minimal_annealing = minimal_assembly_overlap(source)
        # Only the ones that match are included in the output assembly
        # location, so the submitted assembly should be returned without
        # allowed mistmatches
        # TODO: tests for this
        allowed_mismatches = 0

    try:
        products: list[Dseqrecord] = _pcr_assembly(
            pydna_sequences[0],
            pydna_primers[0],
            pydna_primers[1],
            limit=minimal_annealing,
            mismatches=allowed_mismatches,
            add_primer_features=source.add_primer_features,
        )
    except ValueError as e:
        # This catches the too many assemblies error
        raise HTTPException(400, *e.args)

    return format_products(
        source.id,
        products,
        completed_source,
        source.output_name,
        no_products_error_message='No pair of annealing primers was found. Try changing the annealing settings.',
    )


@router.post(
    '/homologous_recombination',
    response_model=create_model(
        'HomologousRecombinationResponse',
        sources=(list[Union[HomologousRecombinationSource, InVivoAssemblySource]], ...),
        sequences=(list[TextFileSequence], ...),
    ),
)
def homologous_recombination(
    source: HomologousRecombinationSource,
    sequences: Annotated[list[TextFileSequence], Field(min_length=2, max_length=2)],
    minimal_homology: int = Query(40, description='The minimum homology between the template and the insert.', ge=5),
):

    template, insert = [read_dsrecord_from_json(seq) for seq in sequences]

    # If an assembly is provided, we ignore minimal_homology
    completed_source = source if is_assembly_complete(source) else None
    if completed_source is not None:
        minimal_homology = minimal_assembly_overlap(source)

    try:
        if template.circular:
            products = _in_vivo_assembly([template, insert], minimal_homology, circular_only=True)
        else:
            products = _homologous_recombination_integration(template, [insert], minimal_homology)
    except ValueError as e:
        raise HTTPException(400, *e.args)

    return format_products(
        source.id,
        products,
        completed_source,
        source.output_name,
        no_products_error_message=f'No homologous recombination with at least {minimal_homology} bps of homology was found.',
    )


@router.post(
    '/gibson_assembly',
    response_model=create_model(
        'GibsonAssemblyResponse',
        sources=(
            list[Union[GibsonAssemblySource, OverlapExtensionPCRLigationSource, InFusionSource, InVivoAssemblySource]],
            ...,
        ),
        sequences=(list[TextFileSequence], ...),
    ),
)
def gibson_assembly(
    sequences: Annotated[list[TextFileSequence], Field(min_length=1)],
    source: Union[GibsonAssemblySource, OverlapExtensionPCRLigationSource, InFusionSource, InVivoAssemblySource],
    minimal_homology: int = Query(
        40, description='The minimum homology between consecutive fragments in the assembly.', ge=5
    ),
    circular_only: bool = Query(False, description='Only return circular assemblies.'),
):

    fragments = [read_dsrecord_from_json(seq) for seq in sequences]
    completed_source = source if is_assembly_complete(source) else None
    if completed_source:
        minimal_homology = minimal_assembly_overlap(completed_source)

    function2use = None
    if isinstance(source, GibsonAssemblySource):
        function2use = _gibson_assembly
    elif isinstance(source, OverlapExtensionPCRLigationSource):
        function2use = _fusion_pcr_assembly
    elif isinstance(source, InFusionSource):
        function2use = _in_fusion_assembly
    else:
        function2use = _in_vivo_assembly

    try:
        products = function2use(fragments, minimal_homology, circular_only)
    except ValueError as e:
        raise HTTPException(400, *e.args)

    return format_products(
        source.id,
        products,
        completed_source,
        source.output_name,
        no_products_error_message=f'No {"circular " if circular_only else ""}assembly with at least {minimal_homology} bps of homology was found.',
    )


@router.post(
    '/restriction_and_ligation',
    response_model=create_model(
        'RestrictionAndLigationResponse',
        sources=(list[RestrictionAndLigationSource], ...),
        sequences=(list[TextFileSequence], ...),
    ),
    summary='Restriction and ligation in a single step. Can also be used for Golden Gate assembly.',
    responses={
        200: {
            'description': 'Restriction and ligation completed successfully',
            'headers': {
                'x-warning': {
                    'description': 'A warning if partially restricted sequences were removed from the returned products',
                    'schema': {'type': 'string'},
                },
            },
        },
        400: {
            'description': 'Restriction and ligation failed',
            'headers': {
                'x-warning': {
                    'description': 'A warning if partially restricted sequences were removed from the returned products',
                    'schema': {'type': 'string'},
                },
            },
        },
    },
)
def restriction_and_ligation(
    response: Response,
    source: RestrictionAndLigationSource,
    sequences: Annotated[list[TextFileSequence], Field(min_length=1)],
    circular_only: bool = Query(False, description='Only return circular assemblies.'),
    sort_by_recognition_sites: bool = Query(
        False,
        description='''
        Sort the products by the number of recognition sites from the first enzyme.
        This is useful for Golden Gate assembly, where you tipically want the product that lost
        the Type IIS recognition site.
        ''',
    ),
):

    fragments = [read_dsrecord_from_json(seq) for seq in sequences]
    enzymes = parse_restriction_enzymes(source.restriction_enzymes)
    check_unambiguous_overhangs(fragments, enzymes)
    completed_source = source if is_assembly_complete(source) else None

    try:
        with warnings.catch_warnings(record=True) as warnings_captured:
            # warnings.simplefilter('always', UserWarning)
            products = _restriction_ligation_assembly(fragments, enzymes, circular_only=circular_only)
    except ValueError as e:
        raise HTTPException(400, *e.args)

    warning_header = None
    if warnings_captured:
        warning_header = '; '.join(str(w.message) for w in warnings_captured)
        response.headers['x-warning'] = warning_header

    if len(enzymes) > 0 and sort_by_recognition_sites:
        enzyme = parse_restriction_enzymes([source.restriction_enzymes[0]])
        products.sort(key=lambda x: len(x.seq.get_cutsites(enzyme)))

    try:
        return format_products(
            source.id,
            products,
            completed_source,
            source.output_name,
            no_products_error_message=f'No compatible restriction-ligation was found with {", ".join(source.restriction_enzymes)}.',
        )
    # We want to include the header in the response, even if raising an HTTPException
    except HTTPException as exc:
        if warning_header is not None:
            exc.headers = {**(exc.headers or {}), 'x-warning': warning_header}
        raise


@router.post(
    '/gateway',
    response_model=create_model(
        'GatewayResponse', sources=(list[GatewaySource], ...), sequences=(list[TextFileSequence], ...)
    ),
)
def gateway(
    source: GatewaySource,
    sequences: Annotated[list[TextFileSequence], Field(min_length=1)],
    circular_only: bool = Query(False, description='Only return circular assemblies.'),
    only_multi_site: bool = Query(
        False, description='Only return assemblies where more than one site per sequence recombined.'
    ),
):

    fragments = [read_dsrecord_from_json(seq) for seq in sequences]
    completed_source = source if is_assembly_complete(source) else None

    try:
        products = _gateway_assembly(fragments, source.reaction_type, source.greedy, circular_only, only_multi_site)
    except ValueError as e:
        raise HTTPException(400, *e.args)

    products = [annotate_gateway_sites(p, source.greedy) for p in products]

    return format_products(
        source.id,
        products,
        completed_source,
        source.output_name,
        no_products_error_message=None,  # Already handled by the _gateway_assembly function
    )


@router.post(
    '/cre_lox_recombination',
    response_model=create_model(
        'CreLoxRecombinationResponse',
        sources=(list[CreLoxRecombinationSource], ...),
        sequences=(list[TextFileSequence], ...),
    ),
)
def cre_lox_recombination(
    source: CreLoxRecombinationSource, sequences: Annotated[list[TextFileSequence], Field(min_length=1)]
):
    fragments = [read_dsrecord_from_json(seq) for seq in sequences]
    completed_source = source if is_assembly_complete(source) else None

    if len(fragments) == 1:
        products = _cre_lox_excision_or_inversion(fragments[0])
    else:
        products = []
        if not fragments[0].circular:
            products.extend(_cre_lox_integration(fragments[0], fragments[1:]))
        if not fragments[1].circular:
            products.extend(_cre_lox_integration(fragments[1], fragments[:1]))

    products = [annotate_loxP_sites(p) for p in products]

    return format_products(
        source.id,
        products,
        completed_source,
        source.output_name,
        no_products_error_message='No compatible Cre/Lox recombination was found.',
    )


@router.post(
    '/recombinase',
    response_model=create_model(
        'RecombinaseResponse',
        sources=(list[RecombinaseSource], ...),
        sequences=(list[TextFileSequence], ...),
    ),
)
def recombinase(
    source: RecombinaseSource,
    sequences: Annotated[list[TextFileSequence], Field(min_length=1)],
    reverse_recombinase: bool = Query(False, description='Whether to use the reverse reaction of the recombinase.'),
    input_contains_genome: bool = Query(
        True, description='Whether one of the input sequences represents a genome sequence.'
    ),
):
    fragments = [read_dsrecord_from_json(seq) for seq in sequences]
    completed_source = source if is_assembly_complete(source) else None
    try:
        collection = RecombinaseCollection([Recombinase(**r.model_dump()) for r in source.recombinases])
    except ValueError as e:
        raise HTTPException(422, *e.args)

    reverse_collection = copy.deepcopy(collection)
    reverse_collection.recombinases.extend([r.get_reverse_recombinase() for r in reverse_collection.recombinases])
    if reverse_recombinase:
        collection = reverse_collection

    products = []
    if input_contains_genome:
        if not any(not f.circular for f in fragments):
            raise HTTPException(400, 'If input_contains_genome is True, there must be at least one linear fragment.')
        if len(fragments) == 1:
            products = _recombinase_excision_or_inversion(fragments[0], collection)
        else:
            linear_fragment_indexes = [i for i, f in enumerate(fragments) if not f.circular]
            for i in linear_fragment_indexes:
                inputs_without_linear_fragment = fragments[:i] + fragments[i + 1 :]
                products.extend(_recombinase_integration(fragments[i], inputs_without_linear_fragment, collection))
    else:
        products = _recombinase_assembly(fragments, collection)

    products = [reverse_collection.annotate(p) for p in products]

    return format_products(
        source.id,
        products,
        completed_source,
        source.output_name,
        no_products_error_message='No compatible reaction was found with the provided recombinases.',
    )
