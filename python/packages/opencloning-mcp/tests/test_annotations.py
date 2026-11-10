"""Tools that change the annotations of a sequence, called through an in-memory MCP client."""

import json

import pytest
from Bio.Seq import Seq, reverse_complement
from Bio.SeqFeature import CompoundLocation, SeqFeature, SimpleLocation
from mcp import Client
from opencloning.dna_functions import format_sequence_genbank
from pydna.dseqrecord import Dseqrecord

# M A G S K L V *
CDS = 'ATGGCTGGATCTAAACTGGTTTAA'
# The same CDS in two exons, the second one with the stop codon cut in two: ATGGCTGGATCTAAACTGGTT | TAA
EXON1, INTRON, EXON2 = 'ATGGCTGGATCTAAACTGGTTT', 'GTAAGTTTTTAG', 'AA'


async def call(client: Client, tool: str, **arguments) -> dict:
    result = await client.call_tool(tool, arguments)
    assert not result.is_error, result.content[0].text
    return json.loads(result.content[0].text)


async def call_error(client: Client, tool: str, **arguments) -> str:
    result = await client.call_tool(tool, arguments)
    assert result.is_error
    return result.content[0].text


def feature(location, label='cdc2', type='CDS') -> SeqFeature:
    return SeqFeature(location, type=type, qualifiers={'label': [label]})


async def add_sequence(
    client: Client, seq: str, features: list[SeqFeature], circular: bool = False
) -> tuple[str, int]:
    strategy_id = (await call(client, 'start_strategy'))['strategy_id']
    record = Dseqrecord(seq, circular=circular)
    record.name = 'test'
    record.features = features
    result = await call(
        client,
        'add_sequence_from_file',
        strategy_id=strategy_id,
        file_name='test.gb',
        file_content=format_sequence_genbank(record).file_content,
    )
    return strategy_id, result['sequence']['id']


async def features_of(client: Client, strategy_id: str, sequence_id: int, **kwargs) -> list[dict]:
    return (await call(client, 'list_features', strategy_id=strategy_id, sequence_id=sequence_id, **kwargs))[
        'features'
    ]


@pytest.mark.anyio
async def test_remove_the_stop_codon_on_the_plus_strand(client: Client):
    strategy_id, sequence_id = await add_sequence(
        client, 'T' * 10 + CDS + 'C' * 10, [feature(SimpleLocation(10, 34, strand=1))]
    )
    result = await call(client, 'remove_stop_codon', strategy_id=strategy_id, sequence_id=sequence_id, feature='cdc2')
    assert result['stop_codon_removed'] == 'TAA'
    assert result['before'].endswith('11..34') and result['after'].endswith('11..31')

    (row,) = await features_of(client, strategy_id, sequence_id)
    assert (row['location'], row['length'], row['protein_aa'], row['ends_with_stop_codon']) == ('11..31', 21, 7, False)
    # The bases did not change
    located = await call(
        client,
        'locate_region',
        strategy_id=strategy_id,
        sequence_id=sequence_id,
        region={'from_base': 1, 'to_base': 44},
    )
    assert located['region']['length'] == 44

    # The CDS no longer ends with a stop codon, so doing it again is refused and changes nothing
    error = await call_error(
        client, 'remove_stop_codon', strategy_id=strategy_id, sequence_id=sequence_id, feature='cdc2'
    )
    assert 'not a stop codon' in error
    assert (await features_of(client, strategy_id, sequence_id))[0]['location'] == '11..31'


@pytest.mark.anyio
async def test_remove_the_stop_codon_on_the_minus_strand(client: Client):
    strategy_id, sequence_id = await add_sequence(
        client, 'T' * 10 + reverse_complement(CDS) + 'C' * 10, [feature(SimpleLocation(10, 34, strand=-1))]
    )
    result = await call(client, 'remove_stop_codon', strategy_id=strategy_id, sequence_id=sequence_id, feature='cdc2')
    # The stop codon is read at the low coordinates of the minus strand
    assert result['stop_codon_removed'] == 'TAA'
    (row,) = await features_of(client, strategy_id, sequence_id)
    assert row['location'] == 'complement(14..34)'
    assert (row['protein_aa'], row['ends_with_stop_codon']) == (7, False)


@pytest.mark.anyio
@pytest.mark.parametrize('on_minus_strand', [False, True])
async def test_remove_the_stop_codon_that_is_split_between_two_exons(client: Client, on_minus_strand):
    genomic = 'T' * 10 + EXON1 + INTRON + EXON2 + 'C' * 10  # exons at [10, 32) and [44, 46)
    if on_minus_strand:
        length = len(genomic)
        location = CompoundLocation(
            [SimpleLocation(length - 32, length - 10, -1), SimpleLocation(length - 46, length - 44, -1)]
        )
        genomic = reverse_complement(genomic)
    else:
        location = CompoundLocation([SimpleLocation(10, 32, 1), SimpleLocation(44, 46, 1)])
    strategy_id, sequence_id = await add_sequence(client, genomic, [feature(location)])
    result = await call(client, 'remove_stop_codon', strategy_id=strategy_id, sequence_id=sequence_id, feature='cdc2')
    assert result['stop_codon_removed'] == 'TAA'
    (row,) = await features_of(client, strategy_id, sequence_id)
    # The second exon was only the end of the stop codon: it is gone, and the first one lost its last base
    assert 'exons' not in row and row['length'] == 21
    assert row['location'] == (
        'complement(%d..%d)' % (len(genomic) - 30, len(genomic) - 10) if on_minus_strand else '11..31'
    )
    assert (row['protein_aa'], row['ends_with_stop_codon']) == (7, False)


