from pydantic import BaseModel, Field, field_validator
from typing import Optional, List

from ._version import __version__

from pydna.opencloning_models import SequenceLocationStr

from opencloning_linkml.datamodel import (
    CloningStrategy as _CloningStrategy,
    Primer as _PrimerModel,
    TextFileSequence as _TextFileSequence,
    Source as _Source,
)

# Maximum length of a primer sequence accepted by the API
MAX_PRIMER_LENGTH = 1000


class PrimerModel(_PrimerModel):
    sequence: Optional[str] = Field(
        default=None,
        max_length=MAX_PRIMER_LENGTH,
        json_schema_extra=_PrimerModel.model_fields['sequence'].json_schema_extra,
    )


class BaseCloningStrategy(_CloningStrategy):
    # For now, we don't add anything, but the classes will not have the new methods if this is used
    # It will be used for validation for now
    primers: Optional[List[PrimerModel]] = Field(
        default_factory=list,
        description="""The primers that are used in the cloning strategy""",
        json_schema_extra={'linkml_meta': {'alias': 'primers', 'domain_of': ['CloningStrategy']}},
    )
    backend_version: Optional[str] = Field(
        default=__version__,
        description="""The version of the backend that was used to generate this cloning strategy""",
        json_schema_extra={'linkml_meta': {'alias': 'backend_version', 'domain_of': ['CloningStrategy']}},
    )

    def add_primer(self, primer: PrimerModel):
        if primer in self.primers:
            return
        primer.id = self.next_id()
        self.primers.append(primer)

    def next_id(self):
        return max([s.id for s in self.sources + self.sequences + self.primers], default=0) + 1

    def add_source_and_sequence(self, source: _Source, sequence: _TextFileSequence):
        if source in self.sources:
            if sequence not in self.sequences:
                raise ValueError(
                    f"Source {source.id} already exists in the cloning strategy, but sequence {sequence.id} it's not its output."
                )
            return
        new_id = self.next_id()
        source.id = new_id
        self.sources.append(source)
        sequence.id = new_id
        self.sequences.append(sequence)

    def all_children_source_ids(self, source_id: int, source_children: list | None = None) -> list[int]:
        """Returns the ids of all source children ids of a source"""
        source = next(s for s in self.sources if s.id == source_id)
        if source_children is None:
            source_children = []

        sources_that_take_output_as_input = [s for s in self.sources if source.id in [inp.sequence for inp in s.input]]
        new_source_ids = [s.id for s in sources_that_take_output_as_input]

        source_children.extend(new_source_ids)
        for new_source_id in new_source_ids:
            self.all_children_source_ids(new_source_id, source_children)
        return source_children


class PrimerDesignQuery(BaseModel):
    model_config = {'arbitrary_types_allowed': True}
    sequence: _TextFileSequence
    location: SequenceLocationStr | None
    forward_orientation: bool = True

    @field_validator('location', mode='before')
    def parse_location(cls, v):
        if v is None:
            return None
        return SequenceLocationStr.field_validator(v)
