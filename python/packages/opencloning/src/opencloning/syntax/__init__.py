import re
import networkx as nx
from Bio.Restriction.Restriction import RestrictionType
from Bio.Seq import reverse_complement
from typing import Dict, List
from pydna.dseqrecord import Dseqrecord

from pydantic import BaseModel, Field, GetJsonSchemaHandler, field_validator
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema

from opencloning.dna_functions import get_invalid_enzyme_names
from opencloning.endpoints.endpoint_utils import parse_restriction_enzymes

from .css_colors import CSS_COLORS


def open_graph_at_node(graph: nx.DiGraph, node: str) -> nx.DiGraph:
    """Remove all incoming edges to a node in the graph.

    Args:
        graph: The directed graph to modify
        node: The node whose incoming edges should be removed

    Returns:
        A new graph with all incoming edges to the node removed
    """
    new_graph = graph.copy()
    for edge in graph.in_edges(node):
        new_graph.remove_edge(*edge)
    return new_graph


def is_part_palindromic(left_overhang: str, right_overhang: str) -> bool:
    return left_overhang == reverse_complement(left_overhang) and right_overhang == reverse_complement(right_overhang)


class DNASequence(str):
    """A DNA sequence string that only contains ACGT characters (uppercase)."""

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler) -> core_schema.CoreSchema:
        return core_schema.no_info_after_validator_function(
            cls._validate,
            core_schema.str_schema(),
            serialization=core_schema.str_schema(),
        )

    @classmethod
    def _validate(cls, value: str) -> 'DNASequence':
        if not isinstance(value, str):
            raise TypeError('DNA sequence must be a string')
        if value and not re.match(r'^[ACGT]+$', value):
            raise ValueError(f"DNA sequence must only contain uppercase ACGT characters, " f"got: {value}")
        return cls(value)

    @classmethod
    def __get_pydantic_json_schema__(cls, _core_schema, handler: GetJsonSchemaHandler) -> JsonSchemaValue:
        return {'type': 'string', 'pattern': '^[ACGT]*$'}


class Part(BaseModel):
    """Represents a single part in the syntax."""

    id: int
    name: str
    info: str = Field(default='')
    glyph: str = Field(default='')
    left_overhang: DNASequence
    right_overhang: DNASequence
    left_inside: DNASequence = Field(default='')
    right_inside: DNASequence = Field(default='')
    left_codon_start: int = Field(default=0)
    right_codon_start: int = Field(default=0)
    color: str = Field(default='')

    @property
    def key(self) -> str:
        """The key of the part is the concatenation of the left and right overhangs."""
        return f"{self.left_overhang}-{self.right_overhang}"

    @field_validator('color')
    @classmethod
    def validate_color(cls, value: str) -> str:
        """Validate color format - can be empty or valid CSS color."""
        # Color can be empty
        if not value or value.strip() == '':
            return ''

        color = value.strip()

        # Check if it's a valid CSS color name
        if color.lower() in CSS_COLORS:
            return color

        # Check hex color format (# followed by 3-6 hex digits)
        if re.match(r'^#[0-9A-Fa-f]{3,6}$', color):
            return color

        # Check rgb() format
        if re.match(r'^rgb\(\d{1,3},\d{1,3},\d{1,3}\)$', color):
            return color

        # Check rgba() format
        if re.match(r'^rgba\(\d{1,3},\d{1,3},\d{1,3},\d{1,3}\)$', color):
            return color

        # Check hsl() format
        if re.match(r'^hsl\(\d{1,3},\d{1,3},\d{1,3}\)$', color):
            return color

        # Check hsla() format
        if re.match(r'^hsla\(\d{1,3},\d{1,3},\d{1,3},\d{1,3}\)$', color):
            return color

        raise ValueError(f"Invalid color format: {color}")

    @field_validator('left_overhang', 'right_overhang')
    @classmethod
    def validate_overhang(cls, value: DNASequence) -> DNASequence:
        if len(value) < 3:
            raise ValueError(f"Overhang must be 3 or more characters long, got: {value}")
        return DNASequence(value)

    @field_validator('left_codon_start', 'right_codon_start')
    @classmethod
    def validate_codon_start(cls, value: int) -> int:
        if value < 0:
            raise ValueError(f"Codon start must be non-negative, got: {value}")
        return value


