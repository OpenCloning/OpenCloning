"""Find open reading frames (ORFs), to help annotate a sequence.

Biopython has no ORF finder (its tutorial only shows how to translate the six frames and split at the stop
codons), and pydna's only looks at the plus strand and starts at every ATG, so this is done here: the six
frames are translated and cut at the stop codons, and each stretch between two stops gives one ORF.
"""

from typing import Literal

from Bio.Data import CodonTable
from Bio.Seq import Seq, reverse_complement
from mcp.server.mcpserver.exceptions import ToolError

from . import storage
from .app import mcp
from .regions import Region, SequenceView
from .tools_primers import get_sequence

# Number of ORFs in an answer, the longest first
MAX_ORFS = 20
STOP = '*'


def orfs_of_strand(
    bases: str, minus_strand: bool, offset: int, table: int, min_aa: int, require_met: bool
) -> list[dict]:
    """The ORFs of the three frames of one strand of `bases`, which are at `offset` in the top strand.

    `bases` is the top strand. For the minus strand its reverse complement is read, and the coordinates are
    brought back to the top strand. Coordinates are 0-based, end exclusive.
    """
    reading = reverse_complement(bases) if minus_strand else bases
    orfs = []
    for frame in range(3):
        usable = reading[frame : frame + (len(reading) - frame) // 3 * 3]
        protein = str(Seq(usable).translate(table=table))
        segment_start = 0
        while segment_start < len(protein):
            stop = protein.find(STOP, segment_start)
            closed = stop != -1
            segment_end = stop if closed else len(protein)
            first = protein.find('M', segment_start, segment_end) if require_met else segment_start
            if first != -1 and segment_end - first >= min_aa:
                start = frame + 3 * first
                end = frame + 3 * (segment_end + closed)
                if minus_strand:
                    start, end = len(reading) - end, len(reading) - start
                orfs.append(
                    {
                        'start': offset + start,
                        'end': offset + end,
                        'minus_strand': minus_strand,
                        'protein': protein[first:segment_end],
                        'starts_with_met': protein[first] == 'M',
                        'ends_with_stop': closed,
                    }
                )
            segment_start = segment_end + 1
    return orfs


def describe_orf(orf: dict, view: SequenceView) -> dict:
    """One ORF for the answer: 1-based location, length and the CDSs that it overlaps."""
    location = f'{orf["start"] + 1}..{orf["end"]}'
    protein = orf['protein']
    overlaps = [
        f'{feature.name or feature.type} {feature.describe().rsplit(" ", 1)[-1]}'
        for feature in view.features
        if feature.type == 'CDS' and any(start < orf['end'] and orf['start'] < end for start, end in feature.parts)
    ]
    row = {
        'location': f'complement({location})' if orf['minus_strand'] else location,
        'length_aa': len(protein),
        'starts_with_met': orf['starts_with_met'],
        'ends_with_stop': orf['ends_with_stop'],
        'protein': protein if len(protein) <= 20 else f'{protein[:10]}...{protein[-5:]}',
    }
    if overlaps:
        row['overlaps_cds'] = overlaps
    return row


@mcp.tool()
def find_orfs(
    strategy_id: str,
    sequence_id: int,
    region: Region | None = None,
    min_aa: int = 100,
    start: Literal['met', 'any'] = 'met',
    strand: Literal['+', '-', 'both'] = 'both',
    genetic_code: int = 1,
) -> dict:
    """Find open reading frames in a sequence, e.g. to annotate a CDS or check a tag is in frame (read-only).

    The six frames are translated and cut at the stop codons; each stretch between two stops gives one ORF, the
    longest ones first (at most 20 are shown, `total` is how many there are). With start='met' (default) an
    ORF starts at the first Met after the previous stop, so it is the longest ORF for that stop codon, and
    start='any' starts it right after the previous stop codon (use it to find ORFs whose Met is not known or
    that are cut at the start of the sequence). `min_aa` is the minimum length in amino acids, not counting
    the stop. The location of a closed ORF includes its stop codon, like a GenBank CDS; `ends_with_stop`
    false means the ORF runs into the end of the sequence or of `region`. `overlaps_cds` lists the CDSs
    already annotated there. ORFs are continuous: a gene with introns shows up as several pieces, and ORFs
    through the origin of a circular sequence are not found. Short ORFs are common by chance, so a long one
    (hundreds of amino acids), or one that overlaps a known feature, is much more likely to be real. To
    annotate one, pass its location to add_feature.
    """
    if min_aa < 1:
        raise ToolError('min_aa must be at least 1.')
    if genetic_code not in CodonTable.unambiguous_dna_by_id:
        raise ToolError(f'Unknown genetic code {genetic_code}: use an NCBI table number, e.g. 1 or 11.')
    strategy = storage.load_strategy(strategy_id)
    _, view = get_sequence(strategy, sequence_id)
    resolved = view.resolve_region(region)
    if resolved.left + resolved.length > view.length:
        raise ToolError('The region goes through the origin of the sequence: search two regions instead.')
    window = view.seq[resolved.left : resolved.left + resolved.length]
    orfs = []
    for minus_strand in (False, True):
        if strand == 'both' or (strand == '-') == minus_strand:
            orfs += orfs_of_strand(window, minus_strand, resolved.left, genetic_code, min_aa, start == 'met')
    orfs.sort(key=lambda orf: (-len(orf['protein']), orf['start']))
    result = {
        'sequence': view.name,
        'searched': f'{resolved.left + 1}..{resolved.left + resolved.length}',
        'total': len(orfs),
        'orfs': [describe_orf(orf, view) for orf in orfs[:MAX_ORFS]],
    }
    if len(orfs) > MAX_ORFS:
        result['note'] = (
            f'{len(orfs)} ORFs found, only the {MAX_ORFS} longest are shown: raise min_aa or set a region.'
        )
    return result
