from fastapi.testclient import TestClient
from opencloning_linkml.datamodel import AssemblyFragment
from pydna.parsers import parse as pydna_parse
from Bio.Restriction.Restriction import CommOnly
from pydna.dseqrecord import Dseqrecord
import unittest
from pydna.dseq import Dseq
from pydna.cre_lox import LOXP_SEQUENCE
import os

from opencloning.dna_functions import format_sequence_genbank, read_dsrecord_from_json
import opencloning.main as _main
from opencloning_linkml.datamodel import (
    PCRSource,
    Primer as PrimerModel,
    TextFileSequence,
    LigationSource,
    HomologousRecombinationSource,
    GibsonAssemblySource,
    RestrictionAndLigationSource,
    CRISPRSource,
    GatewaySource,
    CreLoxRecombinationSource,
    RecombinaseSource,
    Recombinase,
)

test_files = os.path.join(os.path.dirname(__file__), 'test_files')

client = TestClient(_main.app)


def get_all_feature_labels(seq: Dseqrecord):
    return [f.qualifiers['label'][0] for f in seq.features]


class LigationTest(unittest.TestCase):
    def test_ligation(self):
        """Test whether assembly is executed when the order is provided"""
        # Load dummy sequence

        initial_sequence = pydna_parse(f'{test_files}/dummy_EcoRI.fasta')[0]

        # Restriction cut
        enzyme = CommOnly.format('EcoRI')
        output_list: list[Dseqrecord] = initial_sequence.cut([enzyme])

        # Convert to json to use as input
        model_seqs = [format_sequence_genbank(seq) for seq in output_list]
        model_seqs[0].id = 1
        model_seqs[1].id = 2
        json_seqs = [seq.model_dump() for seq in model_seqs]

        # Assign ids to define deterministic assembly
        source = LigationSource(
            id=0,
            input=[
                AssemblyFragment(sequence=1, left_location=None, right_location='8..11', reverse_complemented=False),
                AssemblyFragment(sequence=2, left_location='1..4', right_location=None, reverse_complemented=False),
            ],
            circular=False,
        )

        data = {'source': source.model_dump(), 'sequences': json_seqs}
        response = client.post('/ligation', json=data)
        payload = response.json()

        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        sources = [LigationSource.model_validate(s) for s in payload['sources']]

        self.assertEqual(len(resulting_sequences), 1)
        self.assertEqual(len(sources), 1)

        # Check that the assembly is correct
        self.assertEqual(resulting_sequences[0].seq, initial_sequence.seq)
        self.assertEqual(sources[0], source)

        # Check that the inverse assembly will not pass
        source = LigationSource(
            id=0,
            input=[
                AssemblyFragment(sequence=1, left_location=None, right_location='9..11', reverse_complemented=False),
                AssemblyFragment(sequence=2, left_location='2..4', right_location=None, reverse_complemented=False),
            ],
            circular=False,
        )
        data = {'source': source.model_dump(), 'sequences': json_seqs}
        response = client.post('/ligation', json=data)
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data['detail'], 'The provided assembly is not valid.')

        # Check that the circular assembly does not pass either
        source = LigationSource(
            id=0,
            input=[
                AssemblyFragment(sequence=1, left_location=None, right_location='8..11', reverse_complemented=False),
                AssemblyFragment(sequence=2, left_location='1..4', right_location=None, reverse_complemented=False),
            ],
            circular=True,
        )
        data = {'source': source.model_dump(), 'sequences': json_seqs}
        response = client.post('/ligation', json=data)
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data['detail'], 'The provided assembly is not valid.')

        # Check no ligation
        source = LigationSource(id=0)
        inputs = [format_sequence_genbank(seq).model_dump() for seq in [Dseqrecord('ATCG'), Dseqrecord('ATCG')]]
        data = {'source': source.model_dump(), 'sequences': inputs}
        response = client.post('/ligation', json=data)
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data['detail'], 'No ligations were found.')

    def test_allow_partial_overlap(self):
        """Test that the allow_partial_overlap parameter works."""
        # Partial ligation
        a = Dseqrecord(Dseq.from_full_sequence_and_overhangs('AAAGAA', 0, 3))
        b = Dseqrecord(Dseq.from_full_sequence_and_overhangs('AAAGAA', 3, 0))
        source = LigationSource(id=0)
        json_seqs = [format_sequence_genbank(seq).model_dump() for seq in [a, b]]
        data = {'source': source.model_dump(), 'sequences': json_seqs}
        response = client.post('/ligation', json=data, params={'allow_partial_overlap': True})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        self.assertEqual(len(resulting_sequences), 1)
        self.assertEqual(str(resulting_sequences[0].seq), 'AAAGAAAGAA')

    def test_linear_assembly_no_order(self):
        """Test that when order is not provided, no duplicate sequences are returned as options."""

        # Load Ase1 sequence
        initial_sequence = pydna_parse(f'{test_files}/dummy_EcoRI.fasta')[0]

        # Restriction cut
        enzyme = CommOnly.format('EcoRI')
        output_list: list[Dseqrecord] = initial_sequence.cut([enzyme])

        # Convert to json to use as input
        json_seqs = [format_sequence_genbank(seq) for seq in output_list]
        json_seqs[0].id = 1
        json_seqs[1].id = 2
        json_seqs = [seq.model_dump() for seq in json_seqs]

        # We don't set the fragments_inverted, so we will get all possibilities (in this case only one)
        source = LigationSource(id=0)
        data = {'source': source.model_dump(), 'sequences': json_seqs}
        response = client.post('/ligation', json=data)
        payload = response.json()

        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        sources = [LigationSource.model_validate(s) for s in payload['sources']]

        self.assertEqual(len(resulting_sequences), 1)
        self.assertEqual(len(sources), 1)

        # Check that the assembly is correct
        self.assertEqual(resulting_sequences[0].seq, initial_sequence.seq)

    def test_circular_assembly_no_order(self):
        initial_sequence = pydna_parse(f'{test_files}/pFA6a-hphMX6.gb')[0]

        # Restriction cut
        output_list: list[Dseqrecord] = initial_sequence.cut([CommOnly.format('AscI'), CommOnly.format('SacI')])

        # Convert to json to use as input
        json_seqs = [format_sequence_genbank(seq) for seq in output_list]
        json_seqs[0].id = 1
        json_seqs[1].id = 2
        json_seqs = [seq.model_dump() for seq in json_seqs]

        source = LigationSource(id=0)
        data = {'source': source.model_dump(), 'sequences': json_seqs}
        response = client.post('/ligation', json=data)
        payload = response.json()
        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        sources = [LigationSource.model_validate(s) for s in payload['sources']]

        self.assertEqual(len(resulting_sequences), 1)
        self.assertEqual(len(sources), 1)

        # Check that the assembly is correct, the sequences cannot be compared with the equal operator since their origin is different
        self.assertEqual(resulting_sequences[0].seq.seguid(), initial_sequence.seq.seguid())

    def test_circularization(self):
        enzyme = CommOnly.format('EcoRI')
        fragment = Dseqrecord('AGAATTC', circular=True).cut(enzyme)[0]
        json_seqs = [format_sequence_genbank(fragment)]
        json_seqs[0].id = 1
        json_seqs = [seq.model_dump() for seq in json_seqs]
        source = LigationSource(id=0)
        data = {'source': source.model_dump(), 'sequences': json_seqs}
        response = client.post('/ligation', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        self.assertEqual(resulting_sequences[0].seq, fragment.looped().seq)

    def test_blunt_ligation(self):
        seqs = [Dseqrecord('ATCC', circular=False), Dseqrecord('TAAT', circular=False)]
        json_seqs = [format_sequence_genbank(seq) for seq in seqs]
        json_seqs[0].id = 1
        json_seqs[1].id = 2
        json_seqs = [seq.model_dump() for seq in json_seqs]
        source = LigationSource(id=0)
        data = {'source': source.model_dump(), 'sequences': json_seqs}
        response = client.post('/ligation', json=data, params={'blunt': True})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        self.assertEqual(len(resulting_sequences), 2)

        # We submit one of the resulting sources, to check that it does the
        # blunt ligation without adding the request parameter
        source = payload['sources'][0]
        response = client.post('/ligation', json={'source': source, 'sequences': json_seqs})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resulting_sequences2 = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        self.assertEqual(len(resulting_sequences2), 1)
        self.assertEqual(resulting_sequences2[0].seq, resulting_sequences[0].seq)

    def test_blunt_circularization(self):
        seqs = [Dseqrecord('ATCC', circular=False)]
        json_seqs = [format_sequence_genbank(seq) for seq in seqs]
        json_seqs[0].id = 1
        json_seqs = [seq.model_dump() for seq in json_seqs]
        source = LigationSource(id=0)
        data = {'source': source.model_dump(), 'sequences': json_seqs}
        response = client.post('/ligation', json=data, params={'blunt': True})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        self.assertEqual(len(resulting_sequences), 1)
        self.assertEqual(resulting_sequences[0].seq, seqs[0].looped().seq)

    def test_mixed_ligation(self):
        seqs = [
            Dseqrecord(Dseq.from_full_sequence_and_overhangs('ACCGTA', -3, 0)),
            Dseqrecord(Dseq.from_full_sequence_and_overhangs('AAGACC', 0, -3)),
        ]
        json_seqs = [format_sequence_genbank(seq) for seq in seqs]
        json_seqs[0].id = 1
        json_seqs[1].id = 2
        json_seqs = [seq.model_dump() for seq in json_seqs]
        source = LigationSource(id=0)
        data = {'source': source.model_dump(), 'sequences': json_seqs}
        response = client.post('/ligation', json=data, params={'blunt': True})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        self.assertEqual(len(resulting_sequences), 1)
        self.assertEqual(resulting_sequences[0].seguid(), (seqs[1] + seqs[0]).looped().seguid())

    def test_too_many_assemblies(self):
        # Too many paths
        seqs = [Dseqrecord('ATCC', circular=False)] * 20
        json_seqs = [format_sequence_genbank(seq) for seq in seqs]
        json_seqs = [seq.model_dump() for seq in json_seqs]
        for i in range(len(json_seqs)):
            json_seqs[i]['id'] = i
        source = LigationSource(id=0)
        data = {'source': source.model_dump(), 'sequences': json_seqs}
        response = client.post('/ligation', json=data, params={'blunt': True})
        self.assertEqual(response.status_code, 400)
        self.assertTrue('Too many possible paths' in response.json()['detail'])


class PCRTest(unittest.TestCase):
    def test_pcr(self):

        template = Dseqrecord(Dseq('TTTTACGTACGTAAAAAAGCGCGCGCTTTTT'))

        json_seq = format_sequence_genbank(template)
        json_seq.id = 1

        submitted_source = PCRSource(id=0)

        primer_fwd = PrimerModel(sequence='ACGTACGT', id=2, name='forward')

        primer_rvs = PrimerModel(sequence='GCGCGCGC', id=3, name='reverse')

        data = {
            'source': submitted_source.model_dump(),
            'sequences': [json_seq.model_dump()],
            'primers': [primer_fwd.model_dump(), primer_rvs.model_dump()],
        }
        response = client.post('/pcr', json=data, params={'minimal_annealing': 8})
        payload = response.json()

        sources = [PCRSource.model_validate(s) for s in payload['sources']]
        sequences = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]

        # Only one possible output
        self.assertEqual(len(sources), 1)
        self.assertEqual(len(sequences), 1)
        dseq1 = sequences[0]
        source1 = sources[0]

        # No annotations
        self.assertEqual(len(dseq1.features), 0)

        # Primer annotations can be added
        data['source']['add_primer_features'] = True
        response = client.post('/pcr', json=data, params={'minimal_annealing': 8})
        payload = response.json()
        dseq2 = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(len(dseq2.features), 2)
        self.assertEqual(dseq2.features[0].type, 'primer_bind')
        self.assertEqual(dseq2.features[1].type, 'primer_bind')

        # The labels are set to primer names
        self.assertEqual(dseq2.features[0].qualifiers['label'], [primer_fwd.name])
        self.assertEqual(dseq2.features[1].qualifiers['label'], [primer_rvs.name])

        # The sequence matches what we expect
        self.assertEqual(str(dseq1.seq), 'ACGTACGTAAAAAAGCGCGCGC')

        # Now we submit the deterministic PCR (we already know which fragment we want)

        data = {
            'source': source1.model_dump(),
            'sequences': [json_seq.model_dump()],
            'primers': [primer_fwd.model_dump(), primer_rvs.model_dump()],
        }
        response = client.post('/pcr', json=data)
        payload = response.json()

        sources = [PCRSource.model_validate(s) for s in payload['sources']]
        sequences = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]

        # Only one possible output
        self.assertEqual(len(sources), 1)
        self.assertEqual(len(sequences), 1)
        dseq2 = sequences[0]
        source2 = sources[0]
        self.assertEqual(source1, source2)
        self.assertEqual(str(dseq2.seq), 'ACGTACGTAAAAAAGCGCGCGC')

        # No annotations
        self.assertEqual(len(dseq2.features), 0)

        # Primer annotations can be added
        data['source']['add_primer_features'] = True
        response = client.post('/pcr', json=data)
        payload = response.json()
        dseq3 = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertEqual(len(dseq3.features), 2)

    def test_same_primer_twice(self):
        """
        Special case where you want only one sequence to be returned, since otherwise
        the same sequence is returned as a forward and reverse complement.
        """
        template = Dseqrecord(Dseq('TTTTACGTACGTAAAAAAACGTACGTTTTTT'))

        json_seq = format_sequence_genbank(template)
        json_seq.id = 1

        submitted_source = PCRSource(id=0)

        primer_fwd = PrimerModel(sequence='ACGTACGT', id=2, name='forward')

        data = {
            'source': submitted_source.model_dump(),
            'sequences': [json_seq.model_dump()],
            'primers': [primer_fwd.model_dump(), primer_fwd.model_dump()],
        }

        response = client.post('/pcr', json=data, params={'minimal_annealing': 8})
        payload = response.json()
        self.assertEqual(response.status_code, 200)

        sources = [PCRSource.model_validate(s) for s in payload['sources']]
        sequences = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
        self.assertEqual(len(sources), 1)
        self.assertEqual(len(sequences), 1)

    def test_wrong_primers(self):

        template = Dseqrecord(Dseq('TTTTACGTACGTAAAAAAGCGCGCGCTTTTT'))
        json_seq = format_sequence_genbank(template)
        json_seq.id = 1

        submitted_source = PCRSource(id=0)

        primer_fwd = PrimerModel(sequence='CCCCCCCC', id=2, name='forward')

        primer_rvs = PrimerModel(sequence='GCGCGCGC', id=3, name='reverse')

        # Without specifying the pair
        data = {
            'source': submitted_source.model_dump(),
            'sequences': [json_seq.model_dump()],
            'primers': [primer_fwd.model_dump(), primer_rvs.model_dump()],
        }
        response = client.post('/pcr', json=data, params={'minimal_annealing': 8})
        payload = response.json()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            payload['detail'], 'No pair of annealing primers was found. Try changing the annealing settings.'
        )

        # We submit the right pair of primers, but the wrong annealing information

        primer_fwd = PrimerModel(sequence='ACGTACGT', id=2, name='forward')

        submitted_source = PCRSource(
            id=0,
            input=[
                AssemblyFragment(sequence=1, left_location=None, right_location='1..8', reverse_complemented=False),
                AssemblyFragment(
                    sequence=2, left_location='5..12', right_location='19..26', reverse_complemented=False
                ),
                AssemblyFragment(sequence=3, left_location='1..8', right_location=None, reverse_complemented=True),
            ],
            circular=False,
        )

        data = {
            'source': submitted_source.model_dump(),
            'sequences': [json_seq.model_dump()],
            'primers': [primer_fwd.model_dump(), primer_rvs.model_dump()],
        }
        response = client.post('/pcr', json=data)
        payload = response.json()
        self.assertEqual(response.status_code, 400)

        # This is the wrong annealing info
        submitted_source = PCRSource(
            id=0,
            input=[
                AssemblyFragment(sequence=3, left_location='1..8', right_location=None, reverse_complemented=True),
                AssemblyFragment(
                    sequence=2, left_location='5..12', right_location='19..26', reverse_complemented=False
                ),
                AssemblyFragment(sequence=1, left_location=None, right_location='1..8', reverse_complemented=False),
            ],
            circular=False,
        )

        data = {
            'source': submitted_source.model_dump(),
            'sequences': [json_seq.model_dump()],
            'primers': [primer_fwd.model_dump(), primer_rvs.model_dump()],
        }
        response = client.post('/pcr', json=data)
        payload = response.json()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload['detail'], 'The provided assembly is not valid.')

    def test_wrong_stoichiometry(self):
        # If not 2 primers per sequence, bad request
        template = Dseqrecord(Dseq('ACGTACGTGCGCGCGC'))

        json_seq = format_sequence_genbank(template)
        submitted_source = PCRSource(id=0)

        primer_fwd = PrimerModel(sequence='ACGTACGTG', id=2, name='forward')

        data = {
            'source': submitted_source.model_dump(),
            'sequences': [json_seq.model_dump()],
            'primers': [primer_fwd.model_dump()],
        }
        response = client.post('/pcr', json=data, params={'minimal_annealing': 8})
        self.assertEqual(response.status_code, 422)

    def test_too_many_assemblies(self):
        # Too many assemblies
        template = Dseqrecord(Dseq('A' * 200))
        json_template = format_sequence_genbank(template)
        json_template.id = 1

        source = PCRSource(id=0)
        primers = [
            PrimerModel(sequence='A' * 20, id=1, name=f'primer{1}'),
            PrimerModel(sequence='T' * 20, id=2, name=f'primer{2}'),
        ]

        data = {
            'source': source.model_dump(),
            'sequences': [json_template.model_dump()],
            'primers': [primer.model_dump() for primer in primers],
        }
        response = client.post('/pcr', json=data, params={'minimal_annealing': 8})
        self.assertEqual(response.status_code, 400)
        self.assertTrue('Too many assemblies' in response.json()['detail'])


