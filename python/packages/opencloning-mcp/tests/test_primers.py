"""Primer design tools, called through an in-memory MCP client like in test_tools.py.

The designed primers are used with the pcr and homologous_recombination tools, and the sequence that comes
out is compared with what was asked for: that is the test that the regions and the strands are right.
"""

import json
import random

import pytest
from Bio.Seq import Seq, reverse_complement
from Bio.SeqFeature import SeqFeature, SimpleLocation
from fastapi.testclient import TestClient
from mcp import Client
from opencloning.dna_functions import format_sequence_genbank, read_dsrecord_from_json
from opencloning.pydantic_models import BaseCloningStrategy
from opencloning_linkml.datamodel import TextFileSequence
from pydna.dseqrecord import Dseqrecord

from opencloning_mcp import cloning_api
from opencloning_mcp.server import mcp

SENSE_CODONS = [a + b + c for a in 'ACGT' for b in 'ACGT' for c in 'ACGT' if a + b + c not in ('TAA', 'TAG', 'TGA')]


def random_dna(length: int, seed: int) -> str:
    rng = random.Random(seed)
    return ''.join(rng.choice('ACGT') for _ in range(length))


def random_cds(codons: int, seed: int) -> str:
    """ATG, codons-2 sense codons, and a stop codon."""
    rng = random.Random(seed)
    return 'ATG' + ''.join(rng.choice(SENSE_CODONS) for _ in range(codons - 2)) + 'TAA'


# A gene of 100 codons between two flanks of 200 bp
LEFT, GENE, RIGHT = random_dna(200, 1), random_cds(100, 2), random_dna(200, 3)
GENOME = LEFT + GENE + RIGHT
GENE_START, GENE_END = len(LEFT), len(LEFT) + len(GENE)
PROTEIN = str(Seq(GENE).translate())
# A cassette: the sequence to insert, with a marker gene in the middle
CASSETTE_MARKER = random_cds(60, 4)
CASSETTE = random_dna(100, 5) + CASSETTE_MARKER + random_dna(100, 6)


async def call(client: Client, tool: str, **arguments) -> dict:
    result = await client.call_tool(tool, arguments)
    assert not result.is_error, result.content[0].text
    return json.loads(result.content[0].text)


async def call_error(client: Client, tool: str, **arguments) -> str:
    result = await client.call_tool(tool, arguments)
    assert result.is_error
    return result.content[0].text


async def new_strategy(client: Client) -> str:
    return (await call(client, 'start_strategy'))['strategy_id']


def feature(start: int, end: int, strand: int, label: str = 'cdc2', type: str = 'CDS') -> SeqFeature:
    return SeqFeature(SimpleLocation(start, end, strand=strand), type=type, qualifiers={'label': [label]})


async def add_genbank(client: Client, strategy_id: str, seq: str, features: list[SeqFeature], name: str) -> int:
    record = Dseqrecord(seq)
    record.name = name
    record.features = features
    result = await call(
        client,
        'add_sequence_from_file',
        strategy_id=strategy_id,
        file_name=f'{name}.gb',
        file_content=format_sequence_genbank(record).file_content,
    )
    return result['sequence']['id']


async def add_genome(client: Client, strategy_id: str, on_minus_strand: bool = False) -> int:
    if on_minus_strand:
        length = len(GENOME)
        gene = feature(length - GENE_END, length - GENE_START, -1)
        return await add_genbank(client, strategy_id, reverse_complement(GENOME), [gene], 'genome')
    return await add_genbank(client, strategy_id, GENOME, [feature(GENE_START, GENE_END, 1)], 'genome')


async def add_cassette(client: Client, strategy_id: str) -> int:
    marker = feature(100, 100 + len(CASSETTE_MARKER), 1, 'kanMX')
    return await add_genbank(client, strategy_id, CASSETTE, [marker], 'cassette')


async def download(strategy_id: str) -> dict:
    return TestClient(mcp.streamable_http_app()).get(f'/strategies/{strategy_id}.json').json()


