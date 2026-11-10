"""Call the tools through an in-memory MCP client, the same way a host like Claude Code does."""

import io
import json
from pathlib import Path

import pytest
from Bio import SeqIO
from fastapi.testclient import TestClient
from mcp import Client
from opencloning import app_settings
from opencloning.dna_functions import custom_file_parser
from opencloning.pydantic_models import BaseCloningStrategy

from opencloning_mcp import cloning_api, storage, tools_import
from opencloning_mcp.app import BASE_URL
from opencloning_mcp.server import mcp


async def call(client: Client, tool: str, **arguments) -> dict:
    """Call a tool and return its result as a dict. Fails if the tool raised an error."""
    result = await client.call_tool(tool, arguments)
    assert not result.is_error, result.content[0].text
    return json.loads(result.content[0].text)


@pytest.mark.anyio
async def test_start_describe_and_export(client: Client):
    strategy_id = (await call(client, 'start_strategy', description='test'))['strategy_id']

    description = await call(client, 'describe_strategy', strategy_id=strategy_id)
    assert description == {'description': 'test', 'sequences': [], 'primers': []}

    export = await call(client, 'get_strategy_json', strategy_id=strategy_id)
    assert export['download_url'].endswith(f'/strategies/{strategy_id}.json')
    assert export['number_of_sequences'] == 0


@pytest.mark.anyio
async def test_unknown_strategy_id_is_reported_to_the_model(client: Client):
    result = await client.call_tool('describe_strategy', {'strategy_id': 'wrong'})
    assert result.is_error
    assert 'Unknown or expired strategy_id' in result.content[0].text


@pytest.mark.anyio
async def test_download_route(client: Client):
    strategy_id = (await call(client, 'start_strategy'))['strategy_id']
    http = TestClient(mcp.streamable_http_app())

    response = http.get(f'/strategies/{strategy_id}.json')
    assert response.status_code == 200
    assert response.json()['sequences'] == []

    assert http.get('/strategies/wrong.json').status_code == 404


# Stage 2: imports ===========================================================================

TEST_FILES = Path(__file__).parents[2] / 'opencloning' / 'tests' / 'test_files'


async def new_strategy(client: Client) -> str:
    return (await call(client, 'start_strategy'))['strategy_id']


async def add_file(client: Client, strategy_id: str, file_name: str, **arguments) -> dict:
    content = (TEST_FILES / file_name).read_text()
    return await call(
        client,
        'add_sequence_from_file',
        strategy_id=strategy_id,
        file_name=file_name,
        file_content=content,
        **arguments,
    )


@pytest.mark.anyio
async def test_add_sequence_from_file(client: Client):
    strategy_id = await new_strategy(client)
    result = await add_file(client, strategy_id, 'pFA6a-hphMX6.gb')
    assert result['status'] == 'added'
    sequence = result['sequence']
    assert (sequence['id'], sequence['name'], sequence['length'], sequence['topology']) == (
        1,
        'pFA6a-hphMX6',
        4157,
        'circular',
    )
    assert 'CDS HygR 457..1485 (+)' in sequence['features']


@pytest.mark.anyio
async def test_file_with_several_sequences_needs_a_choice(client: Client):
    strategy_id = await new_strategy(client)

    result = await add_file(client, strategy_id, 'dummy_multi_fasta.fasta')
    assert result['status'] == 'choose_product'
    assert [c['name'] for c in result['candidates']] == ['seq1', 'seq2']
    # Nothing was added yet
    assert (await call(client, 'describe_strategy', strategy_id=strategy_id))['sequences'] == []

    result = await add_file(client, strategy_id, 'dummy_multi_fasta.fasta', product_index=1)
    assert result['status'] == 'added'
    assert result['sequence']['name'] == 'seq2'


@pytest.mark.anyio
async def test_add_typed_sequence(client: Client):
    strategy_id = await new_strategy(client)
    result = await call(
        client, 'add_typed_sequence', strategy_id=strategy_id, sequence='ACGT\nACGT ACGT', name='my seq'
    )
    assert result['sequence'] == {
        'id': 1,
        'name': 'my_seq',
        'length': 12,
        'topology': 'linear',
        'left_end': 'blunt',
        'right_end': 'blunt',
        'features': [],
    }


