from opencloning.primer_design import (
    homologous_recombination_primers,
    gibson_assembly_primers,
    simple_pair_primers,
)
from opencloning.ebic.primer_design import ebic_primers
from Bio.SeqFeature import SimpleLocation, SeqFeature
from unittest import TestCase
from pydna.dseqrecord import Dseqrecord
from pydna.amplify import pcr
from pydna.parsers import parse
from pydna.assembly2 import Assembly, gibson_overlap, gibson_assembly
import pytest
from Bio.Data.IUPACData import ambiguous_dna_values
import os
from opencloning.primer3_functions import PrimerDesignSettings

from pydna.primer import Primer

test_files = os.path.join(os.path.dirname(__file__), 'test_files')


class TestHomologousRecombinationPrimers(TestCase):

    def test_normal_examples(self):
        """
        Test the homologous_recombination_primers function.
        """

        #
        pcr_seq = Dseqrecord('AATGATGGATGACATTCAAAGCACTGATTCTATTGCTGAAAAAGATAAT')
        pcr_loc = SimpleLocation(4, 44)
        hr_seq = Dseqrecord('AAACGTTT')
        homology_length = 3
        minimal_hybridization_length = 10
        insert_forward = True
        target_tm = 30

        # First we replace the CG
        hr_loc_replace = SimpleLocation(3, 5)
        primers = homologous_recombination_primers(
            pcr_seq,
            pcr_loc,
            hr_seq,
            hr_loc_replace,
            homology_length,
            minimal_hybridization_length,
            insert_forward,
            target_tm,
        )
        self.assertEqual(primers, ('aaaATGGATGACATT', 'aaaCTTTTTCAGCAA'))

        # An insertion
        hr_loc_insert = SimpleLocation(3, 3)
        primers = homologous_recombination_primers(
            pcr_seq,
            pcr_loc,
            hr_seq,
            hr_loc_insert,
            homology_length,
            minimal_hybridization_length,
            insert_forward,
            target_tm,
        )
        self.assertEqual(primers, ('aaaATGGATGACATT', 'acgCTTTTTCAGCAA'))

        # Same, circular and we loop
        pcr_seq = pcr_seq.looped()
        hr_seq = hr_seq.looped()
        pcr_seq.features.append(SeqFeature(pcr_loc))
        hr_seq.features.append(SeqFeature(hr_loc_replace))
        hr_seq.features.append(SeqFeature(hr_loc_insert))

        for shift_pcr in range(len(pcr_seq)):
            pcr_shifted = pcr_seq.shifted(shift_pcr)
            pcr_loc = pcr_shifted.features[0].location

            hr_shifted = hr_seq
            hr_loc_replace = hr_shifted.features[0].location
            hr_loc_insert = hr_shifted.features[1].location
            solutions = (
                ('aaaATGGATGACATT', 'aaaCTTTTTCAGCAA'),
                ('aaaATGGATGACATT', 'acgCTTTTTCAGCAA'),
            )
            for shift_hr in range(len(hr_seq)):
                hr_shifted = hr_seq.shifted(shift_hr)
                hr_loc_replace = hr_shifted.features[0].location
                hr_loc_insert = hr_shifted.features[1].location
                solutions = (
                    ('aaaATGGATGACATT', 'aaaCTTTTTCAGCAA'),
                    ('aaaATGGATGACATT', 'acgCTTTTTCAGCAA'),
                )
                for hr_loc, solution in zip([hr_loc_replace, hr_loc_insert], solutions):
                    for insert_forward in (True, False):
                        if not insert_forward:
                            solution = (
                                solution[0][:homology_length] + solution[1][homology_length:],
                                solution[1][:homology_length] + solution[0][homology_length:],
                            )

                        primers = homologous_recombination_primers(
                            pcr_shifted,
                            pcr_loc,
                            hr_shifted,
                            hr_loc,
                            homology_length,
                            minimal_hybridization_length,
                            insert_forward,
                            target_tm,
                        )
                        self.assertEqual(primers, solution)
        # With spacers
        spacers = ['attt', 'cggg']
        primers = homologous_recombination_primers(
            pcr_shifted,
            pcr_loc,
            hr_shifted,
            hr_loc,
            homology_length,
            minimal_hybridization_length,
            True,  # insert_forward
            target_tm,
            spacers,
        )
        solution = ('aaaatttATGGATGACATT', 'acgcccgCTTTTTCAGCAA')
        self.assertEqual(primers, solution)

        # The spacer is defined with respect to the locus, not the insert
        # so if we insert inverse, it should look like this:

        primers = homologous_recombination_primers(
            pcr_shifted,
            pcr_loc,
            hr_shifted,
            hr_loc,
            homology_length,
            minimal_hybridization_length,
            False,  # insert_forward
            target_tm,
            spacers,
        )

        solution = ('aaaatttCTTTTTCAGCAA', 'acgcccgATGGATGACATT')
        self.assertEqual(primers, solution)

    def test_clashing_homology(self):

        pcr_seq = Dseqrecord('AATGATGGATGACATTCAAAGCACTGATTCTATTGCTGAAAAAGATAAT')
        pcr_loc = SimpleLocation(4, 44)
        hr_seq = Dseqrecord('AAACGTTT')
        homology_length = 5
        minimal_hybridization_length = 10
        insert_forward = True
        target_tm = 30
        hr_loc_insert = SimpleLocation(3, 3)

        try:
            homologous_recombination_primers(
                pcr_seq,
                pcr_loc,
                hr_seq,
                hr_loc_insert,
                homology_length,
                minimal_hybridization_length,
                insert_forward,
                target_tm,
            )
            self.fail('Expected ValueError.')

        except ValueError as e:
            self.assertEqual(str(e), 'Forward homology region is out of bounds.')

        hr_loc_insert = SimpleLocation(5, 5)

        try:
            homologous_recombination_primers(
                pcr_seq,
                pcr_loc,
                hr_seq,
                hr_loc_insert,
                homology_length,
                minimal_hybridization_length,
                insert_forward,
                target_tm,
            )
            self.fail('Expected ValueError.')
        except ValueError as e:
            self.assertEqual(str(e), 'Reverse homology region is out of bounds.')

        # circular case with clashing homology
        hr_seq = hr_seq.looped()
        homology_length = 4
        # exact match
        homologous_recombination_primers(
            pcr_seq,
            pcr_loc,
            hr_seq,
            hr_loc_insert,
            homology_length,
            minimal_hybridization_length,
            insert_forward,
            target_tm,
        )
        # clashing homology
        homology_length = 5
        try:
            homologous_recombination_primers(
                pcr_seq,
                pcr_loc,
                hr_seq,
                hr_loc_insert,
                homology_length,
                minimal_hybridization_length,
                insert_forward,
                target_tm,
            )
            self.fail('Expected ValueError.')
        except ValueError as e:
            self.assertEqual(str(e), 'Homology arms overlap.')

    def test_errors(self):
        pcr_seq = Dseqrecord('AATGATGGATGACATTCAAAGCACTGATTCTATTGCTGAAAAAGATAAT')
        pcr_loc = SimpleLocation(4, 44)
        hr_seq = Dseqrecord('AAACGTTT')
        homology_length = 3
        minimal_hybridization_length = 10
        insert_forward = True
        target_tm = 30
        hr_loc_insert = SimpleLocation(5, 5)

        # Wrong number of spacers
        try:
            homologous_recombination_primers(
                pcr_seq,
                pcr_loc,
                hr_seq,
                hr_loc_insert,
                homology_length,
                minimal_hybridization_length,
                insert_forward,
                target_tm,
                spacers=['ATTT'],
            )
            self.fail('Expected ValueError.')

        except ValueError as e:
            self.assertIn("The 'spacers' list", str(e))

        # Primers can't be designed

        try:
            homologous_recombination_primers(
                pcr_seq,
                pcr_loc,
                hr_seq,
                hr_loc_insert,
                homology_length,
                100,
                insert_forward,
                target_tm,
            )
            self.fail('Expected ValueError.')
        except ValueError as e:
            self.assertIn('Primers could not be designed', str(e))