async def bases_of(strategy_id: str, sequence_id: int) -> str:
    """The top strand of a sequence of the strategy."""
    sequences = (await download(strategy_id))['sequences']
    sequence = next(s for s in sequences if s['id'] == sequence_id)
    return str(read_dsrecord_from_json(TextFileSequence.model_validate(sequence)).seq).upper()


def assert_strategy_is_valid(strategy: dict):
    assert cloning_api.post('/validate', json=strategy) is None
    BaseCloningStrategy.model_validate(strategy)
    ids = {item['id'] for key in ('sequences', 'primers') for item in strategy[key]}
    for source in strategy['sources']:
        assert all(i['sequence'] in ids for i in source['input']), source


async def pcr_with(client: Client, strategy_id: str, template_id: int, designed: dict) -> int:
    """Run the pcr tool with the primers of a design, and return the id of the product."""
    forward, reverse = (primer['id'] for primer in designed['primers'])
    result = await call(
        client,
        'pcr',
        strategy_id=strategy_id,
        template_id=template_id,
        forward_primer_id=forward,
        reverse_primer_id=reverse,
    )
    assert result['status'] == 'added', result
    return result['sequence']['id']


# Finding regions ===============================================================================


@pytest.mark.anyio
async def test_list_features_and_locate_region(client: Client):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id)

    listing = await call(client, 'list_features', strategy_id=strategy_id, sequence_id=genome)
    assert listing['topology'] == 'linear'
    (row,) = listing['features']
    assert row['name'] == 'cdc2'
    assert row['location'] == f'{GENE_START + 1}..{GENE_END}'
    assert row['protein_aa'] == 99 and row['ends_with_stop_codon']
    assert (await call(client, 'list_features', strategy_id=strategy_id, sequence_id=genome, query='zzz'))[
        'features'
    ] == []

    located = await call(
        client, 'locate_region', strategy_id=strategy_id, sequence_id=genome, region={'feature': 'cdc2'}
    )
    assert located['region']['length'] == len(GENE)
    assert located['region']['first_bases'] == GENE[:12]
    assert located['region']['protein'].endswith('(99 aa)')

    located = await call(
        client, 'locate_region', strategy_id=strategy_id, sequence_id=genome, point={'feature': 'cdc2', 'after_aa': 10}
    )
    assert located['point']['between_amino_acids'] == f'{PROTEIN[9]}10|{PROTEIN[10]}11'
    assert located['point']['between_bases'] == f'{GENE_START + 30}|{GENE_START + 31}'

    error = await call_error(client, 'locate_region', strategy_id=strategy_id, sequence_id=genome)
    assert 'either a region or a point' in error
    error = await call_error(
        client, 'locate_region', strategy_id=strategy_id, sequence_id=genome, region={'feature': 'nope'}
    )
    assert 'No feature matches "nope"' in error


@pytest.mark.anyio
async def test_the_tools_describe_their_arguments_to_the_model(client: Client):
    tools = {tool.name: tool for tool in (await client.list_tools()).tools}
    tool = tools['design_pcr_primers']
    # The Region, Position and settings models, with the descriptions of their fields, are part of the schema
    schema = json.dumps(tool.input_schema)
    for word in ('upstream', 'after_aa', 'Form 1', 'Met = 1', 'primer_salt_monovalent'):
        assert word in schema, word
    assert 'top strand' in tool.description


# PCR primers ===================================================================================


