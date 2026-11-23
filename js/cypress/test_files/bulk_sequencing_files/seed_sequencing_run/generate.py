"""
Generate a fake whole-plasmid sequencing run (one folder per sample with a <sample>.final.fastq, like the zips
from the sequencing provider) whose reads match sequences of the seed database (opencloning_db/init_db.py).
See README.md for what each sample is for. Run from the repository root:

    uv run --directory python python ../js/cypress/test_files/bulk_sequencing_files/seed_sequencing_run/generate.py
"""

import random
import shutil
from pathlib import Path

from Bio.Seq import reverse_complement
from pydna.parsers import parse

HERE = Path(__file__).resolve().parent
INIT_DB = HERE.parents[4] / 'python/packages/opencloning-db/src/opencloning_db/init_db'

# Sequences of _add_sequencing_check_examples in init_db.py
C1 = 'GCTAAAGACAATTACATAACATACACGTCAGCACGAAACTTGTTGGCCCA'
C2_SUBSTITUTIONS = 'GTGTGCATCGCTTAAGGGTTCAGTAAGTGTGATGCATACGCATTTACTTG'
C3 = 'CTGTGTCCACCCCATCGGACTGGCATTTTTATTACACTCAGAAACAGAAC'
L2 = 'GACACTCGCTATGAATCTCTGATTTACCCACTCTGCCAAACTCCAGCGCG'


def rotate(seq: str, n: int) -> str:
    return seq[n:] + seq[:n]


def substitute(seq: str, positions: list[int]) -> str:
    seq = list(seq)
    for pos in positions:
        seq[pos] = {'A': 'C', 'C': 'G', 'G': 'T', 'T': 'A'}[seq[pos].upper()]
    return ''.join(seq)


def sequence_of(path: Path) -> str:
    return str(parse(str(path))[0].seq).upper()


def main():
    p_rex0008 = sequence_of(INIT_DB / 'sequencing_data/TN9W63_1_pREX0008.gbk')
    p_rex0008_mutated = sequence_of(INIT_DB / 'sequencing_data/TN9W63_1_pREX0008_mutations_added.fasta')
    p_jog684 = sequence_of(INIT_DB / 'golden_braid/105355.gb')
    p_jog173 = sequence_of(INIT_DB / 'golden_braid/105417.gb')
    random.seed(0)
    reads = {
        # Name of an existing sample, read matches its sequence
        'seqcheck_circular_1-sample': rotate(reverse_complement(C1), 20),
        # Name of an existing sample in another case, read matches its sequence
        'SEQCHECK_CIRCULAR_3-SAMPLE': rotate(C3, 17),
        # Name of an existing sample, read has substitutions
        'seqcheck_circular_2-sample': C2_SUBSTITUTIONS,
        # Read of seqcheck_linear_2-sample (with an insertion), under another name
        'colony_L2': L2[:25] + 'TTT' + L2[25:],
        # Exact read of pREX0008, which already has a sample: "Find exact matches" ignores it
        'TN9W63_1': rotate(p_rex0008, 1000),
        # Read of pREX0008 with mutations
        'TN9W63_2': p_rex0008_mutated,
        # Two colonies of pJOG684 (no samples), exact reads: "Find exact matches" finds them
        'GB_105355_c1': rotate(p_jog684, 500),
        'GB_105355_c2': rotate(reverse_complement(p_jog684), 1200),
        # pJOG173 (no samples) with substitutions: no exact match
        'GB_105417_c1': substitute(rotate(p_jog173, 300), [100, 1500, 2500]),
        # Matches nothing
        'empty_well': ''.join(random.choice('ACGT') for _ in range(300)),
    }
    for folder in HERE.iterdir():
        if folder.is_dir():
            shutil.rmtree(folder)
    for name, seq in reads.items():
        folder = HERE / name
        folder.mkdir()
        (folder / f'{name}.final.fastq').write_text(f'@{name}\n{seq}\n+\n{"I" * len(seq)}\n')
        # Like the sequencing provider, with other files that are not linked
        (folder / f'{name}.stats').write_text(f'length\t{len(seq)}\n')


if __name__ == '__main__':
    main()
