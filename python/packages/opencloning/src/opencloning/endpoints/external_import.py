from fastapi import Body, Query, HTTPException, Response, UploadFile, File
from opencloning.app_settings import settings
from pydantic import create_model
import io
import warnings
import asyncio
from fastapi.responses import RedirectResponse
from Bio import BiopythonParserWarning
from typing import Annotated
from pydna.utils import location_boundaries
from pydna.opencloning_models import CloningStrategy as PydnaCloningStrategy

from opencloning.endpoints.endpoint_utils import format_products, read_upload_with_limit
from pydna.snapgene_history_parser import parse_snapgene_history, SnapgeneHistoryParserWarning

from ..get_router import get_router
from opencloning_linkml.datamodel import (
    CloningStrategy,
    TextFileSequence,
    UploadedFileSource,
    RepositoryIdSource,
    AddgeneIdSource,
    WekWikGeneIdSource,
    BenchlingUrlSource,
    SnapGenePlasmidSource,
    EuroscarfSource,
    IGEMSource,
    GenomeCoordinatesSource,
    SequenceFileFormat,
    SEVASource,
    OpenDNACollectionsSource,
    NCBISequenceSource,
)
from pydna.opencloning_models import SequenceLocationStr
from ..dna_functions import (
    format_sequence_genbank,
    get_sequence_from_benchling_url,
    get_sequence_from_iGEM2024,
    get_sequence_from_openDNA_collections,
    request_from_addgene,
    request_from_snapgene,
    request_from_wekwikgene,
    custom_file_parser,
    get_sequence_from_euroscarf_url,
    get_seva_plasmid,
    read_dsrecord_from_json,
)
from .. import request_examples
from .. import ncbi_requests
from ..http_client import ConnectError

router = get_router()


