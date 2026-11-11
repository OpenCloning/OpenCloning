genome_region_examples = {
    'full': {
        'summary': 'All parameters provided',
        'value': {
            'id': 1,
            'repository_id': 'NC_003424.3',
            'assembly_accession': 'GCF_000002945.2',
            'locus_tag': 'SPOM_SPAPB1A10.09',
            'gene_id': 2543372,
            'coordinates': '1877009..1881726',
        },
    },
    'full_with_genbank_accession': {
        'summary': 'All parameters provided, but sequence accession is GenBank',
        'value': {
            'id': 1,
            'repository_id': 'CU329670.1',
            'assembly_accession': 'GCF_000002945.2',
            'locus_tag': 'SPOM_SPAPB1A10.09',
            'gene_id': 2543372,
            'coordinates': '1877009..1881726',
        },
    },
    'id_omitted': {
        'summary': 'Gene ID omitted (filled in response)',
        'value': {
            'id': 1,
            'repository_id': 'NC_003424.3',
            'assembly_accession': 'GCF_000002945.2',
            'locus_tag': 'SPOM_SPAPB1A10.09',
            'coordinates': '1877009..1881726',
        },
    },
    'assembly_accession_omitted': {
        'summary': 'Sequence accession only',
        'value': {
            'id': 1,
            'repository_id': 'NC_003424.3',
            'coordinates': '1877009..1881726',
        },
    },
    'viral_sequence': {
        'summary': 'Viral sequence not associated with assembly',
        'value': {
            'id': 1,
            'repository_id': 'DQ208311.2',
            'coordinates': 'complement(20..2050)',
        },
    },
}

oligonucleotide_hybridization_examples = {
    'default': {
        'summary': 'Typical example',
        'description': 'blah',
        'value': {
            'source': {
                'id': 1,
                'input': [
                    {'sequence': 2},
                    {'sequence': 3},
                ],
            },
            'primers': [
                {'id': 2, 'name': 'primer1', 'sequence': 'aaGCGGCCGCgtagaactttatgtgcttccttacattggt'},
                {'id': 3, 'name': 'primer2', 'sequence': 'aaGCGGCCGCaccaatgtaaggaagcacataaagttctac'},
            ],
        },
    },
}

benchling_url_examples = {
    'default': {
        'summary': 'Typical example',
        'value': {
            'id': 0,
            'repository_id': 'https://benchling.com/siverson/f/lib_B94YxDHhQh-cidar-moclo-library/seq_kryGidaz-c0062_cd.gb',
        },
    },
}

snapgene_plasmid_examples = {
    'default': {
        'summary': 'Typical example',
        'value': {
            'id': 0,
            'repository_id': 'basic_cloning_vectors/pEASY-T1_(linearized)',
        },
    },
}
