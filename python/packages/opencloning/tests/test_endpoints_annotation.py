from fastapi.testclient import TestClient
from pydna.dseqrecord import Dseqrecord
import unittest
import json
import pytest
from importlib import reload
import respx
import httpx2
from fastapi import HTTPException
import os

from opencloning.dna_functions import format_sequence_genbank, read_dsrecord_from_json, annotate_with_plannotate
import opencloning.app_settings as app_settings
import opencloning.http_client as http_client
import opencloning.endpoints.annotation as annotation_endpoints
import opencloning.main as _main
from opencloning_linkml.datamodel import (
    TextFileSequence,
    AnnotationSource,
)

test_files = os.path.join(os.path.dirname(__file__), 'test_files')

client = TestClient(_main.app)

dummy_url = 'http://dummy/url'


class PlannotateTest(unittest.TestCase):
    def setUp(self):
        # Has to be imported here to get the right environment variable
        pytest.MonkeyPatch().setenv('PLANNOTATE_URL', dummy_url)

        reload(app_settings)
        reload(http_client)
        reload(annotation_endpoints)
        reload(_main)
        self.client = TestClient(_main.app)

    def tearDown(self):
        pytest.MonkeyPatch().setenv('PLANNOTATE_URL', '')
        reload(app_settings)
        reload(http_client)
        reload(annotation_endpoints)
        reload(_main)

    @respx.mock
    def test_plannotate(self):
        seq = Dseqrecord(
            'AAAAttgagatcctttttttctgcgcgtaatctgctgcttgcaaacaaaaaaaccaccgctaccagcggtggtttgtttgccggatcaagagctaccaactctttttccgaaggtaactggcttcagcagagcgcagataccaaatactgttcttctagtgtagccgtagttaggccaccacttcaagaactctgtagcaccgcctacatacctcgctctgctaatcctgttaccagtggctgctgccagtggcgataagtcgtgtcttaccgggttggactcaagacgatagttaccggataaggcgcagcggtcgggctgaacggggggttcgtgcacacagcccagcttggagcgaacgacctacaccgaactgagatacctacagcgtgagctatgagaaagcgccacgcttcccgaagggagaaaggcggacaggtatccggtaagcggcagggtcggaacaggagagcgcacgagggagcttccagggggaaacgcctggtatctttatagtcctgtcgggtttcgccacctctgacttgagcgtcgatttttgtgatgctcgtcaggggggcggagcctatggaaaAAAA'
        )
        seq = format_sequence_genbank(seq)
        mock_response_success = json.load(open(f'{test_files}/planottate/mock_response_success.json'))
        # Mock the HTTPX GET request
        respx.post(f'{dummy_url}/annotate').respond(200, json=mock_response_success)

        source = AnnotationSource(id=0, annotation_tool='plannotate')
        response = self.client.post(
            '/annotate/plannotate', json={'sequence': seq.model_dump(), 'source': source.model_dump()}
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        seq = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        source = payload['sources'][0]
        self.assertEqual(source['annotation_tool'], 'plannotate')
        self.assertEqual(source['annotation_tool_version'], '1.2.2')
        self.assertEqual(len(source['annotation_report']), 2)
        feature_names = [f.qualifiers['label'][0] for f in seq.features]
        self.assertIn('ori', feature_names)
        self.assertIn('RNAI', feature_names)

    @respx.mock
    def test_plannotate_down(self):
        respx.post(f'{dummy_url}/annotate').mock(side_effect=httpx2.ConnectError('Connection error'))
        seq = Dseqrecord('aaa')
        seq = format_sequence_genbank(seq)
        source = AnnotationSource(id=0, annotation_tool='plannotate')
        response = self.client.post(
            '/annotate/plannotate', json={'sequence': seq.model_dump(), 'source': source.model_dump()}
        )
        self.assertEqual(response.status_code, 500)

    @respx.mock
    def test_plannotate_timeout(self):
        respx.post(f'{dummy_url}/annotate').mock(side_effect=httpx2.TimeoutException('Timeout error'))
        seq = Dseqrecord('aaa')
        seq = format_sequence_genbank(seq)
        source = AnnotationSource(id=0, annotation_tool='plannotate')
        response = self.client.post(
            '/annotate/plannotate', json={'sequence': seq.model_dump(), 'source': source.model_dump()}
        )
        self.assertEqual(response.status_code, 504)


class PlannotateAsyncTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        # Has to be imported here to get the right environment variable
        pytest.MonkeyPatch().setenv('PLANNOTATE_URL', dummy_url)

        reload(app_settings)
        reload(http_client)
        reload(annotation_endpoints)
        reload(_main)
        self.client = TestClient(_main.app)

    def tearDown(self):
        pytest.MonkeyPatch().setenv('PLANNOTATE_URL', '')
        reload(app_settings)
        reload(http_client)
        reload(annotation_endpoints)
        reload(_main)

    @respx.mock
    async def test_plannotate_other_error(self):
        # This is tested here because it's impossible to send a malformed request from the backend
        respx.post(f'{dummy_url}/annotate').respond(400, json={'error': 'bad request'})

        with pytest.raises(HTTPException) as e:
            await annotate_with_plannotate('hello', 'hello.blah', f'{dummy_url}/annotate')
        self.assertEqual(e.value.status_code, 400)


class AnnotationTest(unittest.TestCase):

    attB1 = 'ACAACTTTGTACAAAAAAGCAGAAG'
    attB2 = 'ACAACTTTGTACAAGAAAGCTGGGC'
    greedy_attP1 = 'CAAATAATGATTTTATTTTGACTGATAGTGACCTGTTCGTTGCAACAAATTGATAAGCAATGCTTTTTTATAATGCCAACTTTGTACAAAAAAGCTGAACGAGAAACGTAAAATGATATAAATATCAATATATTAAATTAGATTTTGCATAAAAAACAGACTACATAATACTGTAAAACACAACATATCCAGTCA'

    def test_get_gateway_sites(self):
        seq = Dseqrecord('aaa' + self.attB1 + 'ccc' + self.attB2 + 'ccc' + self.greedy_attP1)
        response = client.post('/annotation/get_gateway_sites', json=format_sequence_genbank(seq).model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('attB1', payload)
        self.assertIn('attB2', payload)
        self.assertNotIn('attP1', payload)

        response = client.post(
            '/annotation/get_gateway_sites',
            json=format_sequence_genbank(seq).model_dump(),
            params={'greedy': True},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('attB1', payload)
        self.assertIn('attB2', payload)
        self.assertIn('attP1', payload)
