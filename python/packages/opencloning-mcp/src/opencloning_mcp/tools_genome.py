"""Tools to add a region of a genome (e.g. a gene with its flanking sequence) from NCBI.

This is what the "Genome region" source of the web app does: the browser looks up the species, the
assembly and the gene on NCBI, and then sends one request to the cloning API (/genome_coordinates).
The lookups are the first three tools here (read-only); the last two add the region to the strategy.
"""

import asyncio
import re
from typing import Literal

from fastapi import HTTPException
from mcp.server.mcpserver.exceptions import ToolError
from opencloning import ncbi_requests

from . import cloning_api, names
from .app import mcp
from .products import add_product_to_strategy

DATASETS_URL = 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha'
MAX_RESULTS = 10


def ncbi_get(url: str) -> dict:
    """GET from NCBI with the cloning API's own client (it adds the NCBI API key, if there is one)."""
    try:
        response = asyncio.run(ncbi_requests.async_get(url, headers=ncbi_requests._datasets_headers()))
    except HTTPException as error:
        raise ToolError(f'NCBI returned an error: {error.detail}')
    return response.json()


def assembly_summary(report: dict) -> dict:
    return {
        'assembly_id': report['accession'],
        'species': report['organism']['organism_name'],
        'tax_id': report['organism']['tax_id'],
        'has_gene_annotation': 'annotation_info' in report,
    }


@mcp.tool()
def find_genome_assembly(query: str) -> dict:
    """Find the NCBI genome assembly to take a gene or region from: read-only, adds nothing to the strategy.

    `query` is a species name ("pombe", "Saccharomyces cerevisiae"), a taxon id ("4896") or an assembly id
    ("GCF_000002945.2"). For species it returns the reference assembly of each matching species, which is
    usually the one to use. Check `has_gene_annotation`: find_gene only works on annotated assemblies.
    Ask the user which one if there are several candidates.
    """
    query = query.strip()
    if re.match(r'^GC[AF]_\d+', query):
        url = f'{DATASETS_URL}/genome/accession/{query}/dataset_report?filters.assembly_version=all_assemblies'
        reports = ncbi_get(url).get('reports')
        if not reports:
            raise ToolError(f'NCBI has no assembly with id {query}')
        # An id without version (GCF_000002945) matches no particular version: use the current one
        exact = [r for r in reports if r['accession'] == query]
        report = exact[0] if exact else reports[0]
        summary = assembly_summary(report)
        current = report.get('current_accession')
        if current and current != summary['assembly_id']:
            summary['newer_assembly'] = current
        return {'assemblies': [summary]}

    url = f'{DATASETS_URL}/taxonomy/taxon_suggest/{query}?taxon_resource_filter=TAXON_RESOURCE_FILTER_GENOME'
    taxa = [
        t
        for t in ncbi_get(url + '&tax_rank_filter=higher_taxon').get('sci_name_and_ids', [])
        if t.get('rank') == 'SPECIES'
    ]
    assemblies = []
    for taxon in taxa[:MAX_RESULTS]:
        reference_url = f'{DATASETS_URL}/genome/taxon/{taxon["tax_id"]}/dataset_report?filters.reference_only=true'
        reports = ncbi_get(reference_url).get('reports')
        if reports:
            assemblies.append(assembly_summary(reports[0]))
    if not assemblies:
        raise ToolError(f'No species with a reference genome matches "{query}". Try an assembly id instead.')
    return {'assemblies': assemblies}


def annotation_summary(annotation: dict) -> dict:
    start, end, strand, _, sequence_accession, locus_tag, _ = ncbi_requests.get_info_from_annotation(annotation)
    return {
        'symbol': annotation.get('symbol'),
        'locus_tag': locus_tag,
        'name': annotation.get('name'),
        'sequence_accession': sequence_accession,
        'start': start,
        'end': end,
        'strand': '+' if strand == 1 else '-',
    }


def search_genes(assembly_id: str, query: str) -> list[dict]:
    try:
        return asyncio.run(ncbi_requests.get_annotations_from_query(query, assembly_id))
    except HTTPException as error:
        raise ToolError(f'NCBI returned an error: {error.detail}')