@pytest.mark.anyio
async def test_remove_the_stop_codon_errors(client: Client):
    strategy_id, sequence_id = await add_sequence(
        client,
        'T' * 10 + CDS[:-3] + 'GGG' + 'C' * 10,
        [feature(SimpleLocation(10, 34, 1)), feature(SimpleLocation(10, 34, 1), type='gene')],
    )
    common = {'strategy_id': strategy_id, 'sequence_id': sequence_id}
    assert 'GGG, which is not a stop codon' in await call_error(client, 'remove_stop_codon', **common, feature='cdc2')
    assert 'not a CDS' in await call_error(client, 'remove_stop_codon', **common, feature='cdc2', feature_type='gene')
    assert 'No feature' in await call_error(client, 'remove_stop_codon', **common, feature='nope')


@pytest.mark.anyio
async def test_resize_a_feature_on_both_strands(client: Client):
    strategy_id, sequence_id = await add_sequence(
        client,
        'T' * 10 + CDS + 'C' * 10 + 'G' * 20 + reverse_complement(CDS) + 'A' * 10,
        [feature(SimpleLocation(10, 34, 1), 'plus'), feature(SimpleLocation(64, 88, -1), 'minus')],
    )
    common = {'strategy_id': strategy_id, 'sequence_id': sequence_id}
    # 5 bases more upstream, 3 fewer downstream
    for name, expected in (('plus', '6..31'), ('minus', 'complement(68..93)')):
        await call(client, 'resize_feature', **common, feature=name, upstream=5, downstream=-3)
        assert (await features_of(client, strategy_id, sequence_id, query=name))[0]['location'] == expected

    # Features cannot go beyond the sequence
    error = await call_error(client, 'resize_feature', **common, feature='plus', upstream=50)
    assert 'beyond the ends of test' in error
    assert 'shorter than the bases to remove' in await call_error(
        client, 'resize_feature', **common, feature='plus', downstream=-100
    )
    assert (await features_of(client, strategy_id, sequence_id, query='plus'))[0]['location'] == '6..31'


@pytest.mark.anyio
async def test_add_features_by_region(client: Client):
    strategy_id, sequence_id = await add_sequence(
        client, 'T' * 10 + CDS + 'C' * 10, [feature(SimpleLocation(10, 34, 1))]
    )
    common = {'strategy_id': strategy_id, 'sequence_id': sequence_id}
    # The first 3 amino acids of the CDS, as a feature of its own
    added = await call(
        client,
        'add_feature',
        **common,
        name='N-term',
        feature_type='misc_feature',
        region={'start': {'feature': 'cdc2', 'edge': 'start'}, 'end': {'feature': 'cdc2', 'after_aa': 3}},
    )
    assert (added['added']['name'], added['added']['location'], added['added']['length']) == ('N-term', '11..19', 9)

    await call(client, 'add_feature', **common, name='tag', region={'from_base': 1, 'to_base': 9, 'strand': '-'})
    rows = await features_of(client, strategy_id, sequence_id)
    assert [(r['name'], r['location']) for r in rows] == [
        ('cdc2', '11..34'),
        ('N-term', '11..19'),
        ('tag', 'complement(1..9)'),
    ]
    # The new feature can be used to place other things
    located = await call(client, 'locate_region', **common, region={'feature': 'N-term'})
    assert located['region']['first_bases'] == CDS[:9]


@pytest.mark.anyio
@pytest.mark.parametrize('on_minus_strand', [False, True])
async def test_add_a_feature_in_several_parts(client: Client, on_minus_strand):
    # The two exons of a CDS (M A G S K L V *), with an intron in between
    genomic = 'T' * 10 + EXON1 + INTRON + EXON2 + 'C' * 10
    strand = '-' if on_minus_strand else '+'
    if on_minus_strand:
        length = len(genomic)
        genomic = reverse_complement(genomic)
        exon1 = {'from_base': length - 31, 'to_base': length - 10, 'strand': strand}
        exon2 = {'from_base': length - 46 + 1, 'to_base': length - 44, 'strand': strand}
    else:
        exon1 = {'from_base': 11, 'to_base': 32, 'strand': strand}
        exon2 = {'from_base': 45, 'to_base': 46, 'strand': strand}
    strategy_id, sequence_id = await add_sequence(client, genomic, [])
    common = {'strategy_id': strategy_id, 'sequence_id': sequence_id}

    added = (await call(client, 'add_feature', **common, name='cdc2', feature_type='CDS', parts=[exon1, exon2]))[
        'added'
    ]
    assert added['exons'] == 2 and added['length'] == 24
    assert (added['protein_aa'], added['ends_with_stop_codon']) == (7, True)
    # GenBank writes the parts of a minus-strand feature in ascending order, but it is still read from 25..46 first
    assert added['location'] == ('complement(join(11..12,25..46))' if on_minus_strand else 'join(11..32,45..46)')


