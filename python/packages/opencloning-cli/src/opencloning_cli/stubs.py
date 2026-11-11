from pydantic import BaseModel, Field
from typing import Generator
from Bio.Seq import reverse_complement
from pydna import opencloning_models
from pydna.assembly2 import pcr_assembly
from pydna.dseqrecord import Dseqrecord
from pydna.primer import Primer


def _renumber_ids_by_appearance(cloning_strategy: dict) -> dict:
    """Renumber the local ids of a dumped cloning strategy in order of appearance.

    pydna assigns ids with Python's id() (memory addresses) and renumbers them sorted by address,
    which depends on the platform and allocation order, so the same strategy gets different ids on
    different machines. Numbering by position (sequences, then primers, then sources) is stable.
    A source and the sequence it produces share an id, so they keep sharing the new one.
    """
    mapping: dict[int, int] = {}
    for item in [*cloning_strategy['sequences'], *cloning_strategy['primers'], *cloning_strategy['sources']]:
        mapping.setdefault(item['id'], len(mapping) + 1)
    for item in [*cloning_strategy['sequences'], *cloning_strategy['primers'], *cloning_strategy['sources']]:
        item['id'] = mapping[item['id']]
    for source in cloning_strategy['sources']:
        for source_input in source['input']:
            source_input['sequence'] = mapping[source_input['sequence']]
    return cloning_strategy


primer1 = Primer('ACGTACGT')
primer2 = Primer(reverse_complement('GCGCGCGC'))
pcr_template = Dseqrecord('ccccACGTACGTAAAAAAGCGCGCGCcccc', circular=True)
pcr_product, *_ = pcr_assembly(pcr_template, primer1, primer2, limit=8)
cs_pcr = _renumber_ids_by_appearance(opencloning_models.CloningStrategy.from_dseqrecords([pcr_product]).model_dump())


class StubRequest(BaseModel):
    endpoint: str
    method: str = Field(..., pattern=r'^(GET|POST|PUT|DELETE|PATCH)$')
    name: str
    params: dict | None = None
    body: dict | list | None = None
    headers: dict | None = None
    body_from_stub: str | None = None
    multipart_files: list[dict[str, str]] | None = None
    binary_response: bool = False
    reset_db: bool = False
    expected_status_code: int = 200


class StubResponse(BaseModel):
    body: dict | list | str
    status_code: int
    headers: dict


class RecordedStub(BaseModel):
    endpoint: str
    method: str = Field(..., pattern=r'^(GET|POST|PUT|DELETE|PATCH)$')
    name: str
    params: dict | None = None
    body: dict | list | None = None
    headers: dict | None = None
    response: StubResponse


def get_stub(dirname: str, stub_name: str) -> RecordedStub:
    with open(f'{dirname}/{stub_name}.json', 'r') as f:
        return RecordedStub.model_validate_json(f.read())


def get_selected_primer_id(dirname: str, stub_name: str) -> int:
    stub = get_stub(dirname, stub_name)
    return next(item for item in stub.response.body['items'] if item['name'] == 'lacZ_attB1_fwd')['id']


def get_selected_sequence_id(dirname: str, stub_name: str) -> int:
    stub = get_stub(dirname, stub_name)
    return next(item for item in stub.response.body['items'] if item['name'] == 'ase1_CDS_PCR')['id']


def get_selected_tag_id(dirname: str, stub_name: str) -> int:
    stub = get_stub(dirname, stub_name)
    return next(item for item in stub.response.body if item['name'] == 'gibson_assembly')['id']


