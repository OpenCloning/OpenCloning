"""find_orfs, called through an in-memory MCP client."""

import pytest
from Bio.Seq import reverse_complement
from Bio.SeqFeature import SeqFeature, SimpleLocation
from mcp import Client

from .test_annotations import add_sequence, call, call_error

# M A G S K L V * (8 codons)
CDS = 'ATGGCTGGATCTAAACTGGTTTAA'


@pytest.mark.anyio
async def test_orfs_of_both_strands_with_and_without_met(client: Client):
    # A short ORF (7 aa) on each strand
    seq = 'CC' + CDS + 'CCC' + reverse_complement(CDS) + 'CC'
    strategy_id, sequence_id = await add_sequence(client, seq, [])
    common = {'strategy_id': strategy_id, 'sequence_id': sequence_id, 'min_aa': 7}

    result = await call(client, 'find_orfs', **common)
    plus = [o for o in result['orfs'] if not o['location'].startswith('complement')]
    minus = [o for o in result['orfs'] if o['location'].startswith('complement')]
    # The stop codon is part of the location (24 bases), not of the protein
    assert any(o['location'] == '3..26' and o['protein'] == 'MAGSKLV' and o['ends_with_stop'] for o in plus)
    assert any(o['location'] == 'complement(30..53)' and o['protein'] == 'MAGSKLV' for o in minus)
    assert result['searched'] == f'1..{len(seq)}'

    only_plus = await call(client, 'find_orfs', **common, strand='+')
    assert all(not o['location'].startswith('complement') for o in only_plus['orfs'])
    only_minus = await call(client, 'find_orfs', **common, strand='-')
    assert [o['location'] for o in only_minus['orfs']] == ['complement(30..53)']

    # Nothing is long enough
    assert (await call(client, 'find_orfs', **{**common, 'min_aa': 8}))['orfs'] == []


@pytest.mark.anyio
async def test_start_any_includes_orfs_without_met_and_open_ones(client: Client):
    seq = 'TAA' + 'GGC' * 10 + 'ATG' + 'GCC' * 4 + 'TAA'
    strategy_id, sequence_id = await add_sequence(client, seq, [])
    common = {'strategy_id': strategy_id, 'sequence_id': sequence_id, 'strand': '+'}
    with_met = await call(client, 'find_orfs', **common, start='met', min_aa=5)
    assert [o['protein'] for o in with_met['orfs']] == ['M' + 'A' * 4]
    anywhere = await call(client, 'find_orfs', **common, start='any', min_aa=10)
    # Everything between the two stops is one ORF, which does not start with Met
    (orf,) = [o for o in anywhere['orfs'] if o['location'] == f'4..{len(seq)}']
    assert orf['protein'] == 'G' * 10 + 'M' + 'A' * 4 and orf['starts_with_met'] is False

    # Without a stop codon at the end the ORF is open
    open_ended = await add_sequence(client, 'ATG' + 'GCC' * 10, [])
    result = await call(
        client, 'find_orfs', strategy_id=open_ended[0], sequence_id=open_ended[1], min_aa=5, strand='+'
    )
    assert result['orfs'][0]['ends_with_stop'] is False and result['orfs'][0]['length_aa'] == 11


@pytest.mark.anyio
async def test_region_overlaps_and_errors(client: Client):
    seq = 'T' * 12 + CDS + 'C' * 12
    strategy_id, sequence_id = await add_sequence(
        client, seq, [SeqFeature(SimpleLocation(12, 36, 1), type='CDS', qualifiers={'label': ['cdc2']})]
    )
    common = {'strategy_id': strategy_id, 'sequence_id': sequence_id, 'min_aa': 7, 'strand': '+'}
    result = await call(client, 'find_orfs', **common)
    (orf,) = result['orfs']
    assert orf['location'] == '13..36' and orf['overlaps_cds'] == ['cdc2 13..36']

    # Coordinates are those of the whole sequence when a region is given
    inside = await call(client, 'find_orfs', **common, region={'from_base': 10, 'to_base': 40})
    assert inside['searched'] == '10..40' and inside['orfs'][0]['location'] == '13..36'
    # A region that cuts the ORF leaves nothing
    cut = await call(client, 'find_orfs', **common, region={'from_base': 10, 'to_base': 30})
    assert cut['orfs'] == []

    assert 'Unknown genetic code' in await call_error(client, 'find_orfs', **common, genetic_code=99)
    assert 'min_aa' in await call_error(
        client, 'find_orfs', strategy_id=strategy_id, sequence_id=sequence_id, min_aa=0
    )


@pytest.mark.anyio
async def test_the_orfs_are_ordered_and_capped(client: Client):
    # 25 ORFs of increasing length, each closed by a stop codon
    seq = ''.join('ATG' + 'GCC' * n + 'TAA' for n in range(1, 26))
    strategy_id, sequence_id = await add_sequence(client, seq, [])
    result = await call(client, 'find_orfs', strategy_id=strategy_id, sequence_id=sequence_id, min_aa=1, strand='+')
    assert result['total'] >= 25 and len(result['orfs']) == 20 and 'note' in result
    lengths = [o['length_aa'] for o in result['orfs']]
    assert lengths == sorted(lengths, reverse=True) and lengths[0] == 26
