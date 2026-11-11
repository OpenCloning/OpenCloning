import os
import unittest
from pydna.opencloning_models import id_mode
from fastapi.testclient import TestClient
import json
from pydna.dseqrecord import Dseqrecord
from pydna.parsers import parse
import opencloning.main as _main
from pydna.opencloning_models import CloningStrategy as PydnaCloningStrategy
from opencloning.dna_functions import format_sequence_genbank, read_dsrecord_from_json
from opencloning_linkml.datamodel import TextFileSequence, CloningStrategy as BaseCloningStrategy
from opencloning_linkml._version import __version__ as schema_version
from opencloning._version import __version__ as backend_version
import pytest
from importlib import reload
from opencloning.syntax import Syntax

test_files = os.path.join(os.path.dirname(__file__), 'test_files')


client = TestClient(_main.app)


class VersionTest(unittest.TestCase):

    def tearDown(self):
        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.delenv('OPENCLONING_VERSION', raising=False)
        reload(_main)

    def test_version_empty(self):
        response = client.get('/version')
        self.assertEqual(response.status_code, 200)
        resp = response.json()
        self.assertEqual(resp['backend_version'], backend_version)
        self.assertEqual(resp['schema_version'], schema_version)
        self.assertEqual(resp['opencloning_version'], None)
        self.assertEqual(resp['opencloning_version_int'], None)

        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setenv('OPENCLONING_VERSION', '1.0.0')
        response = client.get('/version')
        self.assertEqual(response.status_code, 200)
        resp = response.json()
        self.assertEqual(resp['opencloning_version'], '1.0.0')
        self.assertEqual(resp['opencloning_version_int'], 10000)

        monkeypatch.setenv('OPENCLONING_VERSION', '0.2.3')
        response = client.get('/version')
        self.assertEqual(response.status_code, 200)
        resp = response.json()
        self.assertEqual(resp['opencloning_version'], '0.2.3')
        self.assertEqual(resp['opencloning_version_int'], 203)

        monkeypatch.setenv('OPENCLONING_VERSION', 'blah')
        response = client.get('/version')
        self.assertEqual(response.status_code, 200)
        resp = response.json()
        self.assertEqual(resp['opencloning_version'], 'blah')
        self.assertEqual(resp['opencloning_version_int'], None)


class ValidatorTest(unittest.TestCase):
    def test_validator(self):
        with open(f'{test_files}/homologous_recombination.json') as ins:
            # Read it to json
            data = json.load(ins)
        BaseCloningStrategy.model_validate(data)


class ValidateEndPointTest(unittest.TestCase):

    def test_validate(self):
        # Valid file
        with open(f'{test_files}/homologous_recombination.json') as ins:
            # Read it to json
            data = json.load(ins)

        # To avoid having to change this every time the dependency
        # is updated.
        data['schema_version'] = schema_version

        response = client.post('/validate', json=data)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('x-warning', response.headers)

        # Invalid file
        data['dummy'] = 'dummy'
        response = client.post('/validate', json=data)
        self.assertEqual(response.status_code, 422)

        # Completely wrong file
        data = {'dummy': 'dummy'}
        response = client.post('/validate', json=data)
        self.assertEqual(response.status_code, 422)

        # Old format file
        with open(f'{test_files}/homologous_recombination_old_format.json') as ins:
            # Read it to json
            data = json.load(ins)
        response = client.post('/validate', json=data)
        self.assertEqual(response.status_code, 200)
        self.assertIn('x-warning', response.headers)
        self.assertNotIn('contained an error', response.headers['x-warning'])
        self.assertIn(
            'The cloning strategy is in a previous version of the model and has been migrated to the latest version.',
            response.headers['x-warning'],
        )
        # The data has been migrated to the latest version
        cs = BaseCloningStrategy.model_validate(response.json())
        self.assertEqual(cs.schema_version, schema_version)

        # File with errors
        with open(f'{test_files}/bug_fixing/old_format/digestion_spanning_origin.json') as ins:
            # Read it to json
            data = json.load(ins)
        response = client.post('/validate', json=data)
        self.assertEqual(response.status_code, 200)
        self.assertIn('x-warning', response.headers)
        self.assertIn('previous version', response.headers['x-warning'])
        self.assertIn('contained an error', response.headers['x-warning'])

        # The right source has been turned into a template
        data = response.json()
        seq = next(s for s in data['sequences'] if s['id'] == 3)
        self.assertEqual(seq['type'], 'TemplateSequence')


class RenameSequenceTest(unittest.TestCase):

    def test_rename(self):
        dseqr = Dseqrecord('ACGT')
        dseqr.name = 'original'
        json_seq = format_sequence_genbank(dseqr)
        json_seq.id = 0
        response = client.post('/rename_sequence?name=hello', json=json_seq.model_dump())
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        dseq_resp = read_dsrecord_from_json(TextFileSequence.model_validate(payload))
        self.assertEqual(dseq_resp.name, 'hello')

    def test_error(self):
        """Does not allow spaces"""
        dseqr = Dseqrecord('ACGT')
        dseqr.name = 'original'
        json_seq = format_sequence_genbank(dseqr)
        json_seq.id = 0
        response = client.post('/rename_sequence?name=hello world', json=json_seq.model_dump())
        self.assertEqual(response.status_code, 422)


class RestrictionEnzymeListTest(unittest.TestCase):

    def test_restriction_enzyme_list(self):
        response = client.get('/restriction_enzyme_list')
        assert response.status_code == 200
        assert 'EcoRI' in response.json()['enzyme_names']


class AlignSangerTest(unittest.TestCase):

    def test_align_sanger(self):
        seq = parse(os.path.join(test_files, 'GIN11M86.gb'))[0].looped()
        json_seq = format_sequence_genbank(seq)
        json_seq.id = 0
        trace = 'ttgcagcattttgtctttctataaaaatgtgtcgttcctttttttcattttttggcgcgtcgcctcggggtcgtatagaatatg'
        response = client.post('/align_sanger', json={'sequence': json_seq.model_dump(), 'traces': [trace]})
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_errors(self):
        seq = Dseqrecord('ACGT', circular=True)
        json_seq = format_sequence_genbank(seq)
        json_seq.id = 0
        response = client.post('/align_sanger', json={'sequence': json_seq.model_dump(), 'traces': ['ACGT']})
        assert response.status_code == 400


class ValidateSyntaxTest(unittest.TestCase):
    def test_validate_syntax(self):
        syntax = Syntax.model_validate_json(open(os.path.join(test_files, 'syntax', 'moclo_syntax.json')).read())
        response = client.post('/validate_syntax', json=syntax.model_dump())
        assert response.status_code == 200

    def test_error(self):
        syntax = Syntax.model_validate_json(open(os.path.join(test_files, 'syntax', 'moclo_syntax.json')).read())
        syntax.assemblyEnzymes = []
        response = client.post('/validate_syntax', json=syntax.model_dump())
        assert response.status_code == 422


class NormalizeCloningStrategyTest(unittest.TestCase):
    def test_normalize_cloning_strategy(self):
        with open(f'{test_files}/cs_wrong.json') as ins:
            data = json.load(ins)
        response = client.post('/normalize_cloning_strategy', json=data)
        assert response.status_code == 200
        with id_mode(use_python_internal_id=False):
            normalized_by_pydna = PydnaCloningStrategy.model_validate(data).normalize().model_dump()
        assert response.json() == normalized_by_pydna
