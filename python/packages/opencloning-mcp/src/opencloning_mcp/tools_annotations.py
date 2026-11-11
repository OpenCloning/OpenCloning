"""Tools to change the annotations (features) of a sequence of the strategy.

The change is made in place: the stored GenBank text of the sequence gets the new features, and the strategy
records no step for it. The bases of the sequence never change. Where a feature goes is described with the
Region of regions.py, and the strand arithmetic is done there.
"""

from Bio.Seq import Seq
from Bio.SeqFeature import CompoundLocation, SeqFeature, SimpleLocation
from mcp.server.mcpserver.exceptions import ToolError
from opencloning.dna_functions import format_sequence_genbank

from . import storage
from .app import mcp
from .regions import Feature, Region, SequenceView
from .tools_primers import get_sequence


def save_features(strategy_id: str, sequence_id: int, view: SequenceView) -> SequenceView:
    """Store the sequence with the features of its record, and return a view of the stored version."""
    new_sequence = format_sequence_genbank(view.record).model_dump()
    storage.replace_sequence(strategy_id, sequence_id, new_sequence)
    return SequenceView({**new_sequence, 'id': sequence_id})


def resize(strategy_id: str, sequence_id: int, view: SequenceView, feature: Feature, upstream: int, downstream: int):
    """Move the ends of a feature, and return how it looked before and after."""
    parts = feature.resized_parts(upstream, downstream)
    if min(start for start, _ in parts) < 0 or max(end for _, end in parts) > view.length:
        raise ToolError(
            f'The feature would go beyond the ends of {view.name} ({view.length} bp). '
            'Features cannot be extended through the origin of a circular sequence.'
        )
    locations = [SimpleLocation(start, end, strand=feature.strand) for start, end in parts]
    record_feature = view.record.features[feature.index]
    record_feature.location = locations[0] if len(locations) == 1 else CompoundLocation(locations)
    # A stored translation would not match the new feature
    record_feature.qualifiers.pop('translation', None)
    new_view = save_features(strategy_id, sequence_id, view)
    after = next(f for f in new_view.features if f.index == feature.index)
    return {'before': feature.describe(), 'after': after.describe()}


def feature_location(view: SequenceView, region: Region | None, parts: list[Region] | None):
    """The Biopython location of a new feature: one region, or several regions joined (e.g. the exons of a CDS)."""
    if (region is None) == (parts is None):
        raise ToolError(
            'Give exactly one of `region` (a feature in one piece) and `parts` '
            '(a feature in several pieces, e.g. the exons of a CDS).'
        )
    if parts is not None and len(parts) < 2:
        raise ToolError('`parts` needs at least two regions: use `region` for a feature in one piece.')
    locations = []
    for part in [region] if parts is None else parts:
        locations.extend(view.location(view.resolve_region(part)).to_biopython_location().parts)
    if len(locations) == 1:
        return locations[0]
    if len({location.strand for location in locations}) > 1:
        raise ToolError('All the parts of a feature must be on the same strand.')
    strand = locations[0].strand
    # On a circular sequence a part can go through the origin, so the order is only checked on linear ones
    in_order = view.circular or all(
        (current.start >= previous.end) if strand == 1 else (current.end <= previous.start)
        for previous, current in zip(locations, locations[1:])
    )
    if not in_order:
        raise ToolError(
            'The parts must not overlap, and must be listed in the direction the feature is read: '
            'from low to high coordinates on the plus strand, from high to low on the minus strand.'
        )
    return CompoundLocation(locations)


@mcp.tool()
def add_feature(
    strategy_id: str,
    sequence_id: int,
    name: str,
    region: Region | None = None,
    parts: list[Region] | None = None,
    feature_type: str = 'misc_feature',
) -> dict:
    """Annotate a region of a sequence with a new feature, e.g. a CDS, a tag or a promoter.

    Say where the feature goes with exactly one of:
    - `region`: a feature in one piece, with the strand it is read on (see Region: a feature with bases upstream
      or downstream, bases from..to, or between two points, e.g. the amino acids 1 to 120 of a CDS);
    - `parts`: a feature in several pieces, e.g. the exons of a CDS, or a CDS fused to a tag that is not next to
      it. List the regions in the direction the feature is read (on the minus strand, from the highest
      coordinates to the lowest). They must be on the same strand and not overlap. The bases between the parts
      (introns, other features) are not part of the feature.
    The type is a GenBank feature key: "CDS", "gene", "promoter", "misc_feature"... For a CDS the answer has
    the length of the protein and whether it ends with a stop codon, to check that the parts are in frame. The
    bases of the sequence do not change. The change is made on the sequence itself, not as a new sequence in
    the strategy.
    """
    strategy = storage.load_strategy(strategy_id)
    _, view = get_sequence(strategy, sequence_id)
    location = feature_location(view, region, parts)
    view.record.features.append(SeqFeature(location, type=feature_type, qualifiers={'label': [name]}))
    new_view = save_features(strategy_id, sequence_id, view)
    return {'added': new_view.feature_row(new_view.features[-1])}


