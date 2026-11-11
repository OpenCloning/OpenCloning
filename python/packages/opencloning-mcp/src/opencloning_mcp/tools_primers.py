"""Tools to find regions of a sequence, design primers for them, and see their properties.

The model says what it wants in terms of features, amino acids and coordinates (see regions.py), the
region is resolved here, and the cloning API designs the primers. The designed primers are saved in the
strategy, so that their ids can go straight to the pcr tool.

As in the PCR table of the web app, the Tm of a primer is the one of the part that binds the template (its
3' end), and that is known once the PCR is done: the PCR step records it. So pcr_primer_details reads it there.
"""

import re
from typing import Literal

from mcp.server.mcpserver.exceptions import ToolError
from opencloning.primer3_functions import PrimerDesignSettings
from pydna.opencloning_models import SequenceLocationStr

from . import cloning_api, names, storage
from .app import mcp
from .regions import Position, Region, SequenceView

# list_features shows at most this many features: a genome region can have hundreds
MAX_LISTED_FEATURES = 100


def get_sequence(strategy: dict, sequence_id: int) -> tuple[dict, SequenceView]:
    (sequence,) = storage.get_by_id(strategy, 'sequences', [sequence_id])
    return sequence, SequenceView(sequence)


def with_settings(body: dict, settings: PrimerDesignSettings | None) -> dict:
    """Add the conditions of the Tm calculation to the body of a request, if the model gave any."""
    return {**body, 'settings': settings.model_dump()} if settings else body


def save_primers(strategy_id: str, designed: list[dict], prefix: str, suffixes: tuple[str, str]) -> list[dict]:
    """Save the two primers that the API designed, named like "cdc2_fwd", and return their ids."""
    primers = []
    for primer, suffix in zip(designed, suffixes):
        name = names.primer_name(prefix, suffix)
        primers.append(
            {
                'id': storage.add_primer(strategy_id, name, primer['sequence']),
                'name': name,
                'sequence': primer['sequence'],
            }
        )
    return primers


# Finding regions =============================================================================


@mcp.tool()
def list_features(
    strategy_id: str, sequence_id: int, query: str | None = None, feature_type: str | None = None
) -> dict:
    """List the annotated features of a sequence with their exact 1-based locations (read-only, adds nothing).

    describe_strategy shows only the first 15 features: use this to see all of them, or to find one by a
    word of its name (`query`) or by its type (`feature_type`, e.g. "CDS"). Each feature has an `index`: pass
    it as "#<index>" in a `feature` argument to pick that exact feature when a name is shared (a gene and its
    CDS often have the same name). For a CDS the length in amino acids is given. A location like
    "join(10..50,80..120)" is a feature with introns (exons joined), "complement(...)" is on the minus strand.
    """
    strategy = storage.load_strategy(strategy_id)
    _, view = get_sequence(strategy, sequence_id)
    features = view.filter_features(query, feature_type)
    result = {
        'sequence': view.name,
        'length': view.length,
        'topology': view.topology,
        'features': [view.feature_row(f) for f in features[:MAX_LISTED_FEATURES]],
    }
    if len(features) > MAX_LISTED_FEATURES:
        result['note'] = (
            f'{len(features)} features match, only {MAX_LISTED_FEATURES} are shown: use query or feature_type.'
        )
    return result


@mcp.tool()
def locate_region(
    strategy_id: str, sequence_id: int, region: Region | None = None, point: Position | None = None
) -> dict:
    """Check what a region (or a point) is on a sequence, before designing primers for it (read-only, adds nothing).

    Give either a `region` or a `point`. The answer has the 1-based coordinates, the strand, the length, the
    first and last bases of a region, and for a point the bases around it and, for a point in a CDS, the amino
    acids on both sides, e.g. "A120|G121". Use it to make sure that "after amino acid 120" or "200 bp upstream
    of the ATG" is where the user means, and to read the sequence around a place.
    """
    if (region is None) == (point is None):
        raise ToolError('Give either a region or a point.')
    strategy = storage.load_strategy(strategy_id)
    _, view = get_sequence(strategy, sequence_id)
    result = {'sequence': view.name, 'length': view.length, 'topology': view.topology}
    if region is not None:
        result['region'] = view.describe_region(view.resolve_region(region))
    else:
        result['point'] = view.describe_point(view.resolve_position(point))
    return result


