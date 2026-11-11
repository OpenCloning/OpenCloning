from opencloning_linkml.datamodel.models import TextFileSequence, Source
from opencloning_db.models import SequenceType
from opencloning.dna_functions import read_dsrecord_from_json
from typing import TypeVar


def normalize_email(email: str) -> str:
    return email.strip().lower()


def guess_sequence_type(sequence: TextFileSequence, source: Source) -> SequenceType:
    seqrecord = read_dsrecord_from_json(sequence)

    if seqrecord.circular:
        return SequenceType.plasmid

    source_type = source.type
    if source_type == 'PCRSource':
        return SequenceType.pcr_product
    elif source_type == 'GenomeCoordinatesSource':
        return SequenceType.locus
    elif source_type in ['HomologousRecombinationSource', 'CRISPRSource', 'RecombinaseSource']:
        return SequenceType.allele
    elif source_type == 'RestrictionEnzymeDigestionSource':
        return SequenceType.restriction_fragment
    else:
        return SequenceType.linear_dna


T = TypeVar('T')


def unique_and_sorted(items: list[T]) -> list[T]:
    seen_ids = set()
    out = list()
    for item in items:
        if item.id in seen_ids:
            continue
        out.append(item)
        seen_ids.add(item.id)
    return list(sorted(out, key=lambda x: x.id))
