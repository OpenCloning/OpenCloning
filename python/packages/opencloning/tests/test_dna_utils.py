import os
import unittest
from unittest.mock import patch
from Bio.SeqFeature import SeqFeature
from opencloning.dna_utils import (
    align_with_mafft,
    sum_is_sticky,
    align_sanger_traces,
    compound_location_to_capitalized_str,
    _longest_exact_run,
    _rotate_alignment_to_reference_origin,
)
from pydna.dseq import Dseq
from pydna.parsers import parse
from pydna.dseqrecord import Dseqrecord
from Bio.Seq import reverse_complement
from Bio.SeqFeature import Location

test_files = os.path.join(os.path.dirname(__file__), 'test_files')


class PartialStickyTest(unittest.TestCase):
    # General test functions
    def expectTrue(self, seq_left, seq_right, partial):
        with self.subTest():
            self.assertTrue(sum_is_sticky(seq_left.three_prime_end(), seq_right.five_prime_end(), partial))

    def expectFalse(self, seq_left, seq_right, partial):
        with self.subTest():
            self.assertFalse(sum_is_sticky(seq_left.three_prime_end(), seq_right.five_prime_end(), partial))

    # Specific cases
    def test_blunt_ends(self):
        for partial in [False, True]:
            self.expectFalse(Dseq('ACGT'), Dseq('ACGT'), partial)

    def test_sticky_ends_full_overlap_3(self):
        seq1 = Dseq('ACGTAAA', 'ACGT', ovhg=0)
        seq2 = Dseq('ACGT', 'ACGTTTT', ovhg=3)

        for partial in [False, True]:
            self.expectTrue(seq1, seq2, partial)

    def test_sticky_ends_full_overlap_5(self):
        seq1 = Dseq('ACGT', 'TTTACGT', ovhg=0)
        seq2 = Dseq('AAAACGT', 'ACGT', ovhg=-3)

        for partial in [False, True]:
            self.expectTrue(seq1, seq2, partial)

    def test_sticky_ends_partial_overlap_3(self):
        seq1 = Dseq('ACGTAA', 'ACGT', ovhg=0)
        seq2 = Dseq('ACGT', 'ACGTTTT', ovhg=3)

        self.expectTrue(seq1, seq2, True)
        self.expectFalse(seq1, seq2, False)

        seq3 = Dseq('ACGTAAA', 'ACGT', ovhg=0)
        seq4 = Dseq('ACGT', 'ACGTTT', ovhg=2)

        self.expectTrue(seq3, seq4, True)
        self.expectFalse(seq3, seq4, False)

    def test_sticky_ends_partial_overlap_5(self):
        seq1 = Dseq('ACGT', 'TTACGT', ovhg=0)
        seq2 = Dseq('AAAACGT', 'ACGT', ovhg=-3)

        self.expectTrue(seq1, seq2, True)
        self.expectFalse(seq1, seq2, False)

        seq3 = Dseq('ACGT', 'TTTACGT', ovhg=0)
        seq4 = Dseq('AAACGT', 'ACGT', ovhg=-2)

        self.expectTrue(seq3, seq4, True)
        self.expectFalse(seq3, seq4, False)

    def test_sticky_ends_max_len(self):
        # Ensures that all possible overlapping lengths are covered
        seq1 = Dseq('ACGT', 'GTACGT', ovhg=0)
        seq2 = Dseq('ACAACGT', 'ACGT', ovhg=-3)

        self.expectTrue(seq1, seq2, True)
        self.expectFalse(seq1, seq2, False)


