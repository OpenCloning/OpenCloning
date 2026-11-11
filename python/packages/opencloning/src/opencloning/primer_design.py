from pydna.dseqrecord import Dseqrecord
from pydna.primer import Primer
from pydna.design import primer_design, assembly_fragments
from Bio.SeqFeature import SimpleLocation
from pydna.utils import locations_overlap, shift_location, location_boundaries
from pydna.amplicon import Amplicon
from Bio.Seq import reverse_complement
from Bio.Restriction.Restriction import RestrictionType
from Bio.Data.IUPACData import ambiguous_dna_values as _ambiguous_dna_values
from typing import Callable
from .primer3_functions import primer3_calc_tm, PrimerDesignSettings, primer3_design_primers

ambiguous_dna_values = _ambiguous_dna_values.copy()
# Remove acgt
for base in 'ACGT':
    del ambiguous_dna_values[base]


def default_tm_func(sequence: str) -> float:
    return primer3_calc_tm(sequence, PrimerDesignSettings())


def homologous_recombination_primers(
    pcr_seq: Dseqrecord,
    pcr_loc: SimpleLocation,
    hr_seq: Dseqrecord,
    hr_loc: SimpleLocation,
    homology_length: int,
    minimal_hybridization_length: int,
    insert_forward: bool,
    target_tm: float,
    spacers: list[str] | None = None,
    tm_func: Callable[[str], float] = default_tm_func,
    estimate_function: Callable[[str], float] | None = None,
) -> tuple[str, str]:

    fragment2amplify = pcr_loc.extract(pcr_seq)
    amplicon = primer_design(
        fragment2amplify,
        limit=minimal_hybridization_length,
        target_tm=target_tm,
        tm_func=tm_func,
        estimate_function=estimate_function,
    )

    if insert_forward:
        fwd_primer, rvs_primer = amplicon.primers()
    else:
        rvs_primer, fwd_primer = amplicon.primers()

    if fwd_primer is None or rvs_primer is None:
        raise ValueError('Primers could not be designed, try changing settings.')

    hr_loc_start, hr_loc_end = location_boundaries(hr_loc)
    fwd_homology_start = hr_loc_start - homology_length
    rvs_homology_end = hr_loc_end + homology_length

    if spacers is None:
        spacers = ['', '']

    if len(spacers) != 2:
        raise ValueError("The 'spacers' list must contain exactly two elements.")

    if not hr_seq.circular:
        if fwd_homology_start < 0:
            raise ValueError('Forward homology region is out of bounds.')
        if rvs_homology_end > len(hr_seq):
            raise ValueError('Reverse homology region is out of bounds.')

    # Convert to locations
    fwd_arm = shift_location(SimpleLocation(fwd_homology_start, hr_loc_start), 0, len(hr_seq))
    rvs_arm = shift_location(SimpleLocation(hr_loc_end, rvs_homology_end), 0, len(hr_seq))

    if locations_overlap(fwd_arm, rvs_arm, len(hr_seq)):
        raise ValueError('Homology arms overlap.')

    fwd_homology = fwd_arm.extract(hr_seq)
    rvs_homology = rvs_arm.extract(hr_seq).reverse_complement()

    fwd_primer_seq = (str(fwd_homology.seq) + spacers[0]).lower() + str(fwd_primer.seq).upper()
    rvs_primer_seq = (str(rvs_homology.seq) + reverse_complement(spacers[1])).lower() + str(rvs_primer.seq).upper()

    return fwd_primer_seq, rvs_primer_seq