class TestGibsonAssemblyPrimers(TestCase):

    def test_normal_examples(self):
        """
        Test the gibson_assembly_primers function.
        """

        # Test case for gibson_assembly_primers function
        templates = [
            Dseqrecord('AAACAGTAATACGTTCCTTTTTTATGATGATGGATGACATTCAAAGCACTGATTCTAT'),
            Dseqrecord('GTTTACAACGGCAATGAACGTTCCTTTTTTATGATATGCCCAGCTTCATGAAATGGAA'),
            Dseqrecord('AAGGACAACGTTCCTTTTTTATGATATATATGGCACAGTATGATCAAAAGTTAAGTAC'),
        ]
        # Set the name to 'name' to check formatting of name
        for i, template in enumerate(templates):
            template.name = 'name'
            template.id = f'{i}'

        homology_length = 20
        minimal_hybridization_length = 15
        target_tm = 55
        circular = True

        primers = gibson_assembly_primers(
            templates, homology_length, minimal_hybridization_length, target_tm, circular
        )

        # Check if the correct number of primers is returned
        self.assertEqual(len(primers), 6)  # 2 primers per template

        # Check if all primers are instances of PrimerModel
        for primer in primers:
            self.assertIsInstance(primer, Primer)

        # Check if primer names are correctly formatted
        for i, primer in enumerate(primers):
            template_index = i // 2
            primer_type = 'fwd' if i % 2 == 0 else 'rvs'
            expected_name = f'seq_{templates[template_index].id}_{primer_type}'
            self.assertEqual(primer.name, expected_name)

        # Test that it yields the right sequence
        amplicons = list()
        for i in range(len(templates)):
            amplicons.append(
                pcr(
                    primers[i * 2],
                    primers[i * 2 + 1],
                    templates[i],
                )
            )

        asm = Assembly(
            amplicons,
            algorithm=gibson_overlap,
            use_fragment_order=False,
            use_all_fragments=True,
            limit=homology_length,
        )

        circular_assemblies = asm.assemble_circular()
        self.assertEqual(len(circular_assemblies), 1)
        self.assertEqual(circular_assemblies[0].seq.seguid(), sum(templates, Dseqrecord('')).seq.looped().seguid())

        # Test with circular=False
        circular = False
        primers = gibson_assembly_primers(
            templates, homology_length, minimal_hybridization_length, target_tm, circular
        )

        # Check if the correct number of primers is returned for linear assembly
        self.assertEqual(len(primers), 6)  # 2 primers per template

        # Test that it yields the right sequence
        amplicons = list()
        for i in range(len(templates)):
            amplicons.append(
                pcr(
                    primers[i * 2],
                    primers[i * 2 + 1],
                    templates[i],
                )
            )

        asm = Assembly(
            amplicons,
            algorithm=gibson_overlap,
            use_fragment_order=False,
            use_all_fragments=True,
            limit=homology_length,
        )

        linear_assemblies = asm.assemble_linear()
        self.assertEqual(len(linear_assemblies), 1)
        self.assertEqual(linear_assemblies[0].seq, sum(templates, Dseqrecord('')).seq)

    def test_primer_with_spacers(self):
        """
        Test the gibson_assembly_primers function with spacers.
        """
        templates = [
            Dseqrecord('AAACAGTAATACGTTCCTTTTTTATGATGATGGATGACATTCAAAGCACTGATTCTAT'),
            Dseqrecord('GTTTACAACGGCAATGAACGTTCCTTTTTTATGATATGCCCAGCTTCATGAAATGGAA'),
            Dseqrecord('AAGGACAACGTTCCTTTTTTATGATATATATGGCACAGTATGATCAAAAGTTAAGTAC'),
        ]
        spacers = ['aaaa', 'tttt', 'cccc']
        homology_length = 20
        minimal_hybridization_length = 15
        target_tm = 55
        circular = True

        primers = gibson_assembly_primers(
            templates, homology_length, minimal_hybridization_length, target_tm, circular, spacers=spacers
        )

        self.assertTrue(primers[0].seq.startswith('TTAAGTACccccAAACAGTA'))
        self.assertTrue(primers[-1].seq.reverse_complement().endswith('TTAAGTACccccAAACAGTA'))

        self.assertTrue(primers[1].seq.reverse_complement().endswith('GATTCTATaaaaGTTTACAA'))
        self.assertTrue(primers[2].seq.startswith('GATTCTATaaaaGTTTACAA'))

        self.assertTrue(primers[3].seq.reverse_complement().endswith('AAATGGAAttttAAGGACAA'))
        self.assertTrue(primers[4].seq.startswith('AAATGGAAttttAAGGACAA'))

    @pytest.mark.xfail(reason='Waiting on https://github.com/BjornFJohansson/pydna/issues/265')
    def test_primer_errors(self):
        """
        Test the gibson_assembly_primers function.
        """

        templates = [
            Dseqrecord('AAACAGTAATACGTTCCTTTTTTATGATGATGGATGACATTCAAAGCACTGATTCTAT'),
            Dseqrecord('GTTTACTGGAA'),
            Dseqrecord('AAGGACAACGTTCCTTTTTTATGATATATATGGCACAGTATGATCAAAAGTTAAGTAC'),
        ]
        homology_length = 20
        minimal_hybridization_length = 15
        target_tm = 55
        circular = True

        try:
            gibson_assembly_primers(templates, homology_length, minimal_hybridization_length, target_tm, circular)
            self.fail('Expected ValueError.')
        except ValueError as e:
            self.assertEqual(str(e), 'Primers could not be designed for template 2, try changing settings.')

        templates = [templates[0], templates[2]]

        # Now ask for too long minimal_hybridization_length
        minimal_hybridization_length = 100
        try:
            gibson_assembly_primers(templates, homology_length, minimal_hybridization_length, target_tm, circular)
            self.fail('Expected ValueError.')
        except ValueError as e:
            self.assertEqual(str(e), 'Primers could not be designed for template 1, 2, try changing settings.')

        # Too long homology_length
        homology_length = 200
        minimal_hybridization_length = 15
        try:
            gibson_assembly_primers(templates, homology_length, minimal_hybridization_length, target_tm, circular)
            self.fail('Expected ValueError.')
        except ValueError as e:
            self.assertEqual(str(e), 'Primers could not be designed for template 1, 2, try changing settings.')

    def test_primer_with_amplify_templates(self):
        to_amplify = Dseqrecord('aagccagaagtgcatttggatccaagtgcctccattttaaatctctcatcttc', name='to_amplify')
        to_amplify.add_feature(0, len(to_amplify), label='to_amplify')
        spacer_like = Dseqrecord('attaattcctttgaagaagaaattttgggtttgtggtctgagcctaaat', name='spacer_like')
        spacer_like.add_feature(0, len(spacer_like), label='spacer_like')

        primers = gibson_assembly_primers(
            [to_amplify, spacer_like],
            homology_length=15,
            minimal_hybridization_length=15,
            target_tm=55,
            circular=True,
            amplify_templates=[True, False],
        )

        self.assertEqual(len(primers), 4)
        self.assertEqual(primers[0].name, 'to_amplify_fwd')
        self.assertEqual(primers[1].name, 'to_amplify_rvs')
        self.assertTrue(primers[0].seq.startswith('ggtctgagcctaaat'))
        self.assertTrue(primers[1].seq.reverse_complement().endswith('attaattcctttgaa'))
        self.assertEqual(primers[2], None)
        self.assertEqual(primers[3], None)

        # Test linear assembly
        primers = gibson_assembly_primers(
            [to_amplify, spacer_like],
            homology_length=15,
            minimal_hybridization_length=15,
            target_tm=55,
            circular=False,
            amplify_templates=[True, False],
            spacers=['ATATATA', 'GCGCGCGC', ''],
        )
        self.assertEqual(len(primers), 4)
        self.assertEqual(primers[2], None)
        self.assertEqual(primers[3], None)
        pcr_product = pcr(primers[0], primers[1], to_amplify)

        assembly_product = gibson_assembly([pcr_product, spacer_like], limit=15)[0]
        self.assertEqual(
            str(assembly_product.seq).lower(),
            ('ATATATA' + str(to_amplify.seq) + 'GCGCGCGC' + str(spacer_like.seq)).lower(),
        )

    def test_validation_errors(self):
        """
        Test the validation errors for the gibson_assembly_primers function.
        """
        templates = [
            Dseqrecord('AAACAGTAATACGTTCCTTTTTTATGATGATGGATGACATTCAAAGCACTGATTCTAT'),
            Dseqrecord('GTTTACAACGGCAATGAACGTTCCTTTTTTATGATATGCCCAGCTTCATGAAATGGAA'),
            Dseqrecord('AAGGACAACGTTCCTTTTTTATGATATATATGGCACAGTATGATCAAAAGTTAAGTAC'),
        ]
        templates[1].name = 'template_1'
        homology_length = 20
        minimal_hybridization_length = 15
        target_tm = 55
        circular = False

        # Not two consecutive templates with amplify_templates=False
        with pytest.raises(ValueError) as e:
            gibson_assembly_primers(
                templates,
                homology_length,
                minimal_hybridization_length,
                target_tm,
                circular,
                amplify_templates=[True, False, False],
            )
        self.assertEqual(str(e.value), 'Two consecutive templates with amplify_templates=False are not allowed.')

        # Also in circular
        with pytest.raises(ValueError) as e:
            gibson_assembly_primers(
                templates,
                homology_length,
                minimal_hybridization_length,
                target_tm,
                circular=True,
                amplify_templates=[False, True, False],
            )

        # No mismatch in length between templates and amplify_templates
        with pytest.raises(ValueError) as e:
            gibson_assembly_primers(
                templates,
                homology_length,
                minimal_hybridization_length,
                target_tm,
                circular,
                amplify_templates=[True, False],
            )
        self.assertEqual(str(e.value), 'The number of amplify_templates must be the same as the number of templates.')

        # Spacer too long
        with pytest.raises(ValueError) as e:
            gibson_assembly_primers(
                templates,
                homology_length,
                minimal_hybridization_length,
                target_tm,
                circular,
                spacers=['', 'ACGT' * 100],
                amplify_templates=[True, False, True],
            )
        self.assertEqual(
            str(e.value),
            'Template template_1 (58 bps) is shorter than the longest spacer or 2x the minimal hybridization length.',
        )

        # Single input, amplify_templates=False
        with pytest.raises(ValueError) as e:
            gibson_assembly_primers(
                templates[:1],
                homology_length,
                minimal_hybridization_length,
                target_tm,
                circular,
                amplify_templates=[False],
            )
        self.assertEqual(str(e.value), 'amplify_templates cannot be False for a single template.')

        # First spacer cannot be empty if the first template is not amplified in linear assembly
        with pytest.raises(ValueError) as e:
            gibson_assembly_primers(
                templates[:2],
                homology_length,
                minimal_hybridization_length,
                target_tm,
                circular=False,
                spacers=['ACGT', '', ''],
                amplify_templates=[False, True],
            )
        self.assertEqual(
            str(e.value), 'The first spacer must be empty if the first template is not amplified in linear assembly.'
        )

        # Last spacer must be empty if the last template is not amplified in linear assembly
        with pytest.raises(ValueError) as e:
            gibson_assembly_primers(
                templates[:2],
                homology_length,
                minimal_hybridization_length,
                target_tm,
                circular=False,
                spacers=['', '', 'ACGT'],
                amplify_templates=[True, False],
            )
        self.assertEqual(
            str(e.value), 'The last spacer must be empty if the last template is not amplified in linear assembly.'
        )