@pytest.mark.anyio
async def test_add_primer(client: Client):
    strategy_id = await new_strategy(client)
    assert await call(client, 'add_primer', strategy_id=strategy_id, name='fwd', sequence='ACGTACGT') == {
        'id': 1,
        'name': 'fwd',
        'length': 8,
    }
    result = await client.call_tool('add_primer', {'strategy_id': strategy_id, 'name': 'bad', 'sequence': 'ACGU'})
    assert result.is_error


@pytest.mark.anyio
async def test_api_errors_reach_the_model(client: Client, monkeypatch):
    monkeypatch.setattr(app_settings.settings, 'ADDGENE_TOKEN', None)
    strategy_id = await new_strategy(client)
    result = await client.call_tool('add_sequence_from_addgene', {'strategy_id': strategy_id, 'addgene_id': '39296'})
    assert result.is_error
    assert 'Addgene access requires an API token' in result.content[0].text


@pytest.mark.anyio
async def test_addgene_imports_are_limited_per_strategy(client: Client, monkeypatch):
    monkeypatch.setattr(tools_import, 'MAX_ADDGENE_PER_STRATEGY', 1)
    strategy_id = await new_strategy(client)
    await call(client, 'add_typed_sequence', strategy_id=strategy_id, sequence='ACGTACGTAC')
    sequence = storage.load_strategy(strategy_id)['sequences'][0]
    # An import that already happened, without calling Addgene
    storage.append_step(strategy_id, {'type': 'AddgeneIdSource', 'input': [], 'repository_id': '1'}, sequence)

    result = await client.call_tool('add_sequence_from_addgene', {'strategy_id': strategy_id, 'addgene_id': '2'})
    assert result.is_error and 'limit' in result.content[0].text

    # Another strategy has its own count: it gets as far as the API, which needs a token
    monkeypatch.setattr(app_settings.settings, 'ADDGENE_TOKEN', None)
    other = await new_strategy(client)
    result = await client.call_tool('add_sequence_from_addgene', {'strategy_id': other, 'addgene_id': '2'})
    assert result.is_error and 'API token' in result.content[0].text


@pytest.mark.flaky(reruns=2, reruns_delay=2)
@pytest.mark.anyio
async def test_add_sequence_from_genbank(client: Client):
    """Calls NCBI, like the backend tests of the same endpoint."""
    strategy_id = await new_strategy(client)
    result = await call(client, 'add_sequence_from_genbank', strategy_id=strategy_id, accession='NM_001018957.2')
    assert result['sequence']['name'] == 'NM_001018957'


@pytest.mark.anyio
async def test_exported_strategy_is_valid(client: Client):
    strategy_id = await new_strategy(client)
    await add_file(client, strategy_id, 'pFA6a-hphMX6.gb')
    await add_file(client, strategy_id, 'dummy_multi_fasta.fasta', product_index=0)
    await call(client, 'add_typed_sequence', strategy_id=strategy_id, sequence='ACGTACGT', circular=True)
    await call(client, 'add_primer', strategy_id=strategy_id, name='fwd', sequence='ACGTACGT')

    strategy = TestClient(mcp.streamable_http_app()).get(f'/strategies/{strategy_id}.json').json()
    assert [s['id'] for s in strategy['sequences']] == [s['id'] for s in strategy['sources']] == [1, 2, 3]
    assert [p['id'] for p in strategy['primers']] == [4]
    # The backend /validate endpoint answers null when the strategy is valid and needs no changes
    assert cloning_api.post('/validate', json=strategy) is None
    BaseCloningStrategy.model_validate(strategy)


# Stage 3a: cloning operations ===============================================================


def reverse_complement(sequence: str) -> str:
    return sequence[::-1].translate(str.maketrans('ACGT', 'TGCA'))


async def add_typed(client: Client, strategy_id: str, sequence: str, **arguments) -> int:
    result = await call(client, 'add_typed_sequence', strategy_id=strategy_id, sequence=sequence, **arguments)
    return result['sequence']['id']


async def download(strategy_id: str) -> dict:
    return TestClient(mcp.streamable_http_app()).get(f'/strategies/{strategy_id}.json').json()


def assert_strategy_is_valid(strategy: dict):
    assert cloning_api.post('/validate', json=strategy) is None
    BaseCloningStrategy.model_validate(strategy)
    # Every input of every step is a sequence or primer of the strategy
    ids = {item['id'] for key in ('sequences', 'primers') for item in strategy[key]}
    for source in strategy['sources']:
        assert all(i['sequence'] in ids for i in source['input']), source


