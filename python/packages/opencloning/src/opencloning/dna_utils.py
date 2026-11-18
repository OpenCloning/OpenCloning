"""
Utility functions moved here to avoid circular imports.
"""

from Bio.Seq import reverse_complement
from pydna.dseqrecord import Dseqrecord
import tempfile
import subprocess
import os
import shutil
from pydna.parsers import parse
from Bio.Align import PairwiseAligner
from Bio.Data.IUPACData import ambiguous_dna_values
from pairwise_alignments_to_msa.alignment import aligned_tuples_to_MSA
import edlib
import re
from itertools import combinations
from pydna.utils import location_boundaries, shift_location
from Bio.SeqFeature import SimpleLocation, CompoundLocation

aligner = PairwiseAligner(scoring='blastn')

IUPAC_BASES = set(ambiguous_dna_values)
# Pairs of IUPAC codes that can represent the same base, so edlib counts them as matches
IUPAC_EQUALITIES = [
    (a, b)
    for a, b in combinations(sorted(ambiguous_dna_values), 2)
    if set(ambiguous_dna_values[a]) & set(ambiguous_dna_values[b])
]


def sum_is_sticky(three_prime_end: tuple[str, str], five_prime_end: tuple[str, str], partial: bool = False) -> int:
    """Return the overlap length if the 3' end of seq1 and 5' end of seq2 ends are sticky and compatible for ligation.
    Return 0 if they are not compatible."""
    type_seq1, sticky_seq1 = three_prime_end
    type_seq2, sticky_seq2 = five_prime_end

    if 'blunt' != type_seq2 and type_seq2 == type_seq1 and str(sticky_seq2) == str(reverse_complement(sticky_seq1)):
        return len(sticky_seq1)

    if not partial:
        return 0

    if type_seq1 != type_seq2 or type_seq2 == 'blunt':
        return 0
    elif type_seq2 == "5'":
        sticky_seq1 = str(reverse_complement(sticky_seq1))
    elif type_seq2 == "3'":
        sticky_seq2 = str(reverse_complement(sticky_seq2))

    ovhg_len = min(len(sticky_seq1), len(sticky_seq2))
    # [::-1] to try the longest overhangs first
    for i in range(1, ovhg_len + 1)[::-1]:
        if sticky_seq1[-i:] == sticky_seq2[:i]:
            return i
    else:
        return 0


def align_with_mafft(inputs: list[str], orientation_known: bool) -> list[str]:
    """Align a sanger track to a dseqr sequence"""

    with tempfile.TemporaryDirectory() as tmpdir:
        input_file = os.path.join(tmpdir, 'input.fa')
        with open(input_file, 'w') as f:
            for i, input_seq in enumerate(inputs):
                f.write(f">trace-{i+1}\n{input_seq}\n")

        result = subprocess.run(
            ['mafft', '--nuc'] + (['--adjustdirection'] if orientation_known else []) + [input_file],
            capture_output=True,
            text=True,
        )
    if result.returncode != 0:
        raise RuntimeError(f'MAFFT alignment failed:\n{result.stderr}')

    return [str(s.seq) for s in parse(result.stdout)]


def _edlib_infix(query: str, target: str) -> dict:
    """Align query as an infix of target (edlib HW mode), counting IUPAC-compatible bases as matches."""
    return edlib.align(query, target, mode='HW', task='path', additionalEqualities=IUPAC_EQUALITIES)