class TestSimplePairPrimers(TestCase):
    def test_restriction_enzyme_primers(self):
        """
        Test the restriction_enzyme_primers function.
        """
        from Bio.Restriction import EcoRI, BamHI, AflIII, BsaI

        template = Dseqrecord('ATGCATGCATGCAAAAATGCATGCATGC')
        minimal_hybridization_length = 10
        target_tm = 45
        left_enzyme = EcoRI
        right_enzyme = BamHI
        filler_bases = 'GC'
        template.name = 'dummy'
        template.id = '0'

        fwd, rvs = simple_pair_primers(
            template, minimal_hybridization_length, target_tm, left_enzyme, right_enzyme, filler_bases
        )

        # Check that primers contain the correct restriction sites
        self.assertTrue(fwd.seq.startswith('GC' + str(EcoRI.site)))
        self.assertTrue(rvs.seq.startswith('GC' + str(BamHI.site)))

        # Check that the name is correct
        self.assertEqual(fwd.name, 'dummy_EcoRI_fwd')
        self.assertEqual(rvs.name, 'dummy_BamHI_rvs')

        # Check that the name is correct when the name is 'name'
        template.name = 'name'
        fwd, rvs = simple_pair_primers(
            template, minimal_hybridization_length, target_tm, left_enzyme, right_enzyme, filler_bases
        )

        self.assertEqual(fwd.name, 'seq_0_EcoRI_fwd')
        self.assertEqual(rvs.name, 'seq_0_BamHI_rvs')

        # Test with only left enzyme
        fwd, rvs = simple_pair_primers(
            template, minimal_hybridization_length, target_tm, left_enzyme, None, filler_bases
        )

        self.assertTrue(fwd.seq.startswith('GC' + str(EcoRI.site)))
        self.assertFalse(rvs.seq.startswith('GC' + str(BamHI.site)))

        # Test with only right enzyme
        fwd, rvs = simple_pair_primers(
            template, minimal_hybridization_length, target_tm, None, right_enzyme, filler_bases
        )

        self.assertFalse(fwd.seq.startswith('GC' + str(EcoRI.site)))
        self.assertTrue(rvs.seq.startswith('GC' + str(BamHI.site)))

        # Test with no enzymes
        fwd, rvs = simple_pair_primers(template, minimal_hybridization_length, target_tm, None, None, filler_bases)

        self.assertFalse(fwd.seq.startswith('GC' + str(EcoRI.site)))
        self.assertFalse(rvs.seq.startswith('GC' + str(BamHI.site)))

        # Test with enzyme that has ambiguous bases
        fwd, rvs = simple_pair_primers(template, minimal_hybridization_length, target_tm, AflIII, AflIII, filler_bases)
        actual_site = (
            str(AflIII.site).replace('R', ambiguous_dna_values['R'][0]).replace('Y', ambiguous_dna_values['Y'][0])
        )

        self.assertTrue(fwd.seq.startswith('GC' + actual_site))
        self.assertTrue(rvs.seq.startswith('GC' + actual_site))

        # Test spacers on one side only
        spacers = ['ACGT' * 10, '']
        fwd, rvs = simple_pair_primers(
            template, minimal_hybridization_length, target_tm, left_enzyme, right_enzyme, filler_bases, spacers=spacers
        )

        self.assertTrue('GC' + str(left_enzyme.site) + 'ACGT' * 10 in fwd.seq)
        self.assertTrue('GC' + str(right_enzyme.site) in rvs.seq)

        # Both spacers
        spacers = ['ACGT' * 10, 'ACGT' * 10]
        fwd, rvs = simple_pair_primers(
            template, minimal_hybridization_length, target_tm, left_enzyme, right_enzyme, filler_bases, spacers=spacers
        )

        self.assertTrue('GC' + str(left_enzyme.site) + 'ACGT' * 10 in fwd.seq)
        self.assertTrue('GC' + str(right_enzyme.site) + 'ACGT' * 10 in rvs.seq)

        # Test with left_enzyme_inverted and right_enzyme_inverted
        fwd, rvs = simple_pair_primers(
            template,
            minimal_hybridization_length,
            target_tm,
            BsaI,
            BsaI,
            filler_bases,
            spacers=spacers,
            left_enzyme_inverted=True,
            right_enzyme_inverted=True,
        )

        self.assertTrue('GCGAGACC' + 'ACGT' * 10 in fwd.seq)
        self.assertTrue('GCGAGACC' + 'ACGT' * 10 in rvs.seq)

    def test_without_restriction_enzymes(self):
        """
        Test the restriction_enzyme_primers function without restriction enzymes.
        """
        template = Dseqrecord('ATGCAAACAGTGAACAGATACAGATGGAGACAATGGAGACAATAATGATGGATGAC')
        minimal_hybridization_length = 10
        target_tm = 55
        filler_bases = 'GC'
        template.name = 'dummy'
        template.id = '0'

        fwd, rvs = simple_pair_primers(template, minimal_hybridization_length, target_tm, None, None, filler_bases)

        # Check that primers are correct
        self.assertTrue(fwd.seq.startswith('ATGCA'))
        self.assertTrue(rvs.seq.startswith('GTCAT'))


