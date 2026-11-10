"""Tools for cloning operations. Each one adds one new sequence to the strategy.

All the tools work the same way, through run_operation: they look up the input sequences and primers
in the strategy, send them to the cloning API endpoint, and add the product to the strategy.
"""

from typing import Literal

from . import cloning_api, names, storage
from .app import mcp
from .products import add_product_to_strategy


def run_operation(
    strategy_id: str,
    endpoint: str,
    source: dict,
    sequence_ids: list[int],
    operation: str,
    name: str | None = None,
    primer_ids: list[int] = (),
    primers_key: str = 'primers',
    params: dict | None = None,
    product_index: int | None = None,
    input_ids: list[int] | None = None,
) -> dict:
    """Run a cloning operation on sequences (and primers) of the strategy, and add its product.

    `source` is the start of the source sent to the API, e.g. {"type": "PCRSource"}. The API returns
    it completed, with the details of the operation (cut sites, assembly junctions, ...).
    `operation` is used to name the product when the caller passes no name, e.g. "pcr".
    `input_ids` are the ids recorded as inputs of the step, by default the sequences. A few endpoints
    (oligo hybridization, CRISPR) read or return the inputs as sent, so they need to be set explicitly.
    """
    strategy = storage.load_strategy(strategy_id)
    sequences = storage.get_by_id(strategy, 'sequences', sequence_ids)
    primers = storage.get_by_id(strategy, 'primers', primer_ids)

    if name is None:
        parent_name = names.sequence_name(sequences[0]) if sequences else primers[0]['name']
        name = names.derived_name(parent_name, operation)

    # The ids of the inputs: the API keeps them in the source it returns, linking the new sequence to its inputs
    if input_ids is None:
        input_ids = sequence_ids
    source = {**source, 'id': 0, 'input': [{'sequence': i} for i in input_ids], 'output_name': names.clean(name)}
    body = {'source': source, 'sequences': sequences}
    if primers:
        body[primers_key] = primers

    result = cloning_api.post(endpoint, json=body, params=params)
    return add_product_to_strategy(strategy_id, result, product_index)


@mcp.tool()
def restriction_digest(
    strategy_id: str,
    sequence_id: int,
    enzymes: list[str],
    name: str | None = None,
    product_index: int | None = None,
) -> dict:
    """Digest a sequence with one or two restriction enzymes, e.g. ["EcoRI", "BamHI"], and keep one fragment.

    Enzyme names are case-sensitive, as in REBASE. Usually returns several fragments (status
    "choose_product"): their length and ends (overhangs) help to pick the right one. To keep a second
    fragment from the same digest, call again with another product_index.
    """
    return run_operation(
        strategy_id,
        '/restriction',
        {'type': 'RestrictionEnzymeDigestionSource'},
        [sequence_id],
        operation='_'.join(enzymes),
        name=name,
        params={'restriction_enzymes': enzymes},
        product_index=product_index,
    )


@mcp.tool()
def pcr(
    strategy_id: str,
    template_id: int,
    forward_primer_id: int,
    reverse_primer_id: int,
    name: str | None = None,
    minimal_annealing: int = 14,
    allowed_mismatches: int = 0,
    product_index: int | None = None,
) -> dict:
    """Amplify a template sequence with two primers (added with add_primer).

    minimal_annealing is the minimum number of bases at the 3' end of each primer that must match the
    template. The 5' end of the primers can have extra bases (tails), which are added to the product.
    Afterwards, pcr_primer_details gives the Tm of the part of each primer that binds the template.
    """
    return run_operation(
        strategy_id,
        '/pcr',
        {'type': 'PCRSource'},
        [template_id],
        operation='pcr',
        name=name,
        primer_ids=[forward_primer_id, reverse_primer_id],
        params={'minimal_annealing': minimal_annealing, 'allowed_mismatches': allowed_mismatches},
        product_index=product_index,
    )


@mcp.tool()
def ligation(
    strategy_id: str,
    sequence_ids: list[int],
    name: str | None = None,
    blunt: bool = False,
    circular_only: bool = False,
    product_index: int | None = None,
) -> dict:
    """Ligate sequences with compatible sticky ends, e.g. the products of restriction_digest.

    Set blunt=True to also join blunt ends. Set circular_only=True to only get circular products,
    e.g. an insert ligated into a vector. To digest and ligate in one step (e.g. Golden Gate),
    use restriction_and_ligation instead.
    """
    return run_operation(
        strategy_id,
        '/ligation',
        {'type': 'LigationSource'},
        sequence_ids,
        operation='ligation',
        name=name,
        params={'blunt': blunt, 'circular_only': circular_only},
        product_index=product_index,
    )


