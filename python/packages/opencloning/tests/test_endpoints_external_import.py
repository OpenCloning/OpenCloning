from fastapi.testclient import TestClient
from pydna.dseqrecord import Dseqrecord
import unittest
import tempfile
import pytest
import os
import respx
import httpx2
from importlib import reload
import time
from unittest.mock import patch

import opencloning.request_examples as request_examples
from opencloning.dna_functions import read_dsrecord_from_json
import opencloning.main as _main
from opencloning.endpoints import external_import
from opencloning_linkml.datamodel import (
    NCBISequenceSource,
    TextFileSequence,
    UploadedFileSource,
    GenomeCoordinatesSource,
    AddgeneIdSource,
    BenchlingUrlSource,
    EuroscarfSource,
    SnapGenePlasmidSource,
    IGEMSource,
    WekWikGeneIdSource,
    SEVASource,
    OpenDNACollectionsSource,
)
from opencloning import app_settings, http_client

test_files = os.path.join(os.path.dirname(__file__), 'test_files')

client = TestClient(_main.app)


class ReadFileTest(unittest.TestCase):
    def test_read_files(self):
        """Test that uploading files with single and multiple sequences works."""

        examples = [
            {'file': f'{test_files}/pFA6a-hphMX6.gb', 'format': 'genbank', 'nb_sequences': 1},
            {'file': f'{test_files}/dummy_EcoRI.fasta', 'format': 'fasta', 'nb_sequences': 1},
            {'file': f'{test_files}/dummy_multi_fasta.fasta', 'format': 'fasta', 'nb_sequences': 2},
            {
                'file': f'{test_files}/addgene-plasmid-39296-sequence-49545.dna',
                'format': 'snapgene',
                'nb_sequences': 1,
            },
            {'file': f'{test_files}/ase1.embl', 'format': 'embl', 'nb_sequences': 1},
            # Ape files as of 2024-10-30 did not have a properly formatted LOCUS line
            {
                'file': f'{test_files}/example.ape',
                'format': 'genbank',
                'nb_sequences': 1,
                'warning': True,
                'circular': False,
            },
            # Euroscarf files as of 2024-10-30 did not have a properly formatted LOCUS line
            {
                'file': f'{test_files}/pKT128_euroscarf.gb',
                'format': 'genbank',
                'nb_sequences': 1,
                'warning': True,
                'circular': True,
            },
        ]

        for example in examples:
            with open(example['file'], 'rb') as f:
                response = client.post('/read_from_file', files={'file': f})
            self.assertEqual(response.status_code, 200)
            payload = response.json()

            resulting_sequences = [
                read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
            ]
            sources = [UploadedFileSource.model_validate(s) for s in payload['sources']]

            self.assertEqual(len(sources), example['nb_sequences'])
            self.assertEqual(len(resulting_sequences), example['nb_sequences'])
            for seq in resulting_sequences:
                self.assertGreater(len(seq), 3)
            for source in sources:
                self.assertEqual(source.sequence_file_format, example['format'])

            if 'warning' in example and example['warning']:
                self.assertIn('x-warning', response.headers)
            else:
                self.assertNotIn('x-warning', response.headers)
            if 'circular' in example:
                for seq in resulting_sequences:
                    self.assertEqual(seq.circular, example['circular'])

        # Test naming
        with open(example['file'], 'rb') as f:
            response = client.post('/read_from_file?output_name=hello', files={'file': f})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        dseqr = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(dseqr.name, 'hello')

    def test_errors_read_files(self):
        # Create a temp empty file
        with tempfile.NamedTemporaryFile() as temp_empty_file:

            examples = [
                {
                    'file': './test_endpoints.py',
                    'format': None,
                    'error_message': 'could not guess',
                },
                {
                    'file': './test_endpoints.py',
                    'format': 'snapgene',
                    'error_message': 'Biopython cannot process',
                },
                {
                    'file': './test_endpoints.py',
                    'format': 'genbank',
                    'error_message': 'Biopython cannot process',
                },
                {
                    'file': './test_endpoints.py',
                    'format': 'embl',
                    'error_message': 'Biopython cannot process',
                },
                {
                    'file': './test_endpoints.py',
                    'format': 'fasta',
                    'error_message': 'Biopython cannot process',
                },
                {
                    'file': temp_empty_file.name,
                    'format': 'genbank',
                    'error_message': 'Biopython cannot process',
                },
                {
                    'file': temp_empty_file.name,
                    'format': 'embl',
                    'error_message': 'Biopython cannot process',
                },
                {
                    'file': temp_empty_file.name,
                    'format': 'fasta',
                    'error_message': 'Biopython cannot process',
                },
            ]
            for example in examples:
                if example['format'] is not None:
                    response = client.post(
                        f'/read_from_file?sequence_file_format={example["format"]}',
                        files={'file': temp_empty_file},
                    )
                else:
                    response = client.post('/read_from_file', files={'file': temp_empty_file})

                self.assertNotEqual(response.status_code, 200)
                self.assertIn(example['error_message'], response.json()['detail'])

    def test_file_index_known(self):
        """Test that if the index in file is specified it works."""

        with open(f'{test_files}/dummy_multi_fasta.fasta', 'rb') as f:
            response = client.post('/read_from_file?index_in_file=1', files={'file': f})

        self.assertEqual(response.status_code, 200)
        payload = response.json()

        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        sources = [UploadedFileSource.model_validate(s) for s in payload['sources']]

        self.assertEqual(len(sources), 1)
        self.assertEqual(len(resulting_sequences), 1)

        # If the index is outside the range, it should raise an error
        with open(f'{test_files}/dummy_multi_fasta.fasta', 'rb') as f:
            response = client.post('/read_from_file?index_in_file=2', files={'file': f})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['detail'], 'The index_in_file is out of range.')

    def test_circularize_fasta_sequence(self):
        """Test that the circularize parameter works when reading from file"""
        file_paths = [
            f'{test_files}/dummy_EcoRI.fasta',
            f'{test_files}/example.ape',
            f'{test_files}/gateway_manual_cloning/pcr_product-attP1_1-attP2_1.dna',
        ]
        for file_path in file_paths:
            with open(file_path, 'rb') as f:
                response = client.post('/read_from_file?circularize=True', files={'file': f})

            self.assertEqual(response.status_code, 200)
            payload = response.json()

            resulting_sequences = [
                read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
            ]
            sources = [UploadedFileSource.model_validate(s) for s in payload['sources']]

            self.assertEqual(len(sources), 1)
            self.assertEqual(len(resulting_sequences), 1)
            self.assertTrue(sources[0].circularize)
            self.assertTrue(resulting_sequences[0].circular)

    def test_coordinates_provided(self):
        # Single sequence
        with open(f'{test_files}/dummy_EcoRI.fasta', 'rb') as f:
            response = client.post('/read_from_file?start=0&end=7', files={'file': f})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 1)
        self.assertEqual(len(payload['sources']), 1)
        self.assertEqual(payload['sources'][0]['coordinates'], '1..7')
        seq = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(str(seq.seq), 'AAAAAAG')

        # Multiple sequences where both can be extracted
        with open(f'{test_files}/dummy_multi_fasta.fasta', 'rb') as f:
            response = client.post('/read_from_file?start=0&end=7', files={'file': f})
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 2)
        self.assertEqual(len(payload['sources']), 2)
        seqs = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
        self.assertEqual(str(seqs[0].seq), 'TATTAAT')
        self.assertEqual(str(seqs[1].seq), 'AAAAAAG')

        # Multiple sequences where only one can be extracted
        with open(f'{test_files}/dummy_multi_fasta.fasta', 'rb') as f:
            response = client.post('/read_from_file?start=2&end=15', files={'file': f})
        payload = response.json()
        seqs = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
        self.assertEqual(len(payload['sequences']), 1)
        self.assertEqual(len(payload['sources']), 1)
        seq = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(str(seq.seq), 'AAAAGAATTCTTT')
        self.assertEqual(payload['sources'][0]['index_in_file'], 1)
        # Gives the warning
        self.assertIn('x-warning', response.headers)
        self.assertIn('Some sequences were not extracted', response.headers['x-warning'])

        # Same result if index is provided
        with open(f'{test_files}/dummy_multi_fasta.fasta', 'rb') as f:
            response = client.post('/read_from_file?index_in_file=1&start=2&end=15', files={'file': f})
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 1)
        self.assertEqual(len(payload['sources']), 1)
        self.assertEqual(payload['sources'][0]['index_in_file'], 1)
        seq = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(str(seq.seq), 'AAAAGAATTCTTT')

        # Spanning the origin
        with open(f'{test_files}/dummy_multi_fasta.fasta', 'rb') as f:
            response = client.post('/read_from_file?start=5&end=2&circularize=True', files={'file': f})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 2)
        self.assertEqual(len(payload['sources']), 2)
        seqs = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
        self.assertEqual(str(seqs[0].seq), 'ATATAATA')
        self.assertEqual(str(seqs[1].seq), 'AGAATTCTTTTTTAA')

        # Handles origin-spanning features
        with open(f'{test_files}/plasmid_origin_spanning.gb', 'rb') as f:
            response = client.post('/read_from_file?start=140&end=3', files={'file': f})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 1)
        self.assertEqual(len(payload['sources']), 1)
        seq = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(len(seq.features), 1)

    def test_coordinates_provided_errors(self):
        # Out of bounds
        with open(f'{test_files}/dummy_EcoRI.fasta', 'rb') as f:
            response = client.post('/read_from_file?start=0&end=100', files={'file': f})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json()['detail'], 'Provided coordinates are incompatible with sequences in the file.'
        )

        # Negative coordinates
        with open(f'{test_files}/dummy_EcoRI.fasta', 'rb') as f:
            response = client.post('/read_from_file?start=-1&end=0', files={'file': f})
        self.assertEqual(response.status_code, 422)

        # Start is after end in linear sequence
        with open(f'{test_files}/dummy_EcoRI.fasta', 'rb') as f:
            response = client.post('/read_from_file?start=4&end=2', files={'file': f})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json()['detail'], 'Provided coordinates are incompatible with sequences in the file.'
        )


