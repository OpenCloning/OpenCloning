from fastapi import HTTPException
import unittest
import os
import respx
from pydna.dseq import Dseq
from Bio.Seq import reverse_complement
from opencloning_linkml.datamodel import TextFileSequence, SequenceFileFormat

from opencloning.dna_functions import (
    custom_file_parser,
    correct_name,
    get_sequence_from_euroscarf_url,
    oligonucleotide_hybridization_overhangs,
    get_sequences_from_file_url,
    read_dsrecord_from_json,
)

test_files = os.path.join(os.path.dirname(__file__), 'test_files')


class PermisiveParserWithApeTest(unittest.TestCase):
    def test_permisive_parser_with_ape_circular(self):
        with open(f'{test_files}/P2RP3.ape', 'r') as f:
            plasmid = custom_file_parser(f, 'genbank')[0]
            # Since APE files are not correctly gb formatted (as of 2024-11-27)
            # the Bio.SeqIO.parse may not recognize the topology of the plasmid
            # Our custom permissive parser should be then used and the topology
            # parameter properly recognized
            self.assertEqual(plasmid.circular, True)

    def test_permisive_parser_with_ape_linear(self):
        with open(f'{test_files}/P2RP3_linear.ape', 'r') as f:
            # I manually changed the topology of the plasmid to linear
            plasmid = custom_file_parser(f, 'genbank')[0]
            self.assertEqual(plasmid.circular, False)

    def test_permisive_parser_no_topology(self):
        with open(f'{test_files}/ase1_no_topology.gb', 'r') as f:
            plasmid = custom_file_parser(f, 'genbank')[0]
            self.assertEqual(plasmid.circular, False)

    def test_custom_file_parser_body_error(self):
        with open(f'{test_files}/ase1_body_error.gb', 'r') as f:
            with self.assertRaises(ValueError):
                custom_file_parser(f, 'genbank')


class PermissiveParserOtherTest(unittest.TestCase):
    def test_permissive_parser_other(self):
        with open(f'{test_files}/pSEVA427.gbk', 'r') as f:
            plasmid = custom_file_parser(f, 'genbank')[0]
            self.assertEqual(plasmid.circular, True)

    def test_permissive_parser_base_count_misplaced(self):
        with open(f'{test_files}/base_count_misplaced.gb', 'r') as f:
            custom_file_parser(f, 'genbank')[0]


class MinorFunctionsTest(unittest.TestCase):
    def test_correct_name(self):
        file = f'{test_files}/addgene-plasmid-39296-sequence-49545.gbk'
        with open(file, 'r') as f:
            dseq = custom_file_parser(f, 'genbank')[0]
        correct_name(dseq)
        self.assertEqual(dseq.name, 'pFA6a-kanMX6')


class MinorFunctionsAsyncTest(unittest.IsolatedAsyncioTestCase):
    @respx.mock
    async def test_error_euroscarf(self):

        # If the format of the page would change, these errors should be raised
        respx.get('http://www.euroscarf.de/plasmid_details.php').respond(200, text='')
        with self.assertRaises(HTTPException) as e:
            await get_sequence_from_euroscarf_url('blah')
        self.assertEqual(e.exception.status_code, 503)
        self.assertIn('Could not retrieve plasmid details', e.exception.detail)

        respx.get('http://www.euroscarf.de/plasmid_details.php').respond(200, text='<body>missing other</body>')
        with self.assertRaises(HTTPException) as e:
            await get_sequence_from_euroscarf_url('blah')
        self.assertEqual(e.exception.status_code, 503)
        self.assertIn('Could not retrieve plasmid details', e.exception.detail)


class OligonucleotideHybridizationTest(unittest.TestCase):

    def test_oligonucleotide_hybridization_overhangs(self):
        self.assertEqual(
            [-4], oligonucleotide_hybridization_overhangs('CTCGatcggtgtgaaaagtcagtatccagtcgtgtag', 'tttcacaccgat', 12)
        )
        self.assertEqual(
            [21], oligonucleotide_hybridization_overhangs('tttcacaccgat', 'CTCGatcggtgtgaaaagtcagtatccagtcgtgtag', 12)
        )

        for ovhgs in [[3, 0], [0, 2], [3, 2], [-3, -2], [3, -2]]:
            dseq = Dseq.from_full_sequence_and_overhangs('GGACAATATATGGCAC', *ovhgs)
            self.assertEqual([ovhgs[0]], oligonucleotide_hybridization_overhangs(dseq.watson, dseq.crick, 10))
            self.assertEqual([ovhgs[1]], oligonucleotide_hybridization_overhangs(dseq.crick, dseq.watson, 10))

        seq1 = 'GGACAATATATGGCAC'
        seq2 = 'a' + reverse_complement(seq1)
        seq1 += 'c'

        self.assertRaises(ValueError, oligonucleotide_hybridization_overhangs, seq1, seq2, 10)
        self.assertRaises(
            ValueError, oligonucleotide_hybridization_overhangs, reverse_complement(seq1), reverse_complement(seq2), 10
        )


class GetSequencesFromFileUrlTest(unittest.IsolatedAsyncioTestCase):
    @respx.mock
    async def test_get_sequences_from_file_url_error(self):
        respx.get('https://assets.opencloning.org/annotated-igem-distribution/blah.gb').respond(503, text='')
        with self.assertRaises(HTTPException) as e:
            await get_sequences_from_file_url('https://assets.opencloning.org/annotated-igem-distribution/blah.gb')
        self.assertEqual(e.exception.status_code, 503)
        self.assertIn('the external server (not OpenCloning) returned an error', e.exception.detail)

        respx.get('https://assets.opencloning.org/annotated-igem-distribution/blah.gb').respond(404, text='')
        with self.assertRaises(HTTPException) as e:
            await get_sequences_from_file_url('https://assets.opencloning.org/annotated-igem-distribution/blah.gb')
        self.assertEqual(e.exception.status_code, 404)
        self.assertIn('file requested from url not found', e.exception.detail)


class ReadDsrecordFromJsonTest(unittest.TestCase):
    def test_read_dsrecord_from_json_error(self):
        seq = TextFileSequence(
            id=1,
            file_content='',
            sequence_file_format=SequenceFileFormat('genbank'),
            overhang_crick_3prime=0,
            overhang_watson_3prime=0,
        )
        with self.assertRaises(HTTPException) as e:
            read_dsrecord_from_json(seq)
        self.assertEqual(e.exception.status_code, 422)
        self.assertIn('The file for sequence with id 1 is not in a valid genbank format: ', e.exception.detail)

    def test_read_dsrecord_from_json_with_overhangs(self):
        # Name is parsed as well as sequence
        with open(f'{test_files}/all_cre_lox.gb', 'r') as f:
            content = f.read()
        seq = TextFileSequence(
            id=1,
            file_content=content,
            sequence_file_format=SequenceFileFormat('genbank'),
            overhang_crick_3prime=1,
            overhang_watson_3prime=2,
        )
        dseqr = read_dsrecord_from_json(seq)
        self.assertEqual(dseqr.seq.ovhg, 1)
        self.assertEqual(dseqr.seq.watson_ovhg, 2)
        self.assertEqual(dseqr.name, 'all_cre_lox')
