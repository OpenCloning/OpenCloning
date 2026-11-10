"""The region resolver: pure functions on sequences built in the tests, with no MCP client or cloning API."""

import pytest
from Bio.Seq import reverse_complement
from Bio.SeqFeature import CompoundLocation, SeqFeature, SimpleLocation
from mcp.server.mcpserver.exceptions import ToolError
from opencloning.dna_functions import format_sequence_genbank
from pydantic import ValidationError
from pydna.dseqrecord import Dseqrecord

from opencloning_mcp.regions import Position, Region, SequenceView

# M A G S K L V *
CDS = 'ATGGCTGGATCTAAACTGGTTTAA'
# The same CDS split in two exons: ATGGCT | GGATCTAAACTGGTTTAA
EXON1, INTRON, EXON2 = 'ATGGCT', 'GTAAGTTTTTAG', 'GGATCTAAACTGGTTTAA'


def view_of(seq: str, features: list[SeqFeature], circular: bool = False) -> SequenceView:
    record = Dseqrecord(seq, circular=circular)
    record.name = 'test'
    record.features = features
    sequence = format_sequence_genbank(record)
    sequence.id = 1
    return SequenceView(sequence.model_dump())


def cds(location, **qualifiers) -> SeqFeature:
    return SeqFeature(location, type='CDS', qualifiers={'label': ['cdc2'], **qualifiers})


@pytest.fixture
def plus() -> SequenceView:
    """T*10, the CDS on the plus strand at [10, 34), C*10."""
    return view_of('T' * 10 + CDS + 'C' * 10, [cds(SimpleLocation(10, 34, strand=1))])


@pytest.fixture
def minus() -> SequenceView:
    """The same CDS, on the minus strand at [10, 34)."""
    return view_of('T' * 10 + reverse_complement(CDS) + 'C' * 10, [cds(SimpleLocation(10, 34, strand=-1))])


def region(view: SequenceView, **kwargs):
    return view.resolve_region(Region(**kwargs))


def point(view: SequenceView, **kwargs):
    return view.resolve_position(Position(**kwargs))


# Features ===================================================================================


def test_a_feature_is_a_region_in_its_own_direction(plus, minus):
    resolved = region(plus, feature='cdc2')
    assert (resolved.left, resolved.length, resolved.strand) == (10, 24, 1)
    assert str(plus.location(resolved)) == '11..34'
    assert plus.region_sequence(resolved) == CDS

    resolved = region(minus, feature='CDC2')
    assert (resolved.left, resolved.length, resolved.strand) == (10, 24, -1)
    assert str(minus.location(resolved)) == 'complement(11..34)'
    assert minus.region_sequence(resolved) == CDS


def test_upstream_and_downstream_follow_the_strand_of_the_feature(plus, minus):
    resolved = region(plus, feature='cdc2', upstream=5, downstream=-3)
    assert (resolved.left, resolved.length) == (5, 26)
    assert plus.region_sequence(resolved) == 'TTTTT' + CDS[:-3]

    # On the minus strand upstream is towards the higher coordinates, and it reads as the gene does
    resolved = region(minus, feature='cdc2', upstream=5, downstream=-3)
    assert (resolved.left, resolved.length, resolved.strand) == (13, 26, -1)
    assert minus.region_sequence(resolved) == 'GGGGG' + CDS[:-3]


def test_describe_region_of_a_cds_shows_the_protein(plus):
    description = plus.describe_region(region(plus, feature='cdc2'))
    assert description['location'] == '11..34'
    assert description['protein'] == 'MAGSKLV* (7 aa)'
    assert description['first_bases'] == CDS[:12]
    assert description['last_bases'] == CDS[-12:]


def test_a_feature_is_found_by_any_name_by_substring_or_by_index():
    view = view_of(
        'T' * 10 + CDS + 'C' * 10,
        [
            SeqFeature(
                SimpleLocation(10, 34, strand=1), type='CDS', qualifiers={'gene': ['cdc2'], 'product': ['kinase']}
            ),
            SeqFeature(SimpleLocation(0, 5, strand=1), type='misc_feature', qualifiers={'label': ['hphMX6 cassette']}),
        ],
    )
    assert view.find_feature('kinase').index == 0
    assert view.find_feature('hph').index == 1  # a substring, because no name matches exactly
    assert view.find_feature('#1').type == 'misc_feature'


def test_a_name_that_matches_several_features_must_be_disambiguated():
    features = [
        SeqFeature(SimpleLocation(10, 34, strand=1), type='gene', qualifiers={'label': ['cdc2']}),
        cds(SimpleLocation(10, 34, strand=1)),
    ]
    view = view_of('T' * 10 + CDS + 'C' * 10, features)
    with pytest.raises(ToolError, match='matches 2 features.*feature_type'):
        view.find_feature('cdc2')
    assert view.find_feature('cdc2', 'CDS').type == 'CDS'
    assert view.find_feature('cdc2', 'gene').type == 'gene'