class Syntax(BaseModel):
    """Represents a complete syntax definition."""

    syntaxName: str = Field(alias='syntax_name', default='')
    assemblyEnzymes: List[str] = Field(alias='assembly_enzymes', min_length=1)
    domesticationEnzyme: str | None = Field(alias='domestication_enzyme', default=None)
    relatedDois: List[str] = Field(alias='related_dois', default_factory=list)
    submitters: List[str] = Field(default_factory=list)
    overhangNames: Dict[DNASequence, str] = Field(alias='overhang_names')
    parts: List[Part] = Field(alias='parts', min_length=2)

    @field_validator('submitters')
    @classmethod
    def validate_submitters(cls, value: List[str]) -> List[str]:
        for submitter in value:
            if not re.match(r'^\d{4}-\d{4}-\d{4}-\d{4}$', submitter):
                raise ValueError(f"Submitter must be a valid ORCID, got: {submitter}")
        return value

    @field_validator('overhangNames')
    @classmethod
    def validate_overhang_names(cls, value: Dict[DNASequence, str]) -> Dict[DNASequence, str]:
        for overhang in value.keys():
            if len(overhang) < 3:
                raise ValueError(f"Overhang must be 3 or more characters long, got: {overhang}")
        return value

    @field_validator('parts')
    @classmethod
    def validate_parts(cls, value: List[Part]) -> List[Part]:
        seen_ids = set()
        for part in value:
            if part.id in seen_ids:
                raise ValueError(f"Duplicate part ID found: {part.id}")
            seen_ids.add(part.id)
        return value

    @field_validator('assemblyEnzymes')
    @classmethod
    def validate_assembly_enzymes(cls, value: List[str]) -> List[str]:
        if not value:
            raise ValueError('assemblyEnzymes must contain at least one enzyme')
        invalid_enzymes = get_invalid_enzyme_names(value)
        if invalid_enzymes:
            raise ValueError(f"Invalid enzyme(s): {', '.join(invalid_enzymes)}")
        return value

    @field_validator('domesticationEnzyme')
    @classmethod
    def validate_domestication_enzyme(cls, value: str | None) -> str | None:
        if value is None or value == '':
            return None
        invalid_enzymes = get_invalid_enzyme_names([value])
        if len(invalid_enzymes):
            raise ValueError(f"Invalid enzyme: {value}")
        return value

    class Config:
        populate_by_name = True

    def to_edges_graph(self) -> nx.DiGraph:
        graph = nx.DiGraph()
        for part in self.parts:
            graph.add_edge(part.left_overhang, part.right_overhang)
        return graph

    def get_assembly_enzymes(self) -> List[RestrictionType]:
        batch = parse_restriction_enzymes(self.assemblyEnzymes)
        return [batch.format(name) for name in self.assemblyEnzymes]

    def assign_plasmid_to_syntax_part(self, plasmid: Dseqrecord) -> list[dict]:
        graph = self.to_edges_graph()
        assembly_enzymes = self.get_assembly_enzymes()
        result = []

        # Enzymes are processed in order, so the first enzyme that finds a part is used.
        # This is for syntaxes like GoldenBraid, that in the omega 1 assembly uses BsmBI
        # for the backbone, and BtgZI for the parts.
        # The order of the enzymes therefore matters, and in that case we put BsmBI first,
        # because in principle domesticated parts should not have BsmBI recognition sites.

        for enzyme in assembly_enzymes:
            for fragment in plasmid.cut(enzyme):
                for rc in [True, False]:
                    query = fragment.reverse_complement() if rc else fragment
                    three_type, three_ovhg = query.seq.three_prime_end()
                    five_type, five_ovhg = query.seq.five_prime_end()
                    # It must only have 5' overhangs
                    if three_type != five_type or five_type != "5'":
                        continue
                    # It must not contain the recognition site of any enzyme inside
                    # since they are always in the backbone, not the part.
                    # We use compsite, because the simple search method requires the
                    # cutsite to be there, and not sure how behaviour will be querying
                    # the overhangs.
                    if enzyme.compsite.search(str(query.seq)) is not None:
                        continue

                    left_node = three_ovhg.upper()
                    right_node = reverse_complement(five_ovhg).upper()
                    # This most likely means single cut in the plasmid
                    if left_node == right_node:
                        continue

                    # Parts that have both overhangs palindromic are assigned the part
                    # that does not traverse the first node, which is normally the intended
                    # assignment. One example is the BB2_AB plasmid in GoldenPiCS, which
                    # has overhangs GATC-CCGG (A-B), so it can be either A->B or B->A.
                    # We keep A->B as the intended assignment.

                    graph2use = graph
                    if is_part_palindromic(left_node, right_node):
                        graph2use = open_graph_at_node(graph, list(graph.nodes)[0])

                    if (
                        left_node in graph2use
                        and right_node in graph2use
                        and nx.has_path(graph2use, left_node, right_node)
                    ):
                        result.append(
                            {
                                'key': f"{left_node}-{right_node}",
                                'longest_feature': max(fragment.features, key=lambda x: len(x.location), default=None),
                            }
                        )
            if len(result) > 0:
                break
        # Remove duplicates with same key, keeping the first occurrence.
        result = list({d['key']: d for d in reversed(result)}.values())[::-1]
        return result