@mcp.tool()
def remove_features(
    strategy_id: str, sequence_id: int, feature: str | None = None, feature_type: str | None = None
) -> dict:
    """Remove annotations from a sequence, by name, by type, or both (the bases do not change).

    - `feature` alone: the one feature with that name, or "#<index>" with the index from list_features. It must
      match exactly one feature: if a gene and its CDS share the name, add `feature_type`.
    - `feature_type` alone: ALL the features of that type, e.g. "misc_feature". Check with list_features first.
    The answer lists what was removed. The indexes of list_features change after a removal. The change is made
    on the sequence itself, not as a new sequence in the strategy.
    """
    strategy = storage.load_strategy(strategy_id)
    _, view = get_sequence(strategy, sequence_id)
    if feature:
        chosen = [view.find_feature(feature, feature_type)]
    elif feature_type:
        chosen = view.filter_features(feature_type=feature_type)
    else:
        raise ToolError('Give a feature (a name or "#index"), a feature_type, or both.')
    if not chosen:
        raise ToolError(f'{view.name} has no feature of type {feature_type}.')
    removed = {f.index for f in chosen}
    view.record.features = [f for index, f in enumerate(view.record.features) if index not in removed]
    new_view = save_features(strategy_id, sequence_id, view)
    return {'removed': [f.describe() for f in chosen], 'features_left': len(new_view.features)}


@mcp.tool()
def resize_feature(
    strategy_id: str,
    sequence_id: int,
    feature: str,
    feature_type: str | None = None,
    upstream: int = 0,
    downstream: int = 0,
) -> dict:
    """Move the start and/or the end of a feature (the bases do not change). Works on both strands.

    `upstream` and `downstream` are in the direction of the feature, like in Region: positive adds bases
    before its start / after its end, negative removes them (e.g. downstream=-3 removes the last 3 bases, which
    on the minus strand are at the lowest coordinates). Exons are kept: the bases are removed across them.
    To remove the stop codon of a CDS, use remove_stop_codon, which checks it first. Other features that
    cover the same bases (the gene, the mRNA) are not changed: resize them too if needed. The change is made
    on the sequence itself, not as a new sequence in the strategy.
    """
    strategy = storage.load_strategy(strategy_id)
    _, view = get_sequence(strategy, sequence_id)
    return resize(strategy_id, sequence_id, view, view.find_feature(feature, feature_type), upstream, downstream)


@mcp.tool()
def remove_stop_codon(strategy_id: str, sequence_id: int, feature: str, feature_type: str | None = 'CDS') -> dict:
    """Make a CDS stop before its stop codon, e.g. to fuse a C-terminal tag (the bases do not change).

    It first checks that the last 3 bases of the CDS, read in its direction (both strands, exons included),
    are a stop codon in its genetic code, and does nothing otherwise. Then it shortens the CDS by 3 bases. The
    gene and mRNA features that cover the stop codon are not changed: use resize_feature for them. Use
    design_homology_primers with `replace` to also remove the stop codon from the DNA. The change is made on the
    sequence itself, not as a new sequence in the strategy.
    """
    strategy = storage.load_strategy(strategy_id)
    _, view = get_sequence(strategy, sequence_id)
    cds = view.find_feature(feature, feature_type)
    if cds.type != 'CDS':
        raise ToolError(f'{cds.describe()} is a {cds.type}, not a CDS.')
    codon = view.transcript(cds)[-3:]
    if str(Seq(codon).translate(table=cds.genetic_code)) != '*':
        raise ToolError(f'The last codon of {cds.describe()} is {codon}, which is not a stop codon: nothing changed.')
    return {**resize(strategy_id, sequence_id, view, cds, 0, -3), 'stop_codon_removed': codon}