def test_an_unknown_feature_lists_the_features(plus):
    with pytest.raises(ToolError, match='No feature matches "nope".*#0 CDS cdc2 11..34'):
        plus.find_feature('nope')


# Amino acids ================================================================================


def test_after_amino_acid_on_the_plus_strand(plus):
    resolved = point(plus, feature='cdc2', after_aa=2)
    assert resolved.boundary == 16
    description = plus.describe_point(resolved)
    assert description['between_amino_acids'] == 'A2|G3'
    assert description['between_bases'] == '16|17'
    assert description['context'] == 'TTTTTT' + 'ATGGCT' + '|' + 'GGATCTAAACTG'

    assert point(plus, feature='cdc2', after_aa=0).boundary == 10
    assert plus.describe_point(point(plus, feature='cdc2', after_aa=0))['between_amino_acids'] == 'start|M1'
    assert point(plus, feature='cdc2', after_aa=8).boundary == 34  # after the stop codon


def test_after_amino_acid_on_the_minus_strand(minus):
    resolved = point(minus, feature='cdc2', after_aa=2)
    assert resolved.boundary == 28
    description = minus.describe_point(resolved)
    # The context is read in the direction of the gene
    assert description['context'] == 'GGGGGG' + 'ATGGCT' + '|' + 'GGATCTAAACTG'
    assert description['between_amino_acids'] == 'A2|G3'


def test_after_amino_acid_in_a_cds_with_an_intron():
    genomic = 'T' * 10 + EXON1 + INTRON + EXON2 + 'C' * 10
    location = CompoundLocation([SimpleLocation(10, 16, strand=1), SimpleLocation(28, 46, strand=1)])
    view = view_of(genomic, [cds(location)])
    # Codon 2 ends exactly where the first exon ends: the point goes before the intron
    assert point(view, feature='cdc2', after_aa=2).boundary == 16
    # Codon 3 is in the second exon
    assert point(view, feature='cdc2', after_aa=3).boundary == 31
    assert view.describe_point(point(view, feature='cdc2', after_aa=3))['between_amino_acids'] == 'G3|S4'
    # The region of the feature includes the intron, and the listing says so
    assert region(view, feature='cdc2').length == 36
    row = view.feature_row(view.features[0])
    assert (row['exons'], row['protein_aa'], row['ends_with_stop_codon']) == (2, 7, True)

    # The same gene on the minus strand: every coordinate is mirrored
    genomic_minus = reverse_complement(genomic)
    location = CompoundLocation([SimpleLocation(40, 46, strand=-1), SimpleLocation(10, 28, strand=-1)])
    view = view_of(genomic_minus, [cds(location)])
    assert point(view, feature='cdc2', after_aa=2).boundary == 40
    assert point(view, feature='cdc2', after_aa=3).boundary == 25
    assert view.describe_point(point(view, feature='cdc2', after_aa=3))['between_amino_acids'] == 'G3|S4'


def test_after_amino_acid_respects_codon_start():
    view = view_of('T' * 10 + 'C' + CDS + 'C' * 10, [cds(SimpleLocation(10, 35, strand=1), codon_start=['2'])])
    resolved = point(view, feature='cdc2', after_aa=2)
    assert resolved.boundary == 17
    assert view.describe_point(resolved)['between_amino_acids'] == 'A2|G3'


def test_after_amino_acid_errors(plus):
    with pytest.raises(ToolError, match='has 8 codons'):
        point(plus, feature='cdc2', after_aa=50)

    view = view_of(
        'T' * 10 + CDS + 'C' * 10,
        [SeqFeature(SimpleLocation(10, 34, strand=1), type='gene', qualifiers={'label': ['g']})],
    )
    with pytest.raises(ToolError, match='needs a CDS'):
        point(view, feature='g', after_aa=2)


# Regions between points =====================================================================


def test_a_region_between_two_amino_acids(plus):
    resolved = region(plus, start=Position(feature='cdc2', after_aa=2), end=Position(feature='cdc2', after_aa=5))
    assert plus.region_sequence(resolved) == 'GGATCTAAACTG'[:9]
    assert str(plus.location(resolved)) == '17..25'


def test_the_promoter_between_two_features():
    gene_a = SeqFeature(SimpleLocation(5, 15, strand=1), type='CDS', qualifiers={'label': ['A']})
    gene_b = SeqFeature(SimpleLocation(40, 50, strand=1), type='CDS', qualifiers={'label': ['B']})
    view = view_of('ACGT' * 15, [gene_a, gene_b])
    resolved = region(view, start=Position(feature='A', edge='end'), end=Position(feature='B', edge='start'))
    assert (resolved.left, resolved.length) == (15, 25)


def test_a_region_upstream_of_the_start_codon_as_a_fragment(minus):
    resolved = region(
        minus,
        start=Position(feature='cdc2', edge='start', offset=-8),
        end=Position(feature='cdc2', edge='start'),
    )
    # The strand comes from the feature
    assert resolved.strand == -1
    assert (resolved.left, resolved.length) == (34, 8)
    assert minus.region_sequence(resolved) == 'G' * 8


