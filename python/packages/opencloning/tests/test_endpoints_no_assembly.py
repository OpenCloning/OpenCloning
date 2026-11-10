from fastapi.testclient import TestClient
from pydna.dseqrecord import Dseqrecord
import unittest
import os
from pydna.dseq import Dseq

from opencloning.dna_functions import format_sequence_genbank, read_dsrecord_from_json
import opencloning.main as _main

from opencloning_linkml.datamodel import (
    RestrictionEnzymeDigestionSource,
    RestrictionSequenceCut,
    TextFileSequence,
    PolymeraseExtensionSource,
    ReverseComplementSource,
)
from opencloning.temp_functions import get_enzymes_from_source, restriction_sequence_cut_to_cutsite_tuple

test_files = os.path.join(os.path.dirname(__file__), 'test_files')

client = TestClient(_main.app)


class RestrictionTest(unittest.TestCase):
    def test_enzyme_doesnt_exist(self):
        dseq = Dseqrecord('AAAAAAGAATTCTTTTTT', circular=False)
        json_seq = format_sequence_genbank(dseq)
        json_seq.id = 1

        # One enzyme
        source = RestrictionEnzymeDigestionSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/restriction', json=data, params={'restriction_enzymes': ['helloworld']})
        self.assertEqual(response.status_code, 404)
        self.assertTrue(response.json()['detail'] == 'These enzymes do not exist: helloworld')

        # More than one
        source = RestrictionEnzymeDigestionSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/restriction', json=data, params={'restriction_enzymes': ['helloworld', 'byebye']})
        self.assertEqual(response.status_code, 404)
        self.assertIn('byebye', response.json()['detail'])
        self.assertIn('helloworld', response.json()['detail'])

    def test_enzymes_dont_cut(self):
        dseq = Dseqrecord('AAAAAAGAATTCTTTTTT', circular=False)
        json_seq = format_sequence_genbank(dseq)
        json_seq.id = 1

        # See if we get the right responses
        source = RestrictionEnzymeDigestionSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/restriction', json=data, params={'restriction_enzymes': ['FbaI']})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['detail'], 'These enzymes do not cut: FbaI')

        # Returns when one does not cut
        source = RestrictionEnzymeDigestionSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/restriction', json=data, params={'restriction_enzymes': ['EcoRI', 'BamHI']})
        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.json()['detail'] == 'These enzymes do not cut: BamHI')

        # Returns all that don't cut
        source = RestrictionEnzymeDigestionSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/restriction', json=data, params={'restriction_enzymes': ['BamHI', 'FbaI']})
        self.assertEqual(response.status_code, 400)
        self.assertIn('BamHI', response.json()['detail'])
        self.assertIn('FbaI', response.json()['detail'])

    def test_linear_single_restriction(self):

        dseq = Dseqrecord('AAAAAAGAATTCTTTTTT', circular=False)
        json_seq = format_sequence_genbank(dseq)
        json_seq.id = 1

        # See if we get the right responses
        source = RestrictionEnzymeDigestionSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/restriction', json=data, params={'restriction_enzymes': ['EcoRI']})
        payload = response.json()

        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        sources = [RestrictionEnzymeDigestionSource.model_validate(s) for s in payload['sources']]

        # The right sequences are returned in the right order
        self.assertEqual(resulting_sequences[0].seq.watson.upper(), 'AAAAAAG')
        self.assertEqual(resulting_sequences[1].seq.watson.upper(), 'AATTCTTTTTT')

        # The edges of the fragments are correct:
        self.assertEqual(sources[0].left_edge, None)
        self.assertEqual(restriction_sequence_cut_to_cutsite_tuple(sources[0].right_edge)[0], (7, -4))
        self.assertEqual(restriction_sequence_cut_to_cutsite_tuple(sources[1].left_edge)[0], (7, -4))
        self.assertEqual(sources[1].right_edge, None)

        # The enzyme names are correctly returned:
        self.assertEqual(get_enzymes_from_source(sources[0]), ['EcoRI'])
        self.assertEqual(get_enzymes_from_source(sources[1]), ['EcoRI'])

        # Now we specify the output
        source = RestrictionEnzymeDigestionSource(
            id=0,
            input=[{'sequence': 1}],
            left_edge=None,
            right_edge=RestrictionSequenceCut(cut_watson=7, overhang=-4, restriction_enzyme='EcoRI'),
        )
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/restriction', json=data)
        payload = response.json()

        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        sources = [RestrictionEnzymeDigestionSource.model_validate(s) for s in payload['sources']]

        self.assertEqual(len(resulting_sequences), 1)
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0].left_edge, None)
        self.assertEqual(restriction_sequence_cut_to_cutsite_tuple(sources[0].right_edge)[0], (7, -4))
        self.assertEqual(str(restriction_sequence_cut_to_cutsite_tuple(sources[0].right_edge)[1]), 'EcoRI')
        self.assertEqual(get_enzymes_from_source(sources[0]), ['EcoRI'])

    def test_circular_single_restriction(self):

        dseq = Dseqrecord('AAAAAAGAATTCTTTTTT', circular=True)
        json_seq = format_sequence_genbank(dseq)
        json_seq.id = 1

        # See if we get the right responses
        source = RestrictionEnzymeDigestionSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/restriction', json=data, params={'restriction_enzymes': ['EcoRI']})
        payload = response.json()

        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        sources = [RestrictionEnzymeDigestionSource.model_validate(s) for s in payload['sources']]

        self.assertEqual(len(resulting_sequences), 1)
        self.assertEqual(len(sources), 1)

        # The right sequences are returned in the right order
        self.assertEqual(resulting_sequences[0].seq.watson.upper(), 'AATTCTTTTTTAAAAAAG')

        # The edges of the fragments are correct:
        self.assertEqual(restriction_sequence_cut_to_cutsite_tuple(sources[0].left_edge)[0], (7, -4))
        self.assertEqual(restriction_sequence_cut_to_cutsite_tuple(sources[0].right_edge)[0], (7, -4))

        # The enzyme names are correctly returned:
        self.assertEqual(get_enzymes_from_source(sources[0]), ['EcoRI'])

        # When the cutting site spans the origin
        sequences = ['AATTCTTTTTTG', 'ATTCTTTTTTGA']
        cut_positions = [(0, -4), (11, -4)]

        for s, pos in zip(sequences, cut_positions):
            dseq = Dseqrecord(s, circular=True)
            json_seq = format_sequence_genbank(dseq)
            json_seq.id = 1

            # See if we get the right responses
            source = RestrictionEnzymeDigestionSource(
                id=0,
            )
            data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
            response = client.post('/restriction', json=data, params={'restriction_enzymes': ['EcoRI']})
            payload = response.json()

            resulting_sequences = [
                read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
            ]
            sources = [RestrictionEnzymeDigestionSource.model_validate(s) for s in payload['sources']]

            self.assertEqual(len(resulting_sequences), 1)
            self.assertEqual(len(sources), 1)

            # The right sequences are returned in the right order
            self.assertEqual(resulting_sequences[0].seq.watson.upper(), 'AATTCTTTTTTG')

            # The edges of the fragments are correct:
            self.assertEqual(restriction_sequence_cut_to_cutsite_tuple(sources[0].left_edge)[0], pos)
            self.assertEqual(restriction_sequence_cut_to_cutsite_tuple(sources[0].right_edge)[0], pos)

            # The enzyme names are correctly returned:
            self.assertEqual(get_enzymes_from_source(sources[0]), ['EcoRI'])

    def test_linear_multiple_restriction(self):

        dseq = Dseqrecord('AAAGGATCCAAAAGATATCAAAAA', circular=False)
        json_seq = format_sequence_genbank(dseq)
        json_seq.id = 1

        # We try EcoRV, which gives blunt ends
        source = RestrictionEnzymeDigestionSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/restriction', json=data, params={'restriction_enzymes': ['BamHI', 'EcoRV']})
        payload = response.json()

        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        sources = [RestrictionEnzymeDigestionSource.model_validate(s) for s in payload['sources']]

        self.assertEqual(len(resulting_sequences), 3)
        self.assertEqual(len(sources), 3)

        # The right sequences are returned in the right order
        fragment_sequences = 'AAAG^GATCCAAAAGAT^ATCAAAAA'.split('^')
        for i, s in enumerate(fragment_sequences):
            self.assertEqual(resulting_sequences[i].seq.watson.upper(), s)

        # The edges of the fragments are correct:
        # AAAG^GATC_CAAAAGAT^ATCAAAAA
        edges = [
            (None, RestrictionSequenceCut(cut_watson=4, overhang=-4, restriction_enzyme='BamHI')),
            (
                RestrictionSequenceCut(cut_watson=4, overhang=-4, restriction_enzyme='BamHI'),
                RestrictionSequenceCut(cut_watson=16, overhang=0, restriction_enzyme='EcoRV'),
            ),
            (RestrictionSequenceCut(cut_watson=16, overhang=0, restriction_enzyme='EcoRV'), None),
        ]
        for i, e in enumerate(edges):
            self.assertEqual(sources[i].left_edge, e[0])
            self.assertEqual(sources[i].right_edge, e[1])

        # The enzyme names are correct
        restriction_enzymes = [['BamHI'], ['BamHI', 'EcoRV'], ['EcoRV']]
        for i, e in enumerate(restriction_enzymes):
            self.assertEqual(get_enzymes_from_source(sources[i]), e)

        # Submitting the known fragments

        for i in range(len(edges)):
            source = RestrictionEnzymeDigestionSource(
                id=0,
                input=[{'sequence': 1}],
                left_edge=edges[i][0],
                right_edge=edges[i][1],
            )
            data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
            response = client.post('/restriction', json=data)
            payload = response.json()

            resulting_sequences = [
                read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
            ]
            sources = [RestrictionEnzymeDigestionSource.model_validate(s) for s in payload['sources']]

            self.assertEqual(len(resulting_sequences), 1)
            self.assertEqual(len(sources), 1)
            self.assertEqual(resulting_sequences[0].seq.watson, fragment_sequences[i])

    def test_wrong_known_fragment(self):
        dseq = Dseqrecord('AAAGGATCCAAAAGATATCAAAAA', circular=False)
        json_seq = format_sequence_genbank(dseq)
        json_seq.id = 1
        # Submitting a wrong "known" fragment
        wrong_edges = (None, RestrictionSequenceCut(cut_watson=3, overhang=-4, restriction_enzyme='BamHI'))
        source = RestrictionEnzymeDigestionSource(id=0, left_edge=wrong_edges[0], right_edge=wrong_edges[1])
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/restriction', json=data)
        self.assertEqual(response.status_code, 400)
        self.assertIn('Invalid restriction enzyme pair', response.json()['detail'])

    def test_circular_multiple_restriction(self):

        dseq = Dseqrecord('AAAGGATCCAAAAGATATCAAAAA', circular=True)
        json_seq = format_sequence_genbank(dseq)
        json_seq.id = 1

        # We try EcoRV, which gives blunt ends
        source = RestrictionEnzymeDigestionSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/restriction', json=data, params={'restriction_enzymes': ['BamHI', 'EcoRV']})
        payload = response.json()

        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        sources = [RestrictionEnzymeDigestionSource.model_validate(s) for s in payload['sources']]

        self.assertEqual(len(resulting_sequences), 2)
        self.assertEqual(len(sources), 2)

        fragment_sequences = 'GATCCAAAAGAT^ATCAAAAAAAAG'.split('^')
        # The right sequences are returned in the right order
        for i, s in enumerate(fragment_sequences):
            self.assertEqual(resulting_sequences[i].seq.watson.upper(), s)

        # The edges of the fragments are correct:
        # AAAG^GATC_CAAAAGAT^ATCAAAAA
        # We use 8 + len because it's an origin-spanning sequence
        edges = [
            (
                RestrictionSequenceCut(cut_watson=4, overhang=-4, restriction_enzyme='BamHI'),
                RestrictionSequenceCut(cut_watson=16, overhang=0, restriction_enzyme='EcoRV'),
            ),
            (
                RestrictionSequenceCut(cut_watson=16, overhang=0, restriction_enzyme='EcoRV'),
                RestrictionSequenceCut(cut_watson=4, overhang=-4, restriction_enzyme='BamHI'),
            ),
        ]

        for i, e in enumerate(edges):
            self.assertEqual(sources[i].left_edge, e[0])
            self.assertEqual(sources[i].right_edge, e[1])

        # The enzyme names are correct
        restriction_enzymes = [['BamHI', 'EcoRV'], ['EcoRV', 'BamHI']]
        for i, e in enumerate(restriction_enzymes):
            self.assertEqual(get_enzymes_from_source(sources[i]), e)

        # Submitting the known fragments
        for i in range(len(edges)):
            source = RestrictionEnzymeDigestionSource(
                id=0,
                input=[{'sequence': 1}],
                left_edge=edges[i][0],
                right_edge=edges[i][1],
            )
            data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
            response = client.post('/restriction', json=data)
            payload = response.json()

            resulting_sequences = [
                read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
            ]
            sources = [RestrictionEnzymeDigestionSource.model_validate(s) for s in payload['sources']]

            self.assertEqual(len(resulting_sequences), 1)
            self.assertEqual(len(sources), 1)
            self.assertEqual(resulting_sequences[0].seq.watson, fragment_sequences[i])

    def test_ambiguous_bases_in_overhang(self):
        dseq = Dseqrecord('tNaaTTTTTTTTGGTCTCAa', circular=True)
        json_seq = format_sequence_genbank(dseq)
        json_seq.id = 1

        source = RestrictionEnzymeDigestionSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/restriction', json=data, params={'restriction_enzymes': ['BsaI']})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()['detail'],
            'Overhangs containing ambiguous bases (e.g. N) cannot be ligated: BsaI overhang ATNA in sequence 1.',
        )

    def test_enzymes_overlap(self):
        dseq = Dseqrecord('AAGGTACCAA', circular=False)
        json_seq = format_sequence_genbank(dseq)
        json_seq.id = 1

        source = RestrictionEnzymeDigestionSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/restriction', json=data, params={'restriction_enzymes': ['Acc65I', 'BanI']})
        self.assertEqual(response.status_code, 400)
        self.assertIn('overlap', response.json()['detail'])


