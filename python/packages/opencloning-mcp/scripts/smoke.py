"""Walk through the tools against the running server, over real HTTP, and print what happens.

Start the server first (uv run opencloning-mcp), then: uv run python packages/opencloning-mcp/scripts/smoke.py
The resulting strategy is saved next to this script as smoke_strategy.json, to open it in the web app.
"""

import asyncio
import json
import sys
import urllib.request
from pathlib import Path

from fastapi.testclient import TestClient
from mcp import Client
from opencloning.main import app as cloning_app

SERVER_URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8002/mcp'
TEST_FILES = Path(__file__).parents[2] / 'opencloning' / 'tests' / 'test_files'
OUTPUT_FILE = Path(__file__).parent / 'smoke_strategy.json'


def shorten(value):
    return value[:40] + '...' if isinstance(value, str) and len(value) > 40 else value


async def call(client: Client, tool: str, **arguments) -> dict:
    result = await client.call_tool(tool, arguments)
    text = result.content[0].text
    print(f'\n>>> {tool}({", ".join(f"{k}={shorten(v)!r}" for k, v in arguments.items())})')
    print(('ERROR: ' if result.is_error else '') + text)
    if result.is_error:
        raise SystemExit(1)
    return json.loads(text)


async def main():
    async with Client(SERVER_URL) as client:
        tools = await client.list_tools()
        print('Tools exposed by the server:')
        for tool in tools.tools:
            print(f'  - {tool.name}{tuple(tool.input_schema["properties"])}')

        strategy_id = (await call(client, 'start_strategy', description='smoke test'))['strategy_id']

        # Imports
        plasmid_file = TEST_FILES / 'pFA6a-hphMX6.gb'
        result = await call(
            client,
            'add_sequence_from_file',
            strategy_id=strategy_id,
            file_name=plasmid_file.name,
            file_content=plasmid_file.read_text(),
        )
        vector = result['sequence']['id']
        multi_fasta = (TEST_FILES / 'dummy_multi_fasta.fasta').read_text()
        await call(
            client, 'add_sequence_from_file', strategy_id=strategy_id, file_name='two.fasta', file_content=multi_fasta
        )
        await call(
            client,
            'add_sequence_from_file',
            strategy_id=strategy_id,
            file_name='two.fasta',
            file_content=multi_fasta,
            product_index=1,
        )
        await call(client, 'add_sequence_from_genbank', strategy_id=strategy_id, accession='NM_001018957.2')

        # Cloning: design primers that add BamHI / SacI sites to a gene fragment, PCR it, and ligate it into the vector
        # instead of its hphMX6 cassette
        gene = 'ATGAGCAAAGGAGAAGAACTTTTCACTGGAGTTGTCCCAATTCTTGTTGAATTAGATGGTGATGTTAATGGGCACAAATTTTCTGTCAGTGG'
        result = await call(client, 'add_typed_sequence', strategy_id=strategy_id, sequence=gene, name='gene')
        template = result['sequence']['id']
        designed = await call(
            client,
            'design_pcr_primers',
            strategy_id=strategy_id,
            template_id=template,
            left_enzyme='BamHI',
            right_enzyme='SacI',
            minimal_annealing=15,
        )
        fwd, rvs = designed['primers']
        result = await call(
            client,
            'pcr',
            strategy_id=strategy_id,
            template_id=template,
            forward_primer_id=fwd['id'],
            reverse_primer_id=rvs['id'],
            name='GFP_pcr',
        )
        await call(client, 'pcr_primer_details', strategy_id=strategy_id, sequence_id=result['sequence']['id'])
        pcr_product = result['sequence']['id']
        await call(
            client, 'restriction_digest', strategy_id=strategy_id, sequence_id=vector, enzymes=['BamHI', 'SacI']
        )
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
            sequence_id=pcr_product,
            enzymes=['BamHI', 'SacI'],
            product_index=1,
        )
        insert = result['sequence']['id']
        result = await call(
            client,
            'ligation',
            strategy_id=strategy_id,
            sequence_ids=[backbone, insert],
            name='pFA6a-GFP',
            circular_only=True,
        )
        # The user can always ask for another name
        await call(
            client,
            'rename_sequence',
            strategy_id=strategy_id,
            sequence_id=result['sequence']['id'],
            name='pFA6a-GFP-hph',
        )

        # Stage 3b operations: anneal two oligos into a NotI linker, blunt a fragment, reverse complement it
        fwd = await call(
            client, 'add_primer', strategy_id=strategy_id, name='oligo_fwd', sequence='aaGCGGCCGCgtagaactttatgtgcttcc'
        )
        rvs = await call(
            client, 'add_primer', strategy_id=strategy_id, name='oligo_rvs', sequence='aaGCGGCCGCggaagcacataaagttctac'
        )
        await call(
            client,
            'oligo_hybridization',
            strategy_id=strategy_id,
            forward_primer_id=fwd['id'],
            reverse_primer_id=rvs['id'],
            name='NotI_linker',
        )
        result = await call(client, 'polymerase_extension', strategy_id=strategy_id, sequence_id=insert)
        await call(client, 'reverse_complement', strategy_id=strategy_id, sequence_id=result['sequence']['id'])

        # Homologous recombination of a cassette into a linear locus, then Cre-lox excision of the marker
        loxp = 'ATAACTTCGTATAGCATACATTATACGAAGTTAT'
        left, right = 'ACGATCGATCGTAGCTAGCT', 'TTGCAGCTAGCTAGGATCGA'
        result = await call(
            client, 'add_typed_sequence', strategy_id=strategy_id, sequence=left + 'GGGGGGGGGG' + right, name='locus'
        )
        locus = result['sequence']['id']
        result = await call(
            client,
            'add_typed_sequence',
            strategy_id=strategy_id,
            sequence=left + loxp + 'CATCATCATCAT' + loxp + right,
            name='lox_cassette',
        )
        result = await call(
            client,
            'homologous_recombination',
            strategy_id=strategy_id,
            template_id=locus,
            insert_id=result['sequence']['id'],
            minimal_homology=20,
            name='locus_lox',
        )
        knock_in = result['sequence']['id']
        await call(client, 'cre_lox_recombination', strategy_id=strategy_id, sequence_ids=[knock_in])
        await call(
            client,
            'cre_lox_recombination',
            strategy_id=strategy_id,
            sequence_ids=[knock_in],
            product_index=1,
            name='locus_excised',
        )

        await call(client, 'describe_strategy', strategy_id=strategy_id)
        export = await call(client, 'get_strategy_json', strategy_id=strategy_id)

    print('\n>>> Download', export['download_url'])
    with urllib.request.urlopen(export['download_url']) as response:
        strategy = json.load(response)
    OUTPUT_FILE.write_text(json.dumps(strategy, indent=2))
    print(f'Saved to {OUTPUT_FILE}')

    print('\n>>> Validate the downloaded JSON with the backend /validate endpoint')
    response = TestClient(cloning_app).post('/validate', json=strategy)
    print('status:', response.status_code, '| warnings:', response.headers.get('x-warning'))
    assert response.status_code == 200


asyncio.run(main())