# TODO limit the maximum size of submitted files
@router.post(
    '/read_from_file',
    response_model=create_model(
        'UploadedFileResponse', sources=(list[UploadedFileSource], ...), sequences=(list[TextFileSequence], ...)
    ),
    responses={
        200: {
            'description': 'The sequence was successfully parsed',
            'headers': {
                'x-warning': {
                    'description': 'A warning returned if the file can be read but is not in the expected format or if some sequences were not extracted because they are incompatible with the provided coordinates',
                    'schema': {'type': 'string'},
                },
            },
        },
        422: {
            'description': 'Biopython cannot process this file or provided coordinates are invalid.',
        },
        404: {
            'description': 'The index_in_file is out of range.',
        },
    },
)
def read_from_file(
    response: Response,
    file: UploadFile = File(...),
    sequence_file_format: SequenceFileFormat | None = Query(
        None,
        description='Format of the sequence file. Unless specified, it will be guessed from the extension',
    ),
    index_in_file: int | None = Query(
        None,
        description='The index of the sequence in the file for multi-sequence files',
    ),
    circularize: bool = Query(
        False,
        description='circularize the sequence read (for GenBank or Snapgene files, it will override the topology indicated in the file)',
    ),
    output_name: str | None = Query(
        None,
        description='Name of the output sequence',
    ),
    start: int | None = Query(None, description='Start position of the sequence to read (0-based)', ge=0),
    end: int | None = Query(
        None,
        description='End position of the sequence to read (0-based)',
        ge=0,
    ),
):
    """Return a json sequence from a sequence file"""

    if sequence_file_format is None:
        extension_dict = {
            'gbk': 'genbank',
            'gb': 'genbank',
            'ape': 'genbank',
            'dna': 'snapgene',
            'fasta': 'fasta',
            'embl': 'embl',
            'fa': 'fasta',
        }
        extension = file.filename.split('.')[-1].lower()
        if extension not in extension_dict:
            raise HTTPException(
                422,
                'We could not guess the format of the file from its extension. Please provide file_format as a query parameter.',
            )

        # We guess the file type from the extension
        sequence_file_format = SequenceFileFormat(extension_dict[extension])

    dseqs = list()
    warning_messages = list()

    file_content = read_upload_with_limit(file, settings.MAX_SEQUENCE_FILE_SIZE_MB)
    if sequence_file_format == 'snapgene':
        file_streamer = io.BytesIO(file_content)
    else:
        file_streamer = io.StringIO(file_content.decode('utf-8', errors='replace'))

    try:
        # Capture warnings without converting to errors:
        with warnings.catch_warnings(record=True, category=UserWarning) as warnings_captured:
            dseqs = custom_file_parser(file_streamer, sequence_file_format, circularize)

        # If there were warnings, add them to the response header
        warnings_captured = [w for w in warnings_captured if w.category is not BiopythonParserWarning]

        if warnings_captured:
            warning_messages = [str(w.message) for w in warnings_captured]

    except ValueError as e:
        raise HTTPException(422, f'Biopython cannot process this file: {e}.') from e

    if index_in_file is not None:
        if index_in_file >= len(dseqs):
            raise HTTPException(404, 'The index_in_file is out of range.')
        dseqs = [dseqs[index_in_file]]

    seq_feature = None
    if start is not None and end is not None:
        extracted_sequences = list()
        for dseq in dseqs:
            try:
                seq_feature = SequenceLocationStr.from_start_and_end(start=start, end=end, seq_len=len(dseq))
                # TODO: We could use extract when this is addressed: https://github.com/biopython/biopython/issues/4989
                location = seq_feature.to_biopython_location()
                i, j = location_boundaries(location)
                extracted_sequence = dseq[i:j]
                # Only add the sequence if the interval is not out of bounds
                if len(extracted_sequence) == len(location):
                    extracted_sequences.append(extracted_sequence)
                else:
                    extracted_sequences.append(None)
            except Exception:
                extracted_sequences.append(None)
        dseqs = extracted_sequences

    # The common part
    parent_source = UploadedFileSource(
        id=0,
        sequence_file_format=sequence_file_format,
        file_name=file.filename,
        circularize=circularize,
        coordinates=seq_feature,
    )

    # If coordinates are provided, we only keep the sequences compatible with those coordinates
    out_sources = list()
    out_sequences = list()
    for i in range(len(dseqs)):
        if dseqs[i] is None:
            continue
        new_source = parent_source.model_copy()
        new_source.index_in_file = index_in_file if index_in_file is not None else i
        out_sources.append(new_source)
        out_sequences.append(format_sequence_genbank(dseqs[i], output_name))

    if len(out_sequences) == 0:
        raise HTTPException(422, 'Provided coordinates are incompatible with sequences in the file.')

    if len(out_sequences) < len(dseqs):
        warning_messages.append(
            'Some sequences were not extracted because they are incompatible with the provided coordinates.'
        )

    if len(warning_messages) > 0:
        response.headers['x-warning'] = '; '.join(warning_messages)

    # Validate that the sequences are in a valid genbank format
    for seq in out_sequences:
        read_dsrecord_from_json(seq)

    return {'sequences': out_sequences, 'sources': out_sources}


@router.post(
    '/read_snapgene_history',
    response_model=CloningStrategy,
    responses={
        200: {
            'description': 'The history was successfully parsed',
            'headers': {
                'x-warning': {
                    'description': 'A warning returned if some of the snapgene operations are not supported',
                    'schema': {'type': 'string'},
                },
            },
        },
    },
)
def read_snapgene_history(response: Response, file: UploadFile = File(...)):
    file_content = read_upload_with_limit(file, settings.MAX_SEQUENCE_FILE_SIZE_MB)
    try:
        with warnings.catch_warnings(record=True, category=SnapgeneHistoryParserWarning) as warnings_captured:
            seqr = parse_snapgene_history(file_content, file.filename or 'file.dna')
        if warnings_captured:
            warning_messages = [str(w.message) for w in warnings_captured]
            response.headers['x-warning'] = '; '.join(warning_messages)
        cloning_strategy = PydnaCloningStrategy.from_dseqrecords([seqr])
        return cloning_strategy.model_dump()
    except Exception as e:
        raise HTTPException(
            501, f'We could not read the history from the file, use the read_from_file endpoint instead: {e}'
        ) from e