class FileSizeLimitTest(unittest.TestCase):
    def test_file_too_large(self):
        """Files above MAX_SEQUENCE_FILE_SIZE_MB are rejected with 413."""
        content = b'>seq\n' + b'A' * (1024 * 1024 + 1) + b'\n'
        with patch.object(external_import.settings, 'MAX_SEQUENCE_FILE_SIZE_MB', 1):
            for endpoint in ['/read_from_file', '/read_snapgene_history']:
                response = client.post(endpoint, files={'file': ('big.fasta', content)})
                self.assertEqual(response.status_code, 413, endpoint)
                self.assertIn('maximum size of 1 MB', response.json()['detail'])
            # A small file is still accepted
            response = client.post('/read_from_file', files={'file': ('small.fasta', b'>seq\nACGT\n')})
            self.assertEqual(response.status_code, 200)


class GenBankTest(unittest.TestCase):

    # TODO these tests will not work off-line, so the case where connection cannot be established should be handled in some way
    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    def test_request_gene(self):
        """Test whether the gene is requested from GenBank"""
        source = NCBISequenceSource(
            id=1,
            repository_id='NM_001018957.2',
        )
        response = client.post('/repository_id/genbank', json=source.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        sequence = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertIn('Ase1', sequence.description)

    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    def test_request_wrong_id(self):
        """Test a wrong Genbank id"""
        source = NCBISequenceSource(
            id=1,
            repository_id='wrong_id',
        )
        response = client.post('/repository_id/genbank', json=source.model_dump())
        self.assertEqual(response.status_code, 404)

    # Extremely unlikely case where the request that checks for the length
    # succeeds, but the request that gets the sequence fails
    @respx.mock
    def test_request_wrong_id2(self):
        respx.post('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi').respond(
            200, json={'result': {'uids': ['1'], '1': {'slen': 1000}}}
        )
        # 400 is the error code for a wrong sequence accession :_)
        respx.post('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi').respond(400, text='')
        source = NCBISequenceSource(
            id=1,
            repository_id='wrong_id',
        )
        response = client.post('/repository_id/genbank', json=source.model_dump())
        self.assertEqual(response.status_code, 404)

    @respx.mock
    def test_eutils_down(self):
        """Test that the request fails if the NCBI is down"""

        # First request fails
        respx.post('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi').mock(
            side_effect=httpx2.ConnectError('Connection error')
        )
        source = NCBISequenceSource(
            id=1,
            repository_id='NM_001018957.2',
        )
        response = client.post('/repository_id/genbank', json=source.model_dump())
        self.assertEqual(response.status_code, 504)

        # Second request fails
        respx.post('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi').respond(
            200, json={'result': {'uids': ['1'], '1': {'slen': 1000}}}
        )
        respx.post('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi').mock(
            side_effect=httpx2.ConnectError('Connection error')
        )
        response = client.post('/repository_id/genbank', json=source.model_dump())
        self.assertEqual(response.status_code, 504)

    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    def test_redirect(self):
        """The repository_id endpoint should redirect based on repository_name value"""
        source = NCBISequenceSource(
            id=1,
            repository_id='NM_001018957.2',
        )
        response = client.post('/repository_id', json=source.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        sequence: Dseqrecord = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertIn('Ase1', sequence.description)

    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    def test_rename(self):
        """If passing output_name, it renames the output"""
        source = NCBISequenceSource(
            id=1,
            repository_id='NM_001018957.2',
            output_name='hello',
        )
        response = client.post('/repository_id/genbank', json=source.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        sequence = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(sequence.name, 'hello')

    def test_long_sequence(self):
        """Test that a long sequence raises an error"""
        source = NCBISequenceSource(
            id=1,
            repository_id='CU329670.1',
        )
        response = client.post('/repository_id/genbank', json=source.model_dump())
        self.assertEqual(response.status_code, 400)
        self.assertIn('sequence is too long', response.json()['detail'])


class AddgeneTest(unittest.TestCase):
    def test_request_plasmid(self):
        """Test whether the gene is requested from Addgene and returns the right info"""
        examples = [
            {
                'id': '39282',
                'url': 'https://api.developers.addgene.org/download/genbank/240599/',
                'type': 'addgene-full',
                'name': 'pFA6a-kanMX6-P81nmt1',
            },
            {
                'id': '39289',
                'url': 'https://api.developers.addgene.org/download/genbank/49640/',
                'type': 'depositor-full',
                'name': 'pFA6a-kanMX6-P3nmt1-GFP',
            },
        ]
        for example in examples:
            source = AddgeneIdSource(
                id=1,
                repository_id=example['id'],
            )

            response = client.post('/repository_id/addgene', json=source.model_dump())
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            resulting_sequences = [
                read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
            ]
            sources = [AddgeneIdSource.model_validate(s) for s in payload['sources']]

            self.assertEqual(len(resulting_sequences), 1)
            self.assertEqual(len(sources), 1)
            self.assertEqual(sources[0].addgene_sequence_type, example['type'])
            self.assertEqual(sources[0].sequence_file_url, example['url'])
            self.assertEqual(resulting_sequences[0].name, example['name'])

            # We get the same response when sending the returned source back
            response2 = client.post('/repository_id/addgene', json=payload['sources'][0])
            self.assertEqual(response.json(), response2.json())

    def test_source_url_not_validated(self):
        """sequence_file_url / addgene_sequence_type in the request are ignored, e.g. for old saved sources"""
        legacy_url = 'https://sequences.addgene.org/snapgene-media/v3.101.0/sequences/240599/4936a6ae-6b4d-4d24-b7ac-2339fad5755d/addgene-plasmid-39282-sequence-240599.gbk'
        for sequence_file_url in [legacy_url, 'https://media.addgene.org/snapgene-media/wrongggggggg.gbk']:
            source = AddgeneIdSource(
                id=1,
                repository_id='39282',
                addgene_sequence_type='depositor-full',
                sequence_file_url=sequence_file_url,
            )
            response = client.post('/repository_id/addgene', json=source.model_dump())
            self.assertEqual(response.status_code, 200)
            sources = [AddgeneIdSource.model_validate(s) for s in response.json()['sources']]
            self.assertEqual(len(sources), 1)
            # The returned source has the current values
            self.assertEqual(
                sources[0].sequence_file_url, 'https://api.developers.addgene.org/download/genbank/240599/'
            )
            self.assertEqual(sources[0].addgene_sequence_type, 'addgene-full')

    @respx.mock
    def test_token_rejected(self):
        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setenv('ADDGENE_TOKEN', 'dummy-token')
        reload(app_settings)
        try:
            respx.get('https://api.developers.addgene.org/catalog/plasmid-with-sequences/39282/').respond(
                401, json={'detail': 'Invalid token.'}
            )
            source = AddgeneIdSource(id=1, repository_id='39282')
            response = client.post('/repository_id/addgene', json=source.model_dump())
            self.assertEqual(response.status_code, 503)
            self.assertIn('rejected the ADDGENE_TOKEN', response.json()['detail'])
        finally:
            monkeypatch.undo()
            reload(app_settings)

    @respx.mock
    def test_genbank_download_fails(self):
        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setenv('ADDGENE_TOKEN', 'dummy-token')
        reload(app_settings)
        try:
            respx.get('https://api.developers.addgene.org/catalog/plasmid-with-sequences/39282/').respond(
                200,
                json={
                    'name': 'pFA6a-kanMX6-P81nmt1',
                    'sequences': {
                        'public_user_full_sequences': [],
                        'public_addgene_full_sequences': [{'sequence_id': 240599}],
                    },
                },
            )
            download_route = respx.get('https://api.developers.addgene.org/download/genbank/240599/').respond(500)
            source = AddgeneIdSource(id=1, repository_id='39282')
            response = client.post('/repository_id/addgene', json=source.model_dump())
            self.assertEqual(download_route.call_count, 1)
            self.assertEqual(response.status_code, 503)
            self.assertIn('Failed to download sequence file from Addgene', response.json()['detail'])
        finally:
            monkeypatch.undo()
            reload(app_settings)

    @respx.mock
    def test_auth_header(self):
        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setenv('ADDGENE_TOKEN', 'dummy-token')
        reload(app_settings)
        try:
            plasmid_route = respx.get('https://api.developers.addgene.org/catalog/plasmid-with-sequences/1/').respond(
                404
            )
            response = client.post(
                '/repository_id/addgene', json=AddgeneIdSource(id=1, repository_id='1').model_dump()
            )
            self.assertEqual(response.status_code, 404)
            self.assertEqual(plasmid_route.calls.last.request.headers['Authorization'], 'Token dummy-token')
        finally:
            monkeypatch.undo()
            reload(app_settings)

    def test_missing_sequences(self):
        # Non-existing id
        source = AddgeneIdSource(
            id=1,
            repository_id='DUMMYTEST',
        )

        response = client.post('/repository_id/addgene', json=source.model_dump())
        self.assertEqual(response.status_code, 404)
        self.assertIn('wrong addgene id', response.json()['detail'])

        # Id that has no full-sequences
        source = AddgeneIdSource(
            id=1,
            repository_id='39291',
        )
        response = client.post('/repository_id/addgene', json=source.model_dump())
        self.assertEqual(response.status_code, 404)
        self.assertIn('The requested plasmid does not have full sequences', response.json()['detail'])

    def test_redirect(self):
        """Test repository_id endpoint should redirect based on repository_name value"""
        source = AddgeneIdSource(
            id=1,
            repository_id='39282',
        )
        response = client.post('/repository_id', json=source.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        sequence: Dseqrecord = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertIn('synthetic circular DNA', sequence.description)

    @respx.mock
    def test_addgene_down(self):
        respx.get('https://api.developers.addgene.org/catalog/plasmid-with-sequences/39282/').mock(
            side_effect=httpx2.ConnectError('Connection error')
        )
        source = AddgeneIdSource(
            id=1,
            repository_id='39282',
        )
        response = client.post('/repository_id/addgene', json=source.model_dump())
        self.assertEqual(response.status_code, 504)
        self.assertIn('Unable to connect to Addgene', response.json()['detail'])

    @respx.mock
    def test_missing_addgene_credentials_error(self):
        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.delenv('ADDGENE_TOKEN', raising=False)
        reload(app_settings)
        try:
            source = AddgeneIdSource(
                id=1,
                repository_id='39282',
            )
            response = client.post('/repository_id/addgene', json=source.model_dump())
            self.assertEqual(response.status_code, 503)
            self.assertIn('ADDGENE_TOKEN', response.json()['detail'])
            self.assertIn('Addgene Terms of Use', response.json()['detail'])
        finally:
            monkeypatch.undo()
            reload(app_settings)


class WekWikGeneSourceTest(unittest.TestCase):

    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    def test_valid_id(self):
        source = WekWikGeneIdSource(
            id=1,
            repository_id='0000304',
        )
        response = client.post('/repository_id/wekwikgene', json=source.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 1)
        self.assertEqual(len(payload['sources']), 1)
        sequence: Dseqrecord = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertTrue(sequence.circular)
        self.assertIn('RPL15', sequence.name)

    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    def test_invalid_id(self):
        source = WekWikGeneIdSource(
            id=1,
            repository_id='999999999999999999999999999999',  # Non-existent ID
        )
        response = client.post('/repository_id/wekwikgene', json=source.model_dump())
        self.assertEqual(response.status_code, 404)
        self.assertIn('invalid wekwikgene id', response.json()['detail'])

    @respx.mock
    def test_wekwikgene_down(self):
        source = WekWikGeneIdSource(
            id=1,
            repository_id='0000304',
        )

        respx.get('https://wekwikgene.wllsb.edu.cn/plasmids/0000304').mock(
            side_effect=httpx2.ConnectError('Connection error')
        )
        response = client.post('/repository_id/wekwikgene', json=source.model_dump())
        self.assertEqual(response.status_code, 504)
        self.assertIn('Unable to connect to WeKwikGene', response.json()['detail'])

    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    def test_redirect(self):
        source = WekWikGeneIdSource(
            id=1,
            repository_id='0000304',
        )
        response = client.post('/repository_id', json=source.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        sequence: Dseqrecord = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertIn('RPL15', sequence.name)


class BenchlingUrlSourceTest(unittest.TestCase):

    def test_valid_url(self):
        url = 'https://benchling.com/siverson/f/lib_B94YxDHhQh-cidar-moclo-library/seq_dh1FrJTc-b0015_dh.gb'
        source = BenchlingUrlSource(id=0, repository_id=url)
        response = client.post('/repository_id/benchling', json=source.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 1)
        self.assertEqual(len(payload['sources']), 1)
        self.assertEqual(payload['sources'][0], source.model_dump())

    def test_invalid_url(self):
        # We have to initialize the object with a valid url
        url = 'https://benchling.com/siverson/f/lib_B94YxDHhQh-cidar-moclo-library/seq_dh1FrJTc-b0015_dh.gb'
        source_object = BenchlingUrlSource(id=0, repository_id=url)

        # In the dict, we can then edit
        source_dict = source_object.model_dump()

        # url missing the .gb
        source_dict['repository_id'] = (
            'https://benchling.com/siverson/f/lib_B94YxDHhQh-cidar-moclo-library/seq_dh1FrJTc-b0015_dh'
        )
        response = client.post('/repository_id/benchling', json=source_dict)
        self.assertEqual(response.status_code, 422)

        # The /edit url
        source_dict['repository_id'] = (
            'https://benchling.com/siverson/f/lib_B94YxDHhQh-cidar-moclo-library/seq_dh1FrJTc-b0015_dh/edit'
        )
        response = client.post('/repository_id/benchling', json=source_dict)
        self.assertEqual(response.status_code, 422)

        # One that matches the pattern but does not exist
        url = 'https://benchling.com/bluh/blah.gb'
        source = BenchlingUrlSource(id=0, repository_id=url)
        response = client.post('/repository_id/benchling', json=source.model_dump())
        self.assertEqual(response.status_code, 404)
        self.assertIn('file requested from url not found', response.json()['detail'])


class SnapGenePlasmidSourceTest(unittest.TestCase):

    def test_valid_url(self):

        source = SnapGenePlasmidSource(id=0, repository_id='basic_cloning_vectors/pEASY-T1_(linearized)')
        response = client.post('/repository_id/snapgene', json=source.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 1)
        self.assertEqual(len(payload['sources']), 1)
        out_source = payload['sources'][0]
        self.assertEqual(out_source, source.model_dump())
        seq = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(seq.name, 'pEASY-T1_(linearized)')

        # We can also provide a name
        source2 = SnapGenePlasmidSource(
            id=0,
            repository_id='basic_cloning_vectors/pEASY-T1_(linearized)',
            output_name='my_name',
        )
        response = client.post('/repository_id/snapgene', json=source2.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['sources'][0]['output_name'], 'my_name')
        seq = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(seq.name, 'my_name')

    def test_invalid_url(self):
        # Invalid plasmid set
        source = SnapGenePlasmidSource(id=0, repository_id='hello/world')
        response = client.post('/repository_id/snapgene', json=source.model_dump())
        self.assertEqual(response.status_code, 404)

        # Invalid plasmid name
        source = SnapGenePlasmidSource(id=0, repository_id='basic_cloning_vectors/hello')
        response = client.post('/repository_id/snapgene', json=source.model_dump())
        self.assertEqual(response.status_code, 404)
        self.assertIn('hello is not part of basic_cloning_vectors', response.json()['detail'])

        # Wrongly formatted url
        source_dict = source.model_dump()
        source_dict['repository_id'] = 'hello'
        response = client.post('/repository_id/snapgene', json=source_dict)
        self.assertEqual(response.status_code, 422)


class EuroscarfSourceTest(unittest.TestCase):

    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    def test_valid_url(self):
        source = EuroscarfSource(id=0, repository_id='P30174')
        response = client.post('/repository_id/euroscarf', json=source.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 1)
        self.assertEqual(len(payload['sources']), 1)
        out_source = payload['sources'][0]
        self.assertEqual(out_source, source.model_dump())
        sequence = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(sequence.name, 'pKT128')
        self.assertEqual(len(sequence), 4738)
        self.assertTrue(any('yEGFP' in f.qualifiers['gene'] for f in sequence.features))

        # Ensure that linear files are circularised
        source = EuroscarfSource(id=0, repository_id='P30555')
        response = client.post('/repository_id/euroscarf', json=source.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 1)
        sequence = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertTrue(sequence.circular)

    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    def test_invalid_url(self):
        # Compatible with regex, but does not exist
        source = EuroscarfSource(id=0, repository_id='P99999999999999')
        response = client.post('/repository_id/euroscarf', json=source.model_dump())
        self.assertEqual(response.status_code, 404)

        # Not compatible with regex
        source_dict = source.model_dump()
        source_dict['repository_id'] = 'hello'
        response = client.post('/repository_id/euroscarf', json=source_dict)
        self.assertEqual(response.status_code, 422)

    @respx.mock
    def test_circularize_plasmid(self):
        # We mock a request in which we would get a linear plasmid
        source = EuroscarfSource(id=0, repository_id='P9999999999999')
        respx.get('http://www.euroscarf.de/plasmid_details.php').respond(
            200, text='<html><body><a href="files/dna/test.gb">Download</a></body></html>'
        )
        with open(f'{test_files}/ase1.gb', 'r') as f:
            str_content = f.read()

        respx.get('http://www.euroscarf.de/files/dna/test.gb').respond(200, text=str_content)
        response = client.post('/repository_id/euroscarf', json=source.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        seq = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(seq.circular, True)


class IGEMSourceTest(unittest.TestCase):
    good_url = 'https://assets.opencloning.org/annotated-igem-distribution/results/plasmids/115.gb'
    no_gb_url = 'https://blah.com/1.txt'
    wrong_url = 'https://assets.opencloning.org/annotated-igem-distribution/results/plasmids/dummy.gb'

    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    def test_igem(self):
        source = IGEMSource(id=0, repository_id='BBa_C0062-pSB1C5C', sequence_file_url=self.good_url)
        response = client.post('/repository_id/igem', json=source.model_dump())
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload['sources'][0]['repository_id'], 'BBa_C0062-pSB1C5C')

    def test_errors(self):

        # The repository_id does not start with the part_name, even if url is valid
        source = IGEMSource(id=0, repository_id='BBa_C0062-dummy', sequence_file_url=self.good_url)

        # The url is not a GenBank file
        source_json = source.model_dump()
        source_json['sequence_file_url'] = self.no_gb_url
        response = client.post('/repository_id/igem', json=source_json)
        self.assertEqual(response.status_code, 422)

        # The url does not exist
        source = IGEMSource(id=0, repository_id='dummy-test', sequence_file_url=self.wrong_url)
        response = client.post('/repository_id/igem', json=source.model_dump())
        self.assertEqual(response.status_code, 404)


class GenomeRegionTest(unittest.TestCase):
    def assertStatusCode(self, response_code: int, expected: int, msg: str = ''):
        if response_code == 503:
            self.skipTest('NCBI not available')
        else:
            self.assertEqual(response_code, expected, msg)

    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    def test_examples(self):
        for example_name in request_examples.genome_region_examples:
            example = request_examples.genome_region_examples[example_name]
            response = client.post('/genome_coordinates', json=example['value'])
            msg = f'Error in example {example_name}'
            self.assertStatusCode(response.status_code, 200, msg)
            payload = response.json()
            try:
                sources = [GenomeCoordinatesSource.model_validate(s) for s in payload['sources']]
            except Exception:
                self.fail(f'Cannot parse the sources for example {example_name}')
            response_source = sources[0]
            request_source = GenomeCoordinatesSource.model_validate(example['value'])
            if example_name == 'full' or example_name == 'full_with_genbank_accession':
                self.assertEqual(response_source, request_source, msg)
            elif example_name == 'id_omitted':
                request_source.gene_id = 2543372
                self.assertEqual(response_source, request_source, msg)
            elif example_name == 'assembly_accession_omitted':
                self.assertEqual(response_source, request_source, msg)
            elif example_name == 'viral_sequence':
                self.assertEqual(response_source, request_source, msg)

    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    def test_exceptions(self):
        wait_time = 0.5
        # Load first example
        correct_source = GenomeCoordinatesSource.model_validate(
            request_examples.genome_region_examples['full']['value']
        )

        # Ommit assembly accession
        s = correct_source.model_copy(deep=True)
        s.assembly_accession = None
        response = client.post('/genome_coordinates', json=s.model_dump())
        self.assertStatusCode(response.status_code, 422)
        time.sleep(wait_time)

        # Ommit locus_tag keeping gene id is now supported
        # Before it was not, but see https://github.com/ncbi/datasets/issues/397
        s = correct_source.model_copy(deep=True)
        s.locus_tag = None
        response = client.post('/genome_coordinates', json=s.model_dump())
        self.assertStatusCode(response.status_code, 200)
        time.sleep(wait_time)

        # Wrong gene_id (not matching that of the locus_tag)
        s = correct_source.model_copy(deep=True)
        s.gene_id = 123
        response = client.post('/genome_coordinates', json=s.model_dump())
        self.assertStatusCode(response.status_code, 400)
        time.sleep(wait_time)

        # Wrong assembly accession
        s = correct_source.model_copy(deep=True)
        s.assembly_accession = 'blah'
        response = client.post('/genome_coordinates', json=s.model_dump())
        self.assertStatusCode(response.status_code, 404)
        time.sleep(wait_time)

        # Wrong locus_tag
        s = correct_source.model_copy(deep=True)
        s.locus_tag = 'blah'
        response = client.post('/genome_coordinates', json=s.model_dump())
        self.assertStatusCode(response.status_code, 404)
        time.sleep(wait_time)

        # Wrong coordinates
        s = correct_source.model_copy(deep=True)
        s.coordinates = '1..10'
        response = client.post('/genome_coordinates', json=s.model_dump())
        self.assertIn('gene should fall within', response.json()['detail'])
        self.assertStatusCode(response.status_code, 400)
        time.sleep(wait_time)

        # Wrong assembly accession
        s = correct_source.model_copy(deep=True)
        s.locus_tag = None
        s.gene_id = None
        s.assembly_accession = 'blah'
        response = client.post('/genome_coordinates', json=s.model_dump())
        self.assertStatusCode(response.status_code, 404)
        self.assertIn('Wrong assembly accession', response.json()['detail'])
        time.sleep(wait_time)

        # Assembly accession not linked to any sequence record
        s = correct_source.model_copy(deep=True)
        s.locus_tag = None
        s.gene_id = None
        # It used to be the case, but it changed so now we just mock the response
        s.assembly_accession = 'GCF_000146045.1'
        time.sleep(wait_time)

        with respx.mock:
            respx.get(
                'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCF_000146045.1/sequence_reports'
            ).respond(200, json={'total_count': 0})

            response = client.post('/genome_coordinates', json=s.model_dump())
            self.assertStatusCode(response.status_code, 400)
            self.assertIn('No sequence accessions linked', response.json()['detail'])

        # Assembly accession not linked to that sequence accession
        s = correct_source.model_copy(deep=True)
        s.locus_tag = None
        s.gene_id = None
        s.assembly_accession = 'GCF_000146045.2'
        response = client.post('/genome_coordinates', json=s.model_dump())
        self.assertStatusCode(response.status_code, 400)
        self.assertIn('not contained in assembly accession', response.json()['detail'])
        time.sleep(wait_time)

        # Wrong sequence accession
        s = correct_source.model_copy(deep=True)
        s.locus_tag = None
        s.gene_id = None
        s.assembly_accession = None
        s.repository_id = 'blah'
        response = client.post('/genome_coordinates', json=s.model_dump())
        self.assertStatusCode(response.status_code, 404)
        time.sleep(wait_time)

        # Coordinates malformatted
        viral_source = GenomeCoordinatesSource.model_validate(
            request_examples.genome_region_examples['viral_sequence']['value']
        )
        viral_source.coordinates = '10..1'
        response = client.post('/genome_coordinates', json=viral_source.model_dump())
        self.assertStatusCode(response.status_code, 422)
        time.sleep(wait_time)

        viral_source.coordinates = '0..20'
        response = client.post('/genome_coordinates', json=viral_source.model_dump())
        self.assertStatusCode(response.status_code, 422)
        time.sleep(wait_time)

        # Coordinates outside of the sequence
        viral_source.coordinates = '1..2152'
        response = client.post('/genome_coordinates', json=viral_source.model_dump())
        self.assertStatusCode(response.status_code, 400)
        time.sleep(wait_time)

        # Coordinates too long
        viral_source.coordinates = '1..100004'
        response = client.post('/genome_coordinates', json=viral_source.model_dump())
        self.assertStatusCode(response.status_code, 400)
        self.assertIn('coordinates fall outside the sequence', response.json()['detail'])

    def test_ncbi_down(self):
        correct_source = GenomeCoordinatesSource.model_validate(
            request_examples.genome_region_examples['full']['value']
        )
        with respx.mock:
            respx.get(
                'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/GCF_000002945.2/annotation_report'
            ).respond(500, text='NCBI is down')
            response = client.post('/genome_coordinates', json=correct_source.model_dump())
            self.assertEqual(response.status_code, 503)
            self.assertIn('NCBI is down', response.json()['detail'])

    def test_max_sequence_length(self):
        correct_source = GenomeCoordinatesSource.model_validate(
            request_examples.genome_region_examples['full']['value']
        )
        correct_source.coordinates = f'1..{app_settings.NCBI_MAX_SEQUENCE_LENGTH + 1}'
        response = client.post('/genome_coordinates', json=correct_source.model_dump())
        self.assertEqual(response.status_code, 400)
        self.assertIn(
            f'sequence is too long (max {app_settings.NCBI_MAX_SEQUENCE_LENGTH} bp)', response.json()['detail']
        )


class SEVASourceTest(unittest.TestCase):
    def test_seva_url(self):
        source = SEVASource(
            id=0,
            repository_id='pSEVA261',
            sequence_file_url='https://seva-plasmids.com/maps-canonical/maps-plasmids-SEVAs-canonical-versions-web-1-3-gbk/pSEVA261.gbk',
        )
        response = client.post('/repository_id/seva', json=source.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 1)
        self.assertEqual(len(payload['sources']), 1)
        out_source = payload['sources'][0]
        self.assertEqual(out_source, source.model_dump())
        seq = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(seq.name, 'pSEVA261')

        # Also works with missing link in data.js - see catalog script - (e.g. pSEVA2a2d1)
        source = SEVASource(
            id=0,
            repository_id='pSEVA2a2d1',
        )
        response = client.post('/repository_id/seva', json=source.model_dump())
        self.assertEqual(response.status_code, 200)

    def test_ncbi_url(self):
        source = SEVASource(
            id=0,
            repository_id='pSEVA2214',
            sequence_file_url='https://www.ncbi.nlm.nih.gov/nuccore/MH650998',
        )
        response = client.post('/repository_id/seva', json=source.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 1)
        self.assertEqual(len(payload['sources']), 1)
        out_source = payload['sources'][0]
        self.assertEqual(out_source, source.model_dump())
        seq = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(seq.name, 'pSEVA2214')

    def test_errors(self):
        source = SEVASource(
            id=0,
            repository_id='pSEVA261',
            sequence_file_url='https://seva-plasmids.com/maps-canonical/maps-plasmids-SEVAs-canonical-versions-web-1-3-gbk/pSEVA261.gbk',
        )

        # Invalid repository id
        source_dict = source.model_dump()
        source_dict['repository_id'] = 'pSEVA99999999999999999999999'
        response = client.post('/repository_id/seva', json=source_dict)
        self.assertEqual(response.status_code, 404)

        source_dict = source.model_dump()
        source_dict['sequence_file_url'] = 'https://seva-plasmids.com/dummy.gbk'
        response = client.post('/repository_id/seva', json=source_dict)
        self.assertEqual(response.status_code, 400)

        source_dict = source.model_dump()
        source_dict['repository_id'] = 'hello'
        response = client.post('/repository_id/seva', json=source_dict)
        self.assertEqual(response.status_code, 422)

        source_dict = source.model_dump()
        source_dict['sequence_file_url'] = 'hello'
        response = client.post('/repository_id/seva', json=source_dict)
        self.assertEqual(response.status_code, 422)

        source_dict = source.model_dump()
        source_dict['sequence_file_url'] = 'https://hello.com'
        response = client.post('/repository_id/seva', json=source_dict)
        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertIn('The provided source is not valid.', payload['detail'])
        self.assertIn('repository_id: pSEVA261', payload['detail'])
        self.assertIn(
            f'sequence_file_url: {source.sequence_file_url}',
            payload['detail'],
        )

        # Mock connection error

        source = SEVASource(id=0, repository_id='pSEVA261')

        with respx.mock:
            respx.get(source.sequence_file_url).mock(side_effect=httpx2.ConnectError('Mock Error'))
            response = client.post('/repository_id/seva', json=source.model_dump())
            self.assertEqual(response.status_code, 504)
            payload = response.json()
            self.assertIn('Unable to connect to SEVA', payload['detail'])

        # Mock incorrect file
        with respx.mock:
            respx.get(source.sequence_file_url).respond(200, text='dummy test')
            response = client.post('/repository_id/seva', json=source.model_dump())
            self.assertEqual(response.status_code, 400)
            payload = response.json()
            self.assertIn('No sequences found in file', payload['detail'])

        with respx.mock:
            with open(f'{test_files}/ase1_body_error.gb', 'r') as f:
                mock_seq = f.read()
            respx.get(source.sequence_file_url).respond(200, text=mock_seq)
            response = client.post('/repository_id/seva', json=source.model_dump())
            self.assertEqual(response.status_code, 400)
            payload = response.json()
            self.assertIn('No sequences found in file', payload['detail'])

    def test_redirect(self):
        source = SEVASource(
            id=0,
            repository_id='pSEVA261',
            sequence_file_url='https://seva-plasmids.com/maps-canonical/maps-plasmids-SEVAs-canonical-versions-web-1-3-gbk/pSEVA261.gbk',
        )
        with open(f'{test_files}/ase1.gb', 'r') as f:
            mock_seq = f.read()
        # We mock to avoid extra requests
        with respx.mock:
            respx.get(source.sequence_file_url).respond(200, text=mock_seq)
            response = client.post('/repository_id', json=source.model_dump())
            self.assertEqual(response.status_code, 200)

    def test_circularize(self):
        source = SEVASource(
            id=0,
            repository_id='pSEVA261',
            sequence_file_url='https://seva-plasmids.com/maps-canonical/maps-plasmids-SEVAs-canonical-versions-web-1-3-gbk/pSEVA261.gbk',
        )
        with open(f'{test_files}/ase1.gb', 'r') as f:
            mock_seq = f.read()
        # We mock to avoid extra requests
        with respx.mock:
            respx.get(source.sequence_file_url).respond(200, text=mock_seq)
            response = client.post('/repository_id', json=source.model_dump())
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            seq = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
            self.assertEqual(seq.circular, True)


class OpenDNACollectionsSourceTest(unittest.TestCase):
    def test_valid_url(self):
        source = OpenDNACollectionsSource(
            id=0,
            repository_id='Ecoli Nanobody Toolkit/BC_RJ_SD8',
        )
        response = client.post('/repository_id/open_dna_collections', json=source.model_dump())
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 1)
        self.assertEqual(len(payload['sources']), 1)
        out_source = payload['sources'][0]
        out_source['repository_id'] = 'Ecoli Nanobody Toolkit/BC_RJ_SD8'
        out_source['sequence_file_url'] = (
            'https://assets.opencloning.org/open-dna-collections/Ecoli%20Nanobody%20Toolkit/genbank_seq/BC_RJ_SD8.gb'
        )
        seq = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(seq.name, 'BC_RJ_SD8')

    def test_errors(self):

        source = OpenDNACollectionsSource(
            id=0,
            repository_id='Ecoli Nanobody Toolkit/BC_RJ_SD8',
            sequence_file_url='https://assets.opencloning.org/open-dna-collections/Ecoli%20Nanobody%20Toolkit/genbank_seq/hello.txt',
        )
        response = client.post('/repository_id/open_dna_collections', json=source.model_dump())
        self.assertEqual(response.status_code, 400)

        source = OpenDNACollectionsSource(
            id=0,
            repository_id='hello/BC_RJ_SD8',
        )
        response = client.post('/repository_id/open_dna_collections', json=source.model_dump())
        self.assertEqual(response.status_code, 404)
        self.assertIn('invalid openDNA collections collection', response.json()['detail'])

        source = OpenDNACollectionsSource(
            id=0,
            repository_id='Ecoli Nanobody Toolkit/hello',
        )
        response = client.post('/repository_id/open_dna_collections', json=source.model_dump())
        self.assertEqual(response.status_code, 404)
        self.assertIn('plasmid hello not found in Ecoli Nanobody Toolkit', response.json()['detail'])


class NotAllowedExternalUrlTest(unittest.TestCase):
    def tearDown(self):
        pytest.MonkeyPatch().delenv('ALLOWED_EXTERNAL_URLS', raising=False)
        reload(app_settings)
        reload(http_client)

    def test_not_allowed_external_url(self):
        pytest.MonkeyPatch().setenv('ALLOWED_EXTERNAL_URLS', 'https://dummy.com,https://google.com')
        reload(app_settings)
        reload(http_client)
        source = SEVASource(
            id=0,
            repository_id='pSEVA261',
            sequence_file_url='https://seva-plasmids.com/dummy.gbk',
        )
        response = client.post('/repository_id/seva', json=source.model_dump())
        self.assertEqual(response.status_code, 403)
        self.assertIn('not allowed', response.json()['detail'])


class SnapgeneHistoryTest(unittest.TestCase):
    def test_snapgene_history(self):
        file_name = f'{test_files}/gateway_manual_cloning/expression-attP1_2-attP2_2.dna'
        with open(file_name, 'rb') as f:
            response = client.post('/read_snapgene_history', files={'file': f})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('sources', payload)
        self.assertIn('sequences', payload)
        self.assertIn('primers', payload)
        self.assertNotIn('x-warning', response.headers)

    def test_warnings(self):
        file_name = f'{test_files}/circularize.dna'
        with open(file_name, 'rb') as f:
            response = client.post('/read_snapgene_history', files={'file': f})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('sources', payload)
        self.assertIn('sequences', payload)
        self.assertIn('primers', payload)
        self.assertIn('x-warning', response.headers)
        self.assertIn('Stopped at change topology operation', response.headers['x-warning'])

    def test_not_supported_operations(self):
        file_name = f'{test_files}/blunt_linear_ligation.dna'
        with open(file_name, 'rb') as f:
            response = client.post('/read_snapgene_history', files={'file': f})
        self.assertEqual(response.status_code, 501)
