import pytest
from fastapi.testclient import TestClient
import unittest
from pydna.dseq import Dseq
import copy
import os

import opencloning.request_examples as request_examples
from opencloning.dna_functions import read_dsrecord_from_json
import opencloning.main as _main
from opencloning_linkml.datamodel import (
    TextFileSequence,
    ManuallyTypedSource,
    OligoHybridizationSource,
    ManuallyTypedSequence,
)

test_files = os.path.join(os.path.dirname(__file__), 'test_files')

client = TestClient(_main.app)


class OligoHybridizationTest(unittest.TestCase):

    def test_hybridization(self):
        default_example = request_examples.oligonucleotide_hybridization_examples['default']['value']
        watson_sequence = default_example['primers'][0]['sequence']
        crick_sequence = default_example['primers'][1]['sequence']
        response = client.post('/oligonucleotide_hybridization', json=default_example)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sources']), 1)
        self.assertEqual(len(payload['sequences']), 1)

        source = OligoHybridizationSource.model_validate(payload['sources'][0])
        sequence = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))

        self.assertEqual(source.overhang_crick_3prime, sequence.seq.ovhg)
        self.assertEqual(sequence.seq.watson, watson_sequence.upper())
        self.assertEqual(sequence.seq.crick, crick_sequence.upper())

        # The minimal_annealing parameter is ignored if the overhangs are specified
        modified_example = copy.deepcopy(default_example)
        modified_example['source']['overhang_crick_3prime'] = source.overhang_crick_3prime

        response = client.post(
            '/oligonucleotide_hybridization', json=modified_example, params={'minimal_annealing': 60}
        )
        payload2 = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload, payload2)

        # Don't specify input
        modified_example = copy.deepcopy(default_example)
        modified_example['source']['input'] = []
        response = client.post('/oligonucleotide_hybridization', json=modified_example)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sources']), 1)
        self.assertEqual(len(payload['sequences']), 1)
        OligoHybridizationSource.model_validate(payload['sources'][0])
        sequence = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(sequence.seq.watson, watson_sequence.upper())
        self.assertEqual(sequence.seq.crick, crick_sequence.upper())

    def test_no_valid_result(self):
        default_example = request_examples.oligonucleotide_hybridization_examples['default']['value']
        response = client.post(
            '/oligonucleotide_hybridization', json=default_example, params={'minimal_annealing': 60}
        )
        self.assertEqual(response.status_code, 400)

    def test_invalid_oligo_id(self):
        invalid_oligo_example = copy.deepcopy(
            request_examples.oligonucleotide_hybridization_examples['default']['value']
        )
        invalid_oligo_example['source']['input'][0]['sequence'] = 5
        response = client.post('/oligonucleotide_hybridization', json=invalid_oligo_example)
        self.assertEqual(response.status_code, 404)

    def test_hybridization_in_the_middle(self):
        default_example = request_examples.oligonucleotide_hybridization_examples['default']['value']
        default_example['primers'][0]['sequence'] = 'aaaACGGCAGCCCGTaaa'
        default_example['primers'][1]['sequence'] = 'cccTGCCGTCGGGCAccc'[::-1]
        response = client.post(
            '/oligonucleotide_hybridization', json=default_example, params={'minimal_annealing': 12}
        )
        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertIn('mismatch', payload['detail'])


class ManuallyTypedTest(unittest.TestCase):
    def test_manually_typed(self):
        """Test the manually_typed endpoint"""

        # Test linear (default)
        source = ManuallyTypedSource(
            id=0,
        )
        sequence = ManuallyTypedSequence(id=0, sequence='ATGC')
        data = {'source': source.model_dump(), 'sequence': sequence.model_dump()}

        response = client.post('/manually_typed', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        sources = [ManuallyTypedSource.model_validate(s) for s in payload['sources']]

        self.assertEqual(len(resulting_sequences), 1)
        self.assertEqual(len(sources), 1)
        self.assertEqual(str(resulting_sequences[0].seq), 'ATGC')
        self.assertEqual(sources[0], source)

        # Test circular
        data['sequence']['circular'] = True
        response = client.post('/manually_typed', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        sources = [ManuallyTypedSource.model_validate(s) for s in payload['sources']]

        self.assertEqual(len(resulting_sequences), 1)
        self.assertEqual(len(sources), 1)
        self.assertEqual(str(resulting_sequences[0].seq), 'ATGC')
        self.assertEqual(resulting_sequences[0].seq.circular, True)
        self.assertEqual(sources[0], source)

        # Test overhangs
        source = ManuallyTypedSource(
            id=0,
        )
        sequence = ManuallyTypedSequence(id=0, sequence='ATGC', overhang_crick_3prime=1, overhang_watson_3prime=2)
        data = {'source': source.model_dump(), 'sequence': sequence.model_dump()}

        response = client.post('/manually_typed', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]

        self.assertEqual(len(resulting_sequences), 1)
        self.assertEqual(resulting_sequences[0].seq, Dseq.from_full_sequence_and_overhangs('ATGC', 1, 2))

        # Test that if overhangs are set, it cannot be circular
        wrong_data = data.copy()
        wrong_data['sequence']['circular'] = True

        response = client.post('/manually_typed', json=wrong_data)
        self.assertEqual(response.status_code, 422)

    # Test that it fails if not acgt or empty
    def test_manually_typed_fail(self):

        response = client.post(
            '/manually_typed', json={'source': {'id': 0}, 'sequence': {'id': 0, 'sequence': 'ATGZ'}}
        )
        self.assertEqual(response.status_code, 422)

        response = client.post('/manually_typed', json={'source': {'id': 0}, 'sequence': {'id': 0, 'sequence': ''}})
        self.assertEqual(response.status_code, 422)


def test_primer_too_long_rejected():
    from opencloning.pydantic_models import PrimerModel
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        PrimerModel(id=1, name='p', sequence='A' * 1001)
    assert PrimerModel(id=1, name='p', sequence='A' * 1000).sequence == 'A' * 1000