class HomologousRecombinationTest(unittest.TestCase):
    def test_homologous_recombination(self):
        template = Dseqrecord('TTTTacgatAAtgctccCCCC', circular=False)
        json_template = format_sequence_genbank(template)
        json_template.id = 1

        insert = Dseqrecord('acgatCCCtgctcc', circular=False)
        json_insert = format_sequence_genbank(insert)
        json_insert.id = 2
        # One enzyme
        source = HomologousRecombinationSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_template.model_dump(), json_insert.model_dump()]}
        response = client.post('/homologous_recombination', params={'minimal_homology': 5}, json=data)
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        sequences = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
        self.assertEqual(len(sequences), 1)
        self.assertEqual(str(sequences[0].seq), 'TTTTacgatCCCtgctccCCCC'.upper())

        response = client.post(
            '/homologous_recombination',
            json={
                'source': payload['sources'][0],
                'sequences': [json_template.model_dump(), json_insert.model_dump()],
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        sequences = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
        self.assertEqual(len(sequences), 1)
        self.assertEqual(str(sequences[0].seq), 'TTTTacgatCCCtgctccCCCC'.upper())

    @unittest.skip(
        'Unclear, related to https://github.com/OpenCloning/OpenCloning_backend/issues/329 and https://github.com/pydna-group/pydna/pull/634'
    )
    def test_multiple_insertions(self):
        homology = 'ATGCAAACAGTAATGATGGATGACATTCAAAGCACTGATT'
        template = Dseqrecord(f'aaaaaa{homology}aattggaa{homology}tttttttt', circular=False)
        insert = Dseqrecord(f'{homology}acaa{homology}', circular=False)

        json_template = format_sequence_genbank(template)
        json_template.id = 1
        json_insert = format_sequence_genbank(insert)
        json_insert.id = 2

        source = HomologousRecombinationSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_template.model_dump(), json_insert.model_dump()]}

        response = client.post('/homologous_recombination', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        sequences = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
        self.assertEqual(len(sequences), 3)

    def test_too_many_assemblies(self):
        template = Dseqrecord(Dseq('A' * 200))
        insert = Dseqrecord(Dseq('A' * 40))
        json_template = format_sequence_genbank(template)
        json_template.id = 1
        json_insert = format_sequence_genbank(insert)
        json_insert.id = 2

        source = HomologousRecombinationSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_template.model_dump(), json_insert.model_dump()]}

        response = client.post('/homologous_recombination', json=data)
        self.assertEqual(response.status_code, 400)
        self.assertTrue('Too many assemblies' in response.json()['detail'])

    def test_circular_insertion(self):
        homology = 'ATGCAAACAGTAATGATGGATGACATTCAAAGCACTGATT'
        template = Dseqrecord(f'aaaaaa{homology}tttttttt', circular=False)
        insert = Dseqrecord(f'ccggta{homology}acaata', circular=True)

        json_template = format_sequence_genbank(template)
        json_template.id = 1
        json_insert = format_sequence_genbank(insert)
        json_insert.id = 2

        source = HomologousRecombinationSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_template.model_dump(), json_insert.model_dump()]}

        response = client.post('/homologous_recombination', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        sequences = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
        self.assertEqual(len(sequences), 1)
        self.assertEqual(str(sequences[0].seq), f'aaaaaa{homology}acaataccggta{homology}tttttttt'.upper())

        # Now with two circular sequences
        template = Dseqrecord(f'aaaaaa{homology}tttttttt', circular=True)
        insert = Dseqrecord(f'ccggta{homology}acaata', circular=True)
        json_template = format_sequence_genbank(template)
        json_template.id = 1
        json_insert = format_sequence_genbank(insert)
        json_insert.id = 2

        source = HomologousRecombinationSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_template.model_dump(), json_insert.model_dump()]}

        response = client.post('/homologous_recombination', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        sequences = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
        self.assertEqual(len(sequences), 1)
        self.assertEqual(
            str(sequences[0].seq.seguid()),
            Dseq(f'aaaaaa{homology}acaataccggta{homology}tttttttt', circular=True).seguid(),
        )

    def test_error(self):
        template = Dseqrecord('TTTTacgatAAtgctccCCCC', circular=False)
        insert = Dseqrecord('CCCCtcatGGGG', circular=False)
        json_template = format_sequence_genbank(template)
        json_template.id = 1
        json_insert = format_sequence_genbank(insert)
        json_insert.id = 2

        source = HomologousRecombinationSource(id=0)
        data = {'source': source.model_dump(), 'sequences': [json_template.model_dump(), json_insert.model_dump()]}
        response = client.post('/homologous_recombination', json=data)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()['detail'], 'No homologous recombination with at least 40 bps of homology was found.'
        )