@pytest.mark.anyio
async def test_pcr_primers_for_a_feature_amplify_exactly_the_feature(client: Client):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id)

    designed = await call(
        client, 'design_pcr_primers', strategy_id=strategy_id, template_id=genome, region={'feature': 'cdc2'}
    )
    assert designed['status'] == 'designed'
    assert designed['region']['location'] == f'{GENE_START + 1}..{GENE_END}'
    forward, reverse = designed['primers']
    assert (forward['name'], reverse['name']) == ('cdc2_fwd', 'cdc2_rvs')
    assert forward['sequence'] == GENE[: len(forward['sequence'])]
    assert reverse['sequence'] == reverse_complement(GENE)[: len(reverse['sequence'])]
    assert designed['next_step'].startswith(
        f"pcr(template_id={genome}, forward_primer_id={forward['id']}, reverse_primer_id={reverse['id']})"
    )

    product = await pcr_with(client, strategy_id, genome, designed)
    assert await bases_of(strategy_id, product) == GENE

    # The primers are in the strategy
    description = await call(client, 'describe_strategy', strategy_id=strategy_id)
    assert [p['name'] for p in description['primers']] == ['cdc2_fwd', 'cdc2_rvs']
    assert_strategy_is_valid(await download(strategy_id))

    # Without tails, the part that binds is the whole primer, and its Tm is close to the target
    details = await call(client, 'pcr_primer_details', strategy_id=strategy_id, sequence_id=product)
    for primer in details['primers']:
        assert primer['tail'] == ''
        assert primer['binding_part']['sequence'] == primer['sequence']
        assert abs(primer['binding_part']['melting_temperature'] - 55) < 6


@pytest.mark.anyio
async def test_pcr_primers_for_a_gene_on_the_minus_strand_are_in_the_sense_of_the_gene(client: Client):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id, on_minus_strand=True)

    designed = await call(
        client, 'design_pcr_primers', strategy_id=strategy_id, template_id=genome, region={'feature': 'cdc2'}
    )
    assert designed['region']['strand'] == '-'
    assert designed['region']['location'].startswith('complement(')
    forward = designed['primers'][0]['sequence']
    assert forward == GENE[: len(forward)]

    product = await pcr_with(client, strategy_id, genome, designed)
    assert await bases_of(strategy_id, product) == GENE


@pytest.mark.anyio
@pytest.mark.parametrize('on_minus_strand', [False, True])
async def test_pcr_primers_with_extra_bases_around_the_feature_and_restriction_sites(client: Client, on_minus_strand):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id, on_minus_strand)

    # 30 bp of promoter, without the stop codon
    designed = await call(
        client,
        'design_pcr_primers',
        strategy_id=strategy_id,
        template_id=genome,
        region={'feature': 'cdc2', 'upstream': 30, 'downstream': -3},
        left_enzyme='BamHI',
        right_enzyme='SacI',
        right_tail='GGT',
        spacer_approved_by_user=True,
        name_prefix='pcdc2',
    )
    forward, reverse = designed['primers']
    assert (forward['name'], reverse['name']) == ('pcdc2_BamHI_fwd', 'pcdc2_SacI_rvs')
    # TTT is the filler, then the site. The reverse primer has the site, and the reverse complement of the
    # right tail (GGT, as it reads in the product) between the site and the part that binds
    assert forward['sequence'].startswith('TTTGGATCC')
    assert reverse['sequence'].startswith('TTTGAGCTC' + 'ACC')

    amplicon = LEFT[-30:] + GENE[:-3]
    product = await pcr_with(client, strategy_id, genome, designed)
    assert await bases_of(strategy_id, product) == 'TTT' + 'GGATCC' + amplicon + 'GGT' + 'GAGCTC' + 'AAA'

    # The tails are what is not bound. If the last base of a tail is by chance the same as the template there,
    # it counts as bound: the tail can be a base shorter
    details = await call(client, 'pcr_primer_details', strategy_id=strategy_id, sequence_id=product)
    for primer, intended_tail in zip(details['primers'], ('TTTGGATCC', 'TTTGAGCTCACC')):
        assert intended_tail.startswith(primer['tail']) and len(primer['tail']) >= len(intended_tail) - 2
        assert primer['tail'] + primer['binding_part']['sequence'] == primer['sequence']
    assert_strategy_is_valid(await download(strategy_id))