class TestEbicPrimers(TestCase):
    def test_normal_examples(self):
        """
        Test the ebic_primers function.
        """

        template = parse(os.path.join(test_files, 'lacZ_EBIC_example.gb'))[0]

        alt_settings = PrimerDesignSettings()
        alt_settings.primer_dna_conc = 500
        result = ebic_primers(template, SimpleLocation(1000, 4075), 50, 20, 61, 3, settings=alt_settings)
        expected = (
            (
                'left_fwd',
                'ataGGTCTCtGGAGAAATTGTCGCGGCGATTAAATC',
            ),
            (
                'left_rvs',
                'ataGGTCTCtCATTTCATGGTCATAGCTGTTTCCTG',
            ),
            (
                'right_fwd',
                'ataGGTCTCtGCTTAATAATAATAACCGGGCAGGCC',
            ),
            (
                'right_rvs',
                'ataGGTCTCtAGCGGATGCGATTAATGATCAGTGGC',
            ),
        )

        for primer, expected in zip(result, expected):
            self.assertEqual(primer.name, expected[0])
            self.assertEqual(primer.sequence, expected[1])

    def test_errors(self):
        """
        Test the ebic_primers function.
        """
        template = parse(os.path.join(test_files, 'lacZ_EBIC_example.gb'))[0]
        with self.assertRaises(ValueError) as e:
            ebic_primers(template, SimpleLocation(0, 4075), 50, 20, 61, 3)
        self.assertIn('The template is too short for the padding.', str(e.exception))


# class TestGatewayAttBPrimers(TestCase):
#     def test_normal_examples(self):
#         """
#         Test the gateway_attB_primers function.
#         """
#         template = Dseqrecord('ATGCAAACAGTGAACAGATGGAGACAATAATGATGGATGAC')
#         template.id = '0'
#         minimal_hybridization_length = 10
#         target_tm = 55
#         left_site = 'attB1'
#         right_site = 'attB5'
#         spacers = None

#         primers = gateway_attB_primers(
#             template, minimal_hybridization_length, target_tm, (left_site, right_site), spacers
#         )

#         self.assertEqual(len(primers), 2)
#         self.assertEqual(primers[0].name, 'seq_0_attB1_fwd')
#         self.assertEqual(primers[1].name, 'seq_0_attB5_rvs')
#         self.assertTrue(primers[0].sequence.startswith('GGGG' + primer_design_attB['attB1']))
#         self.assertTrue(primers[1].sequence.startswith('GGGG' + primer_design_attB['attB5']))
