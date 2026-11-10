"""Finding regions of a sequence from a description: a feature, an amino acid of a CDS, coordinates.

The model cannot see the bases of a sequence, and strand-aware coordinate arithmetic is where it makes
mistakes ("200 bp upstream" of a gene on the minus strand, "after amino acid 120" of a CDS with introns).
So the model only describes what it wants (Position and Region below), and the arithmetic is done here.

Vocabulary:
- A *boundary* is a point between two bases: 0 is before the first base, len(sequence) is after the last
  one. Boundaries are 0-based and use the coordinates of the top strand.
- A region has a start and an end *in its own direction* (its strand). On the minus strand the start is
  the boundary with the highest coordinate. The "left" of a region is always its lowest coordinate.
- Everything the user sees is 1-based and inclusive, like GenBank.
"""

from dataclasses import dataclass
from typing import Literal

from Bio.Seq import Seq, reverse_complement
from mcp.server.mcpserver.exceptions import ToolError
from opencloning.dna_functions import read_dsrecord_from_json
from opencloning_linkml.datamodel import TextFileSequence
from pydantic import BaseModel, Field, model_validator
from pydna.opencloning_models import SequenceLocationStr

from .summaries import NAME_QUALIFIERS, feature_name

# Number of bases shown on each side of a point or at the ends of a region, when describing them
CONTEXT_BASES = 12
# Number of features listed in an error message
MAX_LISTED_FEATURES = 12


# The two models below are the arguments of the tools: their descriptions are what the model reads.


class Position(BaseModel):
    """A point between two bases of a sequence. Set exactly one anchor: `feature` or `after_base`."""

    feature: str | None = Field(
        None,
        description="Name of a feature (its label, gene, product or locus_tag, not case-sensitive), or '#N' with "
        'the index shown by list_features. Needs `edge` or `after_aa`.',
    )
    feature_type: str | None = Field(
        None,
        description="With `feature`: the type of the feature, e.g. 'CDS' or 'gene'. Needed if the name is shared.",
    )
    edge: Literal['start', 'end'] | None = Field(
        None,
        description="'start' is just before the first base of the feature, 'end' just after its last base, both in "
        "the direction of the feature: for a feature on the minus strand the 'start' is at its highest coordinate.",
    )
    after_aa: int | None = Field(
        None,
        ge=0,
        description='With `feature`, which must be a CDS: the point right after amino acid N, counting from '
        'Met = 1 (the stop codon is the last one). 0 is right before the first codon.',
    )
    after_base: int | None = Field(
        None, ge=0, description='The point right after base N, 1-based, in top-strand coordinates. 0 is before base 1.'
    )
    offset: int = Field(
        0,
        description='Bases to move the point, in the direction of the feature: positive is downstream, negative is '
        'upstream. For `after_base` positive is to the right.',
    )

    @model_validator(mode='after')
    def check_anchor(self):
        if (self.feature is None) == (self.after_base is None):
            raise ValueError('Set exactly one of feature and after_base.')
        if self.feature is None and (self.edge or self.feature_type or self.after_aa is not None):
            raise ValueError('edge, feature_type and after_aa only go with feature.')
        if self.feature is not None and (self.edge is None) == (self.after_aa is None):
            raise ValueError("With a feature, set exactly one of 'edge' and 'after_aa'.")
        return self


