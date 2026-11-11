from fastapi.testclient import TestClient
import unittest
import pytest
import os
from unittest.mock import AsyncMock, patch

from opencloning.dna_functions import read_dsrecord_from_json
import opencloning.main as _main
from opencloning_linkml.datamodel import (
    TextFileSequence,
)
from pydna.parsers import parse as pydna_parse
from pydna.opencloning_models import TextFileSequence as PydnaTextFileSequence
from pydna.opencloning_models import SequenceLocationStr

test_files = os.path.join(os.path.dirname(__file__), 'test_files')

client = TestClient(_main.app)


class ZiqiangEtAl2024Test(unittest.TestCase):
    def test_ziqiang_et_al_2024(self):
        # Default call should produce the desired product
        protospacers = [
            'GCTGGCTAACCGTGAGGGGA',
            'CCGTGTACTGTAGTTACAGT',
            'TGTGGTTCCCCGGCCGTCTT',
            'ATACTCTAGTCCTCAACGCC',
        ]
        response = client.post('/batch_cloning/ziqiang_et_al2024', json=protospacers)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['primers']), 14)
        # Find the LR source
        lr_source = next(s for s in payload['sources'] if s['type'] == 'GatewaySource' and s['reaction_type'] == 'LR')
        self.assertIsNotNone(lr_source)
        # Get the output sequence
        seq_id = lr_source['id']
        seq = next(s for s in payload['sequences'] if s['id'] == seq_id)
        self.assertIsNotNone(seq)
        dseq = read_dsrecord_from_json(TextFileSequence.model_validate(seq))
        self.assertEqual(dseq.name, 'expression_clone')
        self.assertEqual(dseq.seguid(), 'cdseguid=kzzhO-94Zw1KwHwS1vRcggoXxqU')

        # If we stop after BP, we should get the same sequence
        response = client.post('/batch_cloning/ziqiang_et_al2024', json=protospacers, params={'until_bp': True})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['primers']), 14)
        # No LR should exist
        lr_source = next(
            (s for s in payload['sources'] if s['type'] == 'GatewaySource' and s['reaction_type'] == 'LR'), None
        )
        self.assertIsNone(lr_source)
        bp_source = next(
            (s for s in payload['sources'] if s['type'] == 'GatewaySource' and s['reaction_type'] == 'BP'), None
        )
        self.assertIsNotNone(bp_source)
        seq = next(s for s in payload['sequences'] if s['id'] == bp_source['id'])
        self.assertIsNotNone(seq)
        dseq = read_dsrecord_from_json(TextFileSequence.model_validate(seq))
        self.assertEqual(dseq.name, 'entry_clone')
        self.assertEqual(dseq.seguid(), 'cdseguid=UC2hIJs2Ba3M6he3oUOoLf-I1to')

    def test_protospacer_validation(self):

        # Test that the protospacers are valid
        response = client.post('/batch_cloning/ziqiang_et_al2024', json=[])
        self.assertEqual(response.status_code, 422)
        response = client.post('/batch_cloning/ziqiang_et_al2024', json=[''])
        self.assertEqual(response.status_code, 400)
        response = client.post('/batch_cloning/ziqiang_et_al2024', json=['A'])
        self.assertEqual(response.status_code, 400)
        response = client.post('/batch_cloning/ziqiang_et_al2024', json=['A' * 21])
        self.assertEqual(response.status_code, 400)
        response = client.post('/batch_cloning/ziqiang_et_al2024', json=['b' * 20])
        self.assertEqual(response.status_code, 400)
        response = client.post('/batch_cloning/ziqiang_et_al2024', json=['A' * 8 + 'AACA' + 'A' * 8])
        self.assertEqual(response.status_code, 400)
        response = client.post('/batch_cloning/ziqiang_et_al2024', json=['A' * 8 + 'GCTT' + 'A' * 8])
        self.assertEqual(response.status_code, 400)
        response = client.post(
            '/batch_cloning/ziqiang_et_al2024', json=['A' * 8 + 'ACCA' + 'A' * 8, 'T' * 8 + 'ACCA' + 'T' * 8]
        )
        self.assertEqual(response.status_code, 400)


