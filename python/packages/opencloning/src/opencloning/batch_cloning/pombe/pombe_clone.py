import asyncio
import json
import os
from dataclasses import dataclass

from Bio.SeqFeature import SeqFeature
from opencloning.dna_utils import trim_location
from opencloning.ncbi_requests import get_annotations_from_query, get_genome_region_from_annotation
from opencloning.primer_design import primer_in_region
from pydna.assembly2 import homologous_recombination_integration, pcr_assembly
from pydna.dseqrecord import Dseqrecord
from pydna.opencloning_models import CloningStrategy
from pydna.primer import Primer
from pydna.utils import location_boundaries

from .pombe_naming import CloningType, allele_name, integration_primer_name


@dataclass
class GeneLocus:
    gene: str
    locus: Dseqrecord
    feature: SeqFeature
    cloning_type: CloningType


def get_homology_arms(locus: Dseqrecord, feature: SeqFeature, cloning_type: str) -> tuple[str, str]:
    if cloning_type == 'gene_deletion':
        start, end = (int(i) for i in location_boundaries(feature.location))
        left_homology_arm = str(locus.seq[start - 80 : start])
        right_homology_arm = str(locus.seq[end : end + 80].reverse_complement())
    elif cloning_type == 'gene_cterm_tagging':
        feature.location = trim_location(feature.location, 3, from_end=True)
        start, end = (int(i) for i in location_boundaries(feature.location))
        left_homology_arm = str(locus.seq[end - 80 : end])
        right_homology_arm = str(locus.seq[end : end + 80].reverse_complement())
    elif cloning_type in ('promoter_not_tag', 'promoter_with_tag'):
        start, end = (int(i) for i in location_boundaries(feature.location))
        left_homology_arm = str(locus.seq[start - 80 : start])
        right_homology_arm = str(locus.seq[start : start + 80].reverse_complement())
    else:
        raise ValueError(f'Unsupported cloning type: {cloning_type}')

    return left_homology_arm.lower(), right_homology_arm.lower()


def get_checking_primers(
    locus: Dseqrecord, feature: SeqFeature, gene: str, cloning_type: str, region_length: int = 200
) -> tuple[Primer, Primer]:
    start, end = (int(i) for i in location_boundaries(feature.location))

    def get_upstream_primer():
        padding = 200
        primer = primer_in_region(locus[(start - padding - region_length) : (start - padding)], forward=True)
        primer.name = f'{gene}_check_upstream_fwd'
        return primer

    def get_downstream_primer():
        padding = 200
        primer = primer_in_region(locus[(end + padding) : (end + padding + region_length)], forward=False)
        primer.name = f'{gene}_check_downstream_rvs'
        return primer

    def get_inside_forward_primer():
        padding = 200
        primer = primer_in_region(locus[(end - padding - region_length) : (end - padding)], forward=True)
        primer.name = f'{gene}_check_inside_fwd'
        return primer

    def get_inside_reverse_primer():
        padding = 200
        primer = primer_in_region(locus[(start + padding) : (start + padding + region_length)], forward=False)
        primer.name = f'{gene}_check_inside_rvs'
        return primer

    if cloning_type == 'gene_deletion':
        fwd = get_upstream_primer()
        rvs = get_downstream_primer()
    elif cloning_type == 'gene_cterm_tagging':
        fwd = get_inside_forward_primer()
        rvs = get_downstream_primer()
    elif cloning_type in ('promoter_not_tag', 'promoter_with_tag'):
        fwd = get_upstream_primer()
        rvs = get_inside_reverse_primer()
    else:
        raise ValueError(f'Unsupported cloning type: {cloning_type}')

    return fwd, rvs


async def resolve_gene_locus(gene: str, assembly_accession: str, cloning_type: CloningType) -> GeneLocus:
    annotations = await get_annotations_from_query(gene, assembly_accession)
    if len(annotations) == 0:
        raise ValueError(f'No annotations found for {gene}')

    annotations = [a for a in annotations if gene.upper() in a['locus_tag'].upper()]
    if len(annotations) == 0:
        raise ValueError(f'No right annotation found for {gene}')
    if len(annotations) > 1:
        raise ValueError(f'Multiple annotations found for {gene}')

    annotation = annotations[0]
    if annotation['gene_type'] != 'protein-coding':
        raise ValueError(f'{gene} is not a protein-coding gene')
    if 'gene_id' not in annotation or not annotation['gene_id']:
        raise ValueError(f'{gene} has no gene_id')

    locus = await get_genome_region_from_annotation(annotation, 1000, 1000)
    feature = next(
        f
        for f in locus.features
        if (f.type == 'CDS') and (f"GeneID:{annotation['gene_id']}" in f.qualifiers['db_xref'])
    )
    return GeneLocus(gene=gene, locus=locus, feature=feature, cloning_type=cloning_type)