class Region(BaseModel):
    """A stretch of a sequence. Use exactly one of three forms: a feature (optionally extended or trimmed),
    from_base + to_base, or a start and an end Position. Without a region, tools use the whole sequence.
    """

    feature: str | None = Field(
        None,
        description="Form 1: the region is this feature (name, or '#N' with the index shown by list_features), "
        'on the strand of the feature. For a feature with introns it includes them.',
    )
    feature_type: str | None = Field(None, description="With `feature`: its type, e.g. 'CDS'.")
    upstream: int = Field(
        0,
        description='With `feature`: bases to add before its start (negative: remove bases from the start, e.g. -3 '
        'drops the ATG). Direction of the feature, so on the minus strand this is towards higher coordinates.',
    )
    downstream: int = Field(
        0,
        description='With `feature`: bases to add after its end (negative: remove bases from the end, e.g. -3 drops '
        'the stop codon).',
    )
    from_base: int | None = Field(
        None, ge=1, description='Form 2: first base, 1-based and inclusive, in top-strand coordinates.'
    )
    to_base: int | None = Field(
        None,
        ge=1,
        description='Form 2: last base, 1-based and inclusive. On a circular sequence, to_base < from_base '
        'means the region goes through the origin.',
    )
    start: Position | None = Field(
        None, description='Form 3: where the region starts, in the direction of the region.'
    )
    end: Position | None = Field(None, description='Form 3: where the region ends, in the direction of the region.')
    strand: Literal['+', '-'] | None = Field(
        None,
        description='Direction of the region in forms 2 and 3. Default: the strand of the feature that the start '
        '(or the end) is anchored on, otherwise +. The tools design the amplicon in this direction.',
    )

    @model_validator(mode='after')
    def check_form(self):
        forms = {
            'feature': self.feature is not None,
            'from_base/to_base': self.from_base is not None or self.to_base is not None,
            'start/end': self.start is not None or self.end is not None,
        }
        used = [name for name, is_used in forms.items() if is_used]
        if len(used) != 1:
            raise ValueError(f'Use exactly one form: feature, from_base + to_base, or start + end (got: {used}).')
        if forms['from_base/to_base'] and (self.from_base is None or self.to_base is None):
            raise ValueError('from_base and to_base go together.')
        if forms['start/end'] and (self.start is None or self.end is None):
            raise ValueError('start and end go together.')
        if self.feature is None and (self.feature_type or self.upstream or self.downstream):
            raise ValueError('feature_type, upstream and downstream only go with feature.')
        if self.feature is not None and self.strand is not None:
            raise ValueError("A feature region uses the strand of the feature: don't set 'strand'.")
        return self


def raise_if_empty(parts: list) -> None:
    if not parts:
        raise ToolError('The feature would be empty: it is shorter than the bases to remove.')


@dataclass
class Feature:
    index: int  # position in the features of the record, the '#N' of list_features
    type: str
    name: str
    qualifiers: dict
    location: object  # Biopython location
    parts: list[tuple[int, int]]  # (start, end) 0-based, in the order the feature is read (the 5' part first)
    strand: int  # 1 or -1

    @property
    def start_boundary(self) -> int:
        start, end = self.parts[0]
        return start if self.strand == 1 else end

    @property
    def end_boundary(self) -> int:
        start, end = self.parts[-1]
        return end if self.strand == 1 else start

    @property
    def length(self) -> int:
        """Bases of the feature, not counting the introns."""
        return sum(end - start for start, end in self.parts)

    @property
    def codon_start(self) -> int:
        return int(self.qualifiers.get('codon_start', ['1'])[0])

    @property
    def genetic_code(self) -> int:
        return int(self.qualifiers.get('transl_table', ['1'])[0])

    def resized_parts(self, upstream: int, downstream: int) -> list[tuple[int, int]]:
        """The parts of the feature after adding bases at its start and end (removing them, if negative).

        Upstream and downstream are in the direction of the feature, and trimming goes through the parts,
        so the last 3 bases of a CDS can be removed even if they are in two exons.
        """
        # Work in the direction the feature is read, where the coordinates of the parts increase
        parts = [(start, end) if self.strand == 1 else (-end, -start) for start, end in self.parts]
        for _ in range(-min(upstream, 0)):
            raise_if_empty(parts)
            parts[0] = (parts[0][0] + 1, parts[0][1])
            if parts[0][0] == parts[0][1]:
                parts.pop(0)
        for _ in range(-min(downstream, 0)):
            raise_if_empty(parts)
            parts[-1] = (parts[-1][0], parts[-1][1] - 1)
            if parts[-1][0] == parts[-1][1]:
                parts.pop()
        raise_if_empty(parts)
        parts[0] = (parts[0][0] - max(upstream, 0), parts[0][1])
        parts[-1] = (parts[-1][0], parts[-1][1] + max(downstream, 0))
        return [(start, end) if self.strand == 1 else (-end, -start) for start, end in parts]

    def boundary_after(self, bases: int) -> int:
        """The boundary after the first `bases` bases of the feature (introns are skipped)."""
        remaining = bases
        for start, end in self.parts:
            if remaining <= end - start:
                return start + remaining if self.strand == 1 else end - remaining
            remaining -= end - start
        raise ValueError('bases is longer than the feature')

    def describe(self) -> str:
        """e.g. "#3 CDS cdc2 complement(61..100)", for messages."""
        location = SequenceLocationStr.from_biopython_location(self.location)
        return ' '.join(part for part in (f'#{self.index}', self.type, self.name, location) if part)