# Designing primers ===========================================================================


def spacers_to_confirm(spacers: dict[str, str], approved: bool) -> dict | None:
    """The answer that stops a design when it adds spacers, tails or linkers that nobody approved.

    A linker or a tail changes the construct, so it is the user's decision: the model has to ask, and sets
    `spacer_approved_by_user` to call the tool again. Nothing is saved until then.
    """
    given = {name: bases.upper() for name, bases in spacers.items() if bases}
    if not given or approved:
        return None
    return {
        'status': 'needs_confirmation',
        'message': (
            'Nothing was designed. These bases would be added to the construct: '
            + ', '.join(f'{name} {bases}' for name, bases in given.items())
            + '. Ask the user if they want them (say what they are for: e.g. a linker between a tag and a '
            'protein). If they agree, or if they asked for them, call the same tool again with the same '
            'arguments and spacer_approved_by_user=true. If not, call it without them.'
        ),
        'spacers': given,
    }


@mcp.tool()
def design_pcr_primers(
    strategy_id: str,
    template_id: int,
    region: Region | None = None,
    left_enzyme: str | None = None,
    right_enzyme: str | None = None,
    left_tail: str = '',
    right_tail: str = '',
    filler_bases: str = 'TTT',
    target_tm: float = 55.0,
    minimal_annealing: int = 18,
    name_prefix: str | None = None,
    settings: PrimerDesignSettings | None = None,
    spacer_approved_by_user: bool = False,
) -> dict:
    """Design a pair of primers that amplify a region of a sequence, and save them in the strategy.

    `region` says what to amplify: a feature (with extra bases upstream or downstream if wanted), bases
    from..to, or the stretch between two points (see Region). Without it the whole sequence is amplified.
    The amplicon is in the direction of the region: for a gene on the minus strand the forward primer is the
    one in the sense of the gene. Use locate_region first when the region is not a plain feature.

    Add tails with `left_enzyme` / `right_enzyme` (restriction sites, e.g. "BamHI", with `filler_bases` in
    front so that the enzyme can cut) and `left_tail` / `right_tail` (any extra bases: a Kozak sequence, a
    linker...). With an enzyme the tail goes between the site and the part of the primer that binds. `right_tail`
    is given as it reads in the product, after the region, on the top strand (don't reverse complement it).
    A tail changes the construct: if the user did not ask for it, suggest it and ask first. Without
    `spacer_approved_by_user=true` the tool refuses to design primers with a tail and asks you to check with
    the user. Restriction sites (`left_enzyme` / `right_enzyme`) are not tails: say which ones you use.

    `target_tm` is the melting temperature of the part of the primers that binds the template, which is at
    least `minimal_annealing` bases long: the tails don't count. `settings` are the conditions of the Tm
    calculation (primer and salt concentrations); leave them out for the defaults.

    The answer has the primers with their ids, and the region that was resolved, to check with the user.
    Next run pcr with the primers, then pcr_primer_details for their Tm.
    """
    strategy = storage.load_strategy(strategy_id)
    to_confirm = spacers_to_confirm({'left_tail': left_tail, 'right_tail': right_tail}, spacer_approved_by_user)
    if to_confirm:
        return to_confirm
    template, view = get_sequence(strategy, template_id)
    resolved = view.resolve_region(region)

    body = {
        'pcr_template': {
            'sequence': template,
            # Always the plus strand: the direction is set by forward_orientation, or the API flips the region twice
            'location': str(view.location(resolved, strand=1)),
            'forward_orientation': resolved.strand == 1,
        }
    }
    if left_tail or right_tail:
        body['spacers'] = [left_tail, right_tail]
    params = {'minimal_hybridization_length': minimal_annealing, 'target_tm': target_tm, 'filler_bases': filler_bases}
    if left_enzyme:
        params['left_enzyme'] = left_enzyme
    if right_enzyme:
        params['right_enzyme'] = right_enzyme
    designed = cloning_api.post('/primer_design/simple_pair', json=with_settings(body, settings), params=params)

    suffixes = (f'{left_enzyme}_fwd' if left_enzyme else 'fwd', f'{right_enzyme}_rvs' if right_enzyme else 'rvs')
    primers = save_primers(strategy_id, designed['primers'], name_prefix or resolved.label, suffixes)
    return {
        'status': 'designed',
        'region': view.describe_region(resolved),
        'primers': primers,
        'next_step': (
            f'pcr(template_id={template_id}, forward_primer_id={primers[0]["id"]}, '
            f'reverse_primer_id={primers[1]["id"]}), then pcr_primer_details'
        ),
    }