class GibsonAssemblyTest(unittest.TestCase):
    def test_gibson_assembly(self):
        # A circular one
        fragments = [
            Dseqrecord('TATTTTTTacgatAAtgctccCCCCCCGC', circular=False),
            Dseqrecord('CCCCCCGCtcatGGGAGGGG', circular=False),
            Dseqrecord('GGGAGGGGatataTATTTTTT', circular=False),
        ]

        json_fragments = [format_sequence_genbank(f) for f in fragments]
        for i, f in enumerate(json_fragments):
            f.id = i + 1

        source = GibsonAssemblySource(id=0)

        # All equivalent classes should give the same result
        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        for cls_name in [
            'GibsonAssemblySource',
            'OverlapExtensionPCRLigationSource',
            'InFusionSource',
            'InVivoAssemblySource',
        ]:
            data['source']['type'] = cls_name
            response = client.post('/gibson_assembly', json=data, params={'minimal_homology': 8})
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            sequences = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
            self.assertEqual(payload['sources'][0]['type'], cls_name)
            self.assertEqual(len(sequences), 1)
            self.assertEqual(str(sequences[0].seq), 'TATTTTTTacgatAAtgctccCCCCCCGCtcatGGGAGGGGatata'.upper())

        # Circularisation works
        f1 = Dseqrecord('AGAGACCaaaAGAGACC')
        json_fragments = [format_sequence_genbank(f1)]
        for i, f in enumerate(json_fragments):
            f.id = i + 1

        source = GibsonAssemblySource(id=0)
        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        response = client.post('/gibson_assembly', json=data, params={'minimal_homology': 7})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        sequences = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]

        self.assertEqual(len(sequences), 1)
        self.assertEqual(str(sequences[0].seq), 'AGAGACCaaa'.upper())

    def test_circular_constrain(self):
        # A circular one
        fragments = [
            Dseqrecord('TTTTTacgatAAtgctccCCCCC', circular=False),
            Dseqrecord('CCCCCtcatGGGGG', circular=False),
        ]
        json_fragments = [format_sequence_genbank(f) for f in fragments]
        for i, f in enumerate(json_fragments):
            f.id = i + 1

        source = GibsonAssemblySource(id=0)

        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        response = client.post('/gibson_assembly', json=data, params={'minimal_homology': 5, 'circular_only': True})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['detail'], 'No circular assembly with at least 5 bps of homology was found.')

    def test_too_many_assemblies(self):
        homology = 'ATGCAAACAGTAATGATGGATGACATTCAAAGCACTGATT'
        fragments = [Dseqrecord(f'{homology}acgt{homology}') for _ in range(10)]
        json_fragments = [format_sequence_genbank(f) for f in fragments]
        for i, f in enumerate(json_fragments):
            f.id = i + 1

        source = GibsonAssemblySource(id=0)
        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        response = client.post('/gibson_assembly', json=data)
        self.assertEqual(response.status_code, 400)
        self.assertTrue('Too many possible paths' in response.json()['detail'])

    def test_in_vivo_assembly(self):
        # in vivo assembly should use common_sub_strings and not gibson_overlap
        overlap1 = 'AACAAAGTCAATTTGGCGAT'
        overlap2 = 'TTCTAGAGAACTTCCTAAGGT'
        overlap3 = 'TTTGCAAGCAAAAAGAAGTT'

        fragments = [
            Dseqrecord(f'tc{overlap1}acgatAAtgctcc{overlap2}c', circular=False),  # Note the extra flanking bases
            Dseqrecord(f'tt{overlap2}tcat{overlap3}cccccc', circular=False),
            Dseqrecord(f'aa{overlap3}atata{overlap1}tttt', circular=False),
        ]

        json_fragments = [format_sequence_genbank(f) for f in fragments]
        for i, f in enumerate(json_fragments):
            f.id = i + 1

        source = GibsonAssemblySource(id=0)

        # Only in vivo assembly should work
        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        for cls_name in [
            'GibsonAssemblySource',
            'OverlapExtensionPCRLigationSource',
            'InFusionSource',
            'InVivoAssemblySource',
        ]:
            data['source']['type'] = cls_name
            response = client.post('/gibson_assembly', json=data, params={'minimal_homology': 20})
            if cls_name != 'InVivoAssemblySource':
                self.assertEqual(response.status_code, 400)
                continue
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            sequences = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
            self.assertEqual(payload['sources'][0]['type'], cls_name)
            self.assertEqual(len(sequences), 1)
            self.assertEqual(str(sequences[0].seq), f'{overlap1}acgatAAtgctcc{overlap2}tcat{overlap3}atata'.upper())

    def test_equivalent_classes(self):
        pass


