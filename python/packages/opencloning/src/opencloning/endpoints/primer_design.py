from fastapi import Body, Query, HTTPException
from pydantic import create_model
import re
from Bio.Restriction import RestrictionBatch
from Bio.SeqUtils import gc_fraction

from opencloning.temp_functions import pydna_primer_to_primer_model

from ..dna_functions import get_invalid_enzyme_names
from opencloning_linkml.datamodel import Primer as PrimerModel
from opencloning.pydantic_models import MAX_PRIMER_LENGTH, PrimerDesignQuery
from ..dna_functions import read_dsrecord_from_json
from ..primer_design import (
    homologous_recombination_primers,
    gibson_assembly_primers,
    simple_pair_primers,
)
from ..primer3_functions import (
    primer3_calc_tm,
    PrimerDesignSettings,
    primer3_calc_homodimer,
    primer3_calc_hairpin,
    primer3_calc_heterodimer,
    ThermodynamicResult,
)
from ..get_router import get_router
from ..ebic.primer_design import ebic_primers
from pydantic import BaseModel
import copy

router = get_router()

PrimerDesignResponse = create_model('PrimerDesignResponse', primers=(list[PrimerModel | None], ...))


def validate_spacers(spacers: list[str] | None, nb_templates: int, circular: bool):
    if spacers is None:
        return

    if circular and len(spacers) != nb_templates:
        raise HTTPException(
            422, 'The number of spacers must be the same as the number of templates when the assembly is circular.'
        )
    if not circular and len(spacers) != (nb_templates + 1):
        raise HTTPException(
            422, 'The number of spacers must be one more than the number of templates when the assembly is linear.'
        )
    for spacer in spacers:
        # If it's not only ACGt
        if not re.match(r'^[ACGT]*$', spacer.upper()):
            raise HTTPException(422, 'Spacer can only contain ACGT bases.')


@router.post('/primer_design/homologous_recombination', response_model=PrimerDesignResponse)
def primer_design_homologous_recombination(
    pcr_template: PrimerDesignQuery,
    homologous_recombination_target: PrimerDesignQuery,
    settings: PrimerDesignSettings = Body(description='Primer design settings.', default_factory=PrimerDesignSettings),
    spacers: list[str] | None = Body(
        None,
        description='Spacers to add at the left and right side of the insertion.',
    ),
    homology_length: int = Query(..., description='The length of the homology region in bps.'),
    minimal_hybridization_length: int = Query(
        ..., description='The minimal length of the hybridization region in bps.'
    ),
    target_tm: float = Query(
        ..., description='The desired melting temperature for the hybridization part of the primer.'
    ),
):
    """Design primers for homologous recombination"""

    validate_spacers(spacers, 1, False)

    pcr_seq = read_dsrecord_from_json(pcr_template.sequence)
    pcr_loc = pcr_template.location.to_biopython_location()

    hr_seq = read_dsrecord_from_json(homologous_recombination_target.sequence)
    hr_loc = homologous_recombination_target.location.to_biopython_location()

    insert_forward = pcr_template.forward_orientation

    try:
        forward_primer, reverse_primer = homologous_recombination_primers(
            pcr_seq,
            pcr_loc,
            hr_seq,
            hr_loc,
            homology_length,
            minimal_hybridization_length,
            insert_forward,
            target_tm,
            spacers,
            tm_func=lambda x: primer3_calc_tm(x, settings),
        )
    except ValueError as e:
        raise HTTPException(400, *e.args)

    forward_primer = PrimerModel(id=0, sequence=forward_primer, name='forward')
    reverse_primer = PrimerModel(id=0, sequence=reverse_primer, name='reverse')

    return {'primers': [forward_primer, reverse_primer]}