@mcp.tool()
def design_homology_primers(
    strategy_id: str,
    insert_id: int,
    target_id: int,
    replace: Region | None = None,
    insert_at: Position | None = None,
    insert_region: Region | None = None,
    homology_length: int = 40,
    left_spacer: str = '',
    right_spacer: str = '',
    orientation: Literal['forward', 'reverse'] = 'forward',
    target_tm: float = 55.0,
    minimal_annealing: int = 18,
    name_prefix: str | None = None,
    settings: PrimerDesignSettings | None = None,
    spacer_approved_by_user: bool = False,
) -> dict:
    """Design primers to put an insert into a target by homologous recombination, and save them in the strategy.

    The primers amplify the insert (`insert_id`, e.g. a resistance cassette) and add arms of
    `homology_length` bases that match the target (`target_id`, e.g. a genomic region or a plasmid) on both
    sides of the place where the insert goes. Say where with exactly one of:
    - `replace`: a Region of the target that the insert replaces (a gene to knock out, a stop codon to
      remove for a C-terminal tag...);
    - `insert_at`: a Position of the target where the insert is added without removing anything (e.g. after
      amino acid 120 of a CDS).
    `insert_region` says which part of the insert to amplify (default: all of it, e.g. a whole cassette).

    `orientation` is "forward" if the insert should read in the same direction as the replaced region (or as
    the feature that `insert_at` is anchored on; on the + strand if there is none), "reverse" for the opposite.
    A region is read in the direction of its feature, so a cassette on the + strand of a plasmid replaces a
    gene on the - strand of a genome "forward" if the cassette is meant to read like the gene.
    `left_spacer` / `right_spacer` are extra bases (e.g. a linker or a tag in frame) between the left arm and
    the insert, and between the insert and the right arm; they read on the top strand of the target.
    A spacer or linker changes the construct: if the user did not ask for one and you think it is needed (e.g. a
    linker between a tag and a protein), suggest it and ask first. Without `spacer_approved_by_user=true` the
    tool refuses to design primers with a spacer and asks you to check with the user.

    `target_tm` is the melting temperature of the part of the primers that binds the insert, which is at
    least `minimal_annealing` bases long: the arms don't count. `settings` are the conditions of the Tm
    calculation (primer and salt concentrations); leave them out for the defaults.

    The answer has the primers (the homology arm is in lowercase) with their ids, what is replaced or where
    the insert goes, and the size that the target should have afterwards. Next run pcr on the insert with the
    primers, then pcr_primer_details for their Tm, then homologous_recombination.
    """
    if (replace is None) == (insert_at is None):
        raise ToolError('Give either replace (a region of the target to replace) or insert_at (a point to insert at).')
    strategy = storage.load_strategy(strategy_id)
    to_confirm = spacers_to_confirm(
        {'left_spacer': left_spacer, 'right_spacer': right_spacer}, spacer_approved_by_user
    )
    if to_confirm:
        return to_confirm
    insert, insert_view = get_sequence(strategy, insert_id)
    target, target_view = get_sequence(strategy, target_id)
    resolved_insert = insert_view.resolve_region(insert_region)

    if replace is not None:
        resolved_target = target_view.resolve_region(replace)
        target_strand, replaced = resolved_target.strand, resolved_target.length
        target_location = target_view.location(resolved_target, strand=1)
        target_description = {'replaces': target_view.describe_region(resolved_target)}
    else:
        point = target_view.resolve_position(insert_at)
        boundary = target_view.insertion_boundary(point)
        target_strand, replaced = point.strand or 1, 0
        target_location = target_view.insertion_location(boundary)
        target_description = {'inserts_at': target_view.describe_point(point)}

    # The insert region is always sent on the plus strand, and forward_orientation says how it goes in the target
    forward_orientation = (resolved_insert.strand == target_strand) == (orientation == 'forward')
    body = {
        'pcr_template': {
            'sequence': insert,
            'location': str(insert_view.location(resolved_insert, strand=1)),
            'forward_orientation': forward_orientation,
        },
        'homologous_recombination_target': {'sequence': target, 'location': str(target_location)},
    }
    if left_spacer or right_spacer:
        body['spacers'] = [left_spacer, right_spacer]
    params = {
        'homology_length': homology_length,
        'minimal_hybridization_length': minimal_annealing,
        'target_tm': target_tm,
    }
    designed = cloning_api.post(
        '/primer_design/homologous_recombination', json=with_settings(body, settings), params=params
    )

    primers = save_primers(
        strategy_id, designed['primers'], name_prefix or f'{resolved_insert.label}_HR', ('fwd', 'rvs')
    )
    return {
        'status': 'designed',
        'insert': insert_view.describe_region(resolved_insert),
        **target_description,
        'expected_size_after_recombination': target_view.length
        - replaced
        + resolved_insert.length
        + len(left_spacer)
        + len(right_spacer),
        'primers': primers,
        'next_step': (
            f'pcr(template_id={insert_id}, forward_primer_id={primers[0]["id"]}, reverse_primer_id={primers[1]["id"]}), '
            f'then pcr_primer_details, then homologous_recombination(template_id={target_id}, '
            f'insert_id=<the pcr product>, minimal_homology={homology_length})'
        ),
    }


