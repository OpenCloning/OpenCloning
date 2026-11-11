import os

from opencloning.syntax import Syntax, Part, open_graph_at_node, is_part_palindromic

from pydantic import ValidationError
import unittest
from pydna.parsers import parse as pydna_parse
from Bio.Restriction import BsaI, BsmBI
import networkx as nx
from pydna.dseqrecord import Dseqrecord

test_files = os.path.join(os.path.dirname(__file__), 'test_files')

moclo_syntax = Syntax.model_validate_json(open(os.path.join(test_files, 'syntax', 'moclo_syntax.json')).read())


class TestSyntax(unittest.TestCase):

    def _get_valid_syntax_dict(self):
        """Helper method to create a minimal valid syntax dictionary."""
        return {
            'syntaxName': 'Test Syntax',
            'assemblyEnzymes': ['BsaI'],
            'domesticationEnzyme': 'BsmBI',
            'relatedDois': ['10.1000/xyz123'],
            'submitters': ['0000-0000-0000-0000'],
            'overhangNames': {'ACGT': 'test_overhang'},
            'parts': [
                {
                    'id': 1,
                    'name': 'part1',
                    'left_overhang': 'ACGT',
                    'right_overhang': 'CGTA',
                },
                {
                    'id': 2,
                    'name': 'part2',
                    'left_overhang': 'TTAA',
                    'right_overhang': 'AAAC',
                },
            ],
        }

    def test_validate_submitters(self):
        syntax_dict = self._get_valid_syntax_dict()
        Syntax.model_validate(syntax_dict)

        # Invalid ORCID formats
        self.assertRaises(
            ValidationError,
            Syntax.model_validate,
            {**syntax_dict, 'submitters': ['0000-0000-0000']},
        )
        self.assertRaises(
            ValidationError,
            Syntax.model_validate,
            {**syntax_dict, 'submitters': ['invalid']},
        )

    def test_validate_overhang_names(self):
        syntax_dict = self._get_valid_syntax_dict()
        Syntax.model_validate(syntax_dict)

        # Invalid overhang names (not >=3 characters)
        self.assertRaises(
            ValidationError,
            Syntax.model_validate,
            {**syntax_dict, 'overhangNames': {'AC': 'test'}},
        )

        Syntax.model_validate({**syntax_dict, 'overhangNames': {'ACGTG': 'test'}})
        Syntax.model_validate({**syntax_dict, 'overhangNames': {'ACGT': 'test'}})
        Syntax.model_validate({**syntax_dict, 'overhangNames': {'ACG': 'test'}})

    def test_validate_parts_unique_ids(self):
        syntax_dict = self._get_valid_syntax_dict()
        Syntax.model_validate(syntax_dict)

        # Invalid parts with duplicate IDs
        self.assertRaises(
            ValidationError,
            Syntax.model_validate,
            {
                **syntax_dict,
                'parts': [
                    {
                        'id': 1,
                        'name': 'part1',
                        'left_overhang': 'ACGT',
                        'right_overhang': 'CGTA',
                    },
                    {
                        'id': 1,
                        'name': 'part2',
                        'left_overhang': 'TTTT',
                        'right_overhang': 'AAAA',
                    },
                ],
            },
        )

    def test_validate_enzyme(self):
        self.assertRaises(
            ValidationError, Syntax.model_validate, {**self._get_valid_syntax_dict(), 'assemblyEnzymes': []}
        )
        self.assertRaises(
            ValidationError,
            Syntax.model_validate,
            {**self._get_valid_syntax_dict(), 'assemblyEnzymes': None},
        )
        self.assertRaises(
            ValidationError,
            Syntax.model_validate,
            {**self._get_valid_syntax_dict(), 'assemblyEnzymes': ['InvalidEnzyme']},
        )
        self.assertRaises(
            ValidationError,
            Syntax.model_validate,
            {**self._get_valid_syntax_dict(), 'domesticationEnzyme': 'InvalidEnzyme'},
        )

        Syntax.model_validate({**self._get_valid_syntax_dict(), 'assemblyEnzymes': ['BsaI']})
        Syntax.model_validate({**self._get_valid_syntax_dict(), 'domesticationEnzyme': 'BsmBI'})
        Syntax.model_validate({**self._get_valid_syntax_dict(), 'domesticationEnzyme': None})
        Syntax.model_validate({**self._get_valid_syntax_dict(), 'domesticationEnzyme': ''})

    def test_get_assembly_enzyme(self):
        self.assertEqual(moclo_syntax.get_assembly_enzymes()[0], BsaI)

    def test_assign_plasmid_to_syntax_part(self):

        # Has a part that is specifically named
        plasmid1 = pydna_parse(f'{test_files}/syntax/pYTK002.gb')[0]
        # Spans multiple parts
        plasmid2 = pydna_parse(f'{test_files}/syntax/pYTK095.gb')[0]
        # Has 2 parts
        plasmid3 = pydna_parse(f'{test_files}/syntax/moclo_ytk_multi_part.gb')[0]
        # Has no parts that match the syntax
        plasmid4 = pydna_parse(f'{test_files}/pAG25.gb')[0]

        result = moclo_syntax.assign_plasmid_to_syntax_part(plasmid1)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['key'], 'CCCT-AACG')
        self.assertEqual(result[0]['longest_feature'].qualifiers['label'], ['ConS'])

        result = moclo_syntax.assign_plasmid_to_syntax_part(plasmid2)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['key'], 'TACA-CCCT')
        self.assertEqual(result[0]['longest_feature'].qualifiers['label'], ['AmpR'])

        result = moclo_syntax.assign_plasmid_to_syntax_part(plasmid3)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['key'], 'ATCC-TGGC')
        self.assertEqual(result[0]['longest_feature'].qualifiers['label'], ['mTurquoise2'])
        self.assertEqual(result[1]['key'], 'CCCT-AACG')
        self.assertEqual(result[1]['longest_feature'].qualifiers['label'], ['Con4'])

        self.assertEqual(moclo_syntax.assign_plasmid_to_syntax_part(plasmid4), [])

        # Does not work with single cut in the plasmid
        result = moclo_syntax.assign_plasmid_to_syntax_part(Dseqrecord('AAggtctcaACGTagagtcacac', circular=True))
        self.assertEqual(len(result), 0)

    def test_assembly_enzyme_multiple(self):
        syntax = Syntax.model_validate({**self._get_valid_syntax_dict(), 'assemblyEnzymes': ['BsaI', 'BsmBI']})
        enzymes = syntax.get_assembly_enzymes()
        self.assertEqual(enzymes[0], BsaI)
        self.assertEqual(enzymes[1], BsmBI)
        self.assertEqual(len(enzymes), 2)

        sequences = [
            Dseqrecord('AAggtctcaACGTagagtcacacaggactactaCGTAagagaccAA', circular=True),  # both BsaI
            Dseqrecord('AAcgtctcaACGTagagtcacacaggactactaCGTAagagacgAA', circular=True),  # both BsmBI
            Dseqrecord('AAggtctcaACGTagagtcacacaggactactaCGTAagagacgAA', circular=True),  # one of each
            Dseqrecord('AAcgtctcaACGTagagtcacacaggactactaCGTAagagaccAA', circular=True),  # one of each
        ]
        for i, seq in enumerate(sequences):
            result = syntax.assign_plasmid_to_syntax_part(seq)
            if i < 2:
                self.assertEqual(len(result), 1)
                self.assertEqual(result[0]['key'], 'ACGT-CGTA')
            else:
                self.assertEqual(len(result), 0)

        # If both parts present, detects only the first one. This is because
        # plasmids won't be digested with both enzymes at the same time (at least in
        # goldenBraid).
        result = syntax.assign_plasmid_to_syntax_part(
            Dseqrecord(str(sequences[0].seq) + 'AAcgtctcaTTAAagagtcacacaggactactaAAACagagacgAA', circular=True)
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['key'], 'ACGT-CGTA')

    def test_assign_palindromic_part(self):
        dummy_syntax = Syntax(
            assembly_enzymes=['BsaI'],
            overhang_names={},
            parts=[
                Part(
                    id=1,
                    name='1',
                    left_overhang='ACGT',
                    right_overhang='TTAA',
                ),
                Part(
                    id=2,
                    name='2',
                    left_overhang='TTAA',
                    right_overhang='AAAC',
                ),
                Part(
                    id=3,
                    name='3',
                    left_overhang='AAAC',
                    right_overhang='ACGT',
                ),
            ],
        )

        seq = Dseqrecord('tgggtctcaACGTagagtcacacaggactactaTTAAagagacctac', circular=True)
        self.assertEqual(
            dummy_syntax.assign_plasmid_to_syntax_part(seq), [{'key': 'ACGT-TTAA', 'longest_feature': None}]
        )