class AlignSangerTrackTest(unittest.TestCase):

    def test_align_sanger_traces(self):
        seq = parse(os.path.join(test_files, 'GIN11M86.gb'))[0]
        trace = 'ttgcagcattttgtctttctataaaaatgtgtcgttcctttttttcattttttggcgcgtcgcctcggggtcgtatagaatat'
        alignment = align_sanger_traces(seq, [trace])
        self.assertTrue(alignment[1].startswith('-' * 152 + trace.upper()))

        # Fails with non-nucleotide sequences
        trace_wrong = 'helloworld'
        with self.assertRaises(ValueError):
            align_sanger_traces(seq, [trace_wrong])

        # Works with degenerate sequences
        trace_degenerate = trace.replace('g', 'n')
        alignment_degenerate = align_sanger_traces(seq, [trace_degenerate])
        self.assertTrue(alignment_degenerate[1].startswith('-' * 152 + trace_degenerate.upper()))

        # If the trace aligns to the reverse complement, it returns the trace in the opposite orientation
        trace_rc = reverse_complement(trace)
        alignment_rc = align_sanger_traces(seq, [trace_rc])
        self.assertEqual(alignment_rc[1], alignment[1])

        # Works with circular sequences
        end_of_seq = 'ggtggtgggattggtataaagtggtagggtaagtatgtgtgtattatttacgatc'.upper().replace('G', 'N')
        start_of_seq = 'gatcaataacagtgtttgtggagca'.upper()
        seq = Dseqrecord(start_of_seq + end_of_seq, circular=True)
        for rev_comp in [False, True]:
            trace_across_origin = end_of_seq + start_of_seq[:4] + start_of_seq[8:]
            if rev_comp:
                trace_across_origin = reverse_complement(trace_across_origin)
            alignment = align_sanger_traces(seq, [trace_across_origin])
            # The alignment returns the sequence without shifting it
            self.assertEqual(alignment[0].upper(), str(seq.seq))
            # It has shifted the trace, and replaced padding Ns with dashes, but kept the
            # original Ns as such
            self.assertEqual(
                alignment[1],
                (
                    start_of_seq[:4]
                    + '----'
                    + start_of_seq[8:]
                    + (len(seq) - len(trace_across_origin) - 4) * '-'
                    + end_of_seq
                ).upper(),
            )

        # Works with circular sequences reversed
        trace_across_origin_rc = reverse_complement(trace_across_origin)
        alignment_rc = align_sanger_traces(seq, [trace_across_origin_rc])
        self.assertEqual(alignment_rc[0].upper(), str(seq.seq))
        self.assertEqual(alignment_rc[1], alignment[1])

    def test_align_sanger_traces_multiple(self):
        seq = parse(os.path.join(test_files, 'GIN11M86.gb'))[0].looped()
        trace = 'ttgcagcattttgtctttctataaaaatgtgtcgttcctttttttcattttttggcgcgtcgcctcggggtcgtatagaatatg'
        trace_rc = reverse_complement(trace)

        # Works with multiple traces
        alignments = align_sanger_traces(seq, [trace, trace, trace_rc])
        self.assertEqual(alignments[0].upper().replace('-', ''), str(seq.seq))
        self.assertEqual(len(alignments), 4)
        self.assertEqual(alignments[1], alignments[2])
        # TODO: this has to do with https://github.com/OpenCloning/OpenCloning_frontend/issues/336
        self.assertEqual(alignments[1], alignments[3])

    def test_align_sanger_traces_plasmid(self):
        seq = parse(os.path.join(test_files, 'GIN11M86.gb'))[0].looped()
        ref = str(seq.seq)

        # Full plasmid sequencing: a few SNPs, a deletion and an insertion
        trace = list(ref)
        for pos in (100, 500, 800):
            trace[pos] = 'A' if trace[pos] != 'A' else 'C'
        trace = ''.join(trace)
        trace = trace[:300] + trace[305:]
        trace = trace[:700] + 'GATTACA' + trace[700:]

        expected = align_sanger_traces(seq, [trace])
        self.assertEqual(expected[0], ref[:705] + '-' * 7 + ref[705:])
        self.assertEqual(expected[1].replace('-', ''), trace)

        # The result does not depend on the rotation or strand of the trace
        for shift in [1, 50, 299, 302, 650, len(trace) - 1]:
            for rev_comp in [False, True]:
                rotated = trace[shift:] + trace[:shift]
                if rev_comp:
                    rotated = reverse_complement(rotated)
                self.assertEqual(align_sanger_traces(seq, [rotated]), expected)

        # Nor on the rotation or strand of the reference
        for shifted_seq in [seq.shifted(400), seq.reverse_complement().shifted(123)]:
            alignment = align_sanger_traces(shifted_seq, [trace])
            self.assertEqual(alignment[0].replace('-', ''), str(shifted_seq.seq))
            aligned_trace = alignment[1].replace('-', '')
            self.assertEqual(len(aligned_trace), len(trace))
            self.assertTrue(aligned_trace in trace * 2 or reverse_complement(aligned_trace) in trace * 2)
            self.assertEqual(alignment[0].count('-'), 7)

    def test_align_sanger_traces_longer_than_reference(self):
        seq = parse(os.path.join(test_files, 'GIN11M86.gb'))[0].looped()
        ref = str(seq.seq)
        insertion = 'ACGTACGTAC' * 5
        trace = ref[:200] + insertion + ref[200:]
        expected = [ref[:200] + '-' * len(insertion) + ref[200:], trace]
        for shift in [0, 10, 220, 600]:
            for rev_comp in [False, True]:
                rotated = trace[shift:] + trace[:shift]
                if rev_comp:
                    rotated = reverse_complement(rotated)
                self.assertEqual(align_sanger_traces(seq, [rotated]), expected)

    def test_align_sanger_traces_unrelated(self):
        # Unrelated sequences, where the rough alignment spans more than a full turn of the reference
        seq = Dseqrecord('TTAGTTGTGCCGCAGCGAAGTAGTGCTTGAAATATGCGAC', circular=True)
        trace = 'CCCTAAGTAGGAGCGTATGCGCCCAGTAACCAATGCCTGT'
        alignment = align_sanger_traces(seq, [trace])
        # The alignment is still returned
        self.assertEqual(alignment[0].replace('-', ''), str(seq.seq))

    def test_longest_exact_run(self):
        # 3 matches, mismatch, 6 matches, insertion, deletion, 2 matches
        self.assertEqual(_longest_exact_run('3=1X6=2I1D2=', 0, 0), (7, 7))
        self.assertEqual(_longest_exact_run('3=1X6=2I1D2=', 5, 10), (12, 17))
        # Positions after insertions and deletions
        self.assertEqual(_longest_exact_run('2=3I4=', 0, 0), (7, 4))
        self.assertEqual(_longest_exact_run('2=3D4=', 0, 0), (4, 7))
        # No matches
        self.assertEqual(_longest_exact_run('4X', 3, 8), (3, 8))

    def test_rotate_alignment_to_reference_origin(self):
        ref = 'ACGTTGCA'
        for shift in range(len(ref)):
            rotated = ref[shift:] + ref[:shift]
            self.assertEqual(
                _rotate_alignment_to_reference_origin(rotated, rotated.lower(), shift), (ref, ref.lower())
            )

        # Gaps in the reference stay attached to the base before them
        ref_aln = 'GC--AAC-GT'
        trace_aln = 'GCTTAACCG-'
        # The original reference is AACGTGC (rotated by 5)
        self.assertEqual(
            _rotate_alignment_to_reference_origin(ref_aln, trace_aln, 5),
            ('AAC-GTGC--', 'AACCG-GCTT'),
        )

    def test_mafft_missing(self):
        with patch('shutil.which', lambda x: None if x == 'mafft' else True):
            with self.assertRaises(RuntimeError) as cm:
                align_with_mafft(['ACGT', 'ACGT'], orientation_known=False)
            self.assertEqual(str(cm.exception), "'mafft' executable not found in PATH")