# Properties of primers =======================================================================
# The numbers are the ones of the cloning API (primer3). Free energies are in cal/mol, as in the web app.


def structure(result: dict | None) -> dict | None:
    """A hairpin or dimer as the API describes it (None: none forms), without the drawing."""
    if result is None:
        return None
    return {
        'melting_temperature': round(result['melting_temperature'], 1),
        'delta_g_cal_per_mol': round(result['deltaG']),
    }


def thermodynamics(sequence: str, settings: PrimerDesignSettings | None) -> dict:
    """Tm, GC content, and the most stable hairpin and homodimer of a sequence."""
    details = cloning_api.post('/primer_details', json=with_settings({'sequence': sequence.upper()}, settings))
    return {
        'melting_temperature': round(details['melting_temperature'], 1),
        'gc_percent': round(100 * details['gc_content']),
        'hairpin': structure(details['hairpin']),
        'homodimer': structure(details['homodimer']),
    }


def heterodimer(sequence1: str, sequence2: str, settings: PrimerDesignSettings | None) -> dict | None:
    """The most stable structure formed between two primers (None: none forms)."""
    body = {'sequence1': sequence1.upper(), 'sequence2': sequence2.upper()}
    return structure(cloning_api.post('/primer_heterodimer', json=with_settings(body, settings)))


def binding_details(strategy: dict, fragment: dict, settings: PrimerDesignSettings | None) -> dict:
    """The primer of an input of a PCR step, with its tail and the properties of the part that binds the template."""
    (primer,) = storage.get_by_id(strategy, 'primers', [fragment['sequence']])
    # The step records where in the primer the template is bound, always at the 3' end: e.g. "7..26"
    location = fragment['right_location'] or fragment['left_location']
    length = len(SequenceLocationStr(location).to_biopython_location())
    sequence = primer['sequence']
    return {
        'id': primer['id'],
        'name': primer['name'],
        'sequence': sequence,
        'tail': sequence[:-length],
        'binding_part': {
            'sequence': sequence[-length:],
            'length': length,
            **thermodynamics(sequence[-length:], settings),
        },
    }