@mcp.tool()
def restriction_and_ligation(
    strategy_id: str,
    sequence_ids: list[int],
    enzymes: list[str],
    name: str | None = None,
    circular_only: bool = True,
    product_index: int | None = None,
) -> dict:
    """Digest sequences with restriction enzymes and ligate the fragments in one step.

    Use this for Golden Gate assembly (e.g. enzymes=["BsaI"]) or any one-pot digestion-ligation. The
    sequences are cut with all the enzymes. Products that lost the recognition site of the first enzyme
    come first, which is the one you usually want in Golden Gate.
    """
    return run_operation(
        strategy_id,
        '/restriction_and_ligation',
        {'type': 'RestrictionAndLigationSource', 'restriction_enzymes': enzymes},
        sequence_ids,
        operation='assembly',
        name=name,
        params={'circular_only': circular_only, 'sort_by_recognition_sites': True},
        product_index=product_index,
    )


def homology_assembly(
    strategy_id: str,
    source_type: str,
    operation: str,
    sequence_ids: list[int],
    name: str | None,
    minimal_homology: int,
    circular_only: bool,
    product_index: int | None,
) -> dict:
    """The four homology-based assemblies use the same endpoint, the source type says which one it is."""
    return run_operation(
        strategy_id,
        '/gibson_assembly',
        {'type': source_type},
        sequence_ids,
        operation=operation,
        name=name,
        params={'minimal_homology': minimal_homology, 'circular_only': circular_only},
        product_index=product_index,
    )


@mcp.tool()
def gibson_assembly(
    strategy_id: str,
    sequence_ids: list[int],
    name: str | None = None,
    minimal_homology: int = 20,
    circular_only: bool = False,
    product_index: int | None = None,
) -> dict:
    """Gibson assembly: join sequences whose ends overlap by at least minimal_homology bases.

    The order of sequence_ids does not matter: fragments are joined by their overlaps. Set
    circular_only=True for plasmids.
    """
    return homology_assembly(
        strategy_id,
        'GibsonAssemblySource',
        'gibson',
        sequence_ids,
        name,
        minimal_homology,
        circular_only,
        product_index,
    )


@mcp.tool()
def in_fusion(
    strategy_id: str,
    sequence_ids: list[int],
    name: str | None = None,
    minimal_homology: int = 15,
    circular_only: bool = False,
    product_index: int | None = None,
) -> dict:
    """In-Fusion assembly: join sequences whose ends overlap by at least minimal_homology bases (15 is typical).

    The order of sequence_ids does not matter. Set circular_only=True for plasmids.
    """
    return homology_assembly(
        strategy_id,
        'InFusionSource',
        'in_fusion',
        sequence_ids,
        name,
        minimal_homology,
        circular_only,
        product_index,
    )


@mcp.tool()
def in_vivo_assembly(
    strategy_id: str,
    sequence_ids: list[int],
    name: str | None = None,
    minimal_homology: int = 20,
    circular_only: bool = False,
    product_index: int | None = None,
) -> dict:
    """In vivo assembly (e.g. in yeast or E. coli): join sequences whose ends overlap by at least
    minimal_homology bases.

    The order of sequence_ids does not matter. Set circular_only=True for plasmids. To integrate a
    sequence into a linear locus, use homologous_recombination instead.
    """
    return homology_assembly(
        strategy_id,
        'InVivoAssemblySource',
        'in_vivo',
        sequence_ids,
        name,
        minimal_homology,
        circular_only,
        product_index,
    )


@mcp.tool()
def overlap_extension_pcr(
    strategy_id: str,
    sequence_ids: list[int],
    name: str | None = None,
    minimal_homology: int = 20,
    circular_only: bool = False,
    product_index: int | None = None,
) -> dict:
    """Overlap extension PCR (fusion PCR): join linear fragments whose ends overlap by at least
    minimal_homology bases into one linear product.
    """
    return homology_assembly(
        strategy_id,
        'OverlapExtensionPCRLigationSource',
        'oe_pcr',
        sequence_ids,
        name,
        minimal_homology,
        circular_only,
        product_index,
    )


@mcp.tool()
def homologous_recombination(
    strategy_id: str,
    template_id: int,
    insert_id: int,
    name: str | None = None,
    minimal_homology: int = 40,
    product_index: int | None = None,
) -> dict:
    """Homologous recombination: integrate an insert into a linear template (e.g. a genomic locus).

    The insert must share at least minimal_homology bases at both ends with the template (e.g. a PCR
    product with homology arms). The order matters: the template first, then the insert. If the template
    is circular the API runs an in vivo assembly instead (the step is stored as such); for circular
    templates prefer in_vivo_assembly.
    """
    return run_operation(
        strategy_id,
        '/homologous_recombination',
        {'type': 'HomologousRecombinationSource'},
        [template_id, insert_id],
        operation='hr',
        name=name,
        params={'minimal_homology': minimal_homology},
        product_index=product_index,
    )