@pytest.mark.anyio
async def test_pcr_digest_and_ligate_into_a_vector(client: Client):
    """Clone a PCR product into pFA6a-hphMX6 with BamHI and SacI, replacing the hphMX6 cassette."""
    strategy_id = await new_strategy(client)
    vector = (await add_file(client, strategy_id, 'pFA6a-hphMX6.gb'))['sequence']['id']
    gene = 'ATGAGCAAAGGAGAAGAACTTTTCACTGGAGTTGTCCCAATTCTTGTTGAATTAGATGGTGATGTTAATGGGCACAAATTTTCTGTCAGTGGAGAGGGTGAAGG'
    template = await add_typed(client, strategy_id, gene)
    fwd = await call(client, 'add_primer', strategy_id=strategy_id, name='fwd', sequence='AAAGGATCC' + gene[:20])
    rvs = await call(
        client,
        'add_primer',
        strategy_id=strategy_id,
        name='rvs',
        sequence='AAAGAGCTC' + reverse_complement(gene[-20:]),
    )

    result = await call(
        client,
        'pcr',
        strategy_id=strategy_id,
        template_id=template,
        forward_primer_id=fwd['id'],
        reverse_primer_id=rvs['id'],
    )
    pcr_product = result['sequence']
    assert pcr_product['length'] == len(gene) + 18

    # The digest gives two fragments: nothing is added until one is chosen
    result = await call(
        client, 'restriction_digest', strategy_id=strategy_id, sequence_id=vector, enzymes=['BamHI', 'SacI']
    )
    assert result['status'] == 'choose_product'
    assert [(c['length'], c['left_end'], c['right_end']) for c in result['candidates']] == [
        (1690, "5' overhang GATC", "3' overhang AGCT"),
        (2475, "3' overhang AGCT", "5' overhang GATC"),
    ]
    result = await call(
        client,
        'restriction_digest',
        strategy_id=strategy_id,
        sequence_id=vector,
        enzymes=['BamHI', 'SacI'],
        product_index=1,
    )
    backbone = result['sequence']['id']

    result = await call(
        client,
        'restriction_digest',
        strategy_id=strategy_id,
        sequence_id=pcr_product['id'],
        enzymes=['BamHI', 'SacI'],
        product_index=1,
    )
    insert = result['sequence']

    result = await call(
        client, 'ligation', strategy_id=strategy_id, sequence_ids=[backbone, insert['id']], circular_only=True
    )
    plasmid = result['sequence']
    assert plasmid['topology'] == 'circular'
    assert plasmid['length'] == 2475 + insert['length'] - 8  # two junctions, each with a 4-base overhang

    description = await call(client, 'describe_strategy', strategy_id=strategy_id)
    assert description['sequences'][-1]['made_by'] == {'type': 'LigationSource', 'input_ids': [backbone, insert['id']]}
    assert_strategy_is_valid(await download(strategy_id))


@pytest.mark.anyio
async def test_homology_assemblies(client: Client):
    strategy_id = await new_strategy(client)
    fragments = [
        await add_typed(client, strategy_id, sequence)
        for sequence in ['TATTTTTTacgatAAtgctccCCCCCCGC', 'CCCCCCGCtcatGGGAGGGG', 'GGGAGGGGatataTATTTTTT']
    ]
    result = await call(
        client,
        'gibson_assembly',
        strategy_id=strategy_id,
        sequence_ids=fragments,
        minimal_homology=8,
        circular_only=True,
    )
    assert (result['sequence']['length'], result['sequence']['topology']) == (46, 'circular')

    result = await call(
        client, 'overlap_extension_pcr', strategy_id=strategy_id, sequence_ids=fragments[:2], minimal_homology=8
    )
    assert (result['sequence']['length'], result['sequence']['topology']) == (41, 'linear')

    for tool in ['in_fusion', 'in_vivo_assembly']:
        result = await call(
            client, tool, strategy_id=strategy_id, sequence_ids=fragments, minimal_homology=8, circular_only=True
        )
        assert result['sequence']['length'] == 46

    assert_strategy_is_valid(await download(strategy_id))