def handle_repository_errors(exception: Exception, repository_name: str) -> None:
    """
    Centralized error handler for repository requests, to be called from an ``except`` block.
    Converts ConnectError to HTTPException with 504 status. Anything else is re-raised: HTTPExceptions
    are returned as-is, and unexpected errors end up as a generic 500 (logged once, with their stack).
    """
    if isinstance(exception, ConnectError):
        raise HTTPException(504, f'Unable to connect to {repository_name}: {exception}')
    raise


# TODO: a bit inconsistent that here you don't put {source: {...}} in the request, but
# directly the object.


# Redirect to the right repository
@router.post(
    '/repository_id',
    response_model=create_model(
        'RepositoryIdResponse',
        sources=(
            list[RepositoryIdSource]
            | list[AddgeneIdSource]
            | list[BenchlingUrlSource]
            | list[EuroscarfSource]
            | list[WekWikGeneIdSource]
            | list[SEVASource]
            | list[OpenDNACollectionsSource],
            ...,
        ),
        sequences=(list[TextFileSequence], ...),
    ),
)
async def get_from_repository_id(
    source: (
        AddgeneIdSource
        | BenchlingUrlSource
        | SnapGenePlasmidSource
        | EuroscarfSource
        | WekWikGeneIdSource
        | SEVASource
        | OpenDNACollectionsSource
        | NCBISequenceSource
    ),
):
    mapping_dict = {
        'AddgeneIdSource': 'addgene',
        'BenchlingUrlSource': 'benchling',
        'SnapGenePlasmidSource': 'snapgene',
        'EuroscarfSource': 'euroscarf',
        'WekWikGeneIdSource': 'wekwikgene',
        'SEVASource': 'seva',
        'OpenDNACollectionsSource': 'open_dna_collections',
        'NCBISequenceSource': 'genbank',
    }
    return RedirectResponse(f'/repository_id/{mapping_dict[source.type]}', status_code=307)


@router.post(
    '/repository_id/genbank',
    response_model=create_model(
        'RepositoryIdResponse', sources=(list[NCBISequenceSource], ...), sequences=(list[TextFileSequence], ...)
    ),
)
async def get_from_repository_id_genbank(source: NCBISequenceSource):
    try:
        # This request already fails if the sequence does not exist
        seq_length = await ncbi_requests.get_sequence_length_from_sequence_accession(source.repository_id)
        if seq_length > settings.NCBI_MAX_SEQUENCE_LENGTH:
            raise HTTPException(400, f'sequence is too long (max {settings.NCBI_MAX_SEQUENCE_LENGTH} bp)')
        seq = await ncbi_requests.get_genbank_sequence(source.repository_id)
    except Exception as exception:
        handle_repository_errors(exception, 'NCBI')

    return format_products(source.id, [seq], None, source.output_name)


@router.post(
    '/repository_id/addgene',
    response_model=create_model(
        'AddgeneIdResponse', sources=(list[AddgeneIdSource], ...), sequences=(list[TextFileSequence], ...)
    ),
)
async def get_from_repository_id_addgene(source: AddgeneIdSource):
    try:
        dseq = await request_from_addgene(source.repository_id)
    except Exception as exception:
        handle_repository_errors(exception, 'Addgene')

    # sequence_file_url and addgene_sequence_type in the request are not validated (the urls served by
    # Addgene have changed over time), the returned source always contains the current values.
    return format_products(source.id, [dseq], None, source.output_name)


