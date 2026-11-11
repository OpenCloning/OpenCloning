"""
SQLAlchemy ORM models for the OpenCloning database.
"""

import enum
from datetime import datetime
from typing import List, Optional, TypeVar, Union, get_args, Self

from opencloning.dna_functions import read_dsrecord_from_json
from opencloning.pydantic_models import MAX_PRIMER_LENGTH
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    JSON,
    LargeBinary,
    Table,
    Text,
    UniqueConstraint,
    event,
    select,
    text,
)

from sqlalchemy.sql import func
from sqlalchemy.ext.orderinglist import ordering_list
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    validates,
    Session as SASession,
)

import opencloning_linkml.datamodel.models as opencloning_models
from pydantic import BaseModel as PydanticBaseModel
from pydna.readers import read
import re

from opencloning_db.context import WriteContext
from fastapi import HTTPException

# Source type union from CloningStrategy.sources (list[Union[Source, ...]])
AnySource = get_args(opencloning_models.CloningStrategy.model_fields['sources'].annotation)[0]

# SourceType enum derived from AnySource union members
SourceType = enum.Enum(
    'SourceType',
    [(cls.__name__, cls.__name__) for cls in get_args(AnySource)],
)


def sanitize_sequence_name(name: str) -> str:
    return name.strip().replace(' ', '_')


class SequenceType(enum.Enum):
    """Classification of a sequence (e.g. locus, plasmid, PCR product)."""

    locus = 'locus'
    allele = 'allele'
    plasmid = 'plasmid'
    pcr_product = 'pcr_product'
    restriction_fragment = 'restriction_fragment'
    linear_dna = 'linear_dna'


class WorkspaceRole(enum.Enum):
    owner = 'owner'
    editor = 'editor'
    viewer = 'viewer'


class AnySourceParser(PydanticBaseModel):
    source: AnySource

    @classmethod
    def from_kwargs(cls, **kwargs):
        return cls(source=kwargs).source


class Base(DeclarativeBase):

    def __repr__(self):
        # Only include key attributes to avoid recursion through relationships
        out_str = f"{self.__class__.__name__}"
        if hasattr(self, 'id'):
            out_str += f"(id={self.id})\n"
        else:  # pragma: no cover
            out_str += '\n'
        for key, value in self.__dict__.items():
            # Skip relationship attributes and internal SQLAlchemy attributes
            if not key.startswith('_') and not isinstance(value, Base):
                out_str += f' {key}: {value}\n'
        return out_str