@pytest.mark.anyio
async def test_golden_gate(client: Client):
    strategy_id = await new_strategy(client)
    parts = [
        await add_typed(client, strategy_id, sequence)
        for sequence in ['GGTCTCAattaAAAAAttaaAGAGACC', 'GGTCTCAttaaCCCCCatatAGAGACC', 'GGTCTCAatatGGGGGccggAGAGACC']
    ]
    backbone = await add_typed(client, strategy_id, 'TTTTattaAGAGACCTTTTTGGTCTCAccggTTTT', circular=True)
    result = await call(
        client, 'restriction_and_ligation', strategy_id=strategy_id, sequence_ids=parts + [backbone], enzymes=['BsaI']
    )
    assert (result['sequence']['length'], result['sequence']['topology']) == (39, 'circular')
    assert_strategy_is_valid(await download(strategy_id))


@pytest.mark.anyio
async def test_operation_errors(client: Client):
    strategy_id = await new_strategy(client)
    sequence = await add_typed(client, strategy_id, 'AAAGAATTCAAA')

    async def error_message(tool, **arguments) -> str:
        result = await client.call_tool(tool, {'strategy_id': strategy_id, **arguments})
        assert result.is_error
        return result.content[0].text

    assert 'no item with id 7 in the sequences' in await error_message(
        'restriction_digest', sequence_id=7, enzymes=['EcoRI']
    )
    assert 'These enzymes do not cut: BamHI' in await error_message(
        'restriction_digest', sequence_id=sequence, enzymes=['BamHI']
    )
    assert 'product_index must be between 0 and 1' in await error_message(
        'restriction_digest', sequence_id=sequence, enzymes=['EcoRI'], product_index=5
    )


# Naming ======================================================================================


@pytest.mark.anyio
async def test_products_are_named(client: Client):
    strategy_id = await new_strategy(client)
    vector = (await add_file(client, strategy_id, 'pFA6a-hphMX6.gb'))['sequence']['id']

    # Without a name, one is derived from the parent sequence and the operation
    result = await call(
        client,
        'restriction_digest',
        strategy_id=strategy_id,
        sequence_id=vector,
        enzymes=['BamHI', 'SacI'],
        product_index=1,
    )
    assert result['sequence']['name'] == 'pFA6a-hphMX6_BamHI_SacI'

    # With a name, whitespace is replaced so that it is valid in a GenBank file
    result = await call(
        client,
        'restriction_digest',
        strategy_id=strategy_id,
        sequence_id=vector,
        enzymes=['BamHI', 'SacI'],
        name='my backbone',
        product_index=1,
    )
    assert result['sequence']['name'] == 'my_backbone'

    assert_strategy_is_valid(await download(strategy_id))


@pytest.mark.anyio
async def test_rename_sequence(client: Client):
    strategy_id = await new_strategy(client)
    sequence_id = await add_typed(client, strategy_id, 'ACGTACGTACGT', name='original')

    result = await call(client, 'rename_sequence', strategy_id=strategy_id, sequence_id=sequence_id, name='pFA6a-GFP')
    assert result == {'id': sequence_id, 'name': 'pFA6a-GFP'}

    description = await call(client, 'describe_strategy', strategy_id=strategy_id)
    assert description['sequences'][0]['name'] == 'pFA6a-GFP'

    strategy = await download(strategy_id)
    # The step that made the sequence records the name too, like in the web app
    assert strategy['sources'][0]['output_name'] == 'pFA6a-GFP'
    assert_strategy_is_valid(strategy)


# Stage 3b: the other cloning operations =====================================================

LOXP = 'ATAACTTCGTATAGCATACATTATACGAAGTTAT'
ATT_B1 = 'ACAACTTTGTACAAAAAAGCAGAAG'
ATT_P1 = 'AAAATAATGATTTTATTTGACTGATAGTGACCTGTTCGTTGCAACAAATTGATGAGCAATGCTTTTTTATAATGCCAACTTTGTACAAAAAAGCTGAACGAGAAGCGTAAAATGATATAAATATCAATATATTAAATTAGATTTTGCATAAAAAACAGACTACATAATACTGTAAAACACAACATATCCAGTCACTATGAATCAACTACTTAGATGGTATTAGTGACCTGTA'


async def add_primer(client: Client, strategy_id: str, name: str, sequence: str) -> int:
    return (await call(client, 'add_primer', strategy_id=strategy_id, name=name, sequence=sequence))['id']