@router.post(
    '/repository_id/wekwikgene',
    response_model=create_model(
        'WekWikGeneIdResponse', sources=(list[WekWikGeneIdSource], ...), sequences=(list[TextFileSequence], ...)
    ),
)
async def get_from_repository_id_wekwikgene(source: WekWikGeneIdSource):
    try:
        dseq = await request_from_wekwikgene(source.repository_id)
    except Exception as exception:
        handle_repository_errors(exception, 'WeKwikGene')
    return format_products(
        source.id,
        [dseq],
        source if source.sequence_file_url is not None else None,
        source.output_name,
        wrong_completed_source_error_message=f'''
        The provided source is not valid.
        We found the following:
          - repository_id: {dseq.source.repository_id}
          - sequence_file_url: {dseq.source.sequence_file_url}
        ''',
    )


@router.post(
    '/repository_id/benchling',
    response_model=create_model(
        'BenchlingUrlResponse', sources=(list[BenchlingUrlSource], ...), sequences=(list[TextFileSequence], ...)
    ),
)
async def get_from_benchling_url(
    source: Annotated[BenchlingUrlSource, Body(openapi_examples=request_examples.benchling_url_examples)],
):
    try:
        dseq = await get_sequence_from_benchling_url(source.repository_id)
        return format_products(source.id, [dseq], None, source.output_name)
    except Exception as exception:
        handle_repository_errors(exception, 'Benchling')


@router.post(
    '/repository_id/snapgene',
    response_model=create_model(
        'SnapGenePlasmidResponse', sources=(list[SnapGenePlasmidSource], ...), sequences=(list[TextFileSequence], ...)
    ),
)
async def get_from_repository_id_snapgene(
    source: Annotated[SnapGenePlasmidSource, Body(openapi_examples=request_examples.snapgene_plasmid_examples)],
):
    try:
        plasmid_set, plasmid_name = source.repository_id.split('/')
        seq = await request_from_snapgene(plasmid_set, plasmid_name)
        return format_products(source.id, [seq], None, source.output_name)
    except Exception as exception:
        handle_repository_errors(exception, 'Snapgene')


@router.post(
    '/repository_id/euroscarf',
    response_model=create_model(
        'EuroscarfResponse', sources=(list[EuroscarfSource], ...), sequences=(list[TextFileSequence], ...)
    ),
)
async def get_from_repository_id_euroscarf(source: EuroscarfSource):
    """
    Return the sequence from a plasmid in Euroscarf. Sometimes plasmid files do not contain correct topology information
    (they indicate linear sequence instead of circular). We force them to be circular.
    """
    try:
        dseq = await get_sequence_from_euroscarf_url(source.repository_id)
        return format_products(source.id, [dseq], None, source.output_name)
    except Exception as exception:
        handle_repository_errors(exception, 'Euroscarf')


@router.post(
    '/repository_id/igem',
    response_model=create_model(
        'IGEMResponse', sources=(list[IGEMSource], ...), sequences=(list[TextFileSequence], ...)
    ),
)
async def get_from_repository_id_igem(source: IGEMSource):
    try:
        dseq = await get_sequence_from_iGEM2024(*source.repository_id.split('-'))
        return format_products(
            source.id,
            [dseq],
            source if source.sequence_file_url is not None else None,
            source.output_name,
            wrong_completed_source_error_message=f'''
            The provided source is not valid.
            We found the following:
              - repository_id: {source.repository_id}
              - sequence_file_url: {dseq.source.sequence_file_url}
            ''',
        )
    except Exception as exception:
        handle_repository_errors(exception, 'iGEM')


