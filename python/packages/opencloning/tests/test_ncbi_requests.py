"""
Some extra tests that are not covered by the main endpoint tests
"""

import opencloning.ncbi_requests as ncbi_requests
import pytest
import respx
from fastapi import HTTPException
import unittest

from Bio.SeqFeature import SimpleLocation


class NcbiAsyncRequestsTest(unittest.IsolatedAsyncioTestCase):

    @respx.mock
    async def test_get_genbank_sequence_subset(self):
        respx.post('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi').respond(503, text='')
        with pytest.raises(HTTPException) as e:
            await ncbi_requests.get_genbank_sequence('blah', 1, 10, 1)
        assert e.value.status_code == 503
        assert e.value.detail == 'NCBI returned an internal server error'

        respx.post('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi').respond(500, text='')
        with pytest.raises(HTTPException) as e:
            await ncbi_requests.get_genbank_sequence('blah', 1, 10, 1)
        assert e.value.status_code == 503
        assert e.value.detail == 'NCBI is down, try again later'

        respx.post('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi').respond(504, text='')
        with pytest.raises(HTTPException) as e:
            await ncbi_requests.get_genbank_sequence('blah', 1, 10, 1)
        assert e.value.status_code == 503
        assert e.value.detail == 'NCBI returned an unexpected error'

    async def test_get_annotations_from_query(self):
        result = await ncbi_requests.get_annotations_from_query('SPAPB1A10.09', 'GCF_000002945.2')
        self.assertEqual(result[0]['symbol'], 'ase1')

    @respx.mock
    async def test_get_annotations_from_query_errors(self):
        def get_url(assembly_accession):
            return f'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/{assembly_accession}/annotation_report'

        respx.get(get_url('blah')).respond(404, text='')
        with pytest.raises(HTTPException) as e:
            await ncbi_requests.get_annotations_from_query('bluh', 'blah')
        assert e.value.status_code == 404
        assert e.value.detail == 'wrong accession number'

        respx.get(get_url('blah2')).respond(200, json={'dummy': 'data'})
        with pytest.raises(HTTPException) as e:
            await ncbi_requests.get_annotations_from_query('bluh2', 'blah2')
        assert e.value.status_code == 404
        assert e.value.detail == 'query "bluh2" gave no results'

    @respx.mock
    async def test_get_annotation_from_locus_tag_errors(self):
        def get_url(assembly_accession):
            return f'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/{assembly_accession}/annotation_report'

        respx.get(get_url('blah3')).respond(404, text='')
        with pytest.raises(HTTPException) as e:
            await ncbi_requests.get_annotation_from_locus_tag('bluh3', 'blah3')
        assert e.value.status_code == 404
        assert e.value.detail == 'wrong accession number'

        respx.get(get_url('blah4')).respond(200, json={'dummy': 'data'})
        with pytest.raises(HTTPException) as e:
            await ncbi_requests.get_annotation_from_locus_tag('bluh4', 'blah4')
        assert e.value.status_code == 404
        assert e.value.detail == 'query "bluh4" gave no results'

        respx.get(get_url('blah5')).respond(
            200, json={'reports': [{'annotation': {'locus_tag': 'bluh5'}}, {'annotation': {'locus_tag': 'bluh5'}}]}
        )
        with pytest.raises(HTTPException) as e:
            await ncbi_requests.get_annotation_from_locus_tag('bluh5', 'blah5')
        assert e.value.status_code == 400
        assert e.value.detail == 'multiple matches for locus_tag'

    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    async def test_empty_get_assembly_accession_from_sequence_accession(self):
        # For accessions that are not linked to assemblies
        self.assertEqual([], await ncbi_requests.get_assembly_accession_from_sequence_accession('DQ208311.2'))

    @pytest.mark.xfail(reason='waiting on https://github.com/ncbi/datasets/issues/380#issuecomment-2231142816')
    async def test_get_assembly_accession_from_sequence_accession(self):
        # For accessions that are linked to assemblies
        self.assertEqual(
            ['GCF_000002945.2', 'GCF_000002945.1'],
            await ncbi_requests.get_assembly_accession_from_sequence_accession('NC_003424.3'),
        )

    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    async def test_get_genome_region_from_annotation(self):
        annotations = await ncbi_requests.get_annotations_from_query('aldolase', 'GCF_000146045.2')
        annotation = next(a for a in annotations if a['locus_tag'] == 'YDR294C')
        seq = await ncbi_requests.get_genome_region_from_annotation(annotation, 1000, 1000)
        self.assertEqual(seq.source.locus_tag, 'YDR294C')
        self.assertEqual(seq.source.gene_id, 851888)
        self.assertEqual(seq.source.repository_id, 'NC_001136.10')
        self.assertEqual(seq.source.assembly_accession, 'GCF_000146045.2')
        self.assertEqual(seq.source.coordinates, SimpleLocation(1049458, 1053228, -1))
        self.assertEqual(len(seq), 3770)

    @pytest.mark.flaky(reruns=2, reruns_delay=2)
    async def test_get_info_from_annotation(self):
        example_annotation = {
            'gene_id': '851888',
            'symbol': 'DPL1',
            'name': 'sphinganine-1-phosphate aldolase DPL1',
            'gene_type': 'protein-coding',
            'locus_tag': 'YDR294C',
            'genomic_regions': [
                {
                    'gene_range': {
                        'accession_version': 'NC_001136.10',
                        'range': [{'begin': '1050459', 'end': '1052228', 'orientation': 'minus'}],
                    }
                }
            ],
            'transcripts': [
                {
                    'accession_version': 'NM_001180602.1',
                    'name': 'sphinganine-1-phosphate aldolase DPL1',
                    'cds': {'accession_version': 'NM_001180602.1'},
                    'genomic_locations': [
                        {
                            'genomic_accession_version': 'NC_001136.10',
                            'genomic_range': {'begin': '1050459', 'end': '1052228', 'orientation': 'minus'},
                        }
                    ],
                    'protein': {
                        'accession_version': 'NP_010580.1',
                        'name': 'sphinganine-1-phosphate aldolase DPL1',
                        'length': 589,
                    },
                }
            ],
            'chromosomes': ['IV'],
            'annotations': [{'assembly_accession': 'GCF_000146045.2'}],
        }
        start, end, strand, gene_id, sequence_accession, locus_tag, assembly_accession = (
            ncbi_requests.get_info_from_annotation(example_annotation)
        )
        self.assertEqual(start, 1050459)
        self.assertEqual(end, 1052228)
        self.assertEqual(strand, -1)
        self.assertEqual(gene_id, 851888)
        self.assertEqual(sequence_accession, 'NC_001136.10')
        self.assertEqual(locus_tag, 'YDR294C')
        self.assertEqual(assembly_accession, 'GCF_000146045.2')

        # If assembly accession is not present, it should be None
        example_annotation['annotations'] = []
        start, end, strand, gene_id, sequence_accession, locus_tag, assembly_accession = (
            ncbi_requests.get_info_from_annotation(example_annotation)
        )
        self.assertEqual(assembly_accession, None)

        del example_annotation['annotations']
        start, end, strand, gene_id, sequence_accession, locus_tag, assembly_accession = (
            ncbi_requests.get_info_from_annotation(example_annotation)
        )
        self.assertEqual(assembly_accession, None)

        # If gene id or locus tag is not present, it should be None
        del example_annotation['gene_id']
        del example_annotation['locus_tag']
        start, end, strand, gene_id, sequence_accession, locus_tag, assembly_accession = (
            ncbi_requests.get_info_from_annotation(example_annotation)
        )
        self.assertEqual(gene_id, None)
        self.assertEqual(locus_tag, None)

    async def test_get_genbank_sequence_errors(self):
        with pytest.raises(ValueError) as e:
            await ncbi_requests.get_genbank_sequence('NC_003424.3', None, 10, 1)
        assert e.value.args[0] == 'start, end, and strand must either all be None or none be None'


def test_eutils_params_adds_api_key(monkeypatch):
    params = {'db': 'nuccore'}
    monkeypatch.setattr(ncbi_requests.settings, 'NCBI_API_KEY', None)
    assert ncbi_requests._eutils_params(params) == params
    monkeypatch.setattr(ncbi_requests.settings, 'NCBI_API_KEY', 'secret')
    assert ncbi_requests._eutils_params(params) == {'db': 'nuccore', 'api_key': 'secret'}
    assert ncbi_requests._datasets_headers() == {'api-key': 'secret'}
