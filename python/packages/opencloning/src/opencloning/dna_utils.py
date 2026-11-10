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
from Bio.Align import PairwiseAligner, Alignment
from Bio.Data.IUPACData import ambiguous_dna_values as _ambiguous_dna_values
from pairwise_alignments_to_msa.alignment import aligned_tuples_to_MSA
from copy import deepcopy
import numpy as np
from pydna.utils import location_boundaries, shift_location
from Bio.SeqFeature import SimpleLocation, CompoundLocation

aligner = PairwiseAligner(scoring='blastn')

ambiguous_only_dna_values = {**_ambiguous_dna_values}
for normal_base in 'ACGT':
    del ambiguous_only_dna_values[normal_base]


def get_sequence_shift(sequence: str, reference: str) -> int:
    """Given two identical but shifted sequences, return the shift."""
    if sequence == reference:
        return 0
    else:
        result = (sequence.upper() * 2).find(reference.upper())
        if result == -1:
            raise ValueError('Sequence not found in reference')
        return result % len(sequence)


def remove_padding(alignment: Alignment, reference: str) -> (str, str):
    """Remove the padding from the permutated sequence."""
    new_alignment = deepcopy(alignment)
    permutated_sequence = new_alignment.sequences[1]
    sequence_shift = get_sequence_shift(permutated_sequence, reference)
    padding = len(permutated_sequence) - len(reference)
    if padding == 0:
        return tuple(new_alignment)
    unshifted = permutated_sequence[sequence_shift:] + permutated_sequence[:sequence_shift]
    replaced = unshifted[:-padding] + '-' * padding
    new_alignment.sequences[1] = replaced[-sequence_shift:] + replaced[:-sequence_shift]

    # Remove positions in the alignment where both positions contain a dash
    # this happens because of - matching Ns in the permutated sequence.
    # It's not the best way to do this, but it works for now.
    out_seqs = tuple(new_alignment)
    seqs_array = np.array([list(s) for s in out_seqs])
    # Drop positions where both sequences are dashes
    seqs_array = seqs_array[:, ~np.all(seqs_array == '-', axis=0)]
    return tuple(''.join(s) for s in seqs_array)


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


def permutate_trace(reference: str, sanger_trace: str) -> str:
    """Permutate a trace with respect to the reference using MARS"""
    # As an input for MARS, we need the reference + all traces
    # We include traces in both directions, since MARS does not handle
    # reverse complements - see https://github.com/lorrainea/MARS/issues/17#issuecomment-2598314356
    len_diff = len(reference) - len(sanger_trace)
    padded_trace = sanger_trace
    # TODO: Better way of discriminating between Sanger / full sequence sequencing
    if len_diff > 0 and (len(sanger_trace) / len(reference) < 0.8):
        padded_trace = sanger_trace + len_diff * 'N'

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, 'input.fa')
        with open(input_path, 'w') as f:
            f.write(f">ref\n{reference}\n")
            f.write(f">trace\n{padded_trace}\n")

        output_path = os.path.join(tmpdir, 'output.fa')
        result = subprocess.run(['mars', '-a', 'DNA', '-m', '0', '-i', input_path, '-o', output_path, '-q', '5', '-l', '20', '-P', '1'], capture_output=True, text=True)  # fmt: skip

        if result.returncode != 0:
            raise RuntimeError(f'MARS failed:\n{result.stderr}')

        # read permutated trace
        return str(parse(output_path, 'fasta')[1].seq)


def align_sanger_traces(dseqr: Dseqrecord, sanger_traces: list[str]) -> list[str]:
    """Align a sanger track to a dseqr sequence"""

    # Ensure sequences are in upper case
    query_str = str(dseqr.seq).upper()
    sanger_traces = [trace.upper() for trace in sanger_traces]

    # Check that required executables exist in PATH
    if not shutil.which('mars'):
        raise RuntimeError("'mars' executable not found in PATH")
    if not shutil.which('mafft'):
        raise RuntimeError("'mafft' executable not found in PATH")

    aligned_pairs = []
    for trace in sanger_traces:
        # If the sequence is circular, permutate both fwd and reverse complement
        rc_trace = reverse_complement(trace)
        if dseqr.circular:
            fwd = permutate_trace(query_str, trace)
            rvs = permutate_trace(query_str, rc_trace)
        else:
            fwd = trace
            rvs = rc_trace

        # Pairwise-align and keep the best alignment
        fwd_alignment = next(aligner.align(query_str, fwd))
        rvs_alignment = next(aligner.align(query_str, rvs))

        best_alignment = fwd_alignment if fwd_alignment.score > rvs_alignment.score else rvs_alignment

        if dseqr.circular:
            trace4padding = trace if best_alignment is fwd_alignment else rc_trace
            formatted_alignment = remove_padding(best_alignment, trace4padding)
        else:
            formatted_alignment = tuple(best_alignment)
        aligned_pairs.append(formatted_alignment)

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