@mcp.tool()
def find_gene(assembly_id: str, query: str) -> dict:
    """Search the genes of an annotated assembly by symbol, locus tag or description: read-only, adds nothing.

    `query` is e.g. "cdc2" or "SPBC11B10.09". The search is free text, so the best match is not always
    first: exact matches of the symbol or locus tag come first, and only the first 10 are returned (see
    `total_matches`). Look at `symbol` and `locus_tag`, and ask the user if it is not clear which gene
    they mean. Coordinates are 1-based.
    Then call add_genome_region_from_gene.
    """
    genes = [annotation_summary(a) for a in search_genes(assembly_id, query)]
    # NCBI returns matches in no useful order: put exact matches first so that the cap does not drop them
    genes.sort(key=lambda g: query.lower() not in ((g['locus_tag'] or '').lower(), (g['symbol'] or '').lower()))
    return {'total_matches': len(genes), 'genes': genes[:MAX_RESULTS]}


@mcp.tool()
def list_assembly_chromosomes(assembly_id: str) -> dict:
    """List the chromosomes (and plasmids, organelles) of an assembly with their sequence accessions: read-only.

    Use it to find the sequence_accession for add_genome_region_from_coordinates.
    """
    reports = ncbi_get(f'{DATASETS_URL}/genome/accession/{assembly_id}/sequence_reports').get('reports')
    if not reports:
        raise ToolError(f'NCBI has no sequences for assembly {assembly_id}')
    return {
        'chromosomes': [
            {'name': r.get('chr_name'), 'sequence_accession': r.get('refseq_accession') or r.get('genbank_accession')}
            for r in reports
        ]
    }


@mcp.tool()
def add_genome_region_from_gene(
    strategy_id: str,
    assembly_id: str,
    gene: str,
    upstream_bases: int = 1000,
    downstream_bases: int = 1000,
    name: str | None = None,
) -> dict:
    """Add a gene from an annotated genome assembly, with some flanking sequence on each side.

    `gene` is the locus_tag (preferred) or the symbol exactly as returned by find_gene. Upstream and
    downstream are relative to the gene: for a gene on the minus strand, upstream is on the right of the
    coordinates. The product is oriented as the gene. By default it is named after the gene.
    """
    matches = [
        a
        for a in search_genes(assembly_id, gene)
        if gene.lower() in ((a.get('locus_tag') or '').lower(), (a.get('symbol') or '').lower())
    ]
    if len(matches) != 1:
        raise ToolError(
            f'{len(matches)} genes in {assembly_id} have the locus tag or symbol "{gene}", expected exactly one. '
            'Use find_gene and pass the locus_tag.'
        )
    annotation = matches[0]
    start, end, strand, gene_id, sequence_accession, locus_tag, _ = ncbi_requests.get_info_from_annotation(annotation)

    # The flanks are relative to the gene, the coordinates are not
    start -= upstream_bases if strand == 1 else downstream_bases
    end += downstream_bases if strand == 1 else upstream_bases
    coordinates = f'{start}..{end}' if strand == 1 else f'complement({start}..{end})'
    source = {
        'id': 0,
        'type': 'GenomeCoordinatesSource',
        'repository_id': sequence_accession,
        'assembly_accession': assembly_id,
        'locus_tag': locus_tag,
        'gene_id': gene_id,
        'coordinates': coordinates,
        'output_name': names.clean(name or annotation.get('symbol') or locus_tag or gene),
    }
    result = cloning_api.post('/genome_coordinates', json=source)
    return add_product_to_strategy(strategy_id, result)


@mcp.tool()
def add_genome_region_from_coordinates(
    strategy_id: str,
    sequence_accession: str,
    start: int,
    end: int,
    strand: Literal['plus', 'minus'] = 'plus',
    assembly_id: str | None = None,
    name: str | None = None,
) -> dict:
    """Add a region of a chromosome (or any NCBI sequence) by its coordinates.

    Use add_genome_region_from_gene instead when the user wants a gene. Coordinates are 1-based and
    inclusive, as in NCBI: start must be at least 1 and less than end. `sequence_accession` is e.g.
    "NC_003424.3" (see list_assembly_chromosomes). Pass assembly_id to check that the accession belongs
    to that assembly. Regions longer than a few hundred kb are refused.
    """
    coordinates = f'{start}..{end}' if strand == 'plus' else f'complement({start}..{end})'
    source = {
        'id': 0,
        'type': 'GenomeCoordinatesSource',
        'repository_id': sequence_accession,
        'assembly_accession': assembly_id,
        'coordinates': coordinates,
        'output_name': names.clean(name or f'{sequence_accession}_{start}-{end}'),
    }
    result = cloning_api.post('/genome_coordinates', json=source)
    return add_product_to_strategy(strategy_id, result)