def design_gene_primers(
    locus_ctx: GeneLocus,
    integration_binding_forward: str,
    integration_binding_reverse: str,
) -> tuple[Primer, Primer, Primer, Primer]:
    left_homology_arm, right_homology_arm = get_homology_arms(
        locus_ctx.locus, locus_ctx.feature, locus_ctx.cloning_type
    )

    left_primer = Primer(
        left_homology_arm + integration_binding_forward.upper(),
        name=integration_primer_name(locus_ctx.gene, 'fwd', locus_ctx.cloning_type),
    )
    right_primer = Primer(
        right_homology_arm + integration_binding_reverse.upper(),
        name=integration_primer_name(locus_ctx.gene, 'rvs', locus_ctx.cloning_type),
    )
    left_check_primer, right_check_primer = get_checking_primers(
        locus_ctx.locus, locus_ctx.feature, locus_ctx.gene, locus_ctx.cloning_type
    )
    return left_primer, right_primer, left_check_primer, right_check_primer


def simulate_and_write(
    locus_ctx: GeneLocus,
    primers: tuple[Primer, Primer, Primer, Primer],
    plasmid: Dseqrecord,
    common_primer_forward: Primer | None,
    common_primer_reverse: Primer | None,
    output_dir: str,
) -> None:
    left_primer, right_primer, left_check_primer, right_check_primer = primers

    pcr_products = pcr_assembly(plasmid, left_primer, right_primer, limit=14, mismatches=0)
    if len(pcr_products) == 0:
        raise ValueError('No PCR products when amplifying from the plasmid')
    if len(pcr_products) > 1:
        raise ValueError('Multiple PCR products when amplifying from the plasmid')
    pcr_products[0].name = 'amplified_marker'
    alleles = homologous_recombination_integration(locus_ctx.locus, [pcr_products[0]], 80)
    if len(alleles) == 0:
        raise ValueError(f'No insertions possible for {locus_ctx.gene}')
    if len(alleles) > 1:
        raise ValueError(f'Multiple insertions possible for {locus_ctx.gene}')
    modified_allele_name = allele_name(locus_ctx.gene, locus_ctx.cloning_type)
    alleles[0].name = modified_allele_name
    terminals = [alleles[0]]
    if common_primer_reverse is not None:
        pcr_check_left_products = pcr_assembly(
            alleles[0], left_check_primer, common_primer_reverse, limit=14, mismatches=0
        )
        if len(pcr_check_left_products) == 0:
            raise ValueError(f'No PCR products with the left check primer for {locus_ctx.gene}')
        pcr_check_left = pcr_check_left_products[0]
        pcr_check_left.name = 'check_pcr_left'
        terminals.append(pcr_check_left)

    if common_primer_forward is not None:
        pcr_check_right_products = pcr_assembly(
            alleles[0], common_primer_forward, right_check_primer, limit=14, mismatches=0
        )
        if len(pcr_check_right_products) == 0:
            raise ValueError(f'No PCR products with the right check primer for {locus_ctx.gene}')
        pcr_check_right = pcr_check_right_products[0]
        pcr_check_right.name = 'check_pcr_right'
        terminals.append(pcr_check_right)

    cs = CloningStrategy.from_dseqrecords(terminals)
    if not os.path.exists(os.path.join(output_dir, locus_ctx.gene)):
        os.makedirs(os.path.join(output_dir, locus_ctx.gene))

    gene_dir = os.path.join(output_dir, locus_ctx.gene)
    with open(os.path.join(gene_dir, 'cloning_strategy.json'), 'w') as f:
        f.write(cs.model_dump_json(indent=2))
    with open(os.path.join(gene_dir, 'metadata.json'), 'w') as f:
        json.dump(
            {
                'cloning_type': locus_ctx.cloning_type,
                'allele_name': modified_allele_name,
                'check_pcr_left': common_primer_reverse is not None,
                'check_pcr_right': common_primer_forward is not None,
            },
            f,
        )


async def main(
    gene: str,
    assembly_accession: str,
    integration_binding_forward: str,
    integration_binding_reverse: str,
    cloning_type: CloningType,
    *,
    output_dir: str | None = None,
    plasmid: Dseqrecord | None = None,
    common_primer_forward: Primer | None = None,
    common_primer_reverse: Primer | None = None,
    primers_only: bool = False,
) -> tuple[Primer, Primer, Primer, Primer] | None:
    print(f"\033[92mCloning {gene}\033[0m")
    locus_ctx = await resolve_gene_locus(gene, assembly_accession, cloning_type)
    primers = design_gene_primers(locus_ctx, integration_binding_forward, integration_binding_reverse)
    if primers_only:
        return primers

    assert output_dir is not None
    assert plasmid is not None
    # Simulation is CPU-bound, so it runs in a thread to avoid blocking the event loop
    await asyncio.to_thread(
        simulate_and_write, locus_ctx, primers, plasmid, common_primer_forward, common_primer_reverse, output_dir
    )
    return None
