import asyncio
from fastapi import Form, File, UploadFile, HTTPException
from typing import Annotated, Literal
import os
import tempfile
from fastapi.responses import FileResponse, HTMLResponse
from .pombe_clone import main as pombe_clone
from .pombe_summary import main as pombe_summary
from .pombe_gather import main as pombe_gather
from .pombe_primer_table import build_primer_summary_df, primer_summary_to_html
import shutil
from ...get_router import get_router
from fastapi import Request
from opencloning.dna_functions import get_sequence_from_euroscarf_url, request_from_addgene, request_from_snapgene
from pydna.primer import Primer
from pydna.opencloning_models import UploadedFileSource
from pydna.parsers import parse as pydna_parse
from pydna.parsers import parse_snapgene
from opencloning.app_settings import settings
from opencloning.endpoints.endpoint_utils import read_upload_with_limit
from opencloning.pydantic_models import MAX_PRIMER_LENGTH

router = get_router()


@router.get('/batch_cloning/yeast_primer_design')
async def get_batch_cloning_page(request: Request):
    return FileResponse(os.path.join(os.path.dirname(__file__), 'index.html'))


DEFAULT_PLASMID_OPTIONS = {
    'gene_deletion': {
        'kanmx6': ('addgene', '39296', None),
        'natmx6': ('snapgene', 'yeast_plasmids', 'pFA6a-natMX6'),
        'hphmx6': ('snapgene', 'yeast_plasmids', 'pFA6a-hphMX6'),
    },
    'gene_cterm_tagging': {
        'kanmx6': ('addgene', '87023', None),
        'natmx6': ('addgene', '52693', None),
        'hphmx6': ('addgene', '105156', None),
    },
    'promoter_not_tag': {
        'kanmx6': ('addgene', '39280', None),  # pFA6a-kanMX6-P3nmt1
        'natmx6': ('euroscarf', 'P30425', None),  # pFA6a-natMX6-P3nmt1
        'hphmx6': ('addgene', '105162', None),  # pFA6a-hphMX6-3nmt1
    },
}


def _load_plasmid_file(plasmid_file: UploadFile | None):
    assert plasmid_file is not None
    assert plasmid_file.filename is not None
    file_content = read_upload_with_limit(plasmid_file, settings.MAX_SEQUENCE_FILE_SIZE_MB)
    if plasmid_file.filename.endswith('.dna'):
        return parse_snapgene(file_content)[0]
    plasmid = pydna_parse(file_content.decode('utf-8'))[0]
    plasmid.source = UploadedFileSource(
        file_name=plasmid_file.filename,
        sequence_file_format=plasmid.annotations['pydna_parse_sequence_file_format'],
        index_in_file=0,
    )
    return plasmid


def raise_plasmid_import_error(exception: Exception, mode) -> None:
    raise HTTPException(status_code=503, detail=f'Failed to import plasmid from {mode}: {exception}') from exception


@router.post('/batch_cloning/yeast_primer_design')
async def post_batch_cloning(
    cloning_type: Annotated[
        Literal['gene_deletion', 'gene_cterm_tagging', 'promoter_not_tag', 'promoter_with_tag'], Form(...)
    ],
    desired_output: Annotated[Literal['simulate_cloning', 'primers_only'], Form(...)],
    assembly_accession: str = Form(..., pattern=r'^GC[AF]_[0-9.]+$', min_length=1),
    gene_list: str = Form(...),
    integration_binding_forward: str = Form(..., pattern=r'^[ACGTacgt]+$', min_length=1, max_length=MAX_PRIMER_LENGTH),
    integration_binding_reverse: str = Form(..., pattern=r'^[ACGTacgt]+$', min_length=1, max_length=MAX_PRIMER_LENGTH),
    plasmid_file: UploadFile | None = File(None),
    addgene_id: str | None = Form(None),
    plasmid_option: Annotated[Literal['addgene', 'file', 'default'], Form(...)] = None,
    checking_primer_forward: str = Form('', pattern=r'^[ACGTacgt]*$', max_length=MAX_PRIMER_LENGTH),
    checking_primer_reverse: str = Form('', pattern=r'^[ACGTacgt]*$', max_length=MAX_PRIMER_LENGTH),
    resistance_marker: Annotated[Literal['kanmx6', 'natmx6', 'hphmx6', 'other'], Form(...)] = None,
):
    genes = [gene.strip() for gene in gene_list.split() if gene.strip()]

    if not genes:
        raise HTTPException(status_code=400, detail='No valid genes provided')

    if desired_output == 'primers_only':
        gene_primers = []
        try:
            for gene in genes:
                primers = await pombe_clone(
                    gene,
                    assembly_accession,
                    integration_binding_forward,
                    integration_binding_reverse,
                    cloning_type,
                    primers_only=True,
                )
                gene_primers.append((gene, cloning_type, primers))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        primer_df = build_primer_summary_df(gene_primers)
        return HTMLResponse(content=primer_summary_to_html(primer_df))

    common_primer_forward = (
        Primer(checking_primer_forward, name='common_insert_fwd') if checking_primer_forward else None
    )
    common_primer_reverse = (
        Primer(checking_primer_reverse, name='common_insert_rvs') if checking_primer_reverse else None
    )

    if plasmid_option == 'default':
        try:
            mode, first, second = DEFAULT_PLASMID_OPTIONS[cloning_type][resistance_marker]
            if mode == 'addgene':
                plasmid = await request_from_addgene(first)
            elif mode == 'euroscarf':
                plasmid = await get_sequence_from_euroscarf_url(first)
            else:
                plasmid = await request_from_snapgene(first, second)
        except KeyError:
            raise HTTPException(
                status_code=400, detail=f'Resistance marker {resistance_marker} is not supported for default plasmid'
            )
        except Exception as e:
            raise_plasmid_import_error(e, mode)

    elif plasmid_option == 'file':
        try:
            # Parsing is CPU-bound, so it runs in a thread to avoid blocking the event loop
            plasmid = await asyncio.to_thread(_load_plasmid_file, plasmid_file)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f'Plasmid loading failed: {e}')

    if plasmid_option == 'addgene':
        assert addgene_id is not None
        try:
            plasmid = await request_from_addgene(addgene_id)
        except Exception as e:
            raise_plasmid_import_error(e, 'addgene')

    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            for gene in genes:
                await pombe_clone(
                    gene,
                    assembly_accession,
                    integration_binding_forward,
                    integration_binding_reverse,
                    cloning_type,
                    output_dir=temp_dir,
                    plasmid=plasmid,
                    common_primer_forward=common_primer_forward,
                    common_primer_reverse=common_primer_reverse,
                )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f'Cloning failed: {e}')

        try:
            await asyncio.to_thread(pombe_summary, temp_dir)
            await asyncio.to_thread(pombe_gather, temp_dir)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f'Summary failed: {e}')

        zip_filename = f'{temp_dir}_archive'
        await asyncio.to_thread(shutil.make_archive, zip_filename, 'zip', temp_dir)
        zip_file = f'{zip_filename}.zip'
        return FileResponse(zip_file, filename='batch_cloning_output.zip')