@pytest.mark.anyio
async def test_add_a_feature_with_parts_between_features(client: Client):
    # A CDS and a tag far from each other become one feature, built from the places of other features
    strategy_id, sequence_id = await add_sequence(
        client,
        'T' * 10 + CDS[:-3] + 'C' * 20 + CDS + 'A' * 10,
        [feature(SimpleLocation(10, 31, 1), 'a'), feature(SimpleLocation(51, 75, 1), 'b')],
    )
    common = {'strategy_id': strategy_id, 'sequence_id': sequence_id}
    added = (
        await call(
            client,
            'add_feature',
            **common,
            name='fusion',
            feature_type='CDS',
            parts=[{'feature': 'a'}, {'feature': 'b', 'upstream': -3}],
        )
    )['added']
    assert (added['location'], added['length']) == ('join(11..31,55..75)', 42)
    # MAGSKLV from the first part, then the second one without its ATG: GSKLV... in frame, up to its stop codon
    assert added['protein_aa'] == 13 and added['ends_with_stop_codon'] is True


@pytest.mark.anyio
async def test_add_feature_parts_errors(client: Client):
    strategy_id, sequence_id = await add_sequence(client, 'T' * 10 + CDS + 'C' * 10, [])
    common = {'strategy_id': strategy_id, 'sequence_id': sequence_id, 'name': 'x'}
    one, two = {'from_base': 1, 'to_base': 5}, {'from_base': 20, 'to_base': 25}
    assert 'exactly one of' in await call_error(client, 'add_feature', **common)
    assert 'exactly one of' in await call_error(client, 'add_feature', **common, region=one, parts=[one, two])
    assert 'at least two' in await call_error(client, 'add_feature', **common, parts=[one])
    # Parts in the wrong order, overlapping, or on different strands
    assert 'must not overlap' in await call_error(client, 'add_feature', **common, parts=[two, one])
    assert 'must not overlap' in await call_error(
        client, 'add_feature', **common, parts=[one, {'from_base': 5, 'to_base': 9}]
    )
    assert 'same strand' in await call_error(client, 'add_feature', **common, parts=[one, {**two, 'strand': '-'}])
    assert await features_of(client, strategy_id, sequence_id) == []


@pytest.mark.anyio
async def test_remove_features_by_name_by_type_and_by_index(client: Client):
    strategy_id, sequence_id = await add_sequence(
        client,
        'T' * 10 + CDS + 'C' * 10,
        [
            feature(SimpleLocation(10, 34, 1), 'cdc2', 'gene'),
            feature(SimpleLocation(10, 34, 1), 'cdc2', 'CDS'),
            feature(SimpleLocation(0, 5, 1), 'a', 'misc_feature'),
            feature(SimpleLocation(5, 9, 1), 'b', 'misc_feature'),
        ],
    )
    common = {'strategy_id': strategy_id, 'sequence_id': sequence_id}
    assert 'matches 2 features' in await call_error(client, 'remove_features', **common, feature='cdc2')
    assert 'Give a feature' in await call_error(client, 'remove_features', **common)
    assert 'no feature of type promoter' in await call_error(
        client, 'remove_features', **common, feature_type='promoter'
    )

    result = await call(client, 'remove_features', **common, feature='cdc2', feature_type='gene')
    assert result['removed'] == ['#0 gene cdc2 11..34'] and result['features_left'] == 3
    result = await call(client, 'remove_features', **common, feature_type='misc_feature')
    assert len(result['removed']) == 2 and result['features_left'] == 1
    assert [(r['type'], r['name']) for r in await features_of(client, strategy_id, sequence_id)] == [('CDS', 'cdc2')]


@pytest.mark.anyio
async def test_the_strategy_stays_valid_and_the_annotated_sequence_can_be_used(client: Client):
    from fastapi.testclient import TestClient

    from opencloning_mcp import cloning_api
    from opencloning_mcp.server import mcp

    strategy_id, sequence_id = await add_sequence(
        client, 'T' * 10 + CDS + 'C' * 10, [feature(SimpleLocation(10, 34, 1))], circular=True
    )
    await call(client, 'remove_stop_codon', strategy_id=strategy_id, sequence_id=sequence_id, feature='cdc2')
    await call(
        client,
        'add_feature',
        strategy_id=strategy_id,
        sequence_id=sequence_id,
        name='x',
        region={'from_base': 40, 'to_base': 3},
    )
    strategy = TestClient(mcp.streamable_http_app()).get(f'/strategies/{strategy_id}.json').json()
    assert cloning_api.post('/validate', json=strategy) is None
    rows = await features_of(client, strategy_id, sequence_id)
    assert (rows[0]['protein_aa'], rows[1]['location']) == (7, 'join(40..44,1..3)')
    assert str(Seq(CDS[:-3]).translate()) == 'MAGSKLV'