def stubs(dirname: str) -> Generator[StubRequest, None, None]:
    yield StubRequest(
        name='get_primers',
        endpoint='/db/primers',
        method='GET',
    )
    yield StubRequest(
        name='get_primers_search_by_name',
        endpoint='/db/primers',
        method='GET',
        params={'name': 'lacZ_attB1_fwd'},
    )
    yield StubRequest(
        name='get_primer',
        endpoint=f'/db/primers/{get_selected_primer_id(dirname, "get_primers")}',
        method='GET',
    )
    yield StubRequest(
        name='post_primer',
        endpoint='/db/primers',
        method='POST',
        body={'name': 'new', 'sequence': 'GGCC'},
        reset_db=True,
    )
    yield StubRequest(
        name='patch_primer',
        endpoint=f'/db/primers/{get_selected_primer_id(dirname, "get_primers")}',
        method='PATCH',
        body={'name': 'lacZ_renamed'},
        reset_db=True,
    )
    yield StubRequest(
        name='get_sequences',
        endpoint='/db/sequences',
        method='GET',
    )
    yield StubRequest(
        name='get_sequences_search_by_name',
        endpoint='/db/sequences',
        method='GET',
        params={'name': 'ase1_CDS_PCR'},
    )
    yield StubRequest(
        name='get_sequences_search_by_name_uid_query',
        endpoint='/db/sequences',
        method='GET',
        params={'uid': 'ase1_CDS_PCR'},
    )
    yield StubRequest(
        name='get_sequences_search_by_uid',
        endpoint='/db/sequences',
        method='GET',
        params={'uid': 'example_sequencing-sample'},
    )
    yield StubRequest(
        name='get_sequences_search_by_uid_name_query',
        endpoint='/db/sequences',
        method='GET',
        params={'name': 'example_sequencing-sample'},
    )
    selected_sequence_id = get_selected_sequence_id(dirname, 'get_sequences_search_by_name')
    yield StubRequest(
        name='get_sequence',
        endpoint=f'/db/sequences/{selected_sequence_id}',
        method='GET',
    )
    yield StubRequest(
        name='patch_sequence',
        endpoint=f'/db/sequences/{selected_sequence_id}',
        method='PATCH',
        body={'name': 'ase1_renamed'},
        reset_db=True,
    )
    yield StubRequest(
        name='get_sequence_by_uid',
        endpoint='/db/sequences/by-uid/example_sequencing-sample',
        method='GET',
    )
    yield StubRequest(
        name='get_sequences_by_seguid',
        endpoint='/db/sequences/by-seguid/ldseguid=oMGruVpBiElY0ffP28XC_BlHXv8',
        method='GET',
    )
    yield StubRequest(
        name='get_text_file_sequence',
        endpoint=f'/db/sequences/{selected_sequence_id}/text_file_sequence',
        method='GET',
    )
    yield StubRequest(
        name='get_text_file_sequences_by_ids',
        endpoint='/db/sequences/text_file_sequences',
        method='GET',
        params={'ids': str(selected_sequence_id)},
    )
    yield StubRequest(
        name='get_tags',
        endpoint='/db/tags',
        method='GET',
    )
    yield StubRequest(
        name='get_text_file_sequences_by_tag',
        endpoint='/db/sequences/text_file_sequences',
        method='GET',
        params={'tags': str(get_selected_tag_id(dirname, 'get_tags'))},
    )
    yield StubRequest(
        name='get_cloning_strategy',
        endpoint=f'/db/sequences/{selected_sequence_id}/cloning_strategy',
        method='GET',
    )
    yield StubRequest(
        name='get_sequence_primers',
        endpoint=f'/db/sequences/{selected_sequence_id}/primers',
        method='GET',
    )
    yield StubRequest(
        name='post_sequence',
        endpoint='/db/sequences',
        method='POST',
        body=cs_pcr,
        reset_db=True,
    )
    yield StubRequest(
        name='post_sequence_search',
        endpoint='/db/sequences/search',
        method='POST',
        body=get_stub(dirname, 'get_text_file_sequence').response.body,
    )
    yield StubRequest(
        name='post_sequence_sequencing_files',
        endpoint=f'/db/sequences/{selected_sequence_id}/sequencing_files',
        method='POST',
        multipart_files=[
            {
                'filename': 'run.ab1',
                'content': 'SEQUENCING-RUN-1',
                'content_type': 'application/octet-stream',
            }
        ],
    )
    yield StubRequest(
        name='get_sequence_sequencing_files',
        endpoint=f'/db/sequences/{selected_sequence_id}/sequencing_files',
        method='GET',
    )
    last_file_id = get_stub(dirname, 'get_sequence_sequencing_files').response.body[-1]['id']
    yield StubRequest(
        name='download_sequencing_file',
        endpoint=f'/db/sequencing_files/{last_file_id}/download',
        method='GET',
        binary_response=True,
        reset_db=True,
    )