@pytest.mark.anyio
async def test_homologous_recombination(client: Client):
    strategy_id = await new_strategy(client)
    template = await add_typed(client, strategy_id, 'TTTTacgatAAtgctccCCCC')
    insert = await add_typed(client, strategy_id, 'acgatCCCtgctcc')
    result = await call(
        client,
        'homologous_recombination',
        strategy_id=strategy_id,
        template_id=template,
        insert_id=insert,
        minimal_homology=5,
    )
    assert result['status'] == 'added'
    assert result['sequence']['length'] == 22
    assert_strategy_is_valid(await download(strategy_id))


@pytest.mark.anyio
async def test_crispr_hdr(client: Client):
    strategy_id = await new_strategy(client)
    template = await add_typed(client, strategy_id, 'aaccggttcaatgcaaacagtaatgatggatgacattcaaagcac')
    insert = await add_typed(client, strategy_id, 'aaccggttAAAAAAAAAttcaaagcac')
    guide = await add_primer(client, strategy_id, 'guide', 'ttcaatgcaaacagtaatga')
    result = await call(
        client,
        'crispr_hdr',
        strategy_id=strategy_id,
        template_id=template,
        insert_id=insert,
        guide_primer_ids=[guide],
        minimal_homology=8,
    )
    assert result['status'] == 'added'
    assert result['sequence']['length'] == 27

    strategy = await download(strategy_id)
    # The API rewrites the inputs as the fragments of the assembly (template, insert, template), plus the guide
    assert [i['sequence'] for i in strategy['sources'][-1]['input']] == [template, insert, template, guide]
    assert_strategy_is_valid(strategy)


@pytest.mark.anyio
async def test_gateway_bp(client: Client):
    strategy_id = await new_strategy(client)
    attb = await add_typed(client, strategy_id, 'aaa' + ATT_B1 + 'ccc')
    attp = await add_typed(client, strategy_id, 'aaa' + ATT_P1 + 'ccc')

    sites = await call(client, 'list_gateway_sites', strategy_id=strategy_id, sequence_id=attb)
    assert list(sites) == ['attB1']

    arguments = dict(strategy_id=strategy_id, sequence_ids=[attb, attp], reaction='BP')
    result = await call(client, 'gateway', **arguments)
    assert result['status'] == 'choose_product'
    assert len(result['candidates']) == 2
    result = await call(client, 'gateway', **arguments, product_index=0)
    assert result['status'] == 'added'
    assert_strategy_is_valid(await download(strategy_id))


@pytest.mark.anyio
async def test_cre_lox_excision(client: Client):
    strategy_id = await new_strategy(client)
    locus = await add_typed(client, strategy_id, 'aa' + LOXP + 'acgt' + LOXP + 'cc')
    result = await call(client, 'cre_lox_recombination', strategy_id=strategy_id, sequence_ids=[locus])
    assert result['status'] == 'choose_product'
    assert sorted((c['topology'], c['length']) for c in result['candidates']) == [
        ('circular', 38),
        ('linear', 38),
    ]
    result = await call(
        client, 'cre_lox_recombination', strategy_id=strategy_id, sequence_ids=[locus], product_index=0
    )
    assert result['status'] == 'added'
    assert_strategy_is_valid(await download(strategy_id))


@pytest.mark.anyio
async def test_polymerase_extension(client: Client):
    strategy_id = await new_strategy(client)
    sequence = await add_typed(client, strategy_id, 'aaaGAATTCaaaGAATTCaaa')
    result = await call(
        client, 'restriction_digest', strategy_id=strategy_id, sequence_id=sequence, enzymes=['EcoRI'], product_index=1
    )
    fragment = result['sequence']
    assert fragment['left_end'] != 'blunt'

    result = await call(client, 'polymerase_extension', strategy_id=strategy_id, sequence_id=fragment['id'])
    assert result['status'] == 'added'
    assert (result['sequence']['left_end'], result['sequence']['right_end']) == ('blunt', 'blunt')
    assert_strategy_is_valid(await download(strategy_id))


@pytest.mark.anyio
async def test_reverse_complement(client: Client):
    strategy_id = await new_strategy(client)
    sequence = await add_typed(client, strategy_id, 'ACGTT', name='original')
    result = await call(client, 'reverse_complement', strategy_id=strategy_id, sequence_id=sequence)
    assert result['sequence']['name'] == 'original_rc'

    strategy = await download(strategy_id)
    assert strategy['sequences'][-1]['file_content'].upper().count('AACGT') == 1
    assert [i['sequence'] for i in strategy['sources'][-1]['input']] == [sequence]
    assert_strategy_is_valid(strategy)