class PolymeraseExtensionTest(unittest.TestCase):

    def test_polymerase_extension(self):
        dseq = Dseq.from_full_sequence_and_overhangs('ACGTT', 1, 1)
        template = Dseqrecord(dseq, circular=False)
        json_template = format_sequence_genbank(template)
        json_template.id = 1

        source = PolymeraseExtensionSource(
            id=2,
        )

        data = {'source': source.model_dump(), 'sequences': [json_template.model_dump()]}
        response = client.post('/polymerase_extension', json=data)
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        sequences = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]

        self.assertEqual(len(sequences), 1)
        self.assertEqual(sequences[0].seq, dseq.fill_in())
        response_source = PolymeraseExtensionSource.model_validate(payload['sources'][0])
        self.assertEqual(response_source, source)

    def test_exceptions(self):

        # Sequence without overhangs
        cases = [
            (Dseqrecord('ACGTT'), 400, 1),  # No overhangs
            (Dseqrecord('ACGTT', circular=True), 400, 1),  # circular
        ]

        for template, status_code, id in cases:
            json_template = format_sequence_genbank(template)
            json_template.id = id

            source = PolymeraseExtensionSource(
                id=2,
            )

            data = {'source': source.model_dump(), 'sequences': [json_template.model_dump()]}
            response = client.post('/polymerase_extension', json=data)
            self.assertEqual(response.status_code, status_code)


class ReverseComplementTest(unittest.TestCase):

    def test_reverse_complement(self):
        dseq = Dseqrecord('ACGTT', circular=False)
        json_seq = format_sequence_genbank(dseq)
        json_seq.id = 1

        source = ReverseComplementSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/reverse_complement', json=data)
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload['sequences'][0]['id'], 0)
        self.assertEqual(payload['sources'][0], source.model_dump())
        dseq_rc = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(dseq_rc.name, dseq.name + '_rc')
        self.assertEqual(dseq_rc.reverse_complement().seq, dseq.seq)

        # Also works renaming
        source = ReverseComplementSource(id=0, output_name='test')
        data = {'source': source.model_dump(), 'sequences': [json_seq.model_dump()]}
        response = client.post('/reverse_complement', json=data)
        payload = response.json()
        dseq_rc = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(dseq_rc.name, 'test')