def gibson_assembly_primers(
    templates: list[Dseqrecord],
    homology_length: int,
    minimal_hybridization_length: int,
    target_tm: float,
    circular: bool,
    spacers: list[str] | None = None,
    tm_func: Callable[[str], float] = default_tm_func,
    estimate_function: Callable[[str], float] | None = None,
    amplify_templates: list[bool] | None = None,
) -> list[Primer]:

    if amplify_templates is None:
        amplify_templates = [True] * len(templates)
    if len(amplify_templates) != len(templates):
        raise ValueError('The number of amplify_templates must be the same as the number of templates.')
    for prev, next in zip(amplify_templates[:-1], amplify_templates[1:]):
        if not prev and not next:
            raise ValueError('Two consecutive templates with amplify_templates=False are not allowed.')
    if circular and (not amplify_templates[-1] and not amplify_templates[0]):
        raise ValueError('Two consecutive templates with amplify_templates=False are not allowed.')

    if len(templates) == 1 and amplify_templates[0] is False:
        raise ValueError('amplify_templates cannot be False for a single template.')

    if spacers is not None and not circular:
        if spacers[0] != '' and not amplify_templates[0]:
            raise ValueError(
                'The first spacer must be empty if the first template is not amplified in linear assembly.'
            )
        if spacers[-1] != '' and not amplify_templates[-1]:
            raise ValueError('The last spacer must be empty if the last template is not amplified in linear assembly.')

    # For the function assembly_fragments, maxlink is the maximum length of a Dseqrecord to be considered a spacer.
    # It's important to check that the amplify_templates=False parts are not longer than maxlink, otherwise, they
    # would be considered as spacers. This is perhaps not ideal, as there could be a case, for now we just do it
    # like this.

    maxlink = minimal_hybridization_length * 2
    if spacers is not None:
        maxlink = max(len(spacer) for spacer in spacers)

    inputs: list[Amplicon | Dseqrecord] = list()
    for i, template in enumerate(templates):
        if amplify_templates[i]:
            inputs.append(
                primer_design(
                    template,
                    limit=minimal_hybridization_length,
                    target_tm=target_tm,
                    tm_func=tm_func,
                    estimate_function=estimate_function,
                )
            )
        else:
            if len(template) < maxlink:
                raise ValueError(
                    f'Template {template.name} ({len(template)} bps) is shorter than the longest spacer or 2x the minimal hybridization length.'
                )
            inputs.append(template)

    for i, amplicon in enumerate(inputs):
        if amplify_templates[i] is True and None in amplicon.primers():
            raise ValueError(f'Primers could not be designed for template {templates[i].name}, try changing settings.')

    if spacers is not None:
        spacers = [Dseqrecord(spacer) for spacer in spacers]
        inputs_withspacers = []
        # For linear assemblies, the first spacer is the first thing
        if not circular:
            inputs_withspacers.append(spacers.pop(0))
        for part in inputs:
            inputs_withspacers.append(part)
            inputs_withspacers.append(spacers.pop(0))
        inputs = inputs_withspacers
        # Maxlink is used to define what is a spacer or what is a template (see docs)
    inputs = [i for i in inputs if len(i) > 0]
    assembly_output: list[Amplicon] = assembly_fragments(
        inputs, overlap=homology_length, circular=circular, maxlink=maxlink
    )

    all_primers = list()
    for i, part in enumerate(assembly_output):
        all_primers.extend(list(part.primers() if amplify_templates[i] is True else [None, None]))

    for i in range(0, len(all_primers), 2):
        fwd, rvs = all_primers[i : i + 2]
        if fwd is None or rvs is None:
            continue
        template = templates[i // 2]
        template_name = template.name if template.name != 'name' else f'seq_{template.id}'
        fwd.name = f'{template_name}_fwd'
        rvs.name = f'{template_name}_rvs'

    return all_primers


def sanitize_enzyme_site(site: str) -> str:
    """
    Replaces any ambiguous bases with the first value of the ambiguous base from the Biopython IUPACData.
    """
    return ''.join(b if b not in ambiguous_dna_values else ambiguous_dna_values[b][0] for b in site)


def simple_pair_primers(
    template: Dseqrecord,
    minimal_hybridization_length: int,
    target_tm: float,
    left_enzyme: RestrictionType,
    right_enzyme: RestrictionType,
    filler_bases: str,
    spacers: list[str] | None = None,
    left_enzyme_inverted: bool = False,
    right_enzyme_inverted: bool = False,
    tm_func: Callable[[str], float] = default_tm_func,
    estimate_function: Callable[[str], float] | None = None,
) -> tuple[Primer, Primer]:
    """
    Design primers to amplify a DNA fragment, if left_enzyme or right_enzyme are set, the primers will be designed
    to include the restriction enzyme sites.
    """

    if spacers is None:
        spacers = ['', '']

    if len(spacers) != 2:
        raise ValueError("The 'spacers' list must contain exactly two elements.")

    amplicon = primer_design(
        template,
        limit=minimal_hybridization_length,
        target_tm=target_tm,
        tm_func=tm_func,
        estimate_function=estimate_function,
    )
    fwd_primer, rvs_primer = amplicon.primers()

    if fwd_primer is None or rvs_primer is None:
        raise ValueError('Primers could not be designed, try changing settings.')

    template_name = template.name if template.name != 'name' else f'seq_{template.id}'

    left_site = '' if left_enzyme is None else sanitize_enzyme_site(left_enzyme.site)
    right_site = '' if right_enzyme is None else sanitize_enzyme_site(right_enzyme.site)

    if left_enzyme_inverted:
        left_site = reverse_complement(left_site)
    if right_enzyme_inverted:
        right_site = reverse_complement(right_site)
    if left_enzyme is not None:
        left_site = filler_bases + left_site
    if right_enzyme is not None:
        right_site = filler_bases + right_site

    fwd_primer_seq = left_site + spacers[0] + fwd_primer.seq
    rvs_primer_seq = right_site + reverse_complement(spacers[1]) + rvs_primer.seq

    fwd_primer_name = f'{template_name}_{left_enzyme}_fwd' if left_enzyme is not None else f'{template_name}_fwd'
    rvs_primer_name = f'{template_name}_{right_enzyme}_rvs' if right_enzyme is not None else f'{template_name}_rvs'

    return (Primer(fwd_primer_seq, name=fwd_primer_name), Primer(rvs_primer_seq, name=rvs_primer_name))


def primer_to_amplify_fragment_of_given_size_knowing_other_primer(
    template: Dseqrecord,
    known_primer: Primer,
    known_is_forward: bool,
    fragment_size_range: list[int, int],
) -> Primer:
    """
    Design primers to amplify a DNA fragment of a given size, knowing one primer.
    """
    settings = PrimerDesignSettings()

    if known_is_forward:
        seq_args = {
            'SEQUENCE_PRIMER': str(known_primer.seq),
        }
    else:
        seq_args = {
            'SEQUENCE_PRIMER_REVCOMP': str(known_primer.seq),
        }

    result = primer3_design_primers(
        str(template.seq).upper(),
        seq_args=seq_args,
        global_args={
            'PRIMER_PRODUCT_SIZE_RANGE': [fragment_size_range],  # ~500 bp band
            'PRIMER_OPT_SIZE': 20,
            'PRIMER_MIN_SIZE': 18,
            'PRIMER_MAX_SIZE': 30,
            'PRIMER_PAIR_MAX_DIFF_TM': 3,
            'PRIMER_PICK_ANYWAY': 1,
            'GC_CONTENT_MIN': 10,
            'GC_CONTENT_MAX': 90,
            **settings.to_primer3_args(),
        },
    )
    try:
        if known_is_forward:
            return Primer(result['PRIMER_RIGHT'][0]['SEQUENCE'], name=f'{template.name}_fwd')
        else:
            return Primer(result['PRIMER_LEFT'][0]['SEQUENCE'], name=f'{template.name}_rvs')
    except IndexError:
        print(result)
        raise ValueError(f'Primers for checking could not be designed: {result}')


def primer_in_region(sequence: Dseqrecord, forward: bool) -> Primer:
    """
    Design a forward or reverse primer constrained to lie within a subsequence of a template.
    """

    settings = PrimerDesignSettings()

    result = primer3_design_primers(
        str(sequence.seq).upper(),
        seq_args={},
        global_args={
            'PRIMER_PICK_LEFT_PRIMER': int(forward),
            'PRIMER_PICK_RIGHT_PRIMER': int(not forward),
            'PRIMER_OPT_TM': 55,
            'PRIMER_MIN_TM': 52,
            'PRIMER_MAX_TM': 60,
            **settings.to_primer3_args(),
        },
    )
    try:
        if forward:
            return Primer(result['PRIMER_LEFT'][0]['SEQUENCE'], name=f'{sequence.name}_fwd')
        else:
            return Primer(result['PRIMER_RIGHT'][0]['SEQUENCE'], name=f'{sequence.name}_rvs')
    except (IndexError, KeyError):
        raise ValueError(f'Primer could not be designed in region: {result}')