@pytest.mark.anyio
async def test_oligo_hybridization(client: Client):
    strategy_id = await new_strategy(client)
    fwd = await add_primer(client, strategy_id, 'fwd', 'aaGCGGCCGCgtagaactttatgtgcttccttacattggt')
    rvs = await add_primer(client, strategy_id, 'rvs', 'aaGCGGCCGCaccaatgtaaggaagcacataaagttctac')
    result = await call(
        client, 'oligo_hybridization', strategy_id=strategy_id, forward_primer_id=fwd, reverse_primer_id=rvs
    )
    assert result['status'] == 'added'

    strategy = await download(strategy_id)
    assert [i['sequence'] for i in strategy['sources'][-1]['input']] == [fwd, rvs]
    assert_strategy_is_valid(strategy)


@pytest.mark.anyio
async def test_api_warnings_reach_the_model(client: Client):
    strategy_id = await new_strategy(client)
    linear = await add_typed(client, strategy_id, 'aaGAATTCaaGATATCaaGAATTCaaGAATTCaa')
    circular = await add_typed(client, strategy_id, 'CCCCGAATTCCCC', circular=True)
    result = await call(
        client,
        'restriction_and_ligation',
        strategy_id=strategy_id,
        sequence_ids=[linear, circular],
        enzymes=['EcoRI', 'EcoRV'],
        circular_only=False,
    )
    assert 'partially digested products' in result['warnings']


async def add_snapgene_file(client: Client, strategy_id: str, path: Path) -> int:
    """SnapGene files are binary: convert them to GenBank text, as the tool only takes text."""
    record = custom_file_parser(io.BytesIO(path.read_bytes()), 'snapgene')[0]
    result = await call(
        client,
        'add_sequence_from_file',
        strategy_id=strategy_id,
        file_name=path.stem + '.gb',
        file_content=record.format('genbank'),
        # These records have no name
        name=path.stem,
    )
    return result['sequence']['id']


@pytest.mark.anyio
async def test_gateway_bp_then_lr_with_real_plasmids(client: Client):
    folder = TEST_FILES / 'gateway_manual_cloning'
    strategy_id = await new_strategy(client)
    donor = await add_snapgene_file(client, strategy_id, folder / 'pDONRtm221.dna')
    pcr_product = await add_snapgene_file(client, strategy_id, folder / 'pcr_product-attP1_1-attP2_1.dna')
    destination = await add_snapgene_file(client, strategy_id, folder / 'pET-53-DESTtm.dna')

    result = await call(
        client,
        'gateway',
        strategy_id=strategy_id,
        sequence_ids=[donor, pcr_product],
        reaction='BP',
        circular_only=True,
        name='entry_clone',
    )
    assert (result['status'], result['sequence']['length'], result['sequence']['topology']) == (
        'added',
        4790,
        'circular',
    )

    arguments = dict(strategy_id=strategy_id, sequence_ids=[result['sequence']['id'], destination], reaction='LR')
    result = await call(client, 'gateway', **arguments)
    assert result['status'] == 'choose_product'
    lengths = [c['length'] for c in result['candidates']]
    assert len(lengths) == 4 and 7423 in lengths
    result = await call(client, 'gateway', **arguments, product_index=lengths.index(7423), name='expression_clone')
    assert result['sequence']['length'] == 7423
    assert_strategy_is_valid(await download(strategy_id))


@pytest.mark.anyio
async def test_upload_binary_files_in_the_browser(client: Client):
    strategy_id = await new_strategy(client)
    upload_url = (await call(client, 'get_upload_link', strategy_id=strategy_id))['upload_url']
    path = f'/strategies/{strategy_id}/upload'
    assert upload_url.endswith(path)

    http = TestClient(mcp.streamable_http_app())
    assert 'multiple' in http.get(path).text
    folder = TEST_FILES / 'gateway_manual_cloning'
    uploads = [('file', (f.name, f.read_bytes())) for f in (folder / 'pDONRtm221.dna', folder / 'pET-53-DESTtm.dna')]
    response = http.post(path, files=uploads)
    assert response.status_code == 200
    assert 'sequence 1' in response.text and 'sequence 2' in response.text

    sequences = (await call(client, 'describe_strategy', strategy_id=strategy_id))['sequences']
    assert [(s['id'], s['name']) for s in sequences] == [(1, 'pDONRtm221'), (2, 'pET-53-DESTtm')]
    assert_strategy_is_valid(await download(strategy_id))