class RestrictionAndLigationTest(unittest.TestCase):
    def test_restriction_and_ligation(self):
        fragments = [Dseqrecord('AAAGAATTCAAA'), Dseqrecord('CCCCGAATTCCCC')]
        json_fragments = [format_sequence_genbank(f) for f in fragments]
        for i, f in enumerate(json_fragments):
            f.id = i + 1

        source = RestrictionAndLigationSource(
            id=0,
            restriction_enzymes=['EcoRI'],
        )

        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        response = client.post('/restriction_and_ligation', json=data, params={'minimal_homology': 4})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 4)
        self.assertEqual(len(payload['sources']), 4)

        # Test with blunt ends

        fragments = [Dseqrecord('cccAGCGCTcgcAGCTtat'), Dseqrecord('aaaAGCGCTggaAGCTctt')]
        json_fragments = [format_sequence_genbank(f) for f in fragments]
        for i, f in enumerate(json_fragments):
            f.id = i + 1

        source = RestrictionAndLigationSource(
            id=0,
            restriction_enzymes=['AfeI', 'AluI'],
        )
        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        response = client.post('/restriction_and_ligation', json=data, params={'circular_only': True})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 2)
        self.assertEqual(len(payload['sources']), 2)

        seqs = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
        self.assertEqual(str(seqs[0].seq), 'GCTcgcAGGCTggaAG'.upper())
        self.assertEqual(str(seqs[1].seq), 'GCTcgcAGCTtccAGC'.upper())

    def test_golden_gate(self):
        fragments = [
            Dseqrecord('GGTCTCAattaAAAAAttaaAGAGACC'),
            Dseqrecord('GGTCTCAttaaCCCCCatatAGAGACC'),
            Dseqrecord('GGTCTCAatatGGGGGccggAGAGACC'),
            Dseqrecord('TTTTattaAGAGACCTTTTTGGTCTCAccggTTTT', circular=True),
        ]

        json_fragments = [format_sequence_genbank(f) for f in fragments]
        for i, f in enumerate(json_fragments):
            f.id = i + 1

        source = RestrictionAndLigationSource(
            id=0,
            restriction_enzymes=['BsaI'],
        )

        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        response = client.post('/restriction_and_ligation', json=data, params={'circular_only': True})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 1)
        self.assertEqual(len(payload['sources']), 1)

    def test_ambiguous_bases_in_overhang(self):
        # See https://github.com/OpenCloning/OpenCloning/issues/67
        source = RestrictionAndLigationSource(
            id=0,
            restriction_enzymes=['BsaI'],
        )
        cases = [
            # Matching overhangs that contain an N (used to raise an internal server error)
            [Dseqrecord('GGTCTCAatNaAAAAAttaaAGAGACC'), Dseqrecord('GGTCTCAttaaCCCCCatNaAGAGACC')],
            # Only one of the overhangs contains an N
            [Dseqrecord('GGTCTCAattaAAAAAttaaAGAGACC'), Dseqrecord('GGTCTCAttaaCCCCCatNaAGAGACC')],
            # Overhangs made only of Ns
            [Dseqrecord('GGTCTCANNNNAAAAAttaaAGAGACC'), Dseqrecord('GGTCTCAttaaCCCCCNNNNAGAGACC')],
            # Overhang spanning the origin of a circular sequence
            [Dseqrecord('tNaaTTTTTTTTGGTCTCAa', circular=True), Dseqrecord('GGTCTCAttaaCCCCCatNaAGAGACC')],
        ]
        for fragments in cases:
            json_fragments = [format_sequence_genbank(f) for f in fragments]
            for i, f in enumerate(json_fragments):
                f.id = i + 1
            data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
            for circular_only in [True, False]:
                response = client.post('/restriction_and_ligation', json=data, params={'circular_only': circular_only})
                self.assertEqual(response.status_code, 400)
                self.assertIn('ambiguous bases', response.json()['detail'])
                self.assertIn('in sequence 2', response.json()['detail'])

        # The enzyme, the overhang and the sequence id are reported
        fragments = [Dseqrecord('tNaaTTTTTTTTGGTCTCAa', circular=True), Dseqrecord('GGTCTCAttaaCCCCCattaAGAGACC')]
        json_fragments = [format_sequence_genbank(f) for f in fragments]
        for i, f in enumerate(json_fragments):
            f.id = i + 1
        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        response = client.post('/restriction_and_ligation', json=data)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()['detail'],
            'Overhangs containing ambiguous bases (e.g. N) cannot be ligated: BsaI overhang ATNA in sequence 1.',
        )

    def test_single_input(self):
        fragments = [Dseqrecord('AAAGAATTCAAAGAATTCAAAA')]
        json_fragments = [format_sequence_genbank(f) for f in fragments]
        for i, f in enumerate(json_fragments):
            f.id = i + 1

        source = RestrictionAndLigationSource(
            id=0,
            restriction_enzymes=['EcoRI'],
        )

        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        response = client.post('/restriction_and_ligation', json=data)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sequences']), 3)
        self.assertEqual(len(payload['sources']), 3)

        sequences = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]

        self.assertEqual(str(sequences[0].seq), 'AATTCAAAG')
        self.assertEqual(str(sequences[1].seq), 'AAAGAATTCAAAA')

        sources = [RestrictionAndLigationSource.model_validate(s) for s in payload['sources']]
        # Submitting the known fragments
        data = {'source': sources[0].model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        response = client.post('/restriction_and_ligation', json=data)
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(payload['sequences']), 1)
        self.assertEqual(len(payload['sources']), 1)
        self.assertEqual(payload['sources'][0], sources[0].model_dump())
        self.assertEqual(
            read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0])), sequences[0]
        )

    def test_warning_if_partial_digestion(self):
        fragments = [Dseqrecord('aaGAATTCaaGATATCaaGAATTCaaGAATTCaa'), Dseqrecord('CCCCGAATTCCCC', circular=True)]
        json_fragments = [format_sequence_genbank(f) for f in fragments]
        for i, f in enumerate(json_fragments):
            f.id = i + 1

        source = RestrictionAndLigationSource(
            id=0,
            restriction_enzymes=['EcoRI', 'EcoRV'],
        )
        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}

        response = client.post('/restriction_and_ligation', json=data)
        self.assertEqual(response.status_code, 200)
        self.assertIn('x-warning', response.headers)
        self.assertIn('partially digested products', response.headers['x-warning'])

        # Warnings are also returned on error
        # Internal EcoRV cutsite
        # because the cutsite is not part of an edge)

        f1 = Dseqrecord('aaGAATTCaaGATATCaaGAATTCaa')
        f2 = Dseqrecord('cccGAATTCccc', circular=True)
        json_fragments = [format_sequence_genbank(f) for f in [f1, f2]]
        for i, f in enumerate(json_fragments):
            f.id = i + 1

        source = RestrictionAndLigationSource(
            id=0,
            restriction_enzymes=['EcoRI', 'EcoRV'],
        )
        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        response = client.post('/restriction_and_ligation', json=data)
        self.assertEqual(response.status_code, 400)
        self.assertIn('x-warning', response.headers)
        self.assertIn('partially digested products', response.headers['x-warning'])

    def test_errors(self):
        fragments = [Dseqrecord('AAAGAATTCAAAGAATTCAAAA')]
        json_fragments = [format_sequence_genbank(f) for f in fragments]
        for i, f in enumerate(json_fragments):
            f.id = i + 1

        # Enzyme that does not exist
        source = RestrictionAndLigationSource(
            id=0,
            restriction_enzymes=['dummy'],
        )

        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        response = client.post('/restriction_and_ligation', json=data)
        self.assertEqual(response.status_code, 404)

        # enzyme that does not cut
        source = RestrictionAndLigationSource(
            id=0,
            restriction_enzymes=['HindIII'],
        )

        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        response = client.post('/restriction_and_ligation', json=data)

    def test_too_many_assemblies(self):
        fragments = [
            Dseqrecord('aaGCGGCCGCaaGCGGCCGC', circular=True),
            Dseqrecord('aaGCGGCCGCaaGCGGCCGC', circular=True),
            Dseqrecord('aaGCGGCCGCaaGCGGCCGCaaGCGGCCGCaaGCGGCCGC', circular=True),
        ]

        source = RestrictionAndLigationSource(
            id=0,
            restriction_enzymes=['NotI'],
        )

        json_fragments = [format_sequence_genbank(f) for f in fragments]
        for i, f in enumerate(json_fragments):
            f.id = i + 1

        data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
        response = client.post('/restriction_and_ligation', json=data)
        self.assertEqual(response.status_code, 400)
        self.assertTrue('Too many assemblies' in response.json()['detail'])

    def test_sort_by_recognition_sites(self):
        fragments = [
            Dseqrecord('AAggtctcaACGTagagtcacacaggactactaCGTAagagaccAA', circular=True),
            Dseqrecord('AAggtctcaCGTAagagtcacacaggactactaACGTagagaccAA', circular=True),
        ]

        source = RestrictionAndLigationSource(
            id=0,
            restriction_enzymes=['BsaI'],
        )
        json_fragments = [format_sequence_genbank(f) for f in fragments]
        for i, f in enumerate(json_fragments):
            f.id = i + 1

        for sorting in [True, False]:
            data = {'source': source.model_dump(), 'sequences': [f.model_dump() for f in json_fragments]}
            response = client.post(
                '/restriction_and_ligation', json=data, params={'sort_by_recognition_sites': sorting}
            )
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            seqs1 = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]

            shifted_fragment = fragments[0].shifted(21)
            json_shifted_fragment = format_sequence_genbank(shifted_fragment)
            json_shifted_fragment.id = 1
            data['sequences'][0] = json_shifted_fragment.model_dump()
            data['sequences'] = data['sequences']
            response = client.post(
                '/restriction_and_ligation', json=data, params={'sort_by_recognition_sites': sorting}
            )
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            seqs2 = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]

            if sorting:
                self.assertEqual(len(seqs1[0]), len(seqs2[0]))
                self.assertEqual(len(seqs1[1]), len(seqs2[1]))
            else:
                self.assertNotEqual(len(seqs1[0]), len(seqs2[0]))
                self.assertNotEqual(len(seqs1[1]), len(seqs2[1]))


