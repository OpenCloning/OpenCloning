"""
Load deterministic development/test data into an existing database schema.

Schema must already exist (via Alembic). Use ``opencloning-cli db seed`` for a full
destructive reset including storage prefixes.
"""

import json
import os
import glob
from pathlib import Path

import opencloning_linkml.datamodel.models as opencloning_models
import pydna.opencloning_models as pydna_opencloning_models
from pydna.parsers import parse as pydna_parse
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from opencloning_db.context import WriteContext
from opencloning_db.db import cloning_strategy_to_db, create_sequencing_file
from opencloning_db.models import (
    Line,
    Primer,
    Sequence,
    SequenceInLine,
    SequenceSample,
    Tag,
    SequenceType,
    TemplateSequence,
    User,
    Workspace,
    WorkspaceMembership,
    WorkspaceRole,
)


def load_seed_data(engine: Engine) -> None:
    """Insert the deterministic demo/test baseline into *engine* (or configured default)."""
    cloning_strategies = []
    file_names = []
    data_dir = Path(__file__).resolve().parent / 'init_db'
    # sorted: glob order depends on the filesystem, and it decides the database ids of the seed data
    for file in sorted(glob.glob(str(data_dir / '*.json'))):
        with open(file) as f:
            cloning_strategies.append(opencloning_models.CloningStrategy.model_validate(json.load(f)))
            file_names.append(os.path.basename(file))

    with Session(engine) as session:
        last_seq = None
        sequencing_sequence = None
        # Dummy user and workspace for development purposes (without access)
        other_workspace_user = User(
            email='other-workspace-user@example.com',
            display_name='Other Workspace User',
            auth_provider=None,
            external_subject=None,
            is_instance_admin=False,
        )
        other_workspace = Workspace(name='Other Workspace')

        # Dummy view-only user
        view_only_user = User(
            email='view-only-user@example.com',
            display_name='View Only User',
            auth_provider=None,
            external_subject=None,
            is_instance_admin=False,
        )

        bootstrap_user = User(
            email='bootstrap+clerk_test@example.com',
            display_name='Bootstrap User',
            auth_provider=None,
            external_subject=None,
            is_instance_admin=True,
        )
        workspace = Workspace(name='Bootstrap Workspace')
        session.add_all([bootstrap_user, workspace, other_workspace_user, other_workspace, view_only_user])
        session.flush()
        session.add(
            WorkspaceMembership(
                user_id=bootstrap_user.id,
                workspace_id=workspace.id,
                role=WorkspaceRole.owner,
            )
        )

        session.add(
            WorkspaceMembership(
                user_id=other_workspace_user.id,
                workspace_id=other_workspace.id,
                role=WorkspaceRole.owner,
            )
        )

        session.add(
            WorkspaceMembership(
                user_id=view_only_user.id,
                workspace_id=workspace.id,
                role=WorkspaceRole.viewer,
            )
        )

        seed_ctx = WriteContext(user=bootstrap_user, workspace_id=workspace.id)

        parent_strain = Line.from_create(uid='parent_strain', ctx=seed_ctx)
        session.add(parent_strain)
        for cloning_strategy, file_name in zip(cloning_strategies, file_names):
            tag_name = os.path.basename(file_name).split('.')[0]
            tag = Tag(name=tag_name, workspace_id=workspace.id)
            session.add(tag)
            sequences, id_mappings = cloning_strategy_to_db(cloning_strategy, session, ctx=seed_ctx)
            new_line = Line.from_create(uid=f"{tag_name}-line", ctx=seed_ctx)
            new_line.parents = [parent_strain]
            for seq in sequences:
                if seq.name in ['entry_clone_lacZ']:
                    continue
                if seq.sequence_type == SequenceType.allele or seq.sequence_type == SequenceType.plasmid:
                    new_line.sequences_in_line.append(SequenceInLine(sequence=seq))
            new_line.tags.append(tag)
            session.add(new_line)

            for seq in sequences:
                seq.tags.append(tag)
            last_seq = sequences[-1]
            if cloning_strategy.description == 'sequencing':
                sequencing_sequence = last_seq
            session.add(
                SequenceSample(
                    uid=f"{tag_name}-sample",
                    sequence_id=last_seq.id,
                    uid_workspace_id=workspace.id,
                )
            )

        # Find the primer that is used for testing, and add a uid to it
        test_primer = session.scalar(select(Primer).where(Primer.name == 'fwd_restriction_then_ligation'))
        test_primer.uid = 'ML7'
        test_primer.uid_workspace_id = workspace.id
        tag = session.scalar(select(Tag).where(Tag.name == 'restriction_then_ligation'))
        test_primer.tags.append(tag)
        session.add(test_primer)

        for file in sorted(glob.glob(str(data_dir / 'sequencing_data' / '*'))):
            with open(file, 'rb') as f:
                content = f.read()
            file_name = os.path.basename(file)
            session.add(create_sequencing_file(sequencing_sequence, content, file_name))

        # Add golden braid plasmids from genbank files, tagged with 'golden-braid'
        golden_braid_tag = Tag(name='golden-braid', workspace_id=workspace.id)
        session.add(golden_braid_tag)
        for file in sorted(glob.glob(str(data_dir / 'golden_braid' / '*.gb'))):
            dseqr = pydna_parse(file)[0]
            dseqr.source = pydna_opencloning_models.UploadedFileSource(
                file_name=os.path.basename(file),
                sequence_file_format='genbank',
                index_in_file=0,
            )
            sequences, _ = cloning_strategy_to_db(
                pydna_opencloning_models.CloningStrategy.from_dseqrecords([dseqr]), session, ctx=seed_ctx
            )
            for seq in sequences:
                seq.tags.append(golden_braid_tag)

        # Add primer that is not linked to any source
        pydantic_primer = opencloning_models.Primer(id=0, name='no_source_primer', sequence='GGTTaaCCaaa')
        no_source_primer = Primer.from_pydantic(pydantic_primer, ctx=seed_ctx)
        session.add(no_source_primer)

        # seq: Sequence = session.scalar(select(Sequence).where(Sequence.name == 'entry_clone_lacZ'))
        # pydantic_seq = seq.to_pydantic_sequence()
        # # Add itself as sequencing data twice, and sample id to the sequence
        # session.add(create_sequencing_file(seq, pydantic_seq.file_content.encode('utf-8'), 'entry_clone_lacZ.gb'))
        # session.add(create_sequencing_file(seq, pydantic_seq.file_content.encode('utf-8'), 'entry_clone_lacZ2.gb'))
        # session.add(SequenceSample(uid='entry_clone_lacZ-sample', sequence_id=seq.id, uid_workspace_id=workspace.id))

        # Add a template sequence
        template_sequence = TemplateSequence.from_create(
            name='template_sequence_allele', sequence_type=SequenceType.allele, ctx=seed_ctx
        )
        new_line = Line.from_create(uid='template_sequence-line', ctx=seed_ctx)
        new_line.parents = [parent_strain]
        new_line.sequences_in_line.append(SequenceInLine(sequence=template_sequence))
        session.add(new_line)
        # Add also a real plasmid to the same line
        plasmid = session.scalar(select(Sequence).where(Sequence.name == 'pREX0008'))
        new_line.sequences_in_line.append(SequenceInLine(sequence=plasmid))
        session.flush()

        # Add a template plasmid without a line
        template_plasmid = TemplateSequence.from_create(
            name='template_sequence_plasmid', sequence_type=SequenceType.plasmid, ctx=seed_ctx
        )
        session.add(template_plasmid)
        session.commit()