@dataclass
class Point:
    """A resolved Position."""

    boundary: int  # not wrapped: it can be negative or longer than the sequence
    strand: int | None  # the strand of the feature that the point is anchored on, if any
    label: str
    feature: Feature | None = None
    after_aa: int | None = None


@dataclass
class ResolvedRegion:
    left: int  # lowest coordinate, 0-based, in [0, length of the sequence)
    length: int
    strand: int
    label: str
    feature: Feature | None = None  # when the region is a whole feature (form 1) without changes


class SequenceView:
    """A sequence of the strategy, with what is needed to place regions on it."""

    def __init__(self, sequence: dict):
        record = read_dsrecord_from_json(TextFileSequence.model_validate(sequence))
        self.record = record
        self.name = record.name
        self.circular = bool(record.circular)
        self.seq = str(record.seq).upper()
        self.length = len(self.seq)
        self.features = [
            self._feature(index, feature) for index, feature in enumerate(record.features) if feature.type != 'source'
        ]

    @property
    def topology(self) -> str:
        return 'circular' if self.circular else 'linear'

    @staticmethod
    def _feature(index: int, feature) -> Feature:
        return Feature(
            index=index,
            type=feature.type,
            name=feature_name(feature),
            qualifiers=feature.qualifiers,
            location=feature.location,
            parts=[(int(part.start), int(part.end)) for part in feature.location.parts],
            strand=-1 if feature.location.strand == -1 else 1,
        )

    # Features

    def filter_features(self, query: str | None = None, feature_type: str | None = None) -> list[Feature]:
        """The features of a type, whose name or type contains the query (not case-sensitive)."""
        features = [f for f in self.features if feature_type is None or f.type.lower() == feature_type.lower()]
        if query:
            features = [
                f
                for f in features
                if query.lower() in f.type.lower() or any(query.lower() in n for n in self._names(f, NAME_QUALIFIERS))
            ]
        return features

    def find_feature(self, query: str, feature_type: str | None = None) -> Feature:
        candidates = self.filter_features(feature_type=feature_type)
        query = query.strip()
        if query.startswith('#'):
            matches = [f for f in candidates if query[1:].isdigit() and f.index == int(query[1:])]
        else:
            exact = [f for f in candidates if query.lower() in self._names(f, NAME_QUALIFIERS)]
            matches = exact or [
                f for f in candidates if any(query.lower() in n for n in self._names(f, NAME_QUALIFIERS[:-1]))
            ]
        if len(matches) == 1:
            return matches[0]
        of_type = f' of type {feature_type}' if feature_type else ''
        if not matches:
            raise ToolError(
                f'No feature{of_type} matches "{query}" in {self.name}. Call list_features to see them. '
                f'Features: {self._list(candidates)}'
            )
        raise ToolError(
            f'"{query}" matches {len(matches)} features in {self.name}: {self._list(matches)}. '
            'Say which one, with feature_type or with its index, e.g. "#3".'
        )

    @staticmethod
    def _names(feature: Feature, qualifiers) -> list[str]:
        return [value.lower() for q in qualifiers for value in feature.qualifiers.get(q, [])]

    @staticmethod
    def _list(features: list[Feature]) -> str:
        shown = '; '.join(f.describe() for f in features[:MAX_LISTED_FEATURES])
        return shown + (
            f'; ... and {len(features) - MAX_LISTED_FEATURES} more' if len(features) > MAX_LISTED_FEATURES else ''
        )

    def transcript(self, feature: Feature) -> str:
        """The bases of the feature in the order they are read (minus strand: reverse complemented)."""
        pieces = [self.seq[start:end] for start, end in feature.parts]
        return ''.join(reverse_complement(p) for p in pieces) if feature.strand == -1 else ''.join(pieces)

    def protein(self, feature: Feature) -> str:
        """The translation of a CDS, with * for the stop codon."""
        sequence = self.transcript(feature)[feature.codon_start - 1 :]
        sequence = sequence[: len(sequence) // 3 * 3]
        return str(Seq(sequence).translate(table=feature.genetic_code))

    def feature_span(self, feature: Feature) -> int:
        """Bases from the start to the end of the feature, introns included (it can go through the origin)."""
        span = (feature.end_boundary - feature.start_boundary) * feature.strand
        return (span % self.length or self.length) if self.circular else span

    # Sequence

    def window(self, start: int, end: int) -> str:
        """Top-strand bases between two boundaries, which can be outside the sequence.

        On circular sequences it goes around the origin, on linear ones it stops at the ends.
        """
        if not self.circular:
            return self.seq[max(start, 0) : max(end, 0)]
        pieces, remaining, position = [], end - start, start % self.length
        while remaining > 0:
            piece = self.seq[position : position + remaining]
            pieces.append(piece)
            remaining -= len(piece)
            position = 0
        return ''.join(pieces)

    def region_sequence(self, region: ResolvedRegion) -> str:
        """The bases of the region in its own direction."""
        bases = self.window(region.left, region.left + region.length)
        return reverse_complement(bases) if region.strand == -1 else bases

    def location(self, region: ResolvedRegion, strand: int | None = None) -> SequenceLocationStr:
        """The GenBank-style location of the region (it wraps through the origin if needed).

        By default it has the strand of the region. The design endpoints want strand 1 always,
        and the orientation separately.
        """
        right = region.left + region.length
        right = right if right <= self.length else right - self.length
        return SequenceLocationStr.from_start_and_end(
            region.left, right, self.length, region.strand if strand is None else strand
        )

    def insertion_location(self, boundary: int) -> SequenceLocationStr:
        """The location that the homologous recombination design reads as "insert at this boundary".

        It is a zero-length stretch, which the API writes as a location going all the way around: from the
        boundary to the end of the sequence and from the start to the boundary.
        """
        return SequenceLocationStr.from_start_and_end(boundary, boundary, self.length, None)

    # Resolving

    def resolve_position(self, position: Position) -> Point:
        if position.feature is not None:
            feature = self.find_feature(position.feature, position.feature_type)
            if position.after_aa is not None:
                boundary = self._boundary_after_aa(feature, position.after_aa)
                label = f'{feature.name or feature.type} aa{position.after_aa}'
            else:
                boundary = feature.start_boundary if position.edge == 'start' else feature.end_boundary
                label = f'{feature.name or feature.type} {position.edge}'
            return Point(
                boundary + feature.strand * position.offset, feature.strand, label, feature, position.after_aa
            )
        if position.after_base > self.length:
            raise ToolError(f'after_base {position.after_base} is beyond the end of the sequence ({self.length} bp).')
        return Point(position.after_base + position.offset, None, f'base {position.after_base}')

    def _boundary_after_aa(self, feature: Feature, amino_acids: int) -> int:
        if feature.type != 'CDS':
            raise ToolError(
                f'after_aa needs a CDS, and {feature.describe()} is a {feature.type}. '
                "Use feature_type='CDS' to pick the CDS, or use 'edge' and 'offset'."
            )
        bases = feature.codon_start - 1 + 3 * amino_acids
        protein = self.protein(feature)
        if bases > feature.length:
            raise ToolError(
                f'{feature.describe()} has {len(protein)} codons (including the stop codon, if any), '
                f'so there is no amino acid {amino_acids}.'
            )
        return feature.boundary_after(bases)

    def _make_region(
        self, start: int, length: int, strand: int, label: str, feature: Feature | None = None
    ) -> ResolvedRegion:
        """A region from its start boundary (in its direction) and its length."""
        if length < 1:
            raise ToolError(f'The region would be empty ({length} bp): check the offsets and the strand.')
        left = start if strand == 1 else start - length
        if self.circular:
            if length > self.length:
                raise ToolError(f'The region ({length} bp) is longer than the circular sequence ({self.length} bp).')
            left %= self.length
        elif left < 0:
            raise ToolError(
                f'The region starts {-left} bases before the start of {self.name} (linear, {self.length} bp).'
            )
        elif left + length > self.length:
            raise ToolError(
                f'The region ends {left + length - self.length} bases after the end of {self.name} '
                f'(linear, {self.length} bp).'
            )
        return ResolvedRegion(left, length, strand, label, feature)

    def _region_between(self, start: int, end: int, strand: int, label: str) -> ResolvedRegion:
        raw = (end - start) * strand
        if self.circular:
            raw %= self.length
        if raw <= 0:
            direction = 'plus' if strand == 1 else 'minus'
            raise ToolError(
                f'The end of the region is not after its start in the direction of the {direction} strand '
                f'(or they are the same point). For a minus-strand region, the start has the higher coordinate.'
            )
        return self._make_region(start, raw, strand, label)

    def resolve_region(self, region: Region | None) -> ResolvedRegion:
        if region is None:
            return ResolvedRegion(0, self.length, 1, self.name)
        if region.feature is not None:
            feature = self.find_feature(region.feature, region.feature_type)
            length = self.feature_span(feature) + region.upstream + region.downstream
            start = feature.start_boundary - feature.strand * region.upstream
            unchanged = region.upstream == 0 and region.downstream == 0
            return self._make_region(
                start, length, feature.strand, feature.name or feature.type, feature if unchanged else None
            )
        if region.from_base is not None:
            if region.to_base > self.length or (region.from_base > region.to_base and not self.circular):
                raise ToolError(
                    f'Bases {region.from_base}..{region.to_base} do not fit in {self.name} '
                    f'({self.length} bp, {"circular" if self.circular else "linear"}).'
                )
            strand = -1 if region.strand == '-' else 1
            start, end = (
                (region.from_base - 1, region.to_base) if strand == 1 else (region.to_base, region.from_base - 1)
            )
            return self._region_between(start, end, strand, f'{region.from_base}-{region.to_base}')
        start, end = self.resolve_position(region.start), self.resolve_position(region.end)
        strand = {'+': 1, '-': -1, None: start.strand or end.strand or 1}[region.strand]
        return self._region_between(start.boundary, end.boundary, strand, f'{start.label}_to_{end.label}')

    def insertion_boundary(self, point: Point) -> int:
        """The boundary of a point, to insert something there (a zero-length replacement)."""
        boundary = point.boundary % self.length if self.circular else point.boundary
        if boundary < 0 or boundary > self.length or (not self.circular and boundary in (0, self.length)):
            raise ToolError(f'The point ({point.label}) is outside {self.name} or at its very end ({self.length} bp).')
        if boundary == 0:
            raise ToolError(
                f'The point ({point.label}) is at the origin of the circular sequence {self.name}: an insertion '
                'there cannot be expressed. Choose a point a few bases away from the origin.'
            )
        return boundary

    # Describing

    def describe_region(self, region: ResolvedRegion) -> dict:
        """What the region is, for the model to check against what the user asked."""
        bases = self.region_sequence(region)
        description = {
            'location': str(self.location(region)),
            'strand': '+' if region.strand == 1 else '-',
            'length': region.length,
            'first_bases': bases[:CONTEXT_BASES],
            'last_bases': bases[-CONTEXT_BASES:],
        }
        if region.feature is not None and region.feature.type == 'CDS':
            protein = self.protein(region.feature)
            shown = protein if len(protein) <= 20 else f'{protein[:10]}...{protein[-5:]}'
            description['protein'] = f'{shown} ({len(protein.rstrip("*"))} aa)'
        return description

    def describe_point(self, point: Point) -> dict:
        """Where the point is: the bases and, in a CDS, the amino acids around it."""
        boundary = point.boundary
        if self.circular:
            boundary = boundary % self.length or self.length
        elif not 0 <= boundary <= self.length:
            raise ToolError(f'The point ({point.label}) is outside {self.name} (linear, {self.length} bp).')
        left, right = self.window(boundary - CONTEXT_BASES, boundary), self.window(boundary, boundary + CONTEXT_BASES)
        if point.strand == -1:
            left, right = reverse_complement(right), reverse_complement(left)
        description = {
            'between_bases': f'{boundary}|{boundary % self.length + 1}',
            'strand': '-' if point.strand == -1 else '+',
            'context': f'{left}|{right}',
        }
        if point.after_aa is not None and point.feature is not None:
            protein = self.protein(point.feature)
            before = f'{protein[point.after_aa - 1]}{point.after_aa}' if point.after_aa >= 1 else 'start'
            after = f'{protein[point.after_aa]}{point.after_aa + 1}' if point.after_aa < len(protein) else 'end'
            description['between_amino_acids'] = f'{before}|{after}'
        return description

    def feature_row(self, feature: Feature) -> dict:
        """One line of list_features."""
        row = {
            'index': feature.index,
            'type': feature.type,
            'name': feature.name,
            'location': str(SequenceLocationStr.from_biopython_location(feature.location)),
            'length': feature.length,
        }
        if len(feature.parts) > 1:
            row['exons'] = len(feature.parts)
        if feature.type == 'CDS':
            protein = self.protein(feature)
            row['protein_aa'] = len(protein.rstrip('*'))
            row['ends_with_stop_codon'] = protein.endswith('*')
        return row