@mcp.tool()
def pcr_primer_details(strategy_id: str, sequence_id: int, settings: PrimerDesignSettings | None = None) -> dict:
    """Properties of the two primers of a PCR, once it is done (read-only, adds nothing).

    `sequence_id` is the product of a pcr step. For each primer the answer gives its `tail` (the 5' bases
    that do not bind the template: restriction site, homology arm...) and the properties of the `binding_part`
    (the 3' end that binds the template, as recorded by the PCR): melting temperature (Tm), GC content, and the
    most stable hairpin and self-dimer. The Tm of the binding part is the one that matters for the annealing
    temperature, not the one of the whole primer. It also gives the difference in Tm between the two primers
    and the most stable dimer between the whole primers. Free energies (delta_g) are in cal/mol, a structure
    is None if none forms. Show them to the user as a small table.

    Tm is calculated with primer3 under the conditions in `settings` (primer and salt concentrations;
    default 50 nM primer, 50 mM monovalent and 1.5 mM divalent cations). A polymerase vendor's calculator can
    give a Tm that is several degrees different.
    """
    strategy = storage.load_strategy(strategy_id)
    storage.get_by_id(strategy, 'sequences', [sequence_id])
    source = next(s for s in strategy['sources'] if s['id'] == sequence_id)
    if source['type'] != 'PCRSource':
        raise ToolError(f'Sequence {sequence_id} was not made by PCR (its source is a {source["type"]}).')

    forward_input, _, reverse_input = source['input']
    forward, reverse = (binding_details(strategy, fragment, settings) for fragment in (forward_input, reverse_input))
    tm_difference = forward['binding_part']['melting_temperature'] - reverse['binding_part']['melting_temperature']
    return {
        'pcr_product': sequence_id,
        'primers': [forward, reverse],
        'melting_temperature_difference': round(abs(tm_difference), 1),
        'heterodimer': heterodimer(forward['sequence'], reverse['sequence'], settings),
    }


@mcp.tool()
def primer_details(
    strategy_id: str | None = None,
    primer_ids: list[int] | None = None,
    sequences: list[str] | None = None,
    settings: PrimerDesignSettings | None = None,
) -> dict:
    """Properties of whole primers, e.g. to check primers before using them (read-only, adds nothing).

    Give primers of the strategy (`primer_ids`, with `strategy_id`) and/or plain sequences (`sequences`,
    5' to 3', no strategy needed). For each: melting temperature (Tm), GC content, and the most stable hairpin
    and self-dimer. With exactly two primers it also gives the most stable dimer between them. Free energies
    (delta_g) are in cal/mol, a structure is None if none forms. These are the properties of the whole
    sequence: once a PCR is done, pcr_primer_details gives the Tm of the part that binds the template, which
    is the one that matters when the primers have tails. `settings` are the conditions of the Tm
    calculation (primer and salt concentrations); leave them out for the defaults.
    """
    primers = []
    if primer_ids:
        if strategy_id is None:
            raise ToolError('strategy_id is needed with primer_ids.')
        stored = storage.get_by_id(storage.load_strategy(strategy_id), 'primers', primer_ids)
        primers = [(primer['name'], primer['sequence']) for primer in stored]
    for number, sequence in enumerate(sequences or [], 1):
        sequence = ''.join(sequence.split())
        if not re.fullmatch('[ACGTacgt]+', sequence):
            raise ToolError(f'Sequence {number} can only contain the letters A, C, G and T.')
        primers.append((f'sequence_{number}', sequence))
    if not primers:
        raise ToolError('Give primer_ids or sequences.')

    result = {
        'primers': [
            {'name': name, 'sequence': sequence, 'length': len(sequence), **thermodynamics(sequence, settings)}
            for name, sequence in primers
        ]
    }
    if len(primers) == 2:
        result['heterodimer'] = heterodimer(primers[0][1], primers[1][1], settings)
    return result