@pytest.mark.anyio
async def test_pcr_primers_for_coordinates_and_for_the_whole_sequence(client: Client):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id)

    designed = await call(
        client,
        'design_pcr_primers',
        strategy_id=strategy_id,
        template_id=genome,
        region={'from_base': 51, 'to_base': 150, 'strand': '-'},
    )
    product = await pcr_with(client, strategy_id, genome, designed)
    assert await bases_of(strategy_id, product) == reverse_complement(GENOME[50:150])

    designed = await call(client, 'design_pcr_primers', strategy_id=strategy_id, template_id=genome)
    product = await pcr_with(client, strategy_id, genome, designed)
    assert await bases_of(strategy_id, product) == GENOME


@pytest.mark.anyio
async def test_pcr_primers_for_the_n_terminal_part_of_a_protein(client: Client):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id)
    designed = await call(
        client,
        'design_pcr_primers',
        strategy_id=strategy_id,
        template_id=genome,
        region={'start': {'feature': 'cdc2', 'edge': 'start'}, 'end': {'feature': 'cdc2', 'after_aa': 40}},
    )
    product = await pcr_with(client, strategy_id, genome, designed)
    assert await bases_of(strategy_id, product) == GENE[:120]


@pytest.mark.anyio
async def test_the_tm_settings_are_passed_to_the_design(client: Client):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id)
    common = {'strategy_id': strategy_id, 'template_id': genome, 'region': {'feature': 'cdc2'}}
    default = await call(client, 'design_pcr_primers', **common)
    hot = await call(client, 'design_pcr_primers', **common, target_tm=62)
    assert len(hot['primers'][0]['sequence']) > len(default['primers'][0]['sequence'])


@pytest.mark.anyio
async def test_pcr_design_errors_are_explained(client: Client):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id)

    error = await call_error(
        client,
        'design_pcr_primers',
        strategy_id=strategy_id,
        template_id=genome,
        region={'feature': 'cdc2', 'upstream': 500},
    )
    assert 'before the start of genome' in error
    error = await call_error(
        client,
        'design_pcr_primers',
        strategy_id=strategy_id,
        template_id=genome,
        region={'from_base': 5, 'to_base': 10},
    )
    assert 'Primers could not be designed' in error
    error = await call_error(
        client, 'design_pcr_primers', strategy_id=strategy_id, template_id=genome, left_enzyme='NotAnEnzyme'
    )
    assert 'These enzymes do not exist' in error
    error = await call_error(
        client,
        'design_pcr_primers',
        strategy_id=strategy_id,
        template_id=genome,
        region={'feature': 'cdc2', 'from_base': 1},
    )
    assert 'exactly one form' in error
    error = await call_error(client, 'design_pcr_primers', strategy_id=strategy_id, template_id=99)
    assert 'no item with id 99' in error
    # Nothing was saved by the failed designs
    assert (await call(client, 'describe_strategy', strategy_id=strategy_id))['primers'] == []


# Homologous recombination ======================================================================


async def recombine(
    client: Client, strategy_id: str, designed: dict, cassette: int, genome: int, homology_length: int = 40
) -> str:
    """Run the PCR of the insert and the recombination, and return the bases of the result."""
    product = await pcr_with(client, strategy_id, cassette, designed)
    result = await call(
        client,
        'homologous_recombination',
        strategy_id=strategy_id,
        template_id=genome,
        insert_id=product,
        minimal_homology=homology_length,
    )
    assert result['status'] == 'added', result
    return await bases_of(strategy_id, result['sequence']['id'])