@mcp.tool()
def crispr_hdr(
    strategy_id: str,
    template_id: int,
    insert_id: int,
    guide_primer_ids: list[int],
    name: str | None = None,
    minimal_homology: int = 40,
    product_index: int | None = None,
) -> dict:
    """CRISPR-Cas9 homology-directed repair: cut the template where the guides target, and repair it
    with the insert.

    The guides are primers (added with add_primer) holding the guide RNA target sequence, without the
    PAM. The insert must share at least minimal_homology bases with the template on both sides of the
    cut. The order matters: the template first, then the insert.
    """
    return run_operation(
        strategy_id,
        '/crispr',
        {'type': 'CRISPRSource'},
        [template_id, insert_id],
        operation='crispr',
        name=name,
        primer_ids=guide_primer_ids,
        primers_key='guides',
        params={'minimal_homology': minimal_homology},
        product_index=product_index,
        input_ids=[template_id, insert_id, *guide_primer_ids],
    )


@mcp.tool()
def gateway(
    strategy_id: str,
    sequence_ids: list[int],
    reaction: Literal['BP', 'LR'],
    name: str | None = None,
    greedy: bool = False,
    circular_only: bool = False,
    only_multi_site: bool = False,
    product_index: int | None = None,
) -> dict:
    """Gateway cloning. reaction="BP" joins attB and attP sites (making an entry clone), "LR" joins
    attL and attR sites (making an expression clone).

    One sequence is allowed (intramolecular reaction). Usually returns several candidates (status
    "choose_product"); circular_only=True keeps only circular products, which is typically what you want
    for plasmids. Set greedy=True to detect more att sites (use list_gateway_sites to see which are found).
    """
    return run_operation(
        strategy_id,
        '/gateway',
        {'type': 'GatewaySource', 'reaction_type': reaction, 'greedy': greedy},
        sequence_ids,
        operation=reaction.lower(),
        name=name,
        params={'circular_only': circular_only, 'only_multi_site': only_multi_site},
        product_index=product_index,
    )


@mcp.tool()
def list_gateway_sites(strategy_id: str, sequence_id: int, greedy: bool = False) -> dict:
    """List the Gateway att sites (attB1, attP2, ...) found in a sequence, with their locations.

    Read-only. Use it to check which sites two sequences have before choosing BP or LR in gateway.
    """
    sequence = storage.get_by_id(storage.load_strategy(strategy_id), 'sequences', [sequence_id])[0]
    return cloning_api.post('/annotation/get_gateway_sites', json=sequence, params={'greedy': greedy})


@mcp.tool()
def cre_lox_recombination(
    strategy_id: str,
    sequence_ids: list[int],
    name: str | None = None,
    product_index: int | None = None,
) -> dict:
    """Cre-lox recombination between loxP sites.

    With one sequence: excision or inversion, depending on the orientation of the sites. With two or
    more: integration of the other sequences into the first one (a circular sequence cannot be the host,
    so list a linear one first). Usually returns several candidates (status "choose_product").
    """
    return run_operation(
        strategy_id,
        '/cre_lox_recombination',
        {'type': 'CreLoxRecombinationSource'},
        sequence_ids,
        operation='cre',
        name=name,
        product_index=product_index,
    )


@mcp.tool()
def polymerase_extension(strategy_id: str, sequence_id: int, name: str | None = None) -> dict:
    """Fill in the overhangs of a linear sequence with a DNA polymerase, making its ends blunt.

    The sequence must be linear and have an overhang (e.g. a restriction fragment).
    """
    return run_operation(
        strategy_id,
        '/polymerase_extension',
        {'type': 'PolymeraseExtensionSource'},
        [sequence_id],
        operation='extended',
        name=name,
    )


@mcp.tool()
def reverse_complement(strategy_id: str, sequence_id: int, name: str | None = None) -> dict:
    """Add the reverse complement of a sequence to the strategy, e.g. to orient a fragment before ligation."""
    return run_operation(
        strategy_id,
        '/reverse_complement',
        {'type': 'ReverseComplementSource'},
        [sequence_id],
        operation='rc',
        name=name,
    )


@mcp.tool()
def oligo_hybridization(
    strategy_id: str,
    forward_primer_id: int,
    reverse_primer_id: int,
    name: str | None = None,
    minimal_annealing: int = 20,
    product_index: int | None = None,
) -> dict:
    """Anneal two oligonucleotides (primers added with add_primer) into a double-stranded fragment.

    The oligos can anneal with an offset, leaving overhangs: this is how a linker with sticky ends is made.
    They need at least minimal_annealing complementary bases.
    """
    return run_operation(
        strategy_id,
        '/oligonucleotide_hybridization',
        {'type': 'OligoHybridizationSource'},
        [],
        operation='annealed',
        name=name,
        primer_ids=[forward_primer_id, reverse_primer_id],
        params={'minimal_annealing': minimal_annealing},
        product_index=product_index,
        # This endpoint finds the oligos in source.input and returns it unchanged
        input_ids=[forward_primer_id, reverse_primer_id],
    )
