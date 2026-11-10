from typing import Literal

CloningType = Literal['gene_deletion', 'gene_cterm_tagging', 'promoter_not_tag', 'promoter_with_tag']

INTEGRATION_PRIMER_LABELS = {
    'gene_deletion': 'deletion',
    'gene_cterm_tagging': 'tag',
    'promoter_not_tag': 'promoter',
    'promoter_with_tag': 'promoter_tag',
}

ALLELE_NAMES = {
    'gene_deletion': lambda gene: f'{gene}Δ',
    'gene_cterm_tagging': lambda gene: f'{gene}-tagged',
    'promoter_not_tag': lambda gene: f'{gene}-promoter',
    'promoter_with_tag': lambda gene: f'{gene}-promoter-tagged',
}


def integration_primer_label(cloning_type: CloningType) -> str:
    return INTEGRATION_PRIMER_LABELS[cloning_type]


def allele_name(gene: str, cloning_type: CloningType) -> str:
    return ALLELE_NAMES[cloning_type](gene)


def integration_primer_name(gene: str, direction: Literal['fwd', 'rvs'], cloning_type: CloningType) -> str:
    return f'{gene}_{integration_primer_label(cloning_type)}_{direction}'
