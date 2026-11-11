from fastapi import HTTPException
import math
from pydna.dseqrecord import Dseqrecord
from pydna.opencloning_models import GenomeCoordinatesSource, NCBISequenceSource
from Bio.SeqFeature import Location

from .app_settings import settings
from .http_client import get_http_client, Response


# The API key is never put in URLs (which end up in logs and exception messages):
# - Datasets v2 API: sent in the ``api-key`` header.
# - E-utilities: only accept the ``api_key`` parameter, so it is sent in a POST form body.
def _datasets_headers() -> dict | None:
    return None if settings.NCBI_API_KEY is None else {'api-key': settings.NCBI_API_KEY}


def _eutils_params(params: dict) -> dict:
    if settings.NCBI_API_KEY is None:
        return params
    return {**params, 'api_key': settings.NCBI_API_KEY}


def _check_ncbi_response(resp: Response) -> Response:
    if resp.status_code == 500:
        raise HTTPException(503, 'NCBI is down, try again later')
    elif resp.status_code == 503:
        raise HTTPException(503, 'NCBI returned an internal server error')
    elif resp.status_code != 200 and not math.floor(resp.status_code / 100) == 4:
        raise HTTPException(503, 'NCBI returned an unexpected error')
    return resp


async def async_get(url, headers, params=None) -> Response:
    async with get_http_client() as client:
        resp = await client.get(url, headers=headers, params=params, timeout=20.0)
        return _check_ncbi_response(resp)


async def async_post_form(url, headers=None, params=None) -> Response:
    """POST ``params`` as a form body (E-utilities accept POST, keeping ``api_key`` out of the URL)."""
    async with get_http_client() as client:
        resp = await client.post(url, headers=headers, data=params, timeout=20.0)
        return _check_ncbi_response(resp)


# TODO: this does not return old assembly accessions, see https://github.com/ncbi/datasets/issues/380#issuecomment-2231142816
async def get_assembly_accession_from_sequence_accession(sequence_accession: str) -> list[str]:
    """Get the assembly accession from a sequence accession"""

    url = f'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/sequence_accession/{sequence_accession}/sequence_assemblies'
    resp = await async_get(url, headers=_datasets_headers())
    data = resp.json()
    if 'accessions' in data:
        return data['accessions']
    else:
        return []


async def get_sequence_accessions_from_assembly_accession(assembly_accession: str) -> list[str]:
    """Get the sequence accessions from an assembly accession"""
    url = f'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/{assembly_accession}/sequence_reports'
    resp = await async_get(url, headers=_datasets_headers())
    data = resp.json()
    if 'reports' in data:
        refseq_accessions = [report['refseq_accession'] for report in data['reports'] if 'refseq_accession' in report]
        genbank_accessions = [
            report['genbank_accession'] for report in data['reports'] if 'genbank_accession' in report
        ]
        return refseq_accessions + genbank_accessions
    elif 'total_count' in data:
        raise HTTPException(400, f'No sequence accessions linked, see {url}')
    else:
        raise HTTPException(404, 'Wrong assembly accession number')


async def get_annotation_from_locus_tag(locus_tag: str, assembly_accession: str) -> dict:
    annotations = await get_annotations_from_query(locus_tag, assembly_accession)
    locus_tag_annotations = [a for a in annotations if locus_tag.upper() in a['locus_tag'].upper()]
    if len(locus_tag_annotations) != 1:
        raise HTTPException(400, 'multiple matches for locus_tag')
    return locus_tag_annotations[0]


async def get_annotations_from_query(query: str, assembly_accession: str) -> list[dict]:
    url = f'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/{assembly_accession}/annotation_report?search_text={query}'
    resp = await async_get(url, headers=_datasets_headers())
    if resp.status_code == 404:
        raise HTTPException(404, 'wrong accession number')

    data = resp.json()
    if 'reports' not in data:
        raise HTTPException(404, f'query "{query}" gave no results')

    return [r['annotation'] for r in data['reports']]


async def get_sequence_length_from_sequence_accession(sequence_accession: str) -> int:
    url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi'
    params = _eutils_params({'id': sequence_accession, 'db': 'nuccore', 'retmode': 'json'})
    resp = await async_post_form(url, params=params)
    data = resp.json()
    if 'result' not in data:
        raise HTTPException(503, 'NCBI returned an error (try again)')
    if len(data['result']['uids']) == 0:
        raise HTTPException(404, 'wrong sequence accession')
    sequence_id = data['result']['uids'][0]
    return data['result'][sequence_id]['slen']