class User(Base):
    __tablename__ = 'user'
    __table_args__ = (UniqueConstraint('auth_provider', 'external_subject', name='uq_user_auth_identity'),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[Optional[str]] = mapped_column(unique=True, nullable=True)
    display_name: Mapped[str] = mapped_column(nullable=False)
    auth_provider: Mapped[Optional[str]] = mapped_column(nullable=True)
    external_subject: Mapped[Optional[str]] = mapped_column(nullable=True)
    is_instance_admin: Mapped[bool] = mapped_column(nullable=False, default=False)

    memberships: Mapped[List['WorkspaceMembership']] = relationship(
        back_populates='user',
        cascade='all, delete-orphan',
    )


class Workspace(Base):
    __tablename__ = 'workspace'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(nullable=False)

    memberships: Mapped[List['WorkspaceMembership']] = relationship(
        back_populates='workspace',
        cascade='all, delete-orphan',
    )
    input_entities: Mapped[List['InputEntity']] = relationship(back_populates='workspace')
    tags: Mapped[List['Tag']] = relationship(back_populates='workspace')
    lines: Mapped[List['Line']] = relationship(back_populates='workspace')


class WorkspaceMembership(Base):
    __tablename__ = 'workspace_membership'
    __table_args__ = (UniqueConstraint('user_id', 'workspace_id', name='uq_workspace_membership_user_workspace'),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('user.id'), nullable=False)
    workspace_id: Mapped[int] = mapped_column(ForeignKey('workspace.id'), nullable=False)
    role: Mapped[WorkspaceRole] = mapped_column(Enum(WorkspaceRole, validate_strings=True), nullable=False)

    user: Mapped['User'] = relationship(back_populates='memberships')
    workspace: Mapped['Workspace'] = relationship(back_populates='memberships')


# Many-to-many: tags <-> input_entity (sequences, primers)
input_entity_tag = Table(
    'input_entity_tag',
    Base.metadata,
    Column('input_entity_id', Integer, ForeignKey('input_entity.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tag.id'), primary_key=True),
)

# Many-to-many: line <-> tag
line_tag = Table(
    'line_tag',
    Base.metadata,
    Column('line_id', Integer, ForeignKey('line.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tag.id'), primary_key=True),
)


class Tag(Base):
    """User-defined tag for grouping sequences and primers (e.g. projects)."""

    __tablename__ = 'tag'
    __table_args__ = (
        UniqueConstraint('workspace_id', 'name', name='uq_tag_workspace_name'),
        CheckConstraint("name <> ''", name='tag_name_not_empty'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey('workspace.id'), nullable=False)
    name: Mapped[str] = mapped_column(nullable=False)

    workspace: Mapped['Workspace'] = relationship(back_populates='tags')

    input_entities: Mapped[List['InputEntity']] = relationship(
        'InputEntity',
        secondary=input_entity_tag,
        back_populates='tags',
    )

    lines: Mapped[List['Line']] = relationship(
        'Line',
        secondary=line_tag,
        back_populates='tags',
    )


class InputEntity(Base):
    __tablename__ = 'input_entity'
    __table_args__ = (
        Index(
            'uq_input_entity_template_sequence_workspace_name',
            'workspace_id',
            text('lower(name)'),
            unique=True,
            postgresql_where=text("type = 'template_sequence'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey('workspace.id'), nullable=False)
    type: Mapped[str] = mapped_column()
    name: Mapped[str] = mapped_column(default='name')
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    created_by_id: Mapped[int] = mapped_column(ForeignKey('user.id'), nullable=False)
    workspace: Mapped['Workspace'] = relationship(back_populates='input_entities')
    source_inputs: Mapped[List['SourceInput']] = relationship(back_populates='input_entity')
    created_by: Mapped['User'] = relationship(foreign_keys=[created_by_id])
    tags: Mapped[List['Tag']] = relationship(
        'Tag',
        secondary=input_entity_tag,
        back_populates='input_entities',
    )

    __mapper_args__ = {
        'polymorphic_on': type,
        'polymorphic_identity': 'input_entity',
    }


class BaseSequence(InputEntity):
    __tablename__ = 'base_sequence'

    id: Mapped[int] = mapped_column(ForeignKey('input_entity.id'), primary_key=True)
    sequence_type: Mapped[Optional[SequenceType]] = mapped_column(
        Enum(SequenceType, validate_strings=True), default=None, nullable=True
    )
    instances: Mapped[List['SequenceInstance']] = relationship(back_populates='sequence', cascade='all, delete-orphan')

    __mapper_args__ = {
        'polymorphic_abstract': True,
    }

    @property
    def sample_uids(self) -> List[str]:
        return [s.uid for s in self.instances if isinstance(s, SequenceSample)]

    def to_pydantic_sequence(self) -> opencloning_models.Sequence:
        raise NotImplementedError('to_pydantic_sequence is not implemented for BaseSequence')


class Sequence(BaseSequence):
    __tablename__ = 'sequence'

    id: Mapped[int] = mapped_column(ForeignKey('base_sequence.id'), primary_key=True)
    output_of_source: Mapped['Source'] = relationship(
        back_populates='output_sequence', uselist=False, single_parent=True, cascade='all, delete-orphan'
    )
    overhang_crick_3prime: Mapped[int] = mapped_column(default=0)
    overhang_watson_3prime: Mapped[int] = mapped_column(default=0)
    seguid: Mapped[str] = mapped_column(nullable=False)

    file_content: Mapped[str] = mapped_column(Text, nullable=False, deferred=True)
    sequencing_files: Mapped[List['SequencingFile']] = relationship(
        back_populates='sequence', cascade='all, delete-orphan'
    )

    __mapper_args__ = {
        'polymorphic_identity': 'sequence',
    }

    def to_pydantic_sequence(self) -> opencloning_models.TextFileSequence:
        # We do the renaming here when returning the sequence to prevent editing the original sequence file.
        seqrecord = read(self.file_content)
        seqrecord.name = sanitize_sequence_name(self.name)

        return opencloning_models.TextFileSequence(
            id=self.id,
            file_content=seqrecord.format('genbank'),
            overhang_crick_3prime=self.overhang_crick_3prime,
            overhang_watson_3prime=self.overhang_watson_3prime,
            sequence_file_format='genbank',
        )

    @classmethod
    def from_create(
        cls,
        *,
        name: str,
        file_content: str,
        seguid: str,
        ctx: WriteContext,
        overhang_crick_3prime: int = 0,
        overhang_watson_3prime: int = 0,
        sequence_type: Optional[SequenceType] = None,
    ) -> Self:
        """Build a Sequence from explicit fields and a write context."""
        return cls(
            name=name,
            workspace_id=ctx.workspace_id,
            file_content=file_content,
            seguid=seguid,
            created_by_id=ctx.user.id,
            overhang_crick_3prime=overhang_crick_3prime,
            overhang_watson_3prime=overhang_watson_3prime,
            sequence_type=sequence_type,
        )

    @classmethod
    def from_pydantic_sequence(
        cls,
        pydantic_sequence: opencloning_models.TextFileSequence,
        *,
        ctx: WriteContext,
    ) -> Self:
        """
        Create a database sequence from a pydantic sequence. It does not persist the sequence to the database.
        The GenBank payload is stored directly in the database row.
        """
        file_content = _require_value(pydantic_sequence.file_content, 'TextFileSequence.file_content is required.')
        seqrecord = read_dsrecord_from_json(pydantic_sequence)
        seguid = seqrecord.seq.seguid()
        return cls.from_create(
            name=seqrecord.name,
            file_content=file_content,
            seguid=seguid,
            ctx=ctx,
            **pydantic_sequence.model_dump(include={'overhang_crick_3prime', 'overhang_watson_3prime'}),
        )


class TemplateSequence(BaseSequence):
    __tablename__ = 'template_sequence'

    id: Mapped[int] = mapped_column(ForeignKey('base_sequence.id'), primary_key=True)

    __mapper_args__ = {
        'polymorphic_identity': 'template_sequence',
    }

    @classmethod
    def from_create(
        cls,
        *,
        name: str,
        sequence_type: SequenceType,
        ctx: WriteContext,
    ) -> Self:
        return cls(
            name=name,
            workspace_id=ctx.workspace_id,
            created_by_id=ctx.user.id,
            sequence_type=sequence_type,
        )

    def to_pydantic_sequence(self) -> opencloning_models.TemplateSequence:
        return opencloning_models.TemplateSequence(
            id=self.id,
            circular=self.sequence_type == SequenceType.plasmid,
        )


def template_sequence_name_taken(
    session: SASession,
    *,
    workspace_id: int,
    name: str,
    exclude_id: int | None = None,
) -> bool:
    """Return whether another template sequence in the workspace already has this name (case-insensitive)."""
    stmt = select(TemplateSequence.id).where(
        TemplateSequence.workspace_id == workspace_id,
        func.lower(TemplateSequence.name) == name.lower(),
    )
    if exclude_id is not None:
        stmt = stmt.where(TemplateSequence.id != exclude_id)
    return session.scalar(stmt.limit(1)) is not None


def assert_template_sequence_name_available(
    session: SASession,
    *,
    workspace_id: int,
    name: str,
    exclude_id: int | None = None,
) -> None:
    if template_sequence_name_taken(session, workspace_id=workspace_id, name=name, exclude_id=exclude_id):
        raise HTTPException(
            status_code=409,
            detail=f"Template sequence '{name}' already exists in this workspace",
        )


class Primer(InputEntity):
    __tablename__ = 'primer'

    __table_args__ = (
        CheckConstraint("uid IS NULL OR uid <> ''", name='primer_uid_not_empty'),
        Index('uq_primer_workspace_uid_ci', 'workspace_id', text('lower(uid)'), unique=True),
    )

    id: Mapped[int] = mapped_column(ForeignKey('input_entity.id'), primary_key=True)
    # Duplicates InputEntity.workspace_id to support workspace-scoped UID uniqueness.
    uid_workspace_id: Mapped[int] = mapped_column('workspace_id', ForeignKey('workspace.id'), nullable=False)
    uid: Mapped[Optional[str]] = mapped_column(nullable=True)
    sequence: Mapped[str]

    __mapper_args__ = {
        'polymorphic_identity': 'primer',
    }

    @validates('workspace_id', 'uid_workspace_id')
    def _primer_workspace_columns_must_match(self, key: str, value: int) -> int:
        other_key = 'uid_workspace_id' if key == 'workspace_id' else 'workspace_id'
        other = getattr(self, other_key, None)
        if other is not None and value != other:
            raise ValueError('Primer uid_workspace_id must equal workspace_id on the input_entity row.')
        return value

    @validates('sequence')
    def _validate_sequence(self, key, value: str) -> str:
        if not re.match(r'^[ACGTacgt]+$', value):
            raise ValueError('Primer sequence must only contain ACGT characters')
        if len(value) < 2:
            raise ValueError('Primer sequence must be at least 2 characters long')
        if len(value) > MAX_PRIMER_LENGTH:
            raise ValueError(f'Primer sequence cannot be longer than {MAX_PRIMER_LENGTH} characters')
        return value

    @validates('uid')
    def _validate_uid(self, key, value: Optional[str]) -> Optional[str]:
        if value == '':
            raise ValueError("Primer uid cannot be empty string; use NULL for 'unset'.")
        return value

    @classmethod
    def from_pydantic(
        cls,
        pydantic_primer: opencloning_models.Primer,
        *,
        ctx: WriteContext,
    ) -> 'Primer':
        return cls(
            workspace_id=ctx.workspace_id,
            uid_workspace_id=ctx.workspace_id,
            created_by_id=ctx.user.id,
            **pydantic_primer.model_dump(include={'sequence', 'name'}),
        )

    @classmethod
    def from_create(
        cls,
        *,
        name: str,
        sequence: str,
        uid: Optional[str] = None,
        ctx: WriteContext,
    ) -> 'Primer':
        """Build a Primer from request-body fields and a write context."""
        return cls(
            name=name,
            sequence=sequence,
            uid=uid,
            workspace_id=ctx.workspace_id,
            uid_workspace_id=ctx.workspace_id,
            created_by_id=ctx.user.id,
        )

    def to_pydantic_primer(self) -> opencloning_models.Primer:
        return opencloning_models.Primer(
            id=self.id,
            name=self.name,
            sequence=self.sequence,
            database_id=self.id,
        )


class Source(Base):
    __tablename__ = 'source'

    id: Mapped[int] = mapped_column(ForeignKey('sequence.id'), primary_key=True)
    type: Mapped[SourceType] = mapped_column(Enum(SourceType, validate_strings=True))
    output_sequence: Mapped['Sequence'] = relationship(
        back_populates='output_of_source', uselist=False, single_parent=True
    )
    input: Mapped[List['SourceInput']] = relationship(
        back_populates='source',
        order_by='SourceInput.position',
        collection_class=ordering_list('position'),
        cascade='all, delete-orphan',
    )

    extra_fields: Mapped[dict] = mapped_column(JSON)

    # Fields mapped to ORM columns; all others go to extra_fields
    _ORM_FIELDS = {'type', 'id', 'input', 'output_name', 'database_id'}

    @classmethod
    def from_pydantic(
        cls,
        pydantic_source: opencloning_models.Source,
        output_sequence: 'Sequence',
        entity_mapping: dict[int, InputEntity],
    ) -> 'Source':

        input_value = [_to_db_input(item, entity_mapping[item.sequence]) for item in pydantic_source.input]
        extra_fields = {k: v for k, v in pydantic_source.model_dump().items() if k not in cls._ORM_FIELDS}
        return cls(
            type=pydantic_source.type,
            output_sequence=output_sequence,
            input=input_value,
            extra_fields=extra_fields,
        )

    def to_pydantic_source(self) -> opencloning_models.Source:
        return AnySourceParser.from_kwargs(
            id=self.id,
            database_id=self.id,
            type=self.type.value,
            input=[source_input.to_pydantic() for source_input in self.input],
            **self.extra_fields,
        )


class SourceInput(Base):
    __tablename__ = 'source_input'

    # PK (source_id, position) allows same input_entity to appear multiple times with different locations
    source_id: Mapped[int] = mapped_column(ForeignKey('source.id'), primary_key=True)
    position: Mapped[int] = mapped_column(primary_key=True)
    input_entity_id: Mapped[int] = mapped_column(ForeignKey('input_entity.id'))
    type: Mapped[str] = mapped_column()
    # Optional reference to the specific physical/real-world instance used.
    # Deliberately not cross-checked against input_entity_id to allow provenance
    # tracking even when a UID is later re-pointed to a corrected sequence.
    sequence_instance_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey('sequence_instance.id'), nullable=True, default=None
    )

    source: Mapped['Source'] = relationship(back_populates='input')
    input_entity: Mapped['InputEntity'] = relationship(back_populates='source_inputs')
    sequence_instance: Mapped[Optional['SequenceInstance']] = relationship()

    __mapper_args__ = {
        'polymorphic_on': type,
        'polymorphic_identity': 'source_input',
    }

    def to_pydantic(self) -> opencloning_models.SourceInput:
        return opencloning_models.SourceInput(sequence=self.input_entity.id)


class AssemblyFragment(SourceInput):
    __tablename__ = 'assembly_fragment'
    __table_args__ = (
        ForeignKeyConstraint(
            ['source_id', 'position'],
            ['source_input.source_id', 'source_input.position'],
        ),
        CheckConstraint(
            'left_location IS NOT NULL OR right_location IS NOT NULL',
            name='assembly_fragment_has_location',
        ),
    )

    source_id: Mapped[int] = mapped_column(primary_key=True)
    position: Mapped[int] = mapped_column(primary_key=True)
    left_location: Mapped[Optional[str]]
    right_location: Mapped[Optional[str]]
    reverse_complemented: Mapped[bool]

    __mapper_args__ = {
        'polymorphic_identity': 'assembly_fragment',
        'inherit_condition': (
            (SourceInput.source_id == source_id)  # type: ignore[name-defined]
            & (SourceInput.position == position)  # type: ignore[name-defined]
        ),
    }

    def __init__(self, **kwargs):
        # Fail fast when constructing from Python; DB CHECK constraint enforces on persist.
        left = kwargs.get('left_location')
        right = kwargs.get('right_location')
        if left is None and right is None:
            raise ValueError('At least one of left_location or right_location must be defined')
        super().__init__(**kwargs)

    def to_pydantic(self) -> opencloning_models.AssemblyFragment:
        # New model: left_location and right_location are strings (e.g. "1..4")
        return opencloning_models.AssemblyFragment(
            sequence=self.input_entity.id,
            left_location=self.left_location,
            right_location=self.right_location,
            reverse_complemented=self.reverse_complemented,
        )


def _to_db_input(
    item: Union[opencloning_models.SourceInput, opencloning_models.AssemblyFragment],
    entity: InputEntity,
) -> Union[SourceInput, AssemblyFragment]:
    if isinstance(item, opencloning_models.AssemblyFragment):
        return AssemblyFragment(
            input_entity=entity,
            **item.model_dump(include={'left_location', 'right_location', 'reverse_complemented'}),
        )
    return SourceInput(input_entity=entity)


class SequencingFile(Base):
    __tablename__ = 'sequencing_file'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sequence_id: Mapped[int] = mapped_column(ForeignKey('sequence.id'), nullable=False)
    original_name: Mapped[str] = mapped_column()
    file_content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, deferred=True)

    sequence: Mapped['Sequence'] = relationship(back_populates='sequencing_files')

    __table_args__ = (
        UniqueConstraint('sequence_id', 'original_name', name='uq_sequencefile_sequenceid_originalname'),
    )


class SequenceInstance(Base):
    """
    Base table for all concrete instances of a sequence -- either a physical
    sample in a lab (SequenceSample) or a sequence present in a biological
    line/strain (SequenceInLine). The parent table holds only the FK to the
    theoretical sequence record; child tables add instance-specific columns.
    """

    __tablename__ = 'sequence_instance'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sequence_id: Mapped[int] = mapped_column(ForeignKey('base_sequence.id'), nullable=False)
    type: Mapped[str] = mapped_column()

    sequence: Mapped['BaseSequence'] = relationship(back_populates='instances')

    __mapper_args__ = {
        'polymorphic_on': type,
        'polymorphic_identity': 'sequence_instance',
    }


class SequenceSample(SequenceInstance):
    """
    A physical lab sample with a user-defined UID pointing to the sequence the
    user considers correct. UID is assigned before sequencing; after sequencing
    it can be re-pointed to a corrected sequence by updating sequence_id on the
    parent SequenceInstance row.
    """

    __tablename__ = 'sequence_sample'
    __table_args__ = (Index('uq_sequence_sample_workspace_uid_ci', 'workspace_id', text('lower(uid)'), unique=True),)

    id: Mapped[int] = mapped_column(ForeignKey('sequence_instance.id'), primary_key=True)
    # Duplicates the owning sequence workspace to support workspace-scoped UID uniqueness.
    uid_workspace_id: Mapped[int] = mapped_column('workspace_id', ForeignKey('workspace.id'), nullable=False)
    uid: Mapped[str] = mapped_column()

    __mapper_args__ = {
        'polymorphic_identity': 'sequence_sample',
    }


class SequenceInLine(SequenceInstance):
    """
    Represents a sequence (allele, plasmid, etc.) that is present in a
    biological line or strain. Multiple rows with the same (sequence_id,
    line_id) are allowed to model diploid/polyploid copies.
    """

    __tablename__ = 'sequence_in_line'

    id: Mapped[int] = mapped_column(ForeignKey('sequence_instance.id'), primary_key=True)
    line_id: Mapped[int] = mapped_column(ForeignKey('line.id'), nullable=False)

    line: Mapped['Line'] = relationship(back_populates='sequences_in_line')

    __mapper_args__ = {
        'polymorphic_identity': 'sequence_in_line',
    }


# Many-to-many: Line <-> Line (parents)
line_parent = Table(
    'line_parent',
    Base.metadata,
    Column('line_id', Integer, ForeignKey('line.id'), primary_key=True),
    Column('parent_id', Integer, ForeignKey('line.id'), primary_key=True),
    CheckConstraint('line_id <> parent_id', name='line_not_own_parent'),
)


class Line(Base):
    """Engineered strain / cell line."""

    __tablename__ = 'line'
    __table_args__ = (Index('uq_line_workspace_uid_ci', 'workspace_id', text('lower(uid)'), unique=True),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey('workspace.id'), nullable=False)
    uid: Mapped[str] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    created_by_id: Mapped[int] = mapped_column(ForeignKey('user.id'), nullable=False)

    workspace: Mapped['Workspace'] = relationship(back_populates='lines')
    created_by: Mapped['User'] = relationship(foreign_keys=[created_by_id])

    # Self-referential many-to-many: a line can have many parents,
    # and each parent can have many children.
    parents: Mapped[List['Line']] = relationship(
        'Line',
        secondary=line_parent,
        primaryjoin='Line.id == line_parent.c.line_id',
        secondaryjoin='Line.id == line_parent.c.parent_id',
        back_populates='children',
    )
    children: Mapped[List['Line']] = relationship(
        'Line',
        secondary=line_parent,
        primaryjoin='Line.id == line_parent.c.parent_id',
        secondaryjoin='Line.id == line_parent.c.line_id',
        back_populates='parents',
    )

    sequences_in_line: Mapped[List['SequenceInLine']] = relationship(
        back_populates='line',
    )

    tags: Mapped[List['Tag']] = relationship(
        'Tag',
        secondary=line_tag,
        back_populates='lines',
    )

    @classmethod
    def from_create(cls, *, uid: str, ctx: WriteContext) -> 'Line':
        """Build a Line from request-body fields and a write context."""
        return cls(uid=uid, workspace_id=ctx.workspace_id, created_by_id=ctx.user.id)

    @property
    def parent_ids(self) -> List[int]:
        return [p.id for p in self.parents]

    @property
    def children_ids(self) -> List[int]:
        return [c.id for c in self.children]

    @property
    def alleles(self) -> List['SequenceInLine']:
        return [s for s in self.sequences_in_line if s.sequence.sequence_type == SequenceType.allele]

    @property
    def plasmids(self) -> List['SequenceInLine']:
        return [s for s in self.sequences_in_line if s.sequence.sequence_type == SequenceType.plasmid]


# Hooks

ValidationRow = TypeVar('ValidationRow', bound=Base)


def _require_value(value, message: str):
    if value is None:
        raise ValueError(message)
    return value


def _require_row(
    session: SASession,
    model: type[ValidationRow],
    label: str,
    *,
    instance: ValidationRow | None = None,
    row_id: int | None = None,
) -> ValidationRow:
    """Prefer a relationship-loaded *instance*; otherwise load by *row_id*."""
    if instance is not None:
        return instance
    rid = _require_value(row_id, f"Missing required {label} id for validation.")
    row = session.get(model, rid)
    if row is None:
        raise ValueError(f"Cannot resolve {label}(id={rid}) during validation.")
    return row


def _validate_sequence_sample_workspace(session: SASession) -> None:
    """Validate that the workspace of the SequenceSample matches the workspace of the linked sequence."""
    for s in [*session.new, *session.dirty]:
        if isinstance(s, SequenceSample):
            uid_ws = _require_value(
                s.uid_workspace_id, 'Missing required uid_workspace_id for SequenceSample validation.'
            )
            seq = _require_row(session, BaseSequence, 'BaseSequence', instance=s.sequence, row_id=s.sequence_id)
            ws_id_sequence = _require_value(
                seq.workspace_id, 'Missing required workspace ID for SequenceSample workspace validation.'
            )
            if uid_ws != ws_id_sequence:
                raise ValueError('SequenceSample uid_workspace_id must match the workspace of the linked sequence.')


def _validate_sequence_in_line_workspace(session: SASession) -> None:
    """Validate that the workspace of the SequenceInLine matches the workspace of the linked sequence."""
    for sil in [*session.new, *session.dirty]:
        if not isinstance(sil, SequenceInLine):
            continue
        sil_sequence = _require_row(
            session, BaseSequence, 'BaseSequence', instance=sil.sequence, row_id=sil.sequence_id
        )
        ws_id_sequence = _require_value(
            sil_sequence.workspace_id, 'Missing required workspace ID for SequenceInLine workspace validation.'
        )
        sil_line = _require_row(session, Line, 'Line', instance=sil.line, row_id=sil.line_id)
        ws_id_line = _require_value(
            sil_line.workspace_id, 'Missing required workspace ID for SequenceInLine workspace validation.'
        )
        if ws_id_line != ws_id_sequence:
            raise ValueError('SequenceInLine line workspace must match sequence workspace.')


def _validate_source_input_workspace(session: SASession) -> None:
    """Validate that the workspace of the SourceInput matches the workspace of the output sequence."""
    for si in [*session.new, *session.dirty]:
        if not isinstance(si, SourceInput):
            continue
        src = _require_row(session, Source, 'Source', instance=si.source, row_id=si.source_id)
        output_sequence = _require_row(session, Sequence, 'Sequence', instance=src.output_sequence, row_id=src.id)
        ws_id_output = _require_value(
            output_sequence.workspace_id,
            'Missing required workspace ID for SourceInput workspace validation.',
        )
        input_entity = _require_row(
            session, InputEntity, 'InputEntity', instance=si.input_entity, row_id=si.input_entity_id
        )
        ws_id_input = _require_value(
            input_entity.workspace_id, 'Missing required workspace ID for SourceInput workspace validation.'
        )
        if ws_id_output != ws_id_input:
            raise ValueError('SourceInput input_entity workspace must match source output sequence workspace.')


def _validate_tag_links_workspace(session: SASession) -> None:
    for obj in [*session.new, *session.dirty]:
        if isinstance(obj, (Line, InputEntity)):
            for tag in obj.tags:
                if tag.workspace_id != obj.workspace_id:
                    raise ValueError(
                        f"{obj.__class__.__name__} tag workspace mismatch between {obj.__class__.__name__} and tag."
                    )


@event.listens_for(SASession, 'before_flush')
def _validate_cross_workspace_invariants(session, *_):
    _validate_sequence_sample_workspace(session)
    _validate_sequence_in_line_workspace(session)
    _validate_source_input_workspace(session)
    _validate_tag_links_workspace(session)


def require_real_sequence(
    sequence: BaseSequence,
    *,
    detail: str = 'Sequence not found',
    status_code: int = 404,
) -> Sequence:
    if not isinstance(sequence, Sequence):
        raise HTTPException(status_code=status_code, detail=detail)
    return sequence