class CompoundLocationToCapitalizedStrTest(unittest.TestCase):
    def test_compound_location_to_capitalized_str(self):
        a = Dseqrecord('ACCGGGTTTT')
        loc = Location.fromstring('join(1..2,6..10)')
        loc2 = Location.fromstring('complement(join(1..2,6..10))')
        self.assertEqual(compound_location_to_capitalized_str(a, loc), 'ACcggGTTTT')
        self.assertEqual(compound_location_to_capitalized_str(a, loc2), reverse_complement('ACcggGTTTT'))

        b = Dseqrecord('ACCGGGTTTT', circular=True)
        b.features.append(SeqFeature(type='misc_feature', location=loc, qualifiers={'label': ['test']}))
        b.features.append(SeqFeature(type='misc_feature', location=loc2, qualifiers={'label': ['test2']}))
        for shift in range(len(b)):
            b_shifted = b.shifted(shift)
            loc1_shifted = next(f for f in b_shifted.features if f.qualifiers['label'] == ['test'])
            loc2_shifted = next(f for f in b_shifted.features if f.qualifiers['label'] == ['test2'])
            self.assertEqual(compound_location_to_capitalized_str(b_shifted, loc1_shifted.location), 'ACcggGTTTT')
            self.assertEqual(
                compound_location_to_capitalized_str(b_shifted, loc2_shifted.location),
                reverse_complement('ACcggGTTTT'),
            )

    def test_error(self):
        a = Dseqrecord('ACCGGGTTTT')
        with self.assertRaises(ValueError):
            compound_location_to_capitalized_str(a, Location.fromstring('1..2'))
