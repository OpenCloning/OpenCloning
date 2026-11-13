"""Shared Pydantic request/response models for the API."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field, field_validator

import opencloning_linkml.datamodel.models as opencloning_models
from opencloning.pydantic_models import MAX_PRIMER_LENGTH
from opencloning_db.models import (
    BaseSequence,
    SequenceType,
    Sequence,
    Primer,
    Line,
    SequenceInLine,
    WorkspaceRole,
)


def _strip_str(v: object) -> object:
    if isinstance(v, str):
        return v.strip()
    return v


StrippedStr = Annotated[str, BeforeValidator(_strip_str)]


class ApiModel(BaseModel):
    """Reject unknown JSON keys on all API request/response models in this module."""

    model_config = ConfigDict(extra='forbid')


# --- Auth (OIDC bearer) ---
class UserPublic(ApiModel):
    id: int
    email: str | None = None
    display_name: str
    is_instance_admin: bool


class UserRef(ApiModel):
    """Minimal user reference for embedding in resource responses."""

    id: int
    display_name: str


class UserWithRoleRef(UserRef):
    """User reference with workspace membership role."""

    role: str


class WorkspaceRef(ApiModel):
    id: int
    name: str
    role: str


class WorkspaceCreate(ApiModel):
    name: StrippedStr = Field(min_length=1)


class WorkspaceRename(ApiModel):
    name: StrippedStr = Field(min_length=1)


class WorkspaceMemberAdd(ApiModel):
    email: EmailStr
    role: WorkspaceRole


# --- Sequence sample ---
class SequenceSampleCreate(ApiModel):
    uid: StrippedStr
    sequence_id: int


class SequenceSampleUpdate(ApiModel):
    sequence_id: int


class SequenceSampleRead(ApiModel):
    id: int
    uid: str
    sequence_id: int


class SequenceSampleCreated(ApiModel):
    id: int
    uid: str


# --- Tags ---
class TagCreate(ApiModel):
    name: StrippedStr = Field(min_length=1)


class TagRead(ApiModel):
    id: int
    name: str


class EntityTagAttach(ApiModel):
    tag_id: int


# --- Entity refs ---
class InputEntityRef(ApiModel):
    id: int
    type: str
    name: str


class SequencingFileRef(ApiModel):
    id: int
    original_name: str


# --- Common responses ---
class IdResponse(ApiModel):
    id: int


class RemovedResponse(ApiModel):
    removed: int


class DeletedResponse(ApiModel):
    deleted: int
    data: dict | None = None


# --- Cloning strategy ---
class CloningStrategyIdMapping(ApiModel):
    localId: int
    databaseId: int


class CloningStrategyResponse(ApiModel):
    id: int
    mappings: list[CloningStrategyIdMapping]


class PrimerDatabaseIdMismatch(ApiModel):
    """Incoming ``database_id`` on a strategy primer could not be trusted."""

    primer_id: int
    provided_database_id: int
    kind: Literal['not_found', 'sequence_mismatch']


class SequenceDatabaseIdMismatch(ApiModel):
    """Incoming ``database_id`` on a strategy sequence could not be trusted."""

    sequence_id: int
    provided_database_id: int
    kind: Literal['not_found', 'seguid_mismatch']


class CloningStrategySyncResult(ApiModel):
    file_name: str | None = None
    cloning_strategy: opencloning_models.CloningStrategy | None = None
    parsing_errors: list[str] = Field(default_factory=list)
    parsing_warnings: list[str] = Field(default_factory=list)
    primer_database_id_mismatches: list[PrimerDatabaseIdMismatch] = Field(default_factory=list)
    sequence_database_id_mismatches: list[SequenceDatabaseIdMismatch] = Field(default_factory=list)
    already_synced: bool = False


class CloningStrategySyncResultFilled(ApiModel):
    cloning_strategy: opencloning_models.CloningStrategy
    file_name: str


# --- Sequence / primer refs ---
class SequenceRef(ApiModel):
    id: int
    type: str
    name: str | None
    sequence_type: SequenceType
    tags: list[TagRead] = []
    sample_uids: list[str] = []
    seguid: str | None = None
    created_at: datetime
    created_by: UserRef

    def __hash__(self):
        return hash(self.id)


class SequenceUpdate(ApiModel):
    name: StrippedStr | None = Field(default=None, min_length=1)
    sequence_type: SequenceType | None = None


class TemplateSequenceCreate(ApiModel):
    name: StrippedStr = Field(min_length=1)
    sequence_type: SequenceType


class TemplateSequenceBulkRow(TemplateSequenceCreate):
    name_exists: bool
    name_duplicated: bool


class PrimerUpdate(ApiModel):
    name: StrippedStr | None = Field(default=None, min_length=1)
    uid: StrippedStr | None = None


class PrimerCreate(ApiModel):
    name: StrippedStr
    uid: StrippedStr | None = None
    sequence: str = Field(min_length=2, max_length=MAX_PRIMER_LENGTH, pattern=r'^[ACGTacgt]+$')


class PrimerBulkSubmission(ApiModel):
    name: StrippedStr
    uid: StrippedStr | None = None
    sequence: str


class PrimerBulkRow(PrimerBulkSubmission):
    sequence_invalid: bool
    name_exists: bool
    sequence_exists: bool
    uid_exists: bool
    name_duplicated: bool
    sequence_duplicated: bool
    uid_duplicated: bool


class PrimerRef(ApiModel):
    id: int
    name: str | None
    sequence: str
    uid: str | None = None
    tags: list[TagRead] = []
    created_at: datetime
    created_by: UserRef


class SequenceSampleWithSequence(ApiModel):
    id: int
    uid: str
    sequence_id: int
    sequence: SequenceRef


# --- Line ---
class SequenceInLineRef(ApiModel):
    """Sequence in a line, including the SequenceInLine instance id."""

    id: int
    sequence: SequenceRef


class LineRef(ApiModel):
    id: int
    uid: str
    sequences_in_line: list[SequenceInLineRef]
    parent_ids: list[int]
    tags: list[TagRead]
    created_at: datetime
    created_by: UserRef


class LineCreate(ApiModel):
    uid: StrippedStr
    allele_ids: list[int] = []
    plasmid_ids: list[int] = []
    parent_ids: list[int] = []


class LineUpdate(ApiModel):
    uid: StrippedStr | None = None
    allele_ids: list[int] | None = None
    plasmid_ids: list[int] | None = None
    parent_ids: list[int] | None = None


class LineBulkSubmission(ApiModel):
    uid: StrippedStr
    genotype: list[StrippedStr] = Field(default_factory=list)
    plasmids: list[StrippedStr] = Field(default_factory=list)
    parent_uids: list[StrippedStr] = Field(
        default_factory=list,
        max_length=2,
        description='Up to two parent strain UIDs',
    )

    @field_validator('parent_uids', mode='after')
    @classmethod
    def deduplicate_parent_uids(cls, v: list[StrippedStr]) -> list[StrippedStr]:
        return list(sorted(set(v)))


class LineBulkParentUidFlag(ApiModel):
    uid: str | None
    line_id: int | None = None


class LineBulkSequenceNameFlag(ApiModel):
    name: str
    not_found: bool
    ambiguous: bool
    duplicated: bool
    sequence_id: int | None = None


class LineBulkRow(LineBulkSubmission):
    uid_exists: bool
    uid_duplicated: bool
    genotype_flags: list[LineBulkSequenceNameFlag]
    plasmid_flags: list[LineBulkSequenceNameFlag]
    parent_flags: list[LineBulkParentUidFlag]


def _user_ref(user) -> UserRef | None:
    if user is None:
        return None
    return UserRef(id=user.id, display_name=user.display_name)


def user_with_role_ref(user, role: WorkspaceRole) -> UserWithRoleRef:
    return UserWithRoleRef(id=user.id, display_name=user.display_name, role=role.value)


def sequence_ref(sequence: BaseSequence) -> SequenceRef:
    return SequenceRef(
        id=sequence.id,
        type=sequence.type,
        name=sequence.name,
        sequence_type=sequence.sequence_type,
        tags=[TagRead(id=t.id, name=t.name) for t in sequence.tags],
        sample_uids=sequence.sample_uids,
        seguid=sequence.seguid if isinstance(sequence, Sequence) else None,
        created_at=sequence.created_at,
        created_by=_user_ref(sequence.created_by),
    )


def primer_ref(primer: Primer) -> PrimerRef:
    return PrimerRef(
        id=primer.id,
        name=primer.name,
        sequence=primer.sequence,
        uid=primer.uid,
        tags=[TagRead(id=t.id, name=t.name) for t in primer.tags],
        created_at=primer.created_at,
        created_by=_user_ref(primer.created_by),
    )


def sequence_in_line_ref(sil: SequenceInLine) -> SequenceInLineRef:
    """Build a SequenceInLineRef from a SequenceInLine ORM instance."""
    seq = sil.sequence
    return SequenceInLineRef(
        id=sil.id,
        sequence=sequence_ref(seq),
    )


def line_ref(line: Line) -> LineRef:
    return LineRef(
        id=line.id,
        uid=line.uid,
        sequences_in_line=[sequence_in_line_ref(sil) for sil in line.sequences_in_line],
        parent_ids=line.parent_ids,
        tags=[TagRead(id=tag.id, name=tag.name) for tag in line.tags],
        created_at=line.created_at,
        created_by=_user_ref(line.created_by),
    )


# --- Export (id-based refs; nested entities live in top-level lists) ---
class ExportSequenceRef(ApiModel):
    id: int
    type: str
    name: str | None
    sequence_type: SequenceType
    tag_ids: list[int] = []
    sample_uids: list[str] = []
    seguid: str | None = None
    created_at: datetime
    created_by_id: int


class ExportPrimerRef(ApiModel):
    id: int
    name: str | None
    sequence: str
    uid: str | None = None
    tag_ids: list[int] = []
    created_at: datetime
    created_by_id: int


class ExportLineRef(ApiModel):
    id: int
    uid: str
    sequence_ids: list[int]
    parent_ids: list[int]
    tag_ids: list[int]
    created_at: datetime
    created_by_id: int


def export_sequence_ref(sequence: BaseSequence) -> ExportSequenceRef:
    return ExportSequenceRef(
        id=sequence.id,
        type=sequence.type,
        name=sequence.name,
        sequence_type=sequence.sequence_type,
        tag_ids=[t.id for t in sequence.tags],
        sample_uids=sequence.sample_uids,
        seguid=sequence.seguid if isinstance(sequence, Sequence) else None,
        created_at=sequence.created_at,
        created_by_id=sequence.created_by_id,
    )


def export_primer_ref(primer: Primer) -> ExportPrimerRef:
    return ExportPrimerRef(
        id=primer.id,
        name=primer.name,
        sequence=primer.sequence,
        uid=primer.uid,
        tag_ids=[t.id for t in primer.tags],
        created_at=primer.created_at,
        created_by_id=primer.created_by_id,
    )


def export_line_ref(line: Line) -> ExportLineRef:
    return ExportLineRef(
        id=line.id,
        uid=line.uid,
        sequence_ids=[sil.sequence_id for sil in line.sequences_in_line],
        parent_ids=line.parent_ids,
        tag_ids=[tag.id for tag in line.tags],
        created_at=line.created_at,
        created_by_id=line.created_by_id,
    )


class WorkspaceExport(ApiModel):
    lines: list[ExportLineRef]
    primers: list[ExportPrimerRef]
    sequences: list[ExportSequenceRef]
    tags: list[TagRead]
    users: list[UserRef]
    cloning_strategy: opencloning_models.CloningStrategy


class SequenceSearchResult(ApiModel):
    sequence_ref: SequenceRef
    sequence: opencloning_models.TextFileSequence
    shift: int = 0
    reverse_complemented: bool = False


class SequenceWithTextFile(ApiModel):
    sequence_ref: SequenceRef
    sequence: opencloning_models.TextFileSequence
    sequencing_files: list[SequencingFileRef]


class SequenceValidationRow(ApiModel):
    file_name: str
    reading_error: bool

    name: str | None = None
    length: int | None = None
    circular: bool | None = None
    seguid: str | None = None
    circularised_seguid: str | None = None

    sequence_exists: bool | None = None
    sequence_circularised_exists: bool | None = None
    name_exists: bool | None = None

    duplicated_seguid: bool | None = None
    duplicated_name: bool | None = None