class TestPart(unittest.TestCase):
    def test_part_validation(self):
        part_dict = {
            'id': 1,
            'name': '1',
            'info': 'Assembly connector',
            'glyph': 'three-prime-sticky-restriction-site',
            'left_overhang': 'CCCT',
            'right_overhang': 'AACG',
            'left_inside': 'A',
            'right_inside': 'ATTTTTTTT',
            'left_codon_start': 0,
            'right_codon_start': 0,
            'color': '#84c5de',
        }
        Part.model_validate(part_dict)

        # Invalid overhangs or inside
        for side in ['left', 'right']:
            self.assertRaises(ValidationError, Part.model_validate, {**part_dict, f"{side}_overhang": 'CC'})
            self.assertRaises(ValidationError, Part.model_validate, {**part_dict, f"{side}_overhang": 'NNNN'})
            self.assertRaises(ValidationError, Part.model_validate, {**part_dict, f"{side}_overhang": ''})
            self.assertRaises(ValidationError, Part.model_validate, {**part_dict, f"{side}_inside": 'NNNN'})

            Part.model_validate({**part_dict, f"{side}_inside": 'ATTTTTTTT'})
            Part.model_validate({**part_dict, f"{side}_inside": ''})
            Part.model_validate({**part_dict, f"{side}_codon_start": 0})
            Part.model_validate({**part_dict, f"{side}_codon_start": 1000})

            # Invalid codon start
            self.assertRaises(ValidationError, Part.model_validate, {**part_dict, f"{side}_codon_start": -1})

        # Invalid color
        self.assertRaises(ValidationError, Part.model_validate, {**part_dict, 'color': 'invalid'})

    def test_default_values(self):
        part = Part(
            id=1,
            name='1',
            left_overhang='CCCT',
            right_overhang='AACG',
        )
        self.assertEqual(part.info, '')
        self.assertEqual(part.glyph, '')
        self.assertEqual(part.left_inside, '')
        self.assertEqual(part.right_inside, '')
        self.assertEqual(part.left_codon_start, 0)
        self.assertEqual(part.right_codon_start, 0)
        self.assertEqual(part.color, '')


class TestUtils(unittest.TestCase):
    def test_open_graph_at_node(self):
        graph = nx.DiGraph()
        graph.add_edge('A', 'B')
        graph.add_edge('B', 'C')
        graph.add_edge('C', 'D')
        graph.add_edge('D', 'A')
        open_graph = open_graph_at_node(graph, 'A')
        self.assertEqual(list(open_graph.edges()), [('A', 'B'), ('B', 'C'), ('C', 'D')])

    def test_is_part_palindromic(self):
        self.assertTrue(is_part_palindromic('ACGT', 'TTAA'))
        self.assertFalse(is_part_palindromic('ACGT', 'GCCA'))
