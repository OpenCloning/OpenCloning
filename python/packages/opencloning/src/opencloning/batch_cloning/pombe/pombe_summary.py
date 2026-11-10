from pydna.utils import location_boundaries
from ...pydantic_models import BaseCloningStrategy
from opencloning_linkml.datamodel import Primer as PrimerModel, PCRSource
from pydna.parsers import parse as pydna_parse
import os
import json
from pydna import tm
from Bio.Seq import reverse_complement
import argparse
from Bio.SeqFeature import Location

SEQUENCE_LENGTH_KEYS = {
    'amplified_marker': 'amplified_marker_length',
    'check_pcr_left': 'check_pcr_left_length',
    'check_pcr_right': 'check_pcr_right_length',
}


def _sequence_names_by_id(strategy: BaseCloningStrategy) -> dict[int, str]:
    names = {source.id: source.output_name for source in strategy.sources if source.output_name is not None}
    for sequence in strategy.sequences:
        if sequence.id not in names:
            names[sequence.id] = pydna_parse(sequence.file_content)[0].name
    return names


def _primer_binding(source: PCRSource, primer: PrimerModel) -> str:
    for fragment in source.input:
        if fragment.sequence != primer.id:
            continue
        if fragment.right_location is not None:
            loc = Location.fromstring(fragment.right_location)
            return loc.extract(primer.sequence)
        loc = Location.fromstring(fragment.left_location)
        return loc.extract(reverse_complement(primer.sequence))
    raise ValueError(f'Primer {primer.id} not found in PCR source {source.id}')


def _primer_summary_entry(key: str, primer: PrimerModel, source: PCRSource) -> dict:
    bound = _primer_binding(source, primer)
    if 'rvs' in key:
        bound = reverse_complement(bound)
    return {
        key: primer.sequence,
        f'{key}_name': primer.name,
        f'{key}_bound': bound,
        f'{key}_tm': tm.tm_default(bound),
    }


def _add_pcr_primers(
    primer_dict: dict,
    source: PCRSource,
    output_name: str,
    primer_by_id: dict[int, PrimerModel],
) -> None:
    primer_ids = [inp.sequence for inp in source.input if inp.sequence in primer_by_id]
    if output_name == 'amplified_marker':
        if len(primer_ids) < 2:
            return
        primer_dict.update(_primer_summary_entry('primer_fwd', primer_by_id[primer_ids[0]], source))
        primer_dict.update(_primer_summary_entry('primer_rvs', primer_by_id[primer_ids[1]], source))
    elif output_name == 'check_pcr_left' and primer_ids:
        primer_dict.update(_primer_summary_entry('primer_fwd_check', primer_by_id[primer_ids[0]], source))
    elif output_name == 'check_pcr_right' and primer_ids:
        primer_dict.update(_primer_summary_entry('primer_rvs_check', primer_by_id[primer_ids[-1]], source))


def extract_primers_from_strategy(strategy: BaseCloningStrategy) -> dict:
    primer_by_id = {primer.id: primer for primer in strategy.primers}
    seq_id_to_name = _sequence_names_by_id(strategy)
    primer_dict: dict = {}

    for source in strategy.sources:
        if source.type != 'PCRSource':
            continue
        output_name = seq_id_to_name.get(source.id)
        if output_name is None:
            continue
        _add_pcr_primers(primer_dict, source, output_name, primer_by_id)

    return primer_dict


def process_folder(working_dir: str):
    with open(os.path.join(working_dir, 'cloning_strategy.json'), 'r') as f:
        strategy = BaseCloningStrategy.model_validate(json.load(f))

    locus_source = next(s for s in strategy.sources if s.type == 'GenomeCoordinatesSource')
    locus_location = Location.fromstring(locus_source.coordinates)
    hrec_source = next(s for s in strategy.sources if s.type == 'HomologousRecombinationSource')

    metadata_path = os.path.join(working_dir, 'metadata.json')
    metadata = {}
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)

    summary = {
        'gene': os.path.basename(working_dir),
        'cloning_type': metadata.get('cloning_type', 'gene_deletion'),
        'allele_name': metadata.get('allele_name'),
        'chromosome': locus_source.repository_id,
        'insertion_start': (
            locus_location.start + location_boundaries(Location.fromstring(hrec_source.input[0].right_location))[1]
        ),
        'insertion_end': (
            locus_location.start + location_boundaries(Location.fromstring(hrec_source.input[-1].left_location))[0]
        ),
    }

    for sequence in strategy.sequences:
        seq = pydna_parse(sequence.file_content)[0]
        with open(os.path.join(working_dir, f'{seq.name}.gb'), 'w') as f:
            f.write(seq.format('genbank'))
        length_key = SEQUENCE_LENGTH_KEYS.get(seq.name)
        if length_key is not None:
            summary[length_key] = len(seq.seq)

    summary.update(extract_primers_from_strategy(strategy))

    with open(os.path.join(working_dir, 'summary.json'), 'w') as f:
        json.dump(summary, f, indent=4)


def main(input_dir: str):
    for folder in os.listdir(input_dir):
        working_dir = os.path.join(input_dir, folder)
        if not os.path.isdir(working_dir):
            continue
        if not os.path.exists(os.path.join(working_dir, 'cloning_strategy.json')):
            print(f"Skipping {folder}: no cloning_strategy.json found")
            continue
        process_folder(working_dir)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Process cloning strategies and generate summaries')
    parser.add_argument(
        '--input_dir', type=str, default='batch_cloning_output', help='Input directory containing gene folders'
    )
    args = parser.parse_args()

    main(args.input_dir)