@pytest.mark.anyio
async def test_replace_a_gene_with_a_cassette(client: Client):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id)
    cassette = await add_cassette(client, strategy_id)

    designed = await call(
        client,
        'design_homology_primers',
        strategy_id=strategy_id,
        insert_id=cassette,
        target_id=genome,
        replace={'feature': 'cdc2', 'feature_type': 'CDS'},
        homology_length=40,
    )
    forward, reverse = designed['primers']
    # The 5' tail is the homology arm (lowercase): the 40 bases before the gene, and the reverse complement of
    # the 40 after it
    assert forward['sequence'][:40] == LEFT[-40:].lower()
    assert reverse['sequence'][:40] == reverse_complement(RIGHT[:40]).lower()
    assert designed['replaces']['length'] == len(GENE)
    assert designed['expected_size_after_recombination'] == len(LEFT) + len(CASSETTE) + len(RIGHT)
    assert 'minimal_homology=40' in designed['next_step']

    result = await recombine(client, strategy_id, designed, cassette, genome)
    assert result == LEFT + CASSETTE + RIGHT
    assert_strategy_is_valid(await download(strategy_id))


@pytest.mark.anyio
async def test_replace_only_the_marker_of_the_cassette(client: Client):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id)
    cassette = await add_cassette(client, strategy_id)
    designed = await call(
        client,
        'design_homology_primers',
        strategy_id=strategy_id,
        insert_id=cassette,
        insert_region={'feature': 'kanMX'},
        target_id=genome,
        replace={'feature': 'cdc2'},
    )
    assert await recombine(client, strategy_id, designed, cassette, genome) == LEFT + CASSETTE_MARKER + RIGHT


@pytest.mark.anyio
@pytest.mark.parametrize('orientation', ['forward', 'reverse'])
async def test_orientation_of_the_insert_is_relative_to_the_gene_it_replaces(client: Client, orientation):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id, on_minus_strand=True)
    cassette = await add_cassette(client, strategy_id)
    designed = await call(
        client,
        'design_homology_primers',
        strategy_id=strategy_id,
        insert_id=cassette,
        insert_region={'feature': 'kanMX'},
        target_id=genome,
        replace={'feature': 'cdc2'},
        orientation=orientation,
    )
    result = await recombine(client, strategy_id, designed, cassette, genome)
    top_strand = reverse_complement(GENOME)
    left, right = top_strand[: len(RIGHT)], top_strand[len(RIGHT) + len(GENE) :]
    # The gene is on the minus strand, so a cassette that reads like the gene is reverse complemented on the top strand
    inserted = reverse_complement(CASSETTE_MARKER) if orientation == 'forward' else CASSETTE_MARKER
    assert result == left + inserted + right


@pytest.mark.anyio
async def test_insert_a_tag_in_frame_after_an_amino_acid(client: Client):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id)
    tag = random_cds(21, 9)[:-3]  # 20 codons, no stop
    tag_id = (await call(client, 'add_typed_sequence', strategy_id=strategy_id, sequence=tag))['sequence']['id']

    designed = await call(
        client,
        'design_homology_primers',
        strategy_id=strategy_id,
        insert_id=tag_id,
        target_id=genome,
        insert_at={'feature': 'cdc2', 'after_aa': 10},
        homology_length=30,
        minimal_annealing=15,
    )
    assert designed['inserts_at']['between_amino_acids'] == f'{PROTEIN[9]}10|{PROTEIN[10]}11'
    boundary = GENE_START + 30
    result = await recombine(client, strategy_id, designed, tag_id, genome, homology_length=30)
    assert result == GENOME[:boundary] + tag + GENOME[boundary:]
    # The protein has the tag after amino acid 10, and the rest of it unchanged
    protein = str(Seq(result[GENE_START : GENE_END + len(tag)]).translate())
    assert protein == PROTEIN[:10] + str(Seq(tag).translate()) + PROTEIN[10:]


@pytest.mark.anyio
async def test_c_terminal_tag_replacing_the_stop_codon_with_a_spacer(client: Client):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id)
    tag = random_dna(60, 11)
    tag_id = (await call(client, 'add_typed_sequence', strategy_id=strategy_id, sequence=tag))['sequence']['id']
    designed = await call(
        client,
        'design_homology_primers',
        strategy_id=strategy_id,
        insert_id=tag_id,
        target_id=genome,
        replace={'start': {'feature': 'cdc2', 'after_aa': 99}, 'end': {'feature': 'cdc2', 'edge': 'end'}},
        left_spacer='GGA',
        spacer_approved_by_user=True,
        homology_length=30,
    )
    assert designed['replaces']['length'] == 3 and designed['replaces']['first_bases'] == 'TAA'
    result = await recombine(client, strategy_id, designed, tag_id, genome, homology_length=30)
    assert result == GENOME[: GENE_END - 3] + 'GGA' + tag + GENOME[GENE_END:]


