amanda_settings = {
    # Tm: Optimal 60-62°C, but this can be extended to 58-64°C if necessary.
    # All primers need to ideally be within 5°C to ensure they can be run on the same plate for high-throughput.
    'PRIMER_OPT_TM': 61,  # Optimal Tm
    'PRIMER_MIN_TM': 58,  # Minimum Tm
    'PRIMER_MAX_TM': 64,  # Maximum Tm
    'PRIMER_PAIR_MAX_DIFF_TM': 5,  # Maximum Tm difference within a pair
    # Salt concentration: 50mM NaCl, 1.5mM MgCl2
    'PRIMER_SALT_MONOVALENT': 50.0,
    'PRIMER_SALT_DIVALENT': 1.5,
    # 500 nM primer concentration
    'PRIMER_DNA_CONC': 500.0,
    # Primer size: 17-30nt.
    'PRIMER_MIN_SIZE': 17,  # Minimum primer length
    'PRIMER_MAX_SIZE': 30,  # Maximum primer length
    'PRIMER_OPT_SIZE': 22,  # Typical optimal size (can be adjusted)
    # GC content: between 35 and 65%.
    'PRIMER_MIN_GC': 35,  # Minimum GC content percentage
    'PRIMER_MAX_GC': 65,  # Maximum GC content percentage
    # A 1 or 2nt GC clamp at the 3’ end of the primer helps with PCR efficiency.
    'PRIMER_GC_CLAMP': 1,  # Number of GC bases required at the 3’ end
    # Product size: ~950bp homologous arms, though this can be shortened if necessary.
    'PRIMER_PRODUCT_SIZE_RANGE': [[900, 1000]],  # Product size range in base pairs
    # Avoid primers with long repetitions of nucleotides in a row (e.g., TTTTT).
    'PRIMER_MAX_POLY_X': 4,  # Maximum allowable repetitions of a single nucleotide
    # Dimer and hairpin structure considerations:
    # Self-dimers – avoid ΔG below -10
    # Heterodimers – avoid ΔG below -10
    # Hairpin loops - avoid ΔG below -5
    'PRIMER_MAX_SELF_ANY': 47,
    'PRIMER_MAX_SELF_END': 47,
    'PRIMER_MAX_HAIRPIN': 47,
    # Return only one primer pair
    'PRIMER_NUM_RETURN': 1,
}

# Avoid primers with homology to other sites in the genome.
# This can be checked using external tools like BLAST for specificity.
