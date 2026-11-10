from fastapi.testclient import TestClient
from pydna.dseqrecord import Dseqrecord
from pydna.amplify import pcr
import unittest
import copy
from Bio.Seq import reverse_complement
import os
from primer3 import bindings
from itertools import product

from opencloning.dna_functions import format_sequence_genbank
import opencloning.main as _main
from opencloning_linkml.datamodel import Primer as PrimerModel
from opencloning.pydantic_models import MAX_PRIMER_LENGTH, PrimerDesignQuery
from pydna.opencloning_models import SequenceLocationStr
from opencloning.endpoints.primer_design import (
    PrimerDetailsResponse,
    ThermodynamicResult,
)
from opencloning.primer3_functions import (
    primer3_calc_tm,
    PrimerDesignSettings,
    primer3_calc_homodimer,
    primer3_calc_heterodimer,
)

from pydna.parsers import parse
from pydna.assembly2 import Assembly, gibson_overlap

from opencloning.temp_functions import primer_model_to_pydna_primer

test_files = os.path.join(os.path.dirname(__file__), 'test_files')

client = TestClient(_main.app)


alt_primer_settings = PrimerDesignSettings(primer_dna_conc=500)


class PrimerDesignTest(unittest.TestCase):

    def test_homologous_recombination(self):
        pcr_seq = format_sequence_genbank(Dseqrecord('AATGATGGATGACATTCAAAGCACTGATTCTATTGCTGAAAAAGATAAT'))
        pcr_seq.id = 1
        pcr_loc = SequenceLocationStr('5..44')
        hr_seq = format_sequence_genbank(Dseqrecord('AAACGTTT'))
        hr_seq.id = 2
        hr_loc_replace = SequenceLocationStr('4..5')

        homology_length = 3
        minimal_hybridization_length = 10
        insert_forward = True
        target_tm = 30

        # First we replace the CG
        data = {
            'pcr_template': {
                'sequence': pcr_seq.model_dump(),
                'location': pcr_loc,
            },
            'homologous_recombination_target': {
                'sequence': hr_seq.model_dump(),
                'location': hr_loc_replace,
            },
        }
        params = {
            'homology_length': homology_length,
            'minimal_hybridization_length': minimal_hybridization_length,
            'insert_forward': insert_forward,
            'target_tm': target_tm,
        }
        response = client.post('/primer_design/homologous_recombination', json=data, params=params)
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload['primers'][0]['sequence'], 'aaaATGGATGACATT')
        self.assertEqual(payload['primers'][1]['sequence'], 'aaaCTTTTTCAGCAA')

        # Test with alt settings
        copy_data = copy.deepcopy(data)
        copy_data['settings'] = alt_primer_settings.model_dump()
        response = client.post('/primer_design/homologous_recombination', json=copy_data, params=params)
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload['primers'][0]['sequence'], 'aaaATGGATGACA')
        self.assertEqual(payload['primers'][1]['sequence'], 'aaaCTTTTTCAGC')

        # Raise valuerror
        params['homology_length'] = 10
        response = client.post('/primer_design/homologous_recombination', json=data, params=params)
        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertEqual(payload['detail'], 'Forward homology region is out of bounds.')

        # Test an insertion with spacers and reversed insert
        params['homology_length'] = 3
        data['pcr_template']['forward_orientation'] = False
        data['homologous_recombination_target']['location'] = SequenceLocationStr.from_start_and_end(3, 3, 1000, None)
        data['spacers'] = ['attt', 'cggg']
        response = client.post('/primer_design/homologous_recombination', json=data, params=params)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['primers'][0]['sequence'], 'aaaatttCTTTTTCAGCAA')
        self.assertEqual(payload['primers'][1]['sequence'], 'acgcccgATGGATGACATT')

        # Raise error if the number of spacers is incorrect
        data['spacers'] = ['attt', 'cggg', 'tttt']
        response = client.post('/primer_design/homologous_recombination', json=data, params=params)
        self.assertEqual(response.status_code, 422)
        self.assertIn('The number of spacers must be', response.json()['detail'])

        # Raise error if the spacer is not DNA
        data['spacers'] = ['zzz', 'cggg']
        response = client.post('/primer_design/homologous_recombination', json=data, params=params)
        self.assertEqual(response.status_code, 422)
        self.assertIn('Spacer can only contain ACGT bases', response.json()['detail'])

    def test_gibson_assembly(self):
        # Test case for gibson_assembly_primers endpoint
        templates = [
            Dseqrecord('AAACAGTAATACGTTCCTTTTTTATGATGATGGATGACATTCAAAGCACTGATTCTAT'),
            Dseqrecord('GTTTACAACGGCAATGAACGTTCCTTTTTTATGATATGCCCAGCTTCATGAAATGGAA'),
            Dseqrecord('AAGGACAACGTTCCTTTTTTATGATATATATGGCACAGTATGATCAAAAGTTAAGTAC'),
        ]

        queries = []
        for i, template in enumerate(templates):
            json_seq = format_sequence_genbank(template)
            json_seq.id = i
            queries.append(
                {
                    'sequence': json_seq.model_dump(),
                    'location': SequenceLocationStr.from_start_and_end(start=0, end=len(template)),
                    'forward_orientation': True,
                }
            )

        params = {'homology_length': 20, 'minimal_hybridization_length': 15, 'target_tm': 55, 'circular': True}

        response = client.post(
            '/primer_design/gibson_assembly', json={'pcr_templates': queries, 'spacers': None}, params=params
        )

        self.assertEqual(response.status_code, 200)

        payload = response.json()
        self.assertEqual(len(payload['primers']), 6)  # 2 primers per template
        for i, p in enumerate(payload['primers']):
            p = PrimerModel.model_validate(p)
            # Check that the name is correct
            if i % 2 == 0:
                self.assertEqual(p.name, f'seq_{i//2}_fwd')
            else:
                self.assertEqual(p.name, f'seq_{i//2}_rvs')

        # Validate that it gives the right result
        primers = [primer_model_to_pydna_primer(PrimerModel.model_validate(p)) for p in payload['primers']]
        p1 = pcr(primers[0], primers[1], templates[0])
        p2 = pcr(primers[2], primers[3], templates[1])
        p3 = pcr(primers[4], primers[5], templates[2])
        asm = Assembly(
            [p1, p2, p3], algorithm=gibson_overlap, limit=20, use_all_fragments=True, use_fragment_order=False
        )
        result = asm.assemble_circular()[0]
        expected = sum(templates, Dseqrecord('')).looped()
        self.assertEqual(result.seguid(), expected.seguid())

        # Test with alt settings (produces different primers)
        response = client.post(
            '/primer_design/gibson_assembly',
            json={'pcr_templates': queries, 'spacers': None, 'settings': alt_primer_settings.model_dump()},
            params=params,
        )
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(payload['primers']), 6)
        payload_primers = [primer_model_to_pydna_primer(PrimerModel.model_validate(p)) for p in payload['primers']]
        self.assertLess(len(payload_primers[0]), len(primers[0]))
        self.assertLess(len(payload_primers[1]), len(primers[1]))

        # Also works with forward_orientation = False
        queries[1]['forward_orientation'] = False
        response = client.post(
            '/primer_design/gibson_assembly', json={'pcr_templates': queries, 'spacers': None}, params=params
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['primers']), 6)  # 2 primers per template
        # Primer naming also works for named sequences
        for i, t in enumerate(templates):
            t.name = f'template_{i}'

        primers = [primer_model_to_pydna_primer(PrimerModel.model_validate(p)) for p in payload['primers']]
        p1 = pcr(primers[0], primers[1], templates[0])
        p2 = pcr(primers[2], primers[3], templates[1])
        p3 = pcr(primers[4], primers[5], templates[2])
        asm = Assembly(
            [p1, p2, p3], algorithm=gibson_overlap, limit=20, use_all_fragments=True, use_fragment_order=False
        )
        result = asm.assemble_circular()[0]
        templates2 = [templates[0], templates[1].reverse_complement(), templates[2]]
        expected = sum(templates2, Dseqrecord('')).looped()
        self.assertEqual(result.seguid(), expected.seguid())

        queries = []
        for i, template in enumerate(templates):
            json_seq = format_sequence_genbank(template)
            json_seq.id = i
            queries.append(
                {
                    'sequence': json_seq.model_dump(),
                    'location': SequenceLocationStr.from_start_and_end(start=0, end=len(template)),
                    'forward_orientation': True,
                }
            )

        params = {'homology_length': 20, 'minimal_hybridization_length': 15, 'target_tm': 55, 'circular': True}

        response = client.post(
            '/primer_design/gibson_assembly', json={'pcr_templates': queries, 'spacers': None}, params=params
        )

        self.assertEqual(response.status_code, 200)

        payload = response.json()
        self.assertEqual(len(payload['primers']), 6)  # 2 primers per template
        for i, p in enumerate(payload['primers']):
            p = PrimerModel.model_validate(p)
            # Check that the name is correct
            if i % 2 == 0:
                self.assertEqual(p.name, f'template_{i//2}_fwd')
            else:
                self.assertEqual(p.name, f'template_{i//2}_rvs')

        # Test error case with invalid parameters
        params['minimal_hybridization_length'] = 100  # Too long
        response = client.post(
            '/primer_design/gibson_assembly', json={'pcr_templates': queries, 'spacers': None}, params=params
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('Primers could not be designed', response.json()['detail'])

        # Test case with spacers
        params['homology_length'] = 20
        params['circular'] = True
        params['minimal_hybridization_length'] = 15
        spacers = ['aaaa', 'tttt', 'cccc']
        response = client.post(
            '/primer_design/gibson_assembly', json={'pcr_templates': queries, 'spacers': spacers}, params=params
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['primers']), 6)  # 2 primers per template
        primers = [PrimerModel.model_validate(p) for p in payload['primers']]
        self.assertTrue(primers[0].sequence.startswith('TTAAGTACccccAAACAGTA'))
        self.assertTrue(reverse_complement(primers[-1].sequence).endswith('TTAAGTACccccAAACAGTA'))
        self.assertTrue(reverse_complement(primers[1].sequence).endswith('GATTCTATaaaaGTTTACAA'))
        self.assertTrue(primers[2].sequence.startswith('GATTCTATaaaaGTTTACAA'))
        self.assertTrue(reverse_complement(primers[3].sequence).endswith('AAATGGAAttttAAGGACAA'))
        self.assertTrue(primers[4].sequence.startswith('AAATGGAAttttAAGGACAA'))

        # Test that wrong number of spacers fails
        response = client.post(
            '/primer_design/gibson_assembly',
            json={'pcr_templates': queries, 'spacers': ['aaaa', 'tttt']},
            params=params,
        )
        self.assertEqual(response.status_code, 422)

        # Test that non-DNA spacers fails
        response = client.post(
            '/primer_design/gibson_assembly',
            json={'pcr_templates': queries, 'spacers': ['hello', 'TTTT']},
            params=params,
        )
        self.assertEqual(response.status_code, 422)

    def test_gibson_assembly_amplify_templates(self):
        to_amplify = Dseqrecord('aagccagaagtgcatttggatccaagtgcctccattttaaatctctcatcttc', name='to_amplify')
        to_amplify.add_feature(0, len(to_amplify), label='to_amplify')
        spacer_like = Dseqrecord('attaattcctttgaagaagaaattttgggtttgtggtctgagcctaaat', name='spacer_like')
        spacer_like.add_feature(0, len(spacer_like), label='spacer_like')

        queries = [
            {
                'sequence': format_sequence_genbank(to_amplify).model_dump(),
                'location': SequenceLocationStr.from_start_and_end(start=0, end=len(to_amplify)),
                'forward_orientation': True,
            },
            {
                'sequence': format_sequence_genbank(spacer_like).model_dump(),
                'location': None,
                'forward_orientation': True,
            },
        ]

        params = {'homology_length': 20, 'minimal_hybridization_length': 15, 'target_tm': 55, 'circular': True}

        response = client.post(
            '/primer_design/gibson_assembly', json={'pcr_templates': queries, 'spacers': None}, params=params
        )

        primers = [PrimerModel.model_validate(p) if p is not None else None for p in response.json()['primers']]
        self.assertEqual(primers[0].name, 'to_amplify_fwd')
        self.assertEqual(primers[1].name, 'to_amplify_rvs')
        self.assertEqual(primers[2], None)
        self.assertEqual(primers[3], None)

    def test_simple_pair(self):
        from Bio.Restriction import EcoRI, BamHI

        # Create a test sequence
        dseqr = Dseqrecord('aaaGGCTTCACCAAGTCCTTGGAACAGccc')
        dseqr.name = 'test_sequence'
        json_seq = format_sequence_genbank(dseqr)
        json_seq.id = 0

        query = {
            'sequence': json_seq.model_dump(),
            'location': SequenceLocationStr.from_start_and_end(start=3, end=27),
            'forward_orientation': True,
        }

        params = {
            'minimal_hybridization_length': 7,
            'target_tm': 30,
            'left_enzyme': 'EcoRI',
            'right_enzyme': 'BamHI',
            'filler_bases': 'GC',
        }

        response = client.post('/primer_design/simple_pair', json={'pcr_template': query}, params=params)
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        self.assertEqual(len(payload['primers']), 2)  # 2 primers (forward and reverse)

        fwd_primer = PrimerModel.model_validate(payload['primers'][0])
        rvs_primer = PrimerModel.model_validate(payload['primers'][1])

        self.assertEqual(fwd_primer.name, 'test_sequence_EcoRI_fwd')
        self.assertEqual(rvs_primer.name, 'test_sequence_BamHI_rvs')

        self.assertTrue(fwd_primer.sequence.startswith('GC' + str(EcoRI.site)))
        self.assertTrue(rvs_primer.sequence.startswith('GC' + str(BamHI.site)))

        # Test with alt settings
        response = client.post(
            '/primer_design/simple_pair',
            json={'pcr_template': query, 'settings': alt_primer_settings.model_dump()},
            params=params,
        )
        payload = response.json()
        payload_primers = [PrimerModel.model_validate(p) for p in payload['primers']]
        self.assertLess(len(payload_primers[0].sequence), len(fwd_primer.sequence))
        self.assertLess(len(payload_primers[1].sequence), len(rvs_primer.sequence))

        # Same without enzymes
        params_no_enzymes = copy.deepcopy(params)
        params_no_enzymes.pop('left_enzyme')
        params_no_enzymes.pop('right_enzyme')
        response = client.post('/primer_design/simple_pair', json={'pcr_template': query}, params=params_no_enzymes)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['primers']), 2)  # 2 primers (forward and reverse)
        fwd_primer = PrimerModel.model_validate(payload['primers'][0])
        rvs_primer = PrimerModel.model_validate(payload['primers'][1])
        self.assertEqual(fwd_primer.name, 'test_sequence_fwd')
        self.assertEqual(rvs_primer.name, 'test_sequence_rvs')
        self.assertTrue(fwd_primer.sequence.startswith('GGCTT'))
        self.assertTrue(rvs_primer.sequence.startswith('CTGTT'))

        # Same, now inverted
        query2 = copy.deepcopy(query)
        query2['forward_orientation'] = False
        response = client.post('/primer_design/simple_pair', json={'pcr_template': query2}, params=params_no_enzymes)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['primers']), 2)  # 2 primers (forward and reverse)
        fwd_primer = PrimerModel.model_validate(payload['primers'][0])
        rvs_primer = PrimerModel.model_validate(payload['primers'][1])
        self.assertEqual(fwd_primer.name, 'test_sequence_fwd')
        self.assertEqual(rvs_primer.name, 'test_sequence_rvs')
        self.assertTrue(fwd_primer.sequence.startswith('CTGTT'))
        self.assertTrue(rvs_primer.sequence.startswith('GGCTT'))

        # Test primer name when sequence name is unset
        query2 = copy.deepcopy(query)
        dseqr2 = copy.deepcopy(dseqr)
        dseqr2.name = 'name'
        json_seq2 = format_sequence_genbank(dseqr2)
        json_seq2.id = 0
        query2['sequence'] = json_seq2.model_dump()
        response = client.post('/primer_design/simple_pair', json={'pcr_template': query2}, params=params)
        payload = response.json()
        fwd_primer = PrimerModel.model_validate(payload['primers'][0])
        rvs_primer = PrimerModel.model_validate(payload['primers'][1])

        self.assertEqual(fwd_primer.name, 'seq_0_EcoRI_fwd')
        self.assertEqual(rvs_primer.name, 'seq_0_BamHI_rvs')

        # Test with spacers
        response = client.post(
            '/primer_design/simple_pair',
            json={'pcr_template': query, 'spacers': ['ATTT', 'CCAG']},
            params=params,
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['primers']), 2)

        fwd_primer = PrimerModel.model_validate(payload['primers'][0])
        rvs_primer = PrimerModel.model_validate(payload['primers'][1])

        self.assertEqual(fwd_primer.name, 'test_sequence_EcoRI_fwd')
        self.assertEqual(rvs_primer.name, 'test_sequence_BamHI_rvs')

        self.assertTrue(fwd_primer.sequence.startswith('GC' + str(EcoRI.site) + 'ATTT'))
        self.assertTrue(rvs_primer.sequence.startswith('GC' + str(BamHI.site) + 'CTGG'))

        # Test error case with invalid parameters
        params['minimal_hybridization_length'] = 100  # Too long
        response = client.post('/primer_design/simple_pair', json={'pcr_template': query}, params=params)
        self.assertEqual(response.status_code, 400)
        self.assertIn('Primers could not be designed', response.json()['detail'])

        # Test error case with invalid enzyme
        params['minimal_hybridization_length'] = 10  # Reset to valid value
        params['left_enzyme'] = 'InvalidEnzyme'
        response = client.post('/primer_design/simple_pair', json={'pcr_template': query}, params=params)
        self.assertEqual(response.status_code, 404)
        self.assertIn('These enzymes do not exist', response.json()['detail'])

        # Test error case with wrong filler bases
        params['left_enzyme'] = 'EcoRI'
        params['filler_bases'] = 'zAA'
        response = client.post('/primer_design/simple_pair', json={'pcr_template': query}, params=params)
        self.assertEqual(response.status_code, 400)
        self.assertIn('Filler bases can only contain ACGT bases.', response.json()['detail'])

        # Test error case with wrong spacer number
        params['filler_bases'] = 'GC'
        response = client.post(
            '/primer_design/simple_pair', json={'pcr_template': query, 'spacers': ['ATGC']}, params=params
        )
        self.assertEqual(response.status_code, 422)
        self.assertIn('The number of spacers must be', response.json()['detail'])

    def test_primer_details(self):
        # Works with short sequences
        SEQUENCE = 'ATGCATGCATGCATGC'
        response = client.post('/primer_details', json={'sequence': SEQUENCE})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resp = PrimerDetailsResponse.model_validate(payload)
        self.assertEqual(resp.gc_content, 0.5)
        self.assertEqual(resp.melting_temperature, primer3_calc_tm(SEQUENCE, PrimerDesignSettings()))
        homodimerResult = bindings.calc_homodimer(SEQUENCE, output_structure=True)
        self.assertEqual(resp.homodimer.melting_temperature, homodimerResult.tm)
        self.assertEqual(resp.homodimer.deltaG, homodimerResult.dg)
        self.assertEqual(resp.homodimer.figure, '\n'.join(homodimerResult.ascii_structure_lines))
        hairpinResult = bindings.calc_hairpin(SEQUENCE, output_structure=True)
        self.assertEqual(resp.hairpin.melting_temperature, hairpinResult.tm)
        self.assertEqual(resp.hairpin.deltaG, hairpinResult.dg)
        self.assertEqual(resp.hairpin.figure, '\n'.join(hairpinResult.ascii_structure_lines))

        # Splits long sequence
        LONG_SEQUENCE = 'GGAAAAGCATTTTTCTAAAATTGAAAGGCTTCACCAAGTCCTTGGAACAGATGGAGACAATTCATCATTA'
        response = client.post('/primer_details', json={'sequence': LONG_SEQUENCE})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resp = PrimerDetailsResponse.model_validate(payload)
        # Use the homodimer result with the lowest deltaG
        min_deltaG_homodimer = min(
            bindings.calc_homodimer(seq, output_structure=True).dg for seq in [LONG_SEQUENCE[:60], LONG_SEQUENCE[60:]]
        )
        self.assertEqual(resp.homodimer.deltaG, min_deltaG_homodimer)

        # Same with hairpin
        min_deltaG_hairpin = min(
            bindings.calc_hairpin(seq, output_structure=True).dg for seq in [LONG_SEQUENCE[:60], LONG_SEQUENCE[60:]]
        )
        self.assertEqual(resp.hairpin.deltaG, min_deltaG_hairpin)

        # Response is the same for upper and lower case
        response_lower = client.post('/primer_details', json={'sequence': LONG_SEQUENCE.lower()})
        self.assertEqual(response_lower.json()['melting_temperature'], response.json()['melting_temperature'])

        # Error 422 if sequence is not DNA
        response = client.post('/primer_details', json={'sequence': 'ATGCATGCATGCATGCX'})
        self.assertEqual(response.status_code, 422)

        # Sequences up to MAX_PRIMER_LENGTH are accepted, longer ones are rejected with 422
        response = client.post('/primer_details', json={'sequence': 'A' * MAX_PRIMER_LENGTH})
        self.assertEqual(response.status_code, 200)
        response = client.post('/primer_details', json={'sequence': 'A' * (MAX_PRIMER_LENGTH + 1)})
        self.assertEqual(response.status_code, 422)

        # Handles the case where there is no hairpin / homodimer
        response = client.post('/primer_details', json={'sequence': 'AAAA'})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resp = PrimerDetailsResponse.model_validate(payload)
        self.assertIsNone(resp.homodimer)
        self.assertIsNone(resp.hairpin)

        # Uses primer settings
        response = client.post(
            '/primer_details', json={'sequence': SEQUENCE, 'settings': alt_primer_settings.model_dump()}
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resp = PrimerDetailsResponse.model_validate(payload)
        self.assertEqual(resp.melting_temperature, primer3_calc_tm(SEQUENCE, alt_primer_settings))
        self.assertEqual(
            resp.homodimer.melting_temperature,
            primer3_calc_homodimer(SEQUENCE, alt_primer_settings).melting_temperature,
        )

    def test_primer_heterodimer(self):
        # Works with short sequences
        SEQUENCE1 = 'ATGCATGCATGCATGC'
        SEQUENCE2 = 'CTAAAATTGAAAGGCTTCACCAAGT'
        response = client.post('/primer_heterodimer', json={'sequence1': SEQUENCE1, 'sequence2': SEQUENCE2})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resp = ThermodynamicResult.model_validate(payload)
        heterodimer = bindings.calc_heterodimer(SEQUENCE1, SEQUENCE2, output_structure=True)
        self.assertEqual(resp.melting_temperature, heterodimer.tm)
        self.assertEqual(resp.deltaG, heterodimer.dg)
        self.assertEqual(resp.figure, '\n'.join(heterodimer.ascii_structure_lines))

        # Same with lower case
        response_lower = client.post(
            '/primer_heterodimer', json={'sequence1': SEQUENCE1.lower(), 'sequence2': SEQUENCE2.lower()}
        )
        self.assertEqual(response_lower.json()['melting_temperature'], response.json()['melting_temperature'])

        # Error 422 if sequence is not DNA
        response = client.post('/primer_heterodimer', json={'sequence1': 'ATGCATGCATGCATGCX', 'sequence2': SEQUENCE2})
        self.assertEqual(response.status_code, 422)

        # Sequences up to MAX_PRIMER_LENGTH are accepted, longer ones are rejected with 422 (either primer)
        response = client.post(
            '/primer_heterodimer', json={'sequence1': 'A' * MAX_PRIMER_LENGTH, 'sequence2': SEQUENCE2}
        )
        self.assertEqual(response.status_code, 200)
        too_long = 'A' * (MAX_PRIMER_LENGTH + 1)
        response = client.post('/primer_heterodimer', json={'sequence1': too_long, 'sequence2': SEQUENCE2})
        self.assertEqual(response.status_code, 422)
        response = client.post('/primer_heterodimer', json={'sequence1': SEQUENCE1, 'sequence2': too_long})
        self.assertEqual(response.status_code, 422)

        # Handles long sequences
        LONG_SEQUENCE1 = 'GGAAAAGCATTTTTCTAAAATTGAAAGGCTTCACCAAGTCCTTGGAACAGATGGAGACAATTCATCATTA'
        LONG_SEQUENCE2 = 'GGAAAAGCATTTTTCTAAAATTGAAAGGCTTCGACTATTCCTTGGAACAGATGGAGACAATTCATCATTA'
        response = client.post('/primer_heterodimer', json={'sequence1': LONG_SEQUENCE1, 'sequence2': LONG_SEQUENCE2})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resp = ThermodynamicResult.model_validate(payload)
        combs = list(product([LONG_SEQUENCE1[:60], LONG_SEQUENCE1[60:]], [LONG_SEQUENCE2[:60], LONG_SEQUENCE2[60:]]))
        min_deltaG = min(bindings.calc_heterodimer(seq1, seq2, output_structure=True).dg for seq1, seq2 in combs)
        self.assertEqual(resp.deltaG, min_deltaG)

        # Handles case where there is no heterodimer
        response = client.post('/primer_heterodimer', json={'sequence1': 'AAA', 'sequence2': 'AAA'})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsNone(payload)

        # Works with alt settings
        response = client.post(
            '/primer_heterodimer',
            json={'sequence1': SEQUENCE1, 'sequence2': SEQUENCE2, 'settings': alt_primer_settings.model_dump()},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resp = ThermodynamicResult.model_validate(payload)
        heterodimer = primer3_calc_heterodimer(SEQUENCE1, SEQUENCE2, alt_primer_settings)
        self.assertEqual(resp.melting_temperature, heterodimer.melting_temperature)
        self.assertEqual(resp.deltaG, heterodimer.deltaG)
        self.assertEqual(resp.figure, heterodimer.figure)


class TestEbicPrimers(unittest.TestCase):
    def test_normal_examples(self):
        """
        Test the ebic_primers function.
        """

        template = parse(os.path.join(test_files, 'lacZ_EBIC_example.gb'))[0]
        json_seq = format_sequence_genbank(template)
        json_seq.id = 1

        query = PrimerDesignQuery.model_validate(
            {
                'sequence': json_seq.model_dump(),
                'location': str(SequenceLocationStr.from_start_and_end(start=1000, end=4075)),
            }
        )

        params = {
            'max_inside': 50,
            'max_outside': 20,
            'target_tm': 61,
            'target_tm_tolerance': 3,
            'padding_left': 1000,
            'padding_right': 1000,
        }
        settings = PrimerDesignSettings()
        settings.primer_dna_conc = 500
        response = client.post(
            '/primer_design/ebic',
            json={'template': query.model_dump(), 'settings': settings.model_dump()},
            params=params,
        )
        self.assertEqual(response.status_code, 200)

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

        for expect, primer in zip(expected, response.json()['primers']):
            self.assertEqual(primer['name'], expect[0])
            self.assertEqual(primer['sequence'], expect[1])