class CrisprTest(unittest.TestCase):

    def test_crispr(self):

        template = Dseqrecord('aaccggttcaatgcaaacagtaatgatggatgacattcaaagcac')
        json_template = format_sequence_genbank(template)
        json_template.id = 1

        insert = Dseqrecord('aaccggttAAAAAAAAAttcaaagcac')
        json_insert = format_sequence_genbank(insert)
        json_insert.id = 2

        guide = PrimerModel(sequence='ttcaatgcaaacagtaatga', id=3, name='guide_1')
        source = CRISPRSource(id=0)
        data = {
            'source': source.model_dump(),
            'sequences': [json_template.model_dump(), json_insert.model_dump()],
            'guides': [guide.model_dump()],
        }
        params = {'minimal_homology': 8}

        response = client.post('/crispr', json=data, params=params)

        payload = response.json()
        self.assertEqual(response.status_code, 200)
        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        sources = [CRISPRSource.model_validate(s) for s in payload['sources']]

        self.assertEqual(len(resulting_sequences), 1)
        self.assertEqual(len(sources), 1)

        self.assertEqual(str(resulting_sequences[0].seq), 'aaccggttAAAAAAAAAttcaaagcac'.upper())

        # Multi outputs
        template = Dseqrecord('aaccggttcaatgcaaacagtaatgatggatgacattcaaagcaccgtttatcagtattcaaagcac')
        json_template = format_sequence_genbank(template)
        json_template.id = 1

        insert = Dseqrecord('aaccggttAAAAAAAAAttcaaagcac')
        json_insert = format_sequence_genbank(insert)
        json_insert.id = 2

        guide = PrimerModel(sequence='ttcaatgcaaacagtaatga', id=3, name='guide_1')
        source = CRISPRSource(id=0)
        data = {
            'source': source.model_dump(),
            'sequences': [json_template.model_dump(), json_insert.model_dump()],
            'guides': [guide.model_dump()],
        }
        params = {'minimal_homology': 8}

        response = client.post('/crispr', json=data, params=params)

        payload = response.json()
        self.assertEqual(response.status_code, 200)
        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        sources = [CRISPRSource.model_validate(s) for s in payload['sources']]

        self.assertEqual(len(resulting_sequences), 2)
        self.assertEqual(len(sources), 2)

        output_seqs = set([str(s.seq) for s in resulting_sequences])
        self.assertEqual(
            output_seqs,
            {
                'aaccggttAAAAAAAAAttcaaagcac'.upper(),
                'aaccggttAAAAAAAAAttcaaagcaccgtttatcagtattcaaagcac'.upper(),
            },
        )

        # Submit a known source

        data = {
            'source': sources[0].model_dump(),
            'sequences': [json_template.model_dump(), json_insert.model_dump()],
            'guides': [guide.model_dump()],
        }
        response = client.post('/crispr', json=data, params=params)

        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(payload['sources']), 1)
        self.assertEqual(len(payload['sequences']), 1)
        self.assertEqual(payload['sources'][0], sources[0].model_dump())

    def test_errors(self):

        # Wrong guide
        template = Dseqrecord('aaccggttcaatgcaaacagtaatgatggatgacattcaaagcac')
        json_template = format_sequence_genbank(template)
        json_template.id = 1

        insert = Dseqrecord('aaccggttAAAAAAAAAttcaaagcac')
        json_insert = format_sequence_genbank(insert)
        json_insert.id = 2

        guide = PrimerModel(sequence='AAAAAAAA', id=3, name='guide_1')

        source = CRISPRSource(id=0)

        data = {
            'source': source.model_dump(),
            'sequences': [json_template.model_dump(), json_insert.model_dump()],
            'guides': [guide.model_dump()],
        }

        params = {'minimal_homology': 8}

        response = client.post('/crispr', json=data, params=params)

        payload = response.json()
        self.assertEqual(response.status_code, 400)

        self.assertIn('Could not find Cas9 cutsite in the target sequence using the guide: guide_1', payload['detail'])

        # Wrong and right guide
        guide2 = PrimerModel(sequence='ttcaatgcaaacagtaatga', id=4, name='guide_2')
        data['guides'] = [guide.model_dump(), guide2.model_dump()]

        response = client.post('/crispr', json=data, params=params)
        payload = response.json()
        self.assertEqual(response.status_code, 400)

        self.assertIn('Could not find Cas9 cutsite in the target sequence using the guide: guide_1', payload['detail'])

        # Homology too short
        data['guides'] = [guide2.model_dump()]
        response = client.post('/crispr', json=data)
        payload = response.json()
        self.assertEqual(response.status_code, 400)

        # cut outside of homology

        template2 = Dseqrecord('aaccggttcaatgcaaacagtaatgatggatgacattcaaagcacaaaAAAGAGAGACAGGTTTTGAGtgg')
        json_template2 = format_sequence_genbank(template2)
        json_template2.id = 1

        guide_outside = PrimerModel(sequence='AAAGAGAGACAGGTTTTGAG', id=3, name='guide_outside')
        data = {
            'source': source.model_dump(),
            'sequences': [json_template2.model_dump(), json_insert.model_dump()],
            'guides': [guide_outside.model_dump()],
        }

        response = client.post('/crispr', json=data, params=params)
        payload = response.json()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            payload['detail'],
            'No suitable products produced with provided primers and 8 bps of homology',
        )

    def test_too_many_assemblies(self):
        template = Dseqrecord(30 * 'A' + 'aattcaatgcaaacagtaatgatggatgaca' + 30 * 'A')
        json_template = format_sequence_genbank(template)
        json_template.id = 1

        insert = Dseqrecord(30 * 'A' + 'AAAAAAAAA' + 30 * 'A')
        json_insert = format_sequence_genbank(insert)
        json_insert.id = 2

        guide = PrimerModel(sequence='ttcaatgcaaacagtaatga', id=3, name='guide_1')
        source = CRISPRSource(id=0)
        data = {
            'source': source.model_dump(),
            'sequences': [json_template.model_dump(), json_insert.model_dump()],
            'guides': [guide.model_dump()],
        }
        params = {'minimal_homology': 8}

        response = client.post('/crispr', json=data, params=params)

        self.assertEqual(response.status_code, 400)
        self.assertIn('Too many assemblies', response.json()['detail'])