@pytest.mark.anyio
async def test_spacers_and_tails_are_not_designed_until_the_user_approves_them(client: Client):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id)
    tag_id = (await call(client, 'add_typed_sequence', strategy_id=strategy_id, sequence=random_dna(60, 11)))[
        'sequence'
    ]['id']

    homology = {
        'strategy_id': strategy_id,
        'insert_id': tag_id,
        'target_id': genome,
        'replace': {'feature': 'cdc2', 'downstream': 0},
        'left_spacer': 'ggatct',
        'homology_length': 30,
    }
    answer = await call(client, 'design_homology_primers', **homology)
    assert answer['status'] == 'needs_confirmation' and answer['spacers'] == {'left_spacer': 'GGATCT'}
    assert 'spacer_approved_by_user=true' in answer['message']

    pcr = {'strategy_id': strategy_id, 'template_id': genome, 'right_tail': 'GGT'}
    answer = await call(client, 'design_pcr_primers', **pcr)
    assert answer['status'] == 'needs_confirmation' and answer['spacers'] == {'right_tail': 'GGT'}

    # Nothing was saved, and no spacer means no question
    assert (await call(client, 'describe_strategy', strategy_id=strategy_id))['primers'] == []
    assert (await call(client, 'design_pcr_primers', strategy_id=strategy_id, template_id=genome))[
        'status'
    ] == 'designed'
    assert (await call(client, 'design_homology_primers', **homology, spacer_approved_by_user=True))[
        'status'
    ] == 'designed'


@pytest.mark.anyio
async def test_homology_design_errors_are_explained(client: Client):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id)
    cassette = await add_cassette(client, strategy_id)
    common = {'strategy_id': strategy_id, 'insert_id': cassette, 'target_id': genome}

    assert 'either replace' in await call_error(client, 'design_homology_primers', **common)
    both = {'replace': {'feature': 'cdc2'}, 'insert_at': {'after_base': 100}}
    assert 'either replace' in await call_error(client, 'design_homology_primers', **common, **both)
    error = await call_error(client, 'design_homology_primers', **common, insert_at={'after_base': 0})
    assert 'outside genome or at its very end' in error
    # 300 bases of homology do not fit before the gene
    error = await call_error(
        client, 'design_homology_primers', **common, replace={'feature': 'cdc2'}, homology_length=300
    )
    assert 'out of bounds' in error
    assert (await call(client, 'describe_strategy', strategy_id=strategy_id))['primers'] == []


# Properties of primers =========================================================================


def different_from(base: str) -> str:
    return 'A' if base != 'A' else 'T'