@pytest.mark.xfail(reason='External GoldenBraid service is down', strict=False)
class BatchDomesticateTest(unittest.TestCase):

    def test_full_length_fasta_runs_and_writes_strategy_json(self):
        with open(f'{test_files}/ase1_cerevisiae.fasta', 'r', encoding='utf-8') as f:
            file_content = f.read()
        payload = {
            'sequence': {
                'id': 1,
                'file_content': file_content,
                'sequence_file_format': 'fasta',
                'overhang_crick_3prime': 0,
                'overhang_watson_3prime': 0,
            },
            'location': '1..2724',
            'part_name': 'ase1_cerevisiae',
            'prefix': '',
            'suffix': '',
            'category': 'CDS (B3-B4-B5)',
            'enzymes': ['BsmBI', 'BsaI'],
            'cloning_type': 'domestication',
        }

        response = client.post('/batch_cloning/domesticate', json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['primers']), 4)
        self.assertEqual(len(response.json()['sequences']), 5)

        payload['cloning_type'] = 'synthesis'
        response = client.post('/batch_cloning/domesticate', json=payload)
        self.assertEqual(len(response.json()['primers']), 0)
        self.assertEqual(len(response.json()['sequences']), 4)

    def test_page_error(self):

        seqr = pydna_parse(f'{test_files}/dummy_EcoRI.fasta')
        pydna_seq = PydnaTextFileSequence.from_dseqrecord(seqr[0])
        payload = {
            'sequence': pydna_seq.model_dump(),
            'location': '1..18',
            'part_name': 'dummy_EcoRI',
            'prefix': '',
            'suffix': '',
            'category': 'CDS (B3-B4-B5)',
            'enzymes': ['BsmBI', 'BsaI'],
            'cloning_type': 'domestication',
        }
        response = client.post('/batch_cloning/domesticate', json=payload)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['detail'], 'Given seq must be at least 70 base pairs')

    def test_validation_errors(self):

        seqr = pydna_parse(f'{test_files}/dummy_EcoRI.fasta')
        pydna_seq = PydnaTextFileSequence.from_dseqrecord(seqr[0])
        root_payload = {
            'sequence': pydna_seq.model_dump(),
            'location': '1..18',
            'part_name': 'dummy_EcoRI',
            'prefix': '',
            'suffix': '',
            'category': 'CDS (B3-B4-B5)',
            'enzymes': ['BsmBI', 'BsaI'],
            'cloning_type': 'domestication',
        }
        dummy_strategy = {
            'sequences': [],
            'sources': [],
            'primers': [],
            'description': '',
            'files': None,
            'schema_version': '1.0.0',
            'backend_version': None,
            'frontend_version': None,
        }

        with patch(
            'opencloning.batch_cloning.domesticate._run_cloning_workflow',
            new=AsyncMock(return_value=dummy_strategy),
        ) as mocked_workflow:
            # Invalid category should fail before workflow/network is called
            payload = root_payload | {'category': 'NOT_A_CATEGORY'}
            response = client.post('/batch_cloning/domesticate', json=payload)
            self.assertEqual(response.status_code, 422)
            mocked_workflow.assert_not_awaited()

            # Invalid enzyme should fail before workflow/network is called
            payload = root_payload | {'enzymes': ['EcoRI']}
            response = client.post('/batch_cloning/domesticate', json=payload)
            self.assertEqual(response.status_code, 422)
            mocked_workflow.assert_not_awaited()

            # Empty enzyme list should fail before workflow/network is called
            payload = root_payload | {'enzymes': []}
            response = client.post('/batch_cloning/domesticate', json=payload)
            self.assertEqual(response.status_code, 422)
            mocked_workflow.assert_not_awaited()

            # Empty category requires prefix/suffix to be valid 4bp ACGT strings
            payload = root_payload | {'category': None, 'prefix': 'AAT', 'suffix': 'GCTX'}
            response = client.post('/batch_cloning/domesticate', json=payload)
            self.assertEqual(response.status_code, 400)
            self.assertIn('prefix and suffix must be exactly 4 bp', response.json()['detail'])
            mocked_workflow.assert_not_awaited()

            # A valid payload should pass validation and call workflow
            payload = root_payload | {'category': None, 'prefix': 'aatg', 'suffix': 'gctt'}
            response = client.post('/batch_cloning/domesticate', json=payload)
            self.assertEqual(response.status_code, 200)
            mocked_workflow.assert_awaited_once()

    def test_compound_location(self):
        seq = pydna_parse('packages/opencloning/tests/test_files/ase1.gb')[0]
        feat = next(f for f in seq.features if f.type == 'CDS')
        payload = {
            'sequence': PydnaTextFileSequence.from_dseqrecord(seq).model_dump(),
            'location': SequenceLocationStr.from_biopython_location(feat.location),
            'part_name': 'ase1_cds',
            'prefix': '',
            'suffix': '',
            'category': 'CDS (B3-B4-B5)',
            'enzymes': ['BsmBI', 'BsaI'],
            'cloning_type': 'domestication',
        }
        response = client.post('/batch_cloning/domesticate', json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['primers']), 4)

        payload['cloning_type'] = 'synthesis'
        response = client.post('/batch_cloning/domesticate', json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['primers']), 0)