@router.post('/primer_design/gibson_assembly', response_model=PrimerDesignResponse)
def primer_design_gibson_assembly(
    pcr_templates: list[PrimerDesignQuery] = Body(
        ...,
        description='''The templates to design primers for. If the location is not
        provided for a pcr_template, primers won't be designed for that part (the part will be included
        in the Gibson as is).''',
        min_length=1,
    ),
    settings: PrimerDesignSettings = Body(description='Primer design settings.', default_factory=PrimerDesignSettings),
    spacers: list[str] | None = Body(
        None,
        description='Spacers to add between the restriction site and the 5\' end of the primer footprint (the part that binds the DNA).',
    ),
    homology_length: int = Query(..., description='The length of the homology region in bps.'),
    minimal_hybridization_length: int = Query(
        ..., description='The minimal length of the hybridization region in bps.'
    ),
    target_tm: float = Query(
        ..., description='The desired melting temperature for the hybridization part of the primer.'
    ),
    circular: bool = Query(False, description='Whether the assembly is circular.'),
):
    """Design primers for Gibson assembly. If the location is not provided for a pcr_template, primers won't be designed for that part."""

    # Validate the spacers
    validate_spacers(spacers, len(pcr_templates), circular)
    templates = list()
    amplify_templates = list()
    for query in pcr_templates:
        dseqr = read_dsrecord_from_json(query.sequence)
        if query.location is not None:
            location = query.location.to_biopython_location()
            template = location.extract(dseqr)
            if not query.forward_orientation:
                template = template.reverse_complement()
            # For naming the primers
            template.name = dseqr.name
            template.id = dseqr.id
            amplify_templates.append(True)
        else:
            template = copy.deepcopy(dseqr)
            amplify_templates.append(False)
        templates.append(template)
    try:
        primers = gibson_assembly_primers(
            templates,
            homology_length,
            minimal_hybridization_length,
            target_tm,
            circular,
            spacers,
            tm_func=lambda x: primer3_calc_tm(x, settings),
            amplify_templates=amplify_templates,
        )
    except ValueError as e:
        raise HTTPException(400, *e.args)

    return {'primers': [pydna_primer_to_primer_model(primer) if primer is not None else None for primer in primers]}


@router.post('/primer_design/simple_pair', response_model=PrimerDesignResponse)
def primer_design_simple_pair(
    pcr_template: PrimerDesignQuery,
    spacers: list[str] | None = Body(
        None,
        description='Spacers to add between the restriction site and the 5\' end of the primer footprint (the part that binds the DNA).',
    ),
    settings: PrimerDesignSettings = Body(description='Primer design settings.', default_factory=PrimerDesignSettings),
    minimal_hybridization_length: int = Query(
        ..., description='The minimal length of the hybridization region in bps.'
    ),
    target_tm: float = Query(
        ..., description='The desired melting temperature for the hybridization part of the primer.'
    ),
    left_enzyme: str | None = Query(None, description='The restriction enzyme for the left side of the sequence.'),
    right_enzyme: str | None = Query(None, description='The restriction enzyme for the right side of the sequence.'),
    left_enzyme_inverted: bool = Query(False, description='Whether the left enzyme site is inverted.'),
    right_enzyme_inverted: bool = Query(False, description='Whether the right enzyme site is inverted.'),
    filler_bases: str = Query(
        'TTT',
        description='These bases are added to the 5\' end of the primer to ensure proper restriction enzyme digestion.',
    ),
):
    """
    Design primers for restriction ligation. If the restriction site contains ambiguous bases, the primer bases will
    be chosen by order of appearance in the dictionary `ambiguous_dna_values` from `Bio.Data.IUPACData`.
    """

    if not re.match(r'^[ACGT]*$', filler_bases.upper()):
        raise HTTPException(400, 'Filler bases can only contain ACGT bases.')

    invalid_enzymes = get_invalid_enzyme_names([left_enzyme, right_enzyme])
    if len(invalid_enzymes):
        raise HTTPException(404, 'These enzymes do not exist: ' + ', '.join(invalid_enzymes))

    validate_spacers(spacers, 1, False)

    dseqr = read_dsrecord_from_json(pcr_template.sequence)
    location = pcr_template.location.to_biopython_location()
    template = location.extract(dseqr)
    if not pcr_template.forward_orientation:
        template = template.reverse_complement()
    template.name = dseqr.name
    template.id = dseqr.id
    # This is to my knowledge the only way to get the enzymes
    rb = RestrictionBatch()
    try:
        primers = simple_pair_primers(
            template,
            minimal_hybridization_length,
            target_tm,
            rb.format(left_enzyme) if left_enzyme is not None else None,
            rb.format(right_enzyme) if right_enzyme is not None else None,
            filler_bases,
            spacers,
            left_enzyme_inverted,
            right_enzyme_inverted,
            tm_func=lambda x: primer3_calc_tm(x, settings),
        )
    except ValueError as e:
        raise HTTPException(400, *e.args)

    return {'primers': [pydna_primer_to_primer_model(primer) for primer in primers]}