@pytest.mark.anyio
async def test_pcr_primer_details_use_the_part_of_the_primer_that_binds(client: Client):
    """Primers typed by hand, with tails that surely do not match the template."""
    strategy_id = await new_strategy(client)
    template = random_dna(300, 30)
    template_id = (await call(client, 'add_typed_sequence', strategy_id=strategy_id, sequence=template))['sequence'][
        'id'
    ]
    region = template[100:200]
    forward_binding, reverse_binding = region[:20], reverse_complement(region)[:20]
    forward_tail = 'GGATC' + different_from(template[99])
    reverse_tail = 'GAGCT' + different_from(reverse_complement(template[200]))
    primer_ids = []
    for name, sequence in (('fwd', forward_tail + forward_binding), ('rvs', reverse_tail + reverse_binding)):
        added = await call(client, 'add_primer', strategy_id=strategy_id, name=name, sequence=sequence)
        primer_ids.append(added['id'])
    product = (
        await call(
            client,
            'pcr',
            strategy_id=strategy_id,
            template_id=template_id,
            forward_primer_id=primer_ids[0],
            reverse_primer_id=primer_ids[1],
        )
    )['sequence']['id']

    details = await call(client, 'pcr_primer_details', strategy_id=strategy_id, sequence_id=product)
    forward, reverse = details['primers']
    assert (forward['tail'], reverse['tail']) == (forward_tail, reverse_tail)
    assert forward['binding_part']['sequence'] == forward_binding and reverse['binding_part']['length'] == 20
    assert forward['id'] == primer_ids[0] and reverse['name'] == 'rvs'

    # The numbers are those of the binding part, not of the whole primer
    binding = await call(client, 'primer_details', sequences=[forward_binding])
    whole = await call(client, 'primer_details', sequences=[forward_tail + forward_binding])
    assert forward['binding_part']['melting_temperature'] == binding['primers'][0]['melting_temperature']
    assert forward['binding_part']['melting_temperature'] != whole['primers'][0]['melting_temperature']
    assert details['melting_temperature_difference'] == pytest.approx(
        abs(forward['binding_part']['melting_temperature'] - reverse['binding_part']['melting_temperature']), abs=0.1
    )
    # The dimer is between the whole primers
    dimer = await call(
        client, 'primer_details', sequences=[forward_tail + forward_binding, reverse_tail + reverse_binding]
    )
    assert details['heterodimer'] == dimer['heterodimer']


@pytest.mark.anyio
async def test_pcr_primer_details_errors(client: Client):
    strategy_id = await new_strategy(client)
    genome = await add_genome(client, strategy_id)
    error = await call_error(client, 'pcr_primer_details', strategy_id=strategy_id, sequence_id=genome)
    assert 'was not made by PCR' in error
    error = await call_error(client, 'pcr_primer_details', strategy_id=strategy_id, sequence_id=99)
    assert 'no item with id 99' in error


@pytest.mark.anyio
async def test_primer_details_of_plain_sequences_and_primers_of_the_strategy(client: Client):
    result = await call(client, 'primer_details', sequences=['ATGCATGCATGCATGC', 'GCGCGGATCCGCGCAAAAAAAAAAGCGC'])
    first, second = result['primers']
    assert first['name'] == 'sequence_1' and first['length'] == 16
    assert first['melting_temperature'] == pytest.approx(53.5, abs=0.1)
    assert first['gc_percent'] == 50
    # Free energies are in cal/mol, as primer3 gives them
    assert first['homodimer']['delta_g_cal_per_mol'] == pytest.approx(-16894, abs=100)
    assert result['heterodimer']['delta_g_cal_per_mol'] < 0
    assert second['hairpin'] is not None

    # None when no structure forms
    assert (await call(client, 'primer_details', sequences=['AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAA']))[
        'heterodimer'
    ] is None

    # The conditions of the calculation can be changed
    salty = await call(
        client, 'primer_details', sequences=['ATGCATGCATGCATGC'], settings={'primer_salt_monovalent': 150}
    )
    assert salty['primers'][0]['melting_temperature'] > first['melting_temperature']

    # Primers of the strategy
    strategy_id = await new_strategy(client)
    added = await call(client, 'add_primer', strategy_id=strategy_id, name='oligo', sequence='ATGCATGCATGCATGC')
    result = await call(client, 'primer_details', strategy_id=strategy_id, primer_ids=[added['id']])
    assert result['primers'][0]['name'] == 'oligo'
    assert result['primers'][0]['melting_temperature'] == first['melting_temperature']
    assert 'heterodimer' not in result

    assert 'strategy_id is needed' in await call_error(client, 'primer_details', primer_ids=[1])
    assert 'Give primer_ids or sequences' in await call_error(client, 'primer_details')
    assert 'letters A, C, G and T' in await call_error(client, 'primer_details', sequences=['ACGU'])
