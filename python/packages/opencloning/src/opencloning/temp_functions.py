"""
Functions to be moved to pydna at some point.
"""

from opencloning_linkml.datamodel import AssemblySource
from Bio.SeqFeature import Location
from opencloning_linkml.datamodel import RestrictionEnzymeDigestionSource
from opencloning_linkml.datamodel import RestrictionSequenceCut
from opencloning_linkml.datamodel import Primer as PrimerModel
from Bio.Restriction.Restriction import RestrictionType, RestrictionBatch
from pydna.primer import Primer as PydnaPrimer


def is_assembly_complete(source: AssemblySource) -> bool:
    return any(f.type == 'AssemblyFragment' for f in source.input)


def minimal_assembly_overlap(source: AssemblySource) -> int:
    all_overlaps = list()
    for f in source.input:
        if f.type != 'AssemblyFragment':
            continue
        if f.left_location is not None:
            all_overlaps.append(len(Location.fromstring(f.left_location)))
        if f.right_location is not None:
            all_overlaps.append(len(Location.fromstring(f.right_location)))
    if len(all_overlaps) == 0:
        raise ValueError('Assembly is not complete')
    return min(all_overlaps)


def get_enzymes_from_source(source: RestrictionEnzymeDigestionSource) -> list[str]:
    out = list()
    if source.left_edge is not None:
        out.append(source.left_edge.restriction_enzyme)
    if source.right_edge is not None:
        out.append(source.right_edge.restriction_enzyme)
    # Unique values, sorted the same way
    return sorted(list(set(out)), key=out.index)


def restriction_sequence_cut_to_cutsite_tuple(
    restriction_sequence_cut: RestrictionSequenceCut,
) -> tuple[tuple[int, int], RestrictionType]:
    restriction_enzyme = RestrictionBatch(first=[restriction_sequence_cut.restriction_enzyme]).pop()
    return ((restriction_sequence_cut.cut_watson, restriction_sequence_cut.overhang), restriction_enzyme)


def primer_model_to_pydna_primer(primer_model: PrimerModel) -> PydnaPrimer:
    return PydnaPrimer(primer_model.sequence, id=str(primer_model.id), name=primer_model.name)


def pydna_primer_to_primer_model(pydna_primer: PydnaPrimer) -> PrimerModel:
    return PrimerModel(id=0, name=pydna_primer.name, sequence=str(pydna_primer.seq))