def test_landing_page_is_html_with_the_server_url():
    response = TestClient(mcp.streamable_http_app()).get('/')
    assert response.status_code == 200
    assert response.headers['content-type'].startswith('text/html')
    assert f'{BASE_URL}/mcp' in response.text
    assert '{{' not in response.text


@pytest.mark.anyio
async def test_start_strategy_tells_the_user_about_files_and_has_a_prompt(client: Client):
    result = await call(client, 'start_strategy')
    assert 'upload link' in result['tell_the_user']
    prompts = await client.list_prompts()
    assert [p.name for p in prompts.prompts] == ['start']


# Genome regions from NCBI (these call NCBI, like the backend tests of the same endpoints) ====


@pytest.mark.flaky(reruns=2, reruns_delay=2)
@pytest.mark.anyio
async def test_genome_region_from_a_gene(client: Client):
    result = await call(client, 'find_genome_assembly', query='Schizosaccharomyces pombe')
    assembly = result['assemblies'][0]
    assert (assembly['assembly_id'], assembly['has_gene_annotation']) == ('GCF_000002945.2', True)
    result = await call(client, 'find_genome_assembly', query='GCF_000002945')
    assert result['assemblies'][0]['assembly_id'] == 'GCF_000002945.2'

    found = await call(client, 'find_gene', assembly_id='GCF_000002945.2', query='cdc2')
    # The exact match comes first even though NCBI does not return it first
    cdc2 = found['genes'][0]
    assert cdc2['symbol'] == 'cdc2'
    gene_length = cdc2['end'] - cdc2['start'] + 1

    strategy_id = await new_strategy(client)
    result = await call(
        client,
        'add_genome_region_from_gene',
        strategy_id=strategy_id,
        assembly_id='GCF_000002945.2',
        gene=cdc2['locus_tag'],
        upstream_bases=100,
        downstream_bases=50,
    )
    assert result['status'] == 'added'
    assert result['sequence']['name'] == 'cdc2'
    assert result['sequence']['length'] == gene_length + 150
    assert_strategy_is_valid(await download(strategy_id))

    # An ambiguous gene is refused, and the model is told what to do
    response = await client.call_tool(
        'add_genome_region_from_gene',
        {'strategy_id': strategy_id, 'assembly_id': 'GCF_000002945.2', 'gene': 'not_a_gene_xyz'},
    )
    assert response.is_error


@pytest.mark.flaky(reruns=2, reruns_delay=2)
@pytest.mark.anyio
async def test_flanks_are_relative_to_the_gene_on_the_minus_strand(client: Client):
    # cdc3 is on the minus strand: its upstream flank is on the right of its coordinates
    strategy_id = await new_strategy(client)

    async def region(upstream: int, downstream: int) -> str:
        await call(
            client,
            'add_genome_region_from_gene',
            strategy_id=strategy_id,
            assembly_id='GCF_000002945.2',
            gene='cdc3',
            upstream_bases=upstream,
            downstream_bases=downstream,
            name=f'cdc3_{upstream}_{downstream}',
        )
        record = SeqIO.read(io.StringIO((await download(strategy_id))['sequences'][-1]['file_content']), 'genbank')
        return str(record.seq).upper()

    gene = await region(0, 0)
    with_upstream = await region(20, 0)
    with_downstream = await region(0, 20)
    assert len(gene) == 570
    # The product is oriented as the gene: upstream comes before it, downstream after it
    assert with_upstream.endswith(gene) and len(with_upstream) == 590
    assert with_downstream.startswith(gene) and len(with_downstream) == 590


@pytest.mark.flaky(reruns=2, reruns_delay=2)
@pytest.mark.anyio
async def test_genome_region_from_coordinates(client: Client):
    chromosomes = (await call(client, 'list_assembly_chromosomes', assembly_id='GCF_000002945.2'))['chromosomes']
    assert 'NC_003424.3' in [c['sequence_accession'] for c in chromosomes]

    strategy_id = await new_strategy(client)
    result = await call(
        client,
        'add_genome_region_from_coordinates',
        strategy_id=strategy_id,
        sequence_accession='NC_003424.3',
        start=1000,
        end=1999,
        strand='minus',
        assembly_id='GCF_000002945.2',
    )
    assert result['sequence']['length'] == 1000
    assert_strategy_is_valid(await download(strategy_id))