class GatewaySourceTest(unittest.TestCase):

    attB1 = 'ACAACTTTGTACAAAAAAGCAGAAG'
    attB2 = 'ACAACTTTGTACAAGAAAGCTGGGC'
    attP1 = 'AAAATAATGATTTTATTTGACTGATAGTGACCTGTTCGTTGCAACAAATTGATGAGCAATGCTTTTTTATAATGCCAACTTTGTACAAAAAAGCTGAACGAGAAGCGTAAAATGATATAAATATCAATATATTAAATTAGATTTTGCATAAAAAACAGACTACATAATACTGTAAAACACAACATATCCAGTCACTATGAATCAACTACTTAGATGGTATTAGTGACCTGTA'
    attP2 = 'AAATAATGATTTTATTTTGACTGATAGTGACCTGTTCGTTGCAACAAATTGATAAGCAATGCTTTCTTATAATGCCAACTTTGTACAAGAAAGCTGAACGAGAAACGTAAAATGATATAAATATCAATATATTAAATTAGACTTTGCATAAAAAACAGACTACATAATACTGTAAAACACAACATATCCAGTCACTATGAATCAACTACTTAGATGGTATTAGTGACCTGTA'
    attR1 = 'ACAACTTTGTACAAAAAAGCTGAACGAGAAACGTAAAATGATATAAATATCAATATATTAAATTAGATTTTGCATAAAAAACAGACTACATAATACTGTAAAACACAACATATGCAGTCACTATG'
    attL1 = 'CAAATAATGATTTTATTTTGACTGATAGTGACCTGTTCGTTGCAACAAATTGATAAGCAATGCTTTCTTATAATGCCAACTTTGTACAAAAAAGCAGGCT'

    def test_gateway_source(self):
        attB1 = self.attB1
        attP1 = self.attP1
        attR1 = self.attR1
        attL1 = self.attL1

        product_BP = 'aaaACAACTTTGTACAAAAAAGCTGAACGAGAAGCGTAAAATGATATAAATATCAATATATTAAATTAGATTTTGCATAAAAAACAGACTACATAATACTGTAAAACACAACATATCCAGTCACTATGAATCAACTACTTAGATGGTATTAGTGACCTGTAccc'
        product_PB = (
            'aaaAAAATAATGATTTTATTTGACTGATAGTGACCTGTTCGTTGCAACAAATTGATGAGCAATGCTTTTTTATAATGCCAACTTTGTACAAAAAAGCAGAAGccc'
        )

        product_RL = 'aaaACAACTTTGTACAAAAAAGCAGGCTccc'
        product_LR = 'aaaCAAATAATGATTTTATTTTGACTGATAGTGACCTGTTCGTTGCAACAAATTGATAAGCAATGCTTTCTTATAATGCCAACTTTGTACAAAAAAGCTGAACGAGAAACGTAAAATGATATAAATATCAATATATTAAATTAGATTTTGCATAAAAAACAGACTACATAATACTGTAAAACACAACATATGCAGTCACTATGccc'

        seq1 = Dseqrecord('aaa' + attB1 + 'ccc')
        seq2 = Dseqrecord('aaa' + attP1 + 'ccc')
        seq3 = Dseqrecord('aaa' + attR1 + 'ccc')
        seq4 = Dseqrecord('aaa' + attL1 + 'ccc')

        fragmentsBP = [seq1, seq2]
        fragmentsBP = [format_sequence_genbank(f) for f in fragmentsBP]
        fragmentsBP[0].id = 1
        fragmentsBP[1].id = 2

        fragmentsLR = [seq3, seq4]
        fragmentsLR = [format_sequence_genbank(f) for f in fragmentsLR]
        fragmentsLR[0].id = 3
        fragmentsLR[1].id = 4

        sourceBP = GatewaySource(id=0, reaction_type='BP')
        sourceLR = GatewaySource(id=0, reaction_type='LR')

        # BP reaction ===========================================
        data = {
            'source': sourceBP.model_dump(),
            'sequences': [f.model_dump() for f in fragmentsBP],
        }
        response = client.post('/gateway', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sources']), 2)
        self.assertEqual(payload['sources'][0]['reaction_type'], 'BP')

        seqs = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
        self.assertEqual(len(seqs), 2)
        str_seqs = [str(s.seq) for s in seqs]
        self.assertIn(product_BP.upper(), str_seqs)
        self.assertIn(product_PB.upper(), str_seqs)
        # They contain annotations of gateway sites
        self.assertIn('attB1', get_all_feature_labels(seqs[0]))
        self.assertIn('attR1', get_all_feature_labels(seqs[0]))
        self.assertIn('attB1', get_all_feature_labels(seqs[1]))
        self.assertIn('attL1', get_all_feature_labels(seqs[1]))

        # We can submit the specific source and get one output only
        data = {
            'source': payload['sources'][0],
            'sequences': [f.model_dump() for f in fragmentsBP],
        }
        response = client.post('/gateway', json=data)
        self.assertEqual(response.status_code, 200)
        payload2 = response.json()
        self.assertEqual(len(payload2['sequences']), 1)
        self.assertEqual(payload2['sequences'][0], payload['sequences'][0])

        # The outputs are not valid inputs for same reaction
        data = {
            'source': sourceBP.model_dump(),
            'sequences': payload['sequences'],
        }
        response = client.post('/gateway', json=data)
        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertIn('Inputs are not compatible for BP reaction', payload['detail'])
        self.assertIn('fragment 1: attB1, attR1', payload['detail'])
        self.assertIn('fragment 2: attB1, attL1', payload['detail'])

        # The LR inputs are not valid either
        data = {
            'source': sourceBP.model_dump(),
            'sequences': [f.model_dump() for f in fragmentsLR],
        }
        response = client.post('/gateway', json=data)
        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertIn('Inputs are not compatible for BP reaction', payload['detail'])
        self.assertIn('fragment 1: attB1, attR1', payload['detail'])
        self.assertIn('fragment 2: attB1, attL1', payload['detail'])

        # LR reaction ===========================================
        data = {
            'source': sourceLR.model_dump(),
            'sequences': [f.model_dump() for f in fragmentsLR],
        }
        response = client.post('/gateway', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        returned_seqs = payload['sequences']
        self.assertEqual(len(payload['sources']), 2)
        self.assertEqual(payload['sources'][0]['reaction_type'], 'LR')

        seqs = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
        # They contain annotations of gateway sites
        self.assertIn('attB1', get_all_feature_labels(seqs[0]))
        self.assertIn('attB1', get_all_feature_labels(seqs[1]))
        self.assertIn('attL1', get_all_feature_labels(seqs[1]))
        self.assertIn('attR1', get_all_feature_labels(seqs[1]))

        self.assertEqual(len(seqs), 2)
        str_seqs = [str(s.seq) for s in seqs]
        self.assertIn(product_LR.upper(), str_seqs)
        self.assertIn(product_RL.upper(), str_seqs)

        # The outputs are not valid inputs for same reaction
        data = {
            'source': sourceLR.model_dump(),
            'sequences': returned_seqs,
        }
        response = client.post('/gateway', json=data)
        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertIn('Inputs are not compatible for LR reaction', payload['detail'])
        self.assertIn('fragment 1: attB1', payload['detail'])
        self.assertTrue(payload['detail'].endswith('fragment 2: attB1, attL1, attR1'))

        # Check that greedy would find an attP1 site after the LR reaction, while not
        # greedy does not
        data = {
            'source': {**sourceLR.model_dump(), 'greedy': True},
            'sequences': returned_seqs,
        }
        response = client.post('/gateway', json=data)
        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertIn('Inputs are not compatible for LR reaction', payload['detail'])
        self.assertIn('fragment 1: attB1', payload['detail'])
        self.assertTrue(payload['detail'].endswith('fragment 2: attB1, attP1, attL1, attR1'))

    def test_only_multi_site(self):
        attB1 = self.attB1
        attB2 = self.attB2
        attP1 = self.attP1
        attP2 = self.attP2

        seq1 = Dseqrecord('aaa' + attB1 + 'ggg' + attB2 + 'ccc', circular=True)
        seq2 = Dseqrecord('aaa' + attP1 + 'ggg' + attP2 + 'ccc', circular=True)

        fragments = [seq1, seq2]
        fragments = [format_sequence_genbank(f) for f in fragments]
        fragments[0].id = 1
        fragments[1].id = 2

        source = GatewaySource(id=0, reaction_type='BP')
        data = {
            'source': source.model_dump(),
            'sequences': [f.model_dump() for f in fragments],
        }
        response = client.post('/gateway', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sources']), 4)

        # Here only multi-site
        response = client.post('/gateway', json=data, params={'only_multi_site': True})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sources']), 2)

    def test_single_input(self):
        attB1 = self.attB1
        attP1 = self.attP1

        seq1 = Dseqrecord('aaa' + attB1 + 'ccc' + attP1)

        fragments = [seq1]
        fragments = [format_sequence_genbank(f) for f in fragments]
        fragments[0].id = 1

        source = GatewaySource(id=0, reaction_type='BP')

        data = {
            'source': source.model_dump(),
            'sequences': [f.model_dump() for f in fragments],
        }
        response = client.post('/gateway', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sources']), 2)

        product = Dseq(
            'GTACAAAAAAGCAGAAGcccAAAATAATGATTTTATTTGACTGATAGTGACCTGTTCGTTGCAACAAATTGATGAGCAATGCTTTTTTATAATGCCAACTTT'.upper(),
            circular=True,
        )
        product2 = Dseq(
            'AAAACAACTTTGTACAAAAAAGCTGAACGAGAAGCGTAAAATGATATAAATATCAATATATTAAATTAGATTTTGCATAAAAAACAGACTACATAATACTGTAAAACACAACATATCCAGTCACTATGAATCAACTACTTAGATGGTATTAGTGACCTGTA'.upper(),
            circular=False,
        )
        seqs = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]
        self.assertEqual(seqs[0].seq, product)
        self.assertEqual(seqs[1].seq, product2)


class CreLoxRecombinationTest(unittest.TestCase):

    def test_deletion(self):
        seqA = Dseqrecord('aa' + LOXP_SEQUENCE + 'acgt' + LOXP_SEQUENCE + 'cc')

        fragments = [format_sequence_genbank(seqA)]
        fragments[0].id = 1

        source = CreLoxRecombinationSource(id=0)

        data = {
            'source': source.model_dump(),
            'sequences': [f.model_dump() for f in fragments],
        }
        response = client.post('/cre_lox_recombination', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sources']), 2)

        # The plasmid that "comes out" of the genome
        plasmid = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertTrue(plasmid.circular)

        self.assertEqual(plasmid.seq.seguid(), Dseqrecord(LOXP_SEQUENCE + 'acgt', circular=True).seguid())
        self.assertIn('loxP', get_all_feature_labels(plasmid))

        # The locus sequence that remains
        locus = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][1]))
        self.assertEqual(str(locus.seq).upper(), ('aa' + LOXP_SEQUENCE + 'cc').upper())

        # Example from the paper PMID:12202778
        lox66 = 'ATAACTTCGTATAGCATACATTATACGAACGGTA'
        lox71 = 'TACCGTTCGTATAGCATACATTATACGAAGTTAT'
        double_mutant_lox = 'TACCGTTCGTATAGCATACATTATACGAACGGTA'

        seqA = Dseqrecord('aa' + lox71 + 'acgt' + lox66 + 'cc')

        fragments = [format_sequence_genbank(seqA)]
        fragments[0].id = 1

        source = CreLoxRecombinationSource(id=0)
        data = {
            'source': source.model_dump(),
            'sequences': [f.model_dump() for f in fragments],
        }
        response = client.post('/cre_lox_recombination', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sources']), 2)

        # The plasmid that "comes out" of the genome
        plasmid = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][0]))
        self.assertTrue(plasmid.circular)
        self.assertEqual(plasmid.seq.seguid(), Dseqrecord(LOXP_SEQUENCE + 'acgt', circular=True).seguid())

        # The locus sequence that remains
        locus = read_dsrecord_from_json(TextFileSequence.model_validate(payload['sequences'][1]))
        self.assertEqual(str(locus.seq).upper(), ('aa' + double_mutant_lox + 'cc').upper())

    def test_insertion(self):
        seqA = Dseqrecord(LOXP_SEQUENCE + 'acgt', circular=True)
        seqB = Dseqrecord('aa' + LOXP_SEQUENCE + 'cc')

        fragments = [format_sequence_genbank(seqA), format_sequence_genbank(seqB)]
        fragments[0].id = 1
        fragments[1].id = 2

        source = CreLoxRecombinationSource(id=0)
        data = {
            'source': source.model_dump(),
            'sequences': [f.model_dump() for f in fragments],
        }
        response = client.post('/cre_lox_recombination', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        out_sequences = [read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']]

        self.assertEqual(len(out_sequences), 1)
        self.assertEqual(out_sequences[0].circular, False)

        # This is the intended product
        self.assertEqual(
            str(out_sequences[0].seq).upper(), ('aa' + LOXP_SEQUENCE + 'acgt' + LOXP_SEQUENCE + 'cc').upper()
        )

    def test_no_results(self):
        seqA = Dseqrecord('aa' + LOXP_SEQUENCE + 'cc')
        fragments = [format_sequence_genbank(seqA)]
        fragments[0].id = 1

        source = CreLoxRecombinationSource(id=0)
        data = {
            'source': source.model_dump(),
            'sequences': [f.model_dump() for f in fragments],
        }
        response = client.post('/cre_lox_recombination', json=data)
        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertIn('No compatible Cre/Lox', payload['detail'])


class RecombinaseTest(unittest.TestCase):

    def test_recombinase(self):
        site1 = 'ATGCCCTAAaaCT'
        site2 = 'CAaaTTTTTTTCCCT'

        genome = Dseqrecord(f"cccccc{site1.upper()}aaaaa")
        insert = Dseqrecord(f"{site2.upper()}bbbbb", circular=True)
        fragments = [format_sequence_genbank(genome), format_sequence_genbank(insert)]
        fragments[0].id = 1
        fragments[1].id = 2
        rec = Recombinase(
            name='blah',
            site1=site1,
            site2=site2,
        )

        source = RecombinaseSource(id=0, recombinases=[rec])
        data = {
            'source': source.model_dump(),
            'sequences': [f.model_dump() for f in fragments],
        }
        response = client.post('/recombinase', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sources']), 1)

        # Response is identical independent of the order of the fragments input
        data2 = {**data, 'sequences': [f.model_dump() for f in fragments[::-1]]}
        response2 = client.post('/recombinase', json=data2)
        self.assertEqual(response2.status_code, 200)
        payload2 = response2.json()
        self.assertEqual(payload2, payload)

        # We can do the reverse reaction
        data = {
            'source': source.model_dump(),
            'sequences': payload['sequences'],
        }
        response = client.post('/recombinase', json=data, params={'reverse_recombinase': True})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['sources']), 2)

    def test_recombinase_integration_two_site_pairs(self):
        site1 = 'AAaaTTC'
        site2 = 'CCaaGC'
        site3 = 'GAccACC'
        site4 = 'TCccAAC'
        rec1 = Recombinase(
            site1=site1,
            site2=site2,
            site1_name='s1',
            site2_name='s2',
        )
        rec2 = Recombinase(
            site1=site3,
            site2=site4,
            site1_name='s1',
            site2_name='s2',
        )
        source = RecombinaseSource(id=0, recombinases=[rec1, rec2])
        seq = Dseqrecord(f"ggg{site1}aaa{site3}ttt")
        seq2 = Dseqrecord(f"ccc{site2}ttt{site4}aaa")
        fragments = [format_sequence_genbank(seq), format_sequence_genbank(seq2)]
        fragments[0].id = 1
        fragments[1].id = 2
        data = {
            'source': source.model_dump(),
            'sequences': [f.model_dump() for f in fragments],
        }
        response = client.post('/recombinase', json=data)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        self.assertEqual(len(resulting_sequences), 2)
        self.assertEqual(str(resulting_sequences[0].seq).upper(), 'GGGAAAAGCTTTTCCCACCTTT')
        self.assertEqual(str(resulting_sequences[1].seq).upper(), 'CCCCCAATTCAAAGACCAACAAA')
        # The number of recombinases returned is the same:
        source_recombinases = [Recombinase.model_validate(s) for s in payload['sources'][0]['recombinases']]
        self.assertEqual(len(source_recombinases), 2)
        self.assertEqual(source_recombinases[0], rec1)
        self.assertEqual(source_recombinases[1], rec2)

        # Response is identical independently of the order of the fragments input
        data2 = {**data, 'sequences': [f.model_dump() for f in fragments[::-1]]}
        response2 = client.post('/recombinase', json=data2)
        self.assertEqual(response2.status_code, 200)
        payload2 = response2.json()
        resulting_sequences2 = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload2['sequences']
        ]
        self.assertEqual(
            set(s.seq.seguid() for s in resulting_sequences2), set(s.seq.seguid() for s in resulting_sequences)
        )

        # The same reaction again does not work
        data = {
            'source': source.model_dump(),
            'sequences': payload['sequences'],
        }
        response2 = client.post('/recombinase', json=data)
        self.assertEqual(response2.status_code, 400)
        payload2 = response2.json()
        self.assertIn('No compatible reaction was found with the provided recombinases.', payload2['detail'])

        # The reverse does, and regenerates the original sequences
        data = {
            'source': source.model_dump(),
            'sequences': payload['sequences'],
        }
        response = client.post('/recombinase', json=data, params={'reverse_recombinase': True})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        self.assertEqual(len(resulting_sequences), 2)
        self.assertEqual(str(resulting_sequences[0].seq).upper(), str(seq.seq).upper())
        self.assertEqual(str(resulting_sequences[1].seq).upper(), str(seq2.seq).upper())

    def test_recombinase_validation(self):
        site1 = 'AAaaTTC'
        site2 = 'CCggGC'

        data = {
            'source': {'id': 0, 'recombinases': [{'site1': site1, 'site2': site2}]},
            'sequences': [format_sequence_genbank(Dseqrecord(f"ggg{site1}aaa")).model_dump()],
        }
        response = client.post('/recombinase', json=data)
        self.assertEqual(response.status_code, 422)
        payload = response.json()
        self.assertIn('Recombinase recognition sites do not have matching homology cores', payload['detail'])

        site1 = 'AAAAAAA'

        data = {
            'source': {'id': 0, 'recombinases': [{'site1': site1, 'site2': site2}]},
            'sequences': [format_sequence_genbank(Dseqrecord(f"ggg{site1}aaa")).model_dump()],
        }
        response = client.post('/recombinase', json=data)
        self.assertEqual(response.status_code, 422)

    def test_recombinase_400_if_no_linear_fragment(self):
        site1 = 'AAaaTTC'
        site2 = 'CCaaGC'
        rec = Recombinase(
            site1=site1,
            site2=site2,
        )
        source = RecombinaseSource(id=0, recombinases=[rec])
        seq1 = Dseqrecord(f"ggg{site1}aaa", circular=True)
        fragments = [format_sequence_genbank(seq1)]
        fragments[0].id = 1
        data = {
            'source': source.model_dump(),
            'sequences': [f.model_dump() for f in fragments],
        }
        response = client.post('/recombinase', json=data)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()['detail'], 'If input_contains_genome is True, there must be at least one linear fragment.'
        )

    def test_recombinase_assembly(self):
        site1 = 'AAaaTTC'
        site2 = 'CCaaGC'
        rec = Recombinase(
            site1=site1,
            site2=site2,
        )
        source = RecombinaseSource(id=0, recombinases=[rec])
        seq1 = Dseqrecord(f"ggg{site1}aaa", circular=False)
        seq2 = Dseqrecord(f"ccc{site2}ttt", circular=False)
        fragments = [format_sequence_genbank(seq1), format_sequence_genbank(seq2)]
        fragments[0].id = 1
        fragments[1].id = 2
        data = {
            'source': source.model_dump(),
            'sequences': [f.model_dump() for f in fragments],
        }
        response = client.post('/recombinase', json=data, params={'input_contains_genome': False})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        resulting_sequences = [
            read_dsrecord_from_json(TextFileSequence.model_validate(s)) for s in payload['sequences']
        ]
        self.assertEqual(len(resulting_sequences), 2)
        self.assertEqual(str(resulting_sequences[0].seq).upper(), 'gggAAaaGCttt'.upper())
        self.assertEqual(str(resulting_sequences[1].seq).upper(), 'cccCCaaTTCaaa'.upper())