def test_a_minus_strand_region_between_coordinates_runs_from_the_high_to_the_low_one(plus):
    resolved = region(plus, start=Position(after_base=30), end=Position(after_base=10), strand='-')
    assert (resolved.left, resolved.length, resolved.strand) == (10, 20, -1)
    with pytest.raises(ToolError, match='not after its start.*minus'):
        region(plus, start=Position(after_base=10), end=Position(after_base=30), strand='-')
    with pytest.raises(ToolError, match='not after its start'):
        region(plus, start=Position(after_base=30), end=Position(after_base=10))


def test_from_base_to_base(plus):
    resolved = region(plus, from_base=11, to_base=34)
    assert (resolved.left, resolved.length, resolved.strand) == (10, 24, 1)
    assert region(plus, from_base=11, to_base=34, strand='-').strand == -1
    with pytest.raises(ToolError, match='do not fit'):
        region(plus, from_base=11, to_base=100)
    with pytest.raises(ToolError, match='do not fit'):
        region(plus, from_base=30, to_base=11)


def test_linear_sequences_have_ends(plus):
    with pytest.raises(ToolError, match='before the start of test'):
        region(plus, feature='cdc2', upstream=20)
    with pytest.raises(ToolError, match='after the end of test'):
        region(plus, feature='cdc2', downstream=20)
    with pytest.raises(ToolError, match='would be empty'):
        region(plus, feature='cdc2', downstream=-24)


def test_the_whole_sequence_is_the_default(plus):
    resolved = plus.resolve_region(None)
    assert (resolved.left, resolved.length, resolved.strand) == (0, 44, 1)


# Circular sequences =========================================================================


@pytest.fixture
def wrapped() -> SequenceView:
    """Circular: the first 12 bases of the CDS are at [32, 44), the rest at [0, 12)."""
    location = CompoundLocation([SimpleLocation(32, 44, strand=1), SimpleLocation(0, 12, strand=1)])
    return view_of(CDS[12:] + 'T' * 20 + CDS[:12], [cds(location)], circular=True)


def test_a_feature_through_the_origin(wrapped):
    resolved = region(wrapped, feature='cdc2')
    assert (resolved.left, resolved.length) == (32, 24)
    assert str(wrapped.location(resolved)) == 'join(33..44,1..12)'
    assert wrapped.region_sequence(resolved) == CDS

    resolved = region(wrapped, feature='cdc2', upstream=5)
    assert (resolved.left, resolved.length) == (27, 29)
    assert wrapped.region_sequence(resolved) == 'TTTTT' + CDS

    resolved = point(wrapped, feature='cdc2', after_aa=5)
    assert resolved.boundary == 3
    assert wrapped.describe_point(resolved)['between_amino_acids'] == 'K5|L6'


def test_regions_can_go_through_the_origin_on_circular_sequences(wrapped):
    resolved = region(wrapped, from_base=40, to_base=5)
    assert (resolved.left, resolved.length) == (39, 10)
    assert str(wrapped.location(resolved)) == 'join(40..44,1..5)'
    resolved = region(wrapped, feature='cdc2', upstream=10)
    assert (resolved.left, resolved.length) == (22, 34)


def test_a_region_cannot_be_longer_than_the_circular_sequence(wrapped):
    with pytest.raises(ToolError, match='longer than the circular sequence'):
        region(wrapped, feature='cdc2', upstream=30)


# Points to insert at ========================================================================


def test_insertion_points(plus, wrapped):
    assert plus.insertion_boundary(point(plus, after_base=20)) == 20
    for boundary in (0, 44):
        with pytest.raises(ToolError, match='outside test or at its very end'):
            plus.insertion_boundary(point(plus, after_base=boundary))
    with pytest.raises(ToolError, match='origin'):
        wrapped.insertion_boundary(point(wrapped, after_base=0))
    assert wrapped.insertion_boundary(point(wrapped, after_base=3)) == 3
    # Going past the end of a circular sequence wraps around
    assert wrapped.insertion_boundary(point(wrapped, after_base=44, offset=3)) == 3


# The models the tools receive ===============================================================


@pytest.mark.parametrize(
    'kwargs',
    [
        {},
        {'feature': 'x'},
        {'feature': 'x', 'edge': 'start', 'after_aa': 1},
        {'feature': 'x', 'edge': 'start', 'after_base': 1},
        {'after_base': 1, 'edge': 'start'},
        {'after_base': 1, 'feature_type': 'CDS'},
    ],
)
def test_invalid_positions(kwargs):
    with pytest.raises(ValidationError):
        Position(**kwargs)


@pytest.mark.parametrize(
    'kwargs',
    [
        {},
        {'feature': 'x', 'from_base': 1, 'to_base': 2},
        {'feature': 'x', 'strand': '+'},
        {'from_base': 1},
        {'from_base': 1, 'to_base': 2, 'upstream': 5},
        {'start': Position(after_base=1)},
    ],
)
def test_invalid_regions(kwargs):
    with pytest.raises(ValidationError):
        Region(**kwargs)