async def get_genbank_sequence(sequence_accession, start=None, end=None, strand=None) -> Dseqrecord:
    from opencloning.dna_functions import get_sequences_from_file_url

    # Ensure that start, end, and strand are either all None or none are None
    if (start is None or end is None or strand is None) and not (start is None and end is None and strand is None):
        raise ValueError('start, end, and strand must either all be None or none be None')

    gb_strand = 1 if strand == 1 or strand is None else 2
    url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi'
    params = _eutils_params(
        {
            'db': 'nuccore',
            'id': sequence_accession,
            'rettype': 'gbwithparts',
            'seq_start': start,
            'seq_stop': end,
            'strand': gb_strand,
            'retmode': 'text',
        }
    )

    try:
        seq = (await get_sequences_from_file_url(url, params=params, get_function=async_post_form))[0]
    except HTTPException as e:
        # Now the ncbi returns something like this:
        # Example: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=blah&rettype=gbwithparts&retmode=text
        # 'Error: F a i l e d  t o  u n d e r s t a n d  i d :  b l a h '
        if 'No sequences found in file' in e.detail:
            raise HTTPException(404, 'invalid sequence accession') from e
        raise e
    except Exception as e:
        raise e

    if start is not None:
        if strand == -1:
            location = Location.fromstring(f'complement({start}..{end})')
        else:
            location = Location.fromstring(f'{start}..{end}')
    else:
        location = None

    seq.source = NCBISequenceSource(repository_id=sequence_accession, coordinates=location)
    return seq


def get_info_from_annotation(annotation: dict) -> dict:
    start = int(annotation['genomic_regions'][0]['gene_range']['range'][0]['begin'])
    end = int(annotation['genomic_regions'][0]['gene_range']['range'][0]['end'])
    strand = 1 if annotation['genomic_regions'][0]['gene_range']['range'][0]['orientation'] == 'plus' else -1
    sequence_accession = annotation['genomic_regions'][0]['gene_range']['accession_version']
    locus_tag = annotation['locus_tag'] if 'locus_tag' in annotation else None
    gene_id = int(annotation['gene_id']) if 'gene_id' in annotation else None
    try:
        assembly_accession = annotation['annotations'][0]['assembly_accession']
    except KeyError:
        assembly_accession = None
    except IndexError:
        assembly_accession = None

    return start, end, strand, gene_id, sequence_accession, locus_tag, assembly_accession


async def validate_locus_tag(
    locus_tag: str, assembly_accession: str, gene_id: int | None, start: int, end: int, strand: int
) -> int:
    """
    Validate that the locus tag exists in the assembly and that the gene falls within the requested coordinates.
    Returns gene_id for convenience.
    """

    annotation = await get_annotation_from_locus_tag(locus_tag, assembly_accession)
    gene_start, gene_end, gene_strand, gene_id_annotation, *_ = get_info_from_annotation(annotation)

    # This field will not be present in all cases, but should be there in reference genomes
    if gene_id is not None:
        if 'gene_id' not in annotation:
            raise HTTPException(400, 'gene_id is set, but not found in the annotation')
        if gene_id != gene_id_annotation:
            raise HTTPException(400, 'gene_id does not match the locus_tag')
    elif 'gene_id' in annotation:
        gene_id = gene_id_annotation

    # The gene should fall within the range (range might be bigger if bases were requested upstream or downstream)
    if gene_start < start or gene_end > end or gene_strand != strand:
        raise HTTPException(
            400,
            f'wrong coordinates, the gene should fall within the requested coordinates, {start}, {end} on strand: {strand}',
        )

    return gene_id


async def get_genome_region_from_annotation(
    annotation: dict, padding_left: int = 0, padding_right: int = 0
) -> Dseqrecord:
    start, end, strand, gene_id, sequence_accession, locus_tag, assembly_accession = get_info_from_annotation(
        annotation
    )
    start = start - padding_left
    end = end + padding_right
    seq = await get_genbank_sequence(sequence_accession, start, end, strand)
    location_str = f'{start}..{end}' if strand != -1 else f'complement({start}..{end})'
    coordinates = Location.fromstring(location_str)
    source = GenomeCoordinatesSource(
        assembly_accession=assembly_accession,
        repository_id=sequence_accession,
        coordinates=coordinates,
        locus_tag=locus_tag,
        gene_id=gene_id,
    )
    seq.name = locus_tag
    seq.source = source
    return seq