def _longest_exact_run(cigar: str, q_start: int, t_start: int) -> tuple[int, int]:
    """Walk an extended CIGAR (=, X, I, D) and return the midpoint of the longest run of matches
    as (position in query, position in target). If there are no matches, return the start positions."""
    q, t = q_start, t_start
    best_len, best = 0, (q_start, t_start)
    for length, op in re.findall(r'(\d+)([=XID])', cigar):
        length = int(length)
        if op == '=' and length > best_len:
            best_len, best = length, (q + length // 2, t + length // 2)
        if op in '=XI':
            q += length
        if op in '=XD':
            t += length
    return best


def _rotate_alignment_to_reference_origin(ref_aln: str, trace_aln: str, ref_shift: int) -> tuple[str, str]:
    """Rotate the columns of an alignment of a reference rotated by ref_shift, so that the reference
    row starts at the original index 0 again."""
    ref_len = len(ref_aln) - ref_aln.count('-')
    origin = (ref_len - ref_shift) % ref_len
    base_columns = [i for i, base in enumerate(ref_aln) if base != '-']
    column = base_columns[origin]
    return ref_aln[column:] + ref_aln[:column], trace_aln[column:] + trace_aln[:column]


def _align_to_circular_reference(reference: str, trace: str) -> tuple[str, str]:
    """Align a trace to a circular reference. A fast rough alignment (edlib) of the trace against the
    reference repeated twice picks the strand of the trace and where it lands, both sequences are rotated
    so that the trace does not cross the origin, then the alignment is done with the pairwise aligner,
    and rotated back so the reference is in its original coordinates."""
    reference_twice = reference + reference

    fwd = _edlib_infix(trace, reference_twice)
    rvs = _edlib_infix(reverse_complement(trace), reference_twice)
    if rvs['editDistance'] < fwd['editDistance']:
        trace, rough = reverse_complement(trace), rvs
    else:
        rough = fwd
    ref_start, ref_end = rough['locations'][0]

    if len(trace) / len(reference) >= 0.8:
        # Full plasmid: the trace is circular too, rotate both to start in the middle of the longest exact match
        trace_shift, ref_shift = _longest_exact_run(rough['cigar'], 0, ref_start)
        ref_shift %= len(reference)
        trace = trace[trace_shift:] + trace[:trace_shift]
    else:
        # Sanger read: rotate the reference to the middle of the region the read does not cover,
        # so that the read lies inside it without crossing the origin
        span = ref_end - ref_start + 1
        ref_shift = (ref_end + 1 + max(len(reference) - span, 0) // 2) % len(reference)

    rotated_reference = reference[ref_shift:] + reference[:ref_shift]
    ref_aln, trace_aln = next(aligner.align(rotated_reference, trace))
    return _rotate_alignment_to_reference_origin(ref_aln, trace_aln, ref_shift)


def align_sanger_traces(dseqr: Dseqrecord, sanger_traces: list[str]) -> list[str]:
    """Align a sanger track to a dseqr sequence"""

    # Ensure sequences are in upper case
    query_str = str(dseqr.seq).upper()
    sanger_traces = [trace.upper() for trace in sanger_traces]

    # Check that required executables exist in PATH
    if not shutil.which('mafft'):
        raise RuntimeError("'mafft' executable not found in PATH")

    for trace in sanger_traces:
        if not set(trace) <= IUPAC_BASES:
            raise ValueError('Sanger trace contains characters that are not IUPAC nucleotides')

    aligned_pairs = []
    for trace in sanger_traces:
        if dseqr.circular:
            aligned_pairs.append(_align_to_circular_reference(query_str, trace))
            continue

        # Pairwise-align both orientations and keep the best alignment
        fwd_alignment = next(aligner.align(query_str, trace))
        rvs_alignment = next(aligner.align(query_str, reverse_complement(trace)))
        best_alignment = fwd_alignment if fwd_alignment.score > rvs_alignment.score else rvs_alignment
        aligned_pairs.append(tuple(best_alignment))

    return aligned_tuples_to_MSA(aligned_pairs)


def compound_location_to_capitalized_str(sequence: Dseqrecord, location: CompoundLocation) -> str:
    if not isinstance(location, CompoundLocation):
        raise ValueError('Location must be a CompoundLocation')
    start, end = location_boundaries(location)
    subseq = sequence[start:end]
    shifted_location = shift_location(location, -start, len(subseq))
    edges = []
    parts = shifted_location.parts if location.strand != -1 else reversed(shifted_location.parts)
    for sublocation in parts:
        edges.append(sublocation.start)
        edges.append(sublocation.end)

    result = ''
    for i in range(len(edges) - 1):
        part = subseq[edges[i] : edges[i + 1]]
        if i % 2 == 0:
            part = str(part.seq).upper()
        else:
            part = str(part.seq).lower()
        result += part

    if location.strand == -1:
        result = reverse_complement(result)
    return result


def trim_location(
    location: SimpleLocation | CompoundLocation, amount: int, from_end: bool = True
) -> SimpleLocation | CompoundLocation:

    if not isinstance(location, (SimpleLocation, CompoundLocation)):
        raise ValueError('Location must be a SimpleLocation or CompoundLocation')
    if amount > len(location):
        raise ValueError('Amount is greater than the length of the location')

    if from_end:
        iter = (part for part in location.parts[::-1])
    else:
        iter = (part for part in location.parts)
    left_to_cut = amount
    new_parts = []
    for part in iter:
        if left_to_cut == 0:
            new_parts.append(part)
            continue
        if len(part) > left_to_cut:
            new_parts.append(SimpleLocation(part.start, part.end - left_to_cut))
            left_to_cut = 0
        elif len(part) == left_to_cut:
            left_to_cut = 0
        else:
            left_to_cut -= len(part)
    if from_end:
        new_parts = new_parts[::-1]

    if len(new_parts) == 1:
        return SimpleLocation(new_parts[0].start, new_parts[0].end)

    return CompoundLocation(new_parts)


# For an eventual test
# for loc_str in ['10..20', 'join(10..20, 30..40)', 'complement(join(10..20, 30..40))']:
#     loc = Location.fromstring(loc_str)
#     print(loc)
#     print(trim_location(loc, 5))
#     print()
