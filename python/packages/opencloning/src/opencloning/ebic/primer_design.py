from pydna.dseqrecord import Dseqrecord
from Bio.SeqFeature import SimpleLocation
from ..primer3_functions import PrimerDesignSettings, primer3_design_primers

from opencloning_linkml.datamodel import Primer as PrimerModel
from .primer_design_settings import amanda_settings

adapter_left_fwd = 'ataGGTCTCtGGAG'
adapter_left_rvs = 'ataGGTCTCtCATT'
adapter_right_fwd = 'ataGGTCTCtGCTT'
adapter_right_rvs = 'ataGGTCTCtAGCG'
default_settings = PrimerDesignSettings()


def ebic_primers(
    input_seq: Dseqrecord,
    location: SimpleLocation,
    max_inside: int,
    max_outside: int,
    target_tm: float,
    target_tm_tolerance: float,
    padding_left: int = 1000,
    padding_right: int = 1000,
    settings: PrimerDesignSettings = default_settings,
) -> tuple[PrimerModel, PrimerModel, PrimerModel, PrimerModel]:
    """Design primers for EBIC"""

    # First, we keep only the part within the padding
    edge_left = location.start - padding_left
    edge_right = location.end + padding_right
    if edge_left < 0 or edge_right > len(input_seq):
        raise ValueError('The template is too short for the padding.')

    template_seq = str(input_seq.seq[edge_left:edge_right])
    inside_edge_left = padding_left + max_inside
    inside_edge_right = padding_right + max_inside
    outside_edge_left = padding_left - max_outside

    left_template = template_seq[:inside_edge_left]
    right_template = template_seq[-inside_edge_right:]

    seq_args_left = {
        'SEQUENCE_PRIMER_PAIR_OK_REGION_LIST': f'0,{int(padding_left/2)},{outside_edge_left},{max_outside + max_inside}',
    }
    seq_args_right = {
        'SEQUENCE_PRIMER_PAIR_OK_REGION_LIST': f'0,{max_outside + max_inside},{len(right_template) - int(padding_right/2)},{int(padding_right/2)}',
    }

    global_args = amanda_settings.copy()
    global_args['PRIMER_OPT_TM'] = target_tm
    global_args['PRIMER_MIN_TM'] = target_tm - target_tm_tolerance
    global_args['PRIMER_MAX_TM'] = target_tm + target_tm_tolerance
    global_args['PRIMER_SALT_MONOVALENT'] = settings.primer_salt_monovalent
    global_args['PRIMER_SALT_DIVALENT'] = settings.primer_salt_divalent
    global_args['PRIMER_DNA_CONC'] = settings.primer_dna_conc
    global_args_left = global_args.copy()
    global_args_right = global_args.copy()
    global_args_left['PRIMER_PRODUCT_SIZE_RANGE'] = [[max(100, padding_left - 100), padding_left]]
    global_args_right['PRIMER_PRODUCT_SIZE_RANGE'] = [[max(100, padding_right - 100), padding_right]]

    report_left = primer3_design_primers(left_template, seq_args_left, global_args_left)
    report_right = primer3_design_primers(right_template, seq_args_right, global_args_right)
    primer_names = ['left_fwd', 'left_rvs', 'right_fwd', 'right_rvs']
    primer_seqs = [
        adapter_left_fwd + report_left['PRIMER_LEFT'][0]['SEQUENCE'],
        adapter_left_rvs + report_left['PRIMER_RIGHT'][0]['SEQUENCE'],
        adapter_right_fwd + report_right['PRIMER_LEFT'][0]['SEQUENCE'],
        adapter_right_rvs + report_right['PRIMER_RIGHT'][0]['SEQUENCE'],
    ]
    return [PrimerModel(id=0, name=primer_names[i], sequence=primer_seqs[i]) for i in range(4)]
