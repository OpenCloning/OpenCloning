import os
import unittest
from unittest.mock import patch
from Bio.SeqFeature import SeqFeature
from opencloning.dna_utils import (
    sum_is_sticky,
    align_sanger_traces,
    permutate_trace,
    remove_padding,
    compound_location_to_capitalized_str,
)
from pydna.dseq import Dseq
from pydna.parsers import parse
from pydna.dseqrecord import Dseqrecord
from Bio.Seq import reverse_complement
from Bio.Align import Alignment
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

    def test_permutate_trace_error(self):
        with self.assertRaises(RuntimeError):
            permutate_trace('hello', 'world')

        with self.assertRaises(RuntimeError):
            permutate_trace('a', 'aa')

    def test_remove_padding(self):
        full_seq = 'gatcaataacagtgtttgtggagctgtgtgtattatttacgatc'.upper()
        trace = full_seq[:-15]

        for rotation in range(len(full_seq)):

            # This is the equivalent of permutate_trace(full_seq, trace), but a real example can return
            # the same result for subsequent rotations, so we just mock it like this
            ref = full_seq[rotation:] + full_seq[:rotation]
            permutated_trace = trace[rotation:] + 'N' * 15 + trace[:rotation]
            seq, coords = Alignment.parse_printed_alignment([bytes(ref, 'utf-8'), bytes(permutated_trace, 'utf-8')])

            alignment = Alignment([s.decode() for s in seq], coords)
            assert remove_padding(alignment, trace)[1] == trace[rotation:] + '-' * 15 + trace[:rotation]

        # Works without padding
        seq, coords = Alignment.parse_printed_alignment([bytes(full_seq, 'utf-8'), bytes(full_seq, 'utf-8')])
        alignment = Alignment([s.decode() for s in seq], coords)
        s1, s2 = remove_padding(alignment, full_seq)
        assert s1 == full_seq
        assert s2 == full_seq

        trace = 'GGTGGTGGGATTGGTATAAAGTGGTAGGGTAAGTATGTGTGTATTATTTACGATCAAAACAGTGTTTGTGGAGCA'
        # Removes double -/- resulting from -/N
        seq, coords = Alignment.parse_printed_alignment(
            [
                bytes(
                    'GATCAATAACAGTGTTTGTGGAGCA-----GAGTAGATTACTTAAAGTATGACAATTGCTTCAACGAAGGGAAAAGCGGCGTTCCCTTGATGGTGGTGGGATTGGTATAAAGTGGTAGGGTAAGTATGTGTGTATTATTTACGATC',
                    'utf-8',
                ),
                bytes(
                    '-----AAAACAGTGTTTGTGGAGCANNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNGGTGGTGGGATTGGTATAAAGTGGTAGGGTAAGTATGTGTGTATTATTTACGATC',
                    'utf-8',
                ),
            ]
        )
        alignment = Alignment([s.decode() for s in seq], coords)
        s1, s2 = remove_padding(alignment, trace)
        self.assertNotIn('-', s1)

    def test_binaries_missing(self):
        seq = Dseqrecord('ACGT')

        # Test mars missing
        with patch('shutil.which', lambda x: None if x == 'mars' else True):
            with self.assertRaises(RuntimeError) as cm:
                align_sanger_traces(seq, ['ACGT'])
            self.assertEqual(str(cm.exception), "'mars' executable not found in PATH")

        # Test mafft missing
        with patch('shutil.which', lambda x: None if x == 'mafft' else True):
            with self.assertRaises(RuntimeError) as cm:
                align_sanger_traces(seq, ['ACGT'])
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
