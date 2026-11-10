"""Short descriptions of sequences: what the model sees instead of the full GenBank files."""

from opencloning.dna_functions import read_dsrecord_from_json
from opencloning_linkml.datamodel import TextFileSequence

MAX_FEATURES = 15

# The qualifiers that hold the name of a feature, in order of preference
NAME_QUALIFIERS = ('label', 'gene', 'product', 'locus_tag', 'name', 'note')


def describe_end(end: tuple[str, str]) -> str:
    """pydna describes a sequence end as ("blunt", "") or e.g. ("5'", "aatt")."""
    end_type, overhang = end
    return 'blunt' if end_type == 'blunt' else f'{end_type} overhang {overhang.upper()}'


def feature_name(feature) -> str:
    for qualifier in NAME_QUALIFIERS:
        if qualifier in feature.qualifiers:
            return feature.qualifiers[qualifier][0]
    return ''


def summarize_sequence(sequence: dict) -> dict:
    """Summarize a TextFileSequence (as stored in the strategy JSON)."""
    record = read_dsrecord_from_json(TextFileSequence.model_validate(sequence))
    summary = {
        'name': record.name,
        'length': len(record),
        'topology': 'circular' if record.circular else 'linear',
    }
    if not record.circular:
        summary['left_end'] = describe_end(record.seq.five_prime_end())
        summary['right_end'] = describe_end(record.seq.three_prime_end())

    # e.g. "CDS hph 1023..2048 (+)", the "source" feature spans the whole sequence and says nothing
    features = [f for f in record.features if f.type != 'source']
    summary['features'] = [
        f'{f.type} {feature_name(f)} {f.location.start + 1}..{f.location.end} ({"+" if f.location.strand != -1 else "-"})'
        for f in features[:MAX_FEATURES]
    ]
    if len(features) > MAX_FEATURES:
        summary['features'].append(f'... and {len(features) - MAX_FEATURES} more features')
    return summary