@router.post(
    '/repository_id/open_dna_collections',
    response_model=create_model(
        'OpenDNACollectionsResponse',
        sources=(list[OpenDNACollectionsSource], ...),
        sequences=(list[TextFileSequence], ...),
    ),
)
async def get_from_repository_id_open_dna_collections(source: OpenDNACollectionsSource):
    try:
        collection_name, plasmid_id = source.repository_id.split('/')
        dseq = await get_sequence_from_openDNA_collections(collection_name, plasmid_id)
        return format_products(
            source.id,
            [dseq],
            source if source.sequence_file_url is not None else None,
            source.output_name,
            wrong_completed_source_error_message=f'''
            The provided source is not valid.
            We found the following:
              - collection_name: {collection_name}
              - plasmid_id: {plasmid_id}
              - sequence_file_url: {dseq.source.sequence_file_url}
            ''',
        )
    except Exception as exception:
        handle_repository_errors(exception, 'OpenDNA Collections')


@router.post(
    '/genome_coordinates',
    response_model=create_model(
        'GenomeRegionResponse', sources=(list[GenomeCoordinatesSource], ...), sequences=(list[TextFileSequence], ...)
    ),
)
async def genome_coordinates(
    source: Annotated[GenomeCoordinatesSource, Body(openapi_examples=request_examples.genome_region_examples)],
):

    # Validate that coordinates make sense
    try:
        location_str = SequenceLocationStr(source.coordinates)
        location = location_str.to_biopython_location()
        start, end, strand = location_str.get_ncbi_format_coordinates()
    except Exception as e:
        raise HTTPException(422, f'Invalid coordinates: {e}') from e

    if len(location) > settings.NCBI_MAX_SEQUENCE_LENGTH:
        raise HTTPException(400, f'sequence is too long (max {settings.NCBI_MAX_SEQUENCE_LENGTH} bp)')

    if source.locus_tag is not None and source.assembly_accession is None:
        raise HTTPException(422, 'assembly_accession is required if locus_tag is set')

    # Source includes a locus tag in annotated assembly
    async def validate_locus_task():
        if source.locus_tag is not None:
            return await ncbi_requests.validate_locus_tag(
                source.locus_tag,
                source.assembly_accession,
                source.gene_id,
                start,
                end,
                strand,
            )

    async def validate_assembly_task():
        if source.assembly_accession is not None:
            # We get the assembly accession (if it exists), and if the user provided one we validate it
            sequence_accessions = await ncbi_requests.get_sequence_accessions_from_assembly_accession(
                source.assembly_accession
            )
            if source.repository_id not in sequence_accessions:
                raise HTTPException(
                    400,
                    f'Sequence accession {source.repository_id} not contained in assembly accession {source.assembly_accession}, which contains accessions: {", ".join(sequence_accessions)}',
                )

    async def get_sequence_task():
        return await ncbi_requests.get_genbank_sequence(source.repository_id, start, end, strand)

    tasks = [validate_locus_task(), validate_assembly_task(), get_sequence_task()]

    try:
        gene_id, _, seq = await asyncio.gather(*tasks)
    except Exception as exception:
        handle_repository_errors(exception, 'NCBI')

    source.gene_id = gene_id

    # NCBI does not complain for coordinates that fall out of the sequence, so we have to check here
    if len(seq) != len(location):
        raise HTTPException(400, 'coordinates fall outside the sequence')

    return {'sequences': [format_sequence_genbank(seq, source.output_name)], 'sources': [source.model_copy()]}


@router.post(
    '/repository_id/seva',
    response_model=create_model(
        'SEVASource', sources=(list[SEVASource], ...), sequences=(list[TextFileSequence], ...)
    ),
)
async def get_from_repository_id_seva(source: SEVASource):
    """
    Return the sequence from a plasmid in SEVA.
    """
    try:
        dseq = await get_seva_plasmid(source.repository_id)
    except Exception as exception:
        handle_repository_errors(exception, 'SEVA')

    return format_products(
        source.id,
        [dseq],
        source if source.sequence_file_url is not None else None,
        source.output_name,
        wrong_completed_source_error_message=f'''
        The provided source is not valid.
        We found the following:
          - repository_id: {dseq.source.repository_id}
          - sequence_file_url: {dseq.source.sequence_file_url}
        ''',
    )