@router.post('/primer_design/ebic', response_model=PrimerDesignResponse)
def primer_design_ebic(
    template: PrimerDesignQuery,
    settings: PrimerDesignSettings = Body(description='Primer design settings.', default_factory=PrimerDesignSettings),
    max_inside: int = Query(..., description='The maximum length of the inside edge of the EBIC primer.'),
    max_outside: int = Query(..., description='The maximum length of the outside edge of the EBIC primer.'),
    target_tm: float = Query(
        ..., description='The desired melting temperature for the hybridization part of the primer.'
    ),
    target_tm_tolerance: float = Query(
        3, description='The tolerance for the desired melting temperature for the hybridization part of the primer.'
    ),
    padding_left: int = Query(..., description='The padding length on the left side of the template.'),
    padding_right: int = Query(..., description='The padding length on the right side of the template.'),
):
    """Design primers for EBIC"""
    dseqr = read_dsrecord_from_json(template.sequence)
    location = template.location.to_biopython_location()
    return {
        'primers': ebic_primers(
            dseqr,
            location,
            max_inside,
            max_outside,
            target_tm,
            target_tm_tolerance,
            padding_left,
            padding_right,
            settings,
        )
    }


# @router.post('/primer_design/gateway_attB', response_model=PrimerDesignResponse)
# async def primer_design_gateway_attB(
#     template: PrimerDesignQuery,
#     left_site: str = Query(..., description='The left attB site to recombine.', pattern=r'^attB[1-5]$'),
#     right_site: str = Query(..., description='The right attB site to recombine.', pattern=r'^attB[1-5]$'),
#     spacers: list[str] | None = Body(None, description='Spacers to add between the attB site and the primer.'),
#     filler_bases: str = Query(
#         'GGGG',
#         description='These bases are added to the 5\' end of the primer to ensure proper restriction enzyme digestion.',
#     ),
#     minimal_hybridization_length: int = Query(
#         ..., description='The minimal length of the hybridization region in bps.'
#     ),
#     target_tm: float = Query(
#         ..., description='The desired melting temperature for the hybridization part of the primer.'
#     ),
# ):
#     """Design primers for Gateway attB"""
#     dseqr = read_dsrecord_from_json(template.sequence)
#     location = template.location.to_biopython_location(dseqr.circular, len(dseqr))
#     template = location.extract(dseqr)
#     if not template.forward_orientation:
#         template = template.reverse_complement()
#     template.name = dseqr.name
#     template.id = dseqr.id
#     try:
#         primers = gateway_attB_primers(
#             template, minimal_hybridization_length, target_tm, (left_site, right_site), spacers, filler_bases
#         )
#     except ValueError as e:
#         raise HTTPException(400, *e.args)

#     return {'primers': primers}


class PrimerDetailsResponse(BaseModel):
    melting_temperature: float
    gc_content: float
    homodimer: ThermodynamicResult | None
    hairpin: ThermodynamicResult | None


@router.post('/primer_details', response_model=PrimerDetailsResponse)
def primer_details(
    sequence: str = Body(..., description='Primer sequence', pattern=r'^[ACGTacgt]+$', max_length=MAX_PRIMER_LENGTH),
    settings: PrimerDesignSettings = Body(description='Primer design settings.', default_factory=PrimerDesignSettings),
):
    """Get information about a primer"""
    sequence = sequence.upper()
    tm = primer3_calc_tm(sequence, settings)
    gc_content = gc_fraction(sequence)

    homodimer = primer3_calc_homodimer(sequence, settings)
    hairpin = primer3_calc_hairpin(sequence, settings)

    return {
        'melting_temperature': tm,
        'gc_content': gc_content,
        'homodimer': homodimer,
        'hairpin': hairpin,
    }


@router.post('/primer_heterodimer', response_model=ThermodynamicResult | None)
def primer_heterodimer(
    sequence1: str = Body(
        ..., description='First primer sequence', pattern=r'^[ACGTacgt]+$', max_length=MAX_PRIMER_LENGTH
    ),
    sequence2: str = Body(
        ..., description='Second primer sequence', pattern=r'^[ACGTacgt]+$', max_length=MAX_PRIMER_LENGTH
    ),
    settings: PrimerDesignSettings = Body(description='Primer design settings.', default_factory=PrimerDesignSettings),
):
    """Get information about a primer pair"""

    return primer3_calc_heterodimer(sequence1, sequence2, settings)
