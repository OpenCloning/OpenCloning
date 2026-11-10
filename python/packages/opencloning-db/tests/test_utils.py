from opencloning_db.utils import guess_sequence_type
from opencloning_db.models import SequenceType
from pydna.opencloning_models import TextFileSequence
from pydna.dseqrecord import Dseqrecord


class DummySource:
    def __init__(self, type: str):
        self.type = type


def test_guess_sequence_type():
    circ = Dseqrecord('ATGC', circular=True)
    assert guess_sequence_type(TextFileSequence.from_dseqrecord(circ), None) == SequenceType.plasmid
    lin_tfs = TextFileSequence.from_dseqrecord(Dseqrecord('ATGC'))
    assert guess_sequence_type(lin_tfs, DummySource(type=None)) == SequenceType.linear_dna
    assert guess_sequence_type(lin_tfs, DummySource(type='PCRSource')) == SequenceType.pcr_product
    assert guess_sequence_type(lin_tfs, DummySource(type='GenomeCoordinatesSource')) == SequenceType.locus
    assert guess_sequence_type(lin_tfs, DummySource(type='HomologousRecombinationSource')) == SequenceType.allele
    assert guess_sequence_type(lin_tfs, DummySource(type='CRISPRSource')) == SequenceType.allele
    assert guess_sequence_type(lin_tfs, DummySource(type='RecombinaseSource')) == SequenceType.allele
    assert (
        guess_sequence_type(lin_tfs, DummySource(type='RestrictionEnzymeDigestionSource'))
        == SequenceType.restriction_fragment
    )
    assert guess_sequence_type(lin_tfs, DummySource(type='ManuallyTypedSource')) == SequenceType.linear_dna
