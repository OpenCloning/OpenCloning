"""Tests for ORM models in ``models`` (beyond router coverage)."""

from __future__ import annotations

from copy import deepcopy
import os
import unittest

import opencloning_linkml.datamodel.models as opencloning_models
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from opencloning.pydantic_models import MAX_PRIMER_LENGTH
from opencloning_db.context import WriteContext
from opencloning_db.db import cloning_strategy_to_db, dseqrecord_to_db
from opencloning_db.models import (
    AnySourceParser,
    AssemblyFragment,
    BaseSequence,
    InputEntity,
    Line,
    Primer,
    Sequence,
    SequenceInLine,
    SequenceSample,
    SequenceType,
    Source,
    SourceInput,
    SourceType,
    Tag,
    TemplateSequence,
    User,
    Workspace,
    WorkspaceMembership,
    WorkspaceRole,
    _to_db_input,
    _require_value,
    _require_row,
)
from tests.cloning_strategy_examples import cs_pcr, pcr_product
from opencloning_db.migrations import reset_database

_TEST_DATABASE_URL = os.environ.get(
    'OPENCLONING_TEST_DATABASE_URL',
    'postgresql+psycopg://dbuser:dbpassword@localhost:5432/opencloning_test',
)


def _ctx(workspace_id: int, user_id: int = 1) -> WriteContext:
    """Build a WriteContext with a lightweight (unsaved) User stub for tests."""
    return WriteContext(user=User(id=user_id, email='unused@test'), workspace_id=workspace_id)


class _MemoryDbTestCase(unittest.TestCase):
    """Fresh Postgres schema per test."""

    def setUp(self):
        super().setUp()
        self.engine = create_engine(_TEST_DATABASE_URL)
        reset_database(self.engine)
        with Session(self.engine) as session:
            session.add(User(email='test@test.com', display_name='Test'))
            session.commit()

    def tearDown(self):
        self.engine.dispose()
        super().tearDown()


class TestAnySourceParser(unittest.TestCase):
    """Tests for ``AnySourceParser``."""

    _CASES = (
        (
            opencloning_models.ManuallyTypedSource,
            {'id': 1, 'type': 'ManuallyTypedSource', 'input': []},
        ),
        (
            opencloning_models.PCRSource,
            {'id': 2, 'type': 'PCRSource', 'input': []},
        ),
        (
            opencloning_models.DatabaseSource,
            {
                'id': 3,
                'type': 'DatabaseSource',
                'input': [],
                'database_id': 99,
            },
        ),
    )

    def test_from_kwargs_roundtrip(self):
        """``from_kwargs`` round-trips each linkml source *payload*."""
        for model_cls, payload in self._CASES:
            with self.subTest(type=payload['type']):
                inst = model_cls.model_validate(payload)
                out = AnySourceParser.from_kwargs(**inst.model_dump())
                self.assertIsInstance(out, model_cls)
                self.assertEqual(out.id, inst.id)

    def test_model_validate_from_dict(self):
        """Pydantic parses ``AnySourceParser`` when ``source`` is a dict."""
        raw = {'id': 10, 'type': 'ManuallyTypedSource', 'input': []}
        wrapper = AnySourceParser.model_validate({'source': raw})
        self.assertIsInstance(
            wrapper.source,
            opencloning_models.ManuallyTypedSource,
        )
        self.assertEqual(wrapper.source.id, 10)


class TestBaseRepr(unittest.TestCase):
    """Tests for ``Base.__repr__``."""

    def test_includes_class_name_id_and_scalars(self):
        """Repr names the class, ``id``, and non-relationship scalars."""
        w = Workspace(name='Lab')
        w.id = 42
        text = repr(w)
        self.assertIn('Workspace', text)
        self.assertIn('id=42', text)
        self.assertIn('name: Lab', text)

        # Class without id for coverage completion
        si = SourceInput(source_id=1, position=0, input_entity_id=2, type='SourceInput', sequence_instance_id=None)
        text = repr(si)
        self.assertNotIn('id=', text)
        self.assertIn('SourceInput', text)
        self.assertIn('source_id: 1', text)
        self.assertIn('position: 0', text)
        self.assertIn('input_entity_id: 2', text)
        self.assertIn('type: SourceInput', text)
        self.assertIn('sequence_instance_id: None', text)


@pytest.mark.usefixtures('engine_client_config_readonly')
class TestSequence(_MemoryDbTestCase):
    """Tests for ``Sequence``."""

    def test_base_sequence_loads_concrete_template_subclass(self):
        """Loading through ``BaseSequence`` preserves the concrete template subtype."""
        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            template = TemplateSequence(
                workspace_id=ws.id,
                name='tpl',
                sequence_type=SequenceType.allele,
                created_by_id=1,
            )
            session.add(template)
            session.commit()

            loaded = session.get(BaseSequence, template.id)

        assert isinstance(loaded, TemplateSequence)

    def test_sample_uids_only_sequence_samples(self):
        """``sample_uids`` lists UIDs from ``SequenceSample`` only."""
        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            seq = Sequence(workspace_id=ws.id, file_content='s.gb', name='seq', seguid='SEGUID-SEQ', created_by_id=1)
            line = Line(workspace_id=ws.id, uid='L-1', created_by_id=1)
            session.add_all([seq, line])
            session.flush()
            samp = SequenceSample(
                sequence_id=seq.id,
                uid_workspace_id=ws.id,
                uid='S-1',
            )
            sil = SequenceInLine(sequence_id=seq.id, line_id=line.id)
            session.add_all([samp, sil])
            session.flush()
            session.refresh(seq)
            self.assertEqual(set(seq.sample_uids), {'S-1'})

    def test_sequence_in_line_accepts_template_sequence_in_same_workspace(self):
        """Template sequences can be linked to lines through the shared SequenceInLine table."""
        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            template = TemplateSequence(
                workspace_id=ws.id,
                name='tpl',
                sequence_type=SequenceType.allele,
                created_by_id=1,
            )
            line = Line(workspace_id=ws.id, uid='L-1', created_by_id=1)
            session.add_all([template, line])
            session.flush()

            sil = SequenceInLine(sequence_id=template.id, line_id=line.id)
            session.add(sil)
            session.commit()
            session.refresh(sil)
            linked_sequence = sil.sequence

        assert isinstance(linked_sequence, TemplateSequence)

    def test_to_pydantic_sequence_reads_genbank_file(self):
        """Reads GenBank file text from the sequence row itself."""
        file_content = pcr_product.format('genbank')

        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            seq = Sequence(
                workspace_id=ws.id,
                file_content=file_content,
                name='n',
                overhang_crick_3prime=3,
                overhang_watson_3prime=5,
                seguid='SEGUID-SEQ',
                created_by_id=1,
            )
            session.add(seq)
            session.flush()
            session.refresh(seq)
            pyd = seq.to_pydantic_sequence()

        self.assertIsInstance(pyd, opencloning_models.TextFileSequence)
        self.assertEqual(pyd.id, seq.id)
        self.assertIn('LOCUS', pyd.file_content)
        self.assertEqual(pyd.overhang_crick_3prime, 3)
        self.assertEqual(pyd.overhang_watson_3prime, 5)
        self.assertEqual(pyd.sequence_file_format, 'genbank')

    def test_base_sequence_to_pydantic_raises_not_implemented(self):
        base = BaseSequence.__new__(BaseSequence)
        with self.assertRaises(NotImplementedError):
            base.to_pydantic_sequence()

    def test_template_sequence_to_pydantic(self):
        with Session(self.engine) as session:
            for sequence_type in [SequenceType.allele, SequenceType.plasmid]:
                ws = Workspace(name='W')
                session.add(ws)
                session.flush()
                ts = TemplateSequence(
                    workspace_id=ws.id,
                    name='tpl',
                    sequence_type=sequence_type,
                    created_by_id=1,
                )
                session.add(ts)
                session.flush()
                pyd = ts.to_pydantic_sequence()

                self.assertIsInstance(pyd, opencloning_models.TemplateSequence)
                self.assertEqual(pyd.id, ts.id)
                if sequence_type == SequenceType.plasmid:
                    self.assertTrue(pyd.circular)
                else:
                    self.assertFalse(pyd.circular)


class TestPrimer(_MemoryDbTestCase):
    """Tests for ``Primer``."""

    def test_from_pydantic_and_to_pydantic_roundtrip(self):
        """Round-trip primer through linkml preserves sequence and name."""
        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            pp = opencloning_models.Primer(
                id=0,
                name='p1',
                sequence='ATGC',
                database_id=None,
            )
            primer = Primer.from_pydantic(pp, ctx=_ctx(ws.id))
            session.add(primer)
            session.flush()
            session.refresh(primer)
            out = primer.to_pydantic_primer()
        pp.database_id = primer.id
        pp.id = primer.id
        self.assertEqual(out, pp)

    def test_workspace_columns_must_match(self):
        """``workspace_id`` and ``uid_workspace_id`` cannot diverge."""
        with self.assertRaisesRegex(ValueError, 'uid_workspace_id must equal'):
            Primer(
                workspace_id=1,
                uid_workspace_id=2,
                sequence='AT',
                uid=None,
            )

    def test_uid_empty_string_rejected(self):
        """Empty string UID is invalid (use NULL)."""
        with self.assertRaisesRegex(ValueError, 'cannot be empty string'):
            Primer(
                workspace_id=1,
                uid_workspace_id=1,
                sequence='AT',
                uid='',
            )

    def test_sequence_invalid_characters_rejected_on_instantiation(self):
        """Primer sequence must be ACGT only (ORM ``@validates``)."""
        with self.assertRaisesRegex(ValueError, 'only contain ACGT'):
            Primer(workspace_id=1, uid_workspace_id=1, name='p', sequence='ATNX')

    def test_sequence_too_short_rejected_on_instantiation(self):
        """Primer sequence must be at least two bases."""
        with self.assertRaisesRegex(ValueError, 'at least 2 characters'):
            Primer(workspace_id=1, uid_workspace_id=1, name='p', sequence='A')

    def test_sequence_too_long_rejected_on_instantiation(self):
        """Primer sequence cannot exceed MAX_PRIMER_LENGTH."""
        with self.assertRaisesRegex(ValueError, f'cannot be longer than {MAX_PRIMER_LENGTH}'):
            Primer(
                workspace_id=1,
                uid_workspace_id=1,
                name='p',
                sequence='A' * (MAX_PRIMER_LENGTH + 1),
            )

    def test_from_pydantic_rejects_sequence_too_short(self):
        """``from_pydantic`` applies the same sequence rules as direct construction."""
        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            pp = opencloning_models.Primer(
                id=0,
                name='p1',
                sequence='G',
                database_id=None,
            )
            with self.assertRaisesRegex(ValueError, 'at least 2 characters'):
                Primer.from_pydantic(pp, ctx=_ctx(ws.id))


class TestSource(_MemoryDbTestCase):
    """Tests for ``Source``."""

    def test_from_pydantic_and_to_pydantic_roundtrip(self):
        """
        ORM Source (without inputs) round-trips through linkml. With inputs is tested
        in cloning_strategy_to_db and test_source_input_to_pydantic_uses_input_entity_id
        """
        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            seq = Sequence(workspace_id=ws.id, file_content='o.gb', name='out', seguid='SEGUID-OUT', created_by_id=1)
            session.add(seq)
            session.flush()

            pyd = opencloning_models.ManuallyTypedSource.model_validate(
                {'id': seq.id, 'type': 'ManuallyTypedSource', 'input': []}
            )
            src = Source.from_pydantic(pyd, seq, {})
            session.add(src)
            session.flush()
            session.refresh(src)

            back = src.to_pydantic_source()
        self.assertIsInstance(back, opencloning_models.ManuallyTypedSource)
        self.assertEqual(back.id, seq.id)
        self.assertEqual(back.input, [])

    def test_from_pydantic_stores_extra_fields_in_json(self):
        """Fields outside ``_ORM_FIELDS`` are persisted in ``extra_fields``."""
        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            seq = Sequence(workspace_id=ws.id, file_content='e.gb', name='e', seguid='SEGUID-E', created_by_id=1)
            session.add(seq)
            session.flush()
            pyd = opencloning_models.PCRSource.model_validate(
                {
                    'id': seq.id,
                    'type': 'PCRSource',
                    'input': [],
                    'circular': True,
                }
            )
            src = Source.from_pydantic(pyd, seq, {})
            session.add(src)
            session.flush()
            self.assertTrue(src.extra_fields.get('circular'))
            typ = getattr(src.type, 'value', src.type)
            self.assertEqual(typ, 'PCRSource')


class TestSourceInputAndAssemblyFragment(_MemoryDbTestCase):
    """Tests for ``SourceInput`` and ``AssemblyFragment``."""

    def test_source_input_to_pydantic_uses_input_entity_id(self):
        """``to_pydantic`` sets ``sequence`` from ``input_entity.id``."""
        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            ent = Sequence(workspace_id=ws.id, file_content='in.gb', name='in', seguid='SEGUID-IN', created_by_id=1)
            session.add(ent)
            session.flush()
            src_row = Source(
                id=ent.id,
                type=SourceType.ManuallyTypedSource,
                output_sequence=ent,
                extra_fields={},
            )
            session.add(src_row)
            session.flush()
            si = SourceInput(
                source_id=src_row.id,
                position=0,
                input_entity_id=ent.id,
                input_entity=ent,
            )
            session.add(si)
            session.flush()
            pyd_src_input = si.to_pydantic()
            pyd_src = src_row.to_pydantic_source()

        self.assertEqual(pyd_src_input.sequence, ent.id)
        self.assertEqual(pyd_src.input[0].sequence, ent.id)
        self.assertEqual(pyd_src.id, ent.id)

    def test_assembly_fragment_init_requires_at_least_one_location(self):
        """Constructor requires at least one of left/right location."""
        with self.assertRaisesRegex(ValueError, 'At least one of left_location'):
            AssemblyFragment(
                left_location=None,
                right_location=None,
                reverse_complemented=False,
            )

    def test_assembly_fragment_to_pydantic(self):
        """Pydantic output carries locations and ``reverse_complemented``."""
        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            ent = Sequence(workspace_id=ws.id, file_content='af.gb', name='af', seguid='SEGUID-AF', created_by_id=1)
            session.add(ent)
            session.flush()
            out_seq = Sequence(
                workspace_id=ws.id, file_content='out.gb', name='out', seguid='SEGUID-OUT', created_by_id=1
            )
            session.add(out_seq)
            session.flush()
            src_row = Source(
                id=out_seq.id,
                type=SourceType.AssemblySource,
                output_sequence=out_seq,
                extra_fields={},
            )
            session.add(src_row)
            session.flush()
            frag = AssemblyFragment(
                source_id=src_row.id,
                position=0,
                input_entity_id=ent.id,
                input_entity=ent,
                left_location='1..10',
                right_location=None,
                reverse_complemented=True,
            )
            session.add(frag)
            session.flush()
            pyd = frag.to_pydantic()
        self.assertEqual(pyd.left_location, '1..10')
        self.assertIsNone(pyd.right_location)
        self.assertTrue(pyd.reverse_complemented)
        self.assertEqual(pyd.sequence, ent.id)


@pytest.mark.usefixtures('engine_client_config_readonly')
class TestCloningStrategyToDb(_MemoryDbTestCase):
    """Tests for ``cloning_strategy_to_db`` mappings."""

    def test_dseqrecord_to_db_raises_when_strategy_has_multiple_sequences(self):
        """``dseqrecord_to_db`` rejects strategies that produce more than one sequence."""
        with self.assertRaisesRegex(ValueError, 'expects exactly one sequence'):
            dseqrecord_to_db(pcr_product, None, ctx=_ctx(1))

    def test_cloning_strategy_to_db_raises_when_sequence_has_no_source(self):
        """Every strategy sequence must have a source with the same id."""
        strategy = deepcopy(cs_pcr)
        missing_source_id = strategy.sequences[0].id
        strategy.sources = [s for s in strategy.sources if s.id != missing_source_id]

        with self.assertRaisesRegex(ValueError, f"No source produces sequence {missing_source_id}"):
            cloning_strategy_to_db(strategy, None, ctx=_ctx(1))

    def test_id_mappings_all_new_entities(self):
        """Mappings include all strategy ids and point to persisted rows."""
        strategy = deepcopy(cs_pcr)
        expected_ids = {s.id for s in strategy.sequences} | {p.id for p in strategy.primers}

        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            output_rows, id_mappings = cloning_strategy_to_db(strategy, session, ctx=_ctx(ws.id))

            self.assertEqual(set(id_mappings.keys()), expected_ids)
            self.assertEqual(len(output_rows), len(strategy.sequences))
            for strategy_seq, output_seq in zip(strategy.sequences, output_rows):
                self.assertEqual(id_mappings[strategy_seq.id], output_seq.id)
                self.assertIsNotNone(session.get(Sequence, output_seq.id))
            for primer in strategy.primers or []:
                db_primer = session.get(Primer, id_mappings[primer.id])
                self.assertIsNotNone(db_primer)
                self.assertEqual(db_primer.name, primer.name)
                self.assertEqual(db_primer.sequence, primer.sequence)

    def test_id_mappings_mixed_existing_and_new_sequences(self):
        """Existing sequence IDs are reused while other entities are newly mapped."""
        strategy = deepcopy(cs_pcr)

        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            session.add(WorkspaceMembership(user_id=1, workspace_id=ws.id, role=WorkspaceRole.owner))
            session.flush()
            # First, commit some sequences
            _, id_mappings = cloning_strategy_to_db(strategy, session, ctx=_ctx(ws.id))
            num_sequences_before = session.query(Sequence).count()
            num_primers_before = session.query(Primer).count()
            self.assertEqual(num_sequences_before, 2)
            self.assertEqual(num_primers_before, 2)
            # Refresh their database_ids
            for source in strategy.sources:
                source.database_id = id_mappings[source.id]
            for primer in strategy.primers:
                primer.database_id = id_mappings[primer.id]
            # Drop the database_id of the PCR product, to mock repeating the PCR
            pcr_source = next(s for s in strategy.sources if s.type == 'PCRSource')
            pcr_source.database_id = None
            pcr_product = next(s for s in strategy.sequences if s.id == pcr_source.id)
            pcr_product.id = 999
            pcr_source.id = 999
            new_output_rows, new_id_mappings = cloning_strategy_to_db(strategy, session, ctx=_ctx(ws.id))
            num_sequences_after = session.query(Sequence).count()
            num_primers_after = session.query(Primer).count()
            self.assertEqual(num_sequences_after, 3)
            self.assertEqual(num_primers_after, 2)
            # The previous mappings should be the same
            self.assertEqual(len(id_mappings), len(new_id_mappings))
            # The previous mappings should be the same
            for k, v in id_mappings.items():
                if k in new_id_mappings:
                    self.assertEqual(new_id_mappings[k], v)
            # The new mapping points to the new sequence
            self.assertEqual(new_id_mappings[pcr_product.id], new_output_rows[0].id)


class TestToDbInput(unittest.TestCase):
    """Tests for ``_to_db_input``."""

    def test_builds_source_input(self):
        """Plain linkml ``SourceInput`` becomes ORM ``SourceInput``."""
        ent = InputEntity()
        ent.id = 99
        item = opencloning_models.SourceInput(sequence=99)
        row = _to_db_input(item, ent)
        self.assertIsInstance(row, SourceInput)
        self.assertIs(row.input_entity, ent)

    def test_builds_assembly_fragment(self):
        """Linkml ``AssemblyFragment`` becomes ORM ``AssemblyFragment``."""
        ent = InputEntity()
        ent.id = 88
        item = opencloning_models.AssemblyFragment(
            sequence=88,
            left_location='2..4',
            right_location=None,
            reverse_complemented=False,
        )
        row = _to_db_input(item, ent)
        self.assertIsInstance(row, AssemblyFragment)
        self.assertEqual(row.left_location, '2..4')
        self.assertIs(row.input_entity, ent)


class TestSequenceSample(_MemoryDbTestCase):
    """Tests for ``SequenceSample`` validators."""

    def test_sequence_sample_uid_workspace_id_mismatch_raises(self):
        """Re-pointing ``sequence_id`` across workspaces triggers validator."""
        with Session(self.engine) as session:
            w1 = Workspace(name='W1')
            w2 = Workspace(name='W2')
            session.add_all([w1, w2])
            session.flush()
            seq_w1 = Sequence(workspace_id=w1.id, file_content='q1.gb', seguid='SEGUID-Q1', created_by_id=1)
            seq_w2 = Sequence(workspace_id=w2.id, file_content='q2.gb', seguid='SEGUID-Q2', created_by_id=1)
            session.add_all([seq_w1, seq_w2])
            session.flush()
            samp = SequenceSample(
                sequence_id=seq_w1.id,
                uid_workspace_id=w1.id,
                uid='U',
            )
            session.add(samp)
            session.flush()

            samp.sequence_id = seq_w2.id
            with self.assertRaisesRegex(ValueError, 'uid_workspace_id must match'):
                session.flush()

    def test_uid_workspace_must_match_sequence_workspace(self):
        """Changing ``uid_workspace_id`` away from sequence workspace fails."""
        with Session(self.engine) as session:
            w1 = Workspace(name='W1')
            w2 = Workspace(name='W2')
            session.add_all([w1, w2])
            session.flush()
            seq = Sequence(workspace_id=w1.id, file_content='q.gb', seguid='SEGUID-Q', created_by_id=1)
            session.add(seq)
            session.flush()
            samp = SequenceSample(
                sequence_id=seq.id,
                uid_workspace_id=w1.id,
                uid='U',
            )
            session.add(samp)
            session.flush()
            samp.uid_workspace_id = w2.id
            with self.assertRaisesRegex(ValueError, 'uid_workspace_id must match'):
                session.flush()
            # Same if inserting directly (via hook)
            session.add(
                SequenceSample(
                    sequence_id=seq.id,
                    uid_workspace_id=w2.id,
                    uid='U',
                )
            )
            with self.assertRaisesRegex(ValueError, 'uid_workspace_id must match'):
                session.flush()


class TestCrossWorkspaceHooks(_MemoryDbTestCase):
    """Cross-workspace invariants enforced in before_flush hooks."""

    def test_sequence_in_line_workspace_mismatch_raises(self):
        with Session(self.engine) as session:
            w1 = Workspace(name='W1')
            w2 = Workspace(name='W2')
            session.add_all([w1, w2])
            session.flush()
            line_w1 = Line(workspace_id=w1.id, uid='L-W1', created_by_id=1)
            seq_w2 = Sequence(workspace_id=w2.id, file_content='s2.gb', name='S2', seguid='SEGUID-S2', created_by_id=1)
            session.add_all([line_w1, seq_w2])
            session.flush()
            session.add(SequenceInLine(line_id=line_w1.id, sequence_id=seq_w2.id))
            with self.assertRaisesRegex(ValueError, 'SequenceInLine line workspace must match sequence workspace'):
                session.flush()

    def test_sequence_in_line_same_workspace_passes(self):
        with Session(self.engine) as session:
            w1 = Workspace(name='W1')
            session.add(w1)
            session.flush()
            line_w1 = Line(workspace_id=w1.id, uid='L-W1', created_by_id=1)
            seq_w1 = Sequence(workspace_id=w1.id, file_content='s1.gb', name='S1', seguid='SEGUID-S1', created_by_id=1)
            session.add_all([line_w1, seq_w1])
            session.flush()
            session.add(SequenceInLine(line_id=line_w1.id, sequence_id=seq_w1.id))
            session.flush()

    def test_source_input_workspace_mismatch_raises(self):
        with Session(self.engine) as session:
            w1 = Workspace(name='W1')
            w2 = Workspace(name='W2')
            session.add_all([w1, w2])
            session.flush()
            out_seq = Sequence(
                workspace_id=w1.id, file_content='out.gb', name='Out', seguid='SEGUID-OUT', created_by_id=1
            )
            in_seq = Sequence(workspace_id=w2.id, file_content='in.gb', name='In', seguid='SEGUID-IN', created_by_id=1)
            session.add_all([out_seq, in_seq])
            session.flush()
            src = Source(
                id=out_seq.id,
                type=SourceType.ManuallyTypedSource,
                output_sequence=out_seq,
                extra_fields={},
            )
            session.add(src)
            session.flush()
            session.add(
                SourceInput(
                    source_id=src.id,
                    position=0,
                    input_entity_id=in_seq.id,
                )
            )
            with self.assertRaisesRegex(
                ValueError, 'SourceInput input_entity workspace must match source output sequence workspace'
            ):
                session.flush()

    def test_line_tag_workspace_mismatch_raises(self):
        with Session(self.engine) as session:
            w1 = Workspace(name='W1')
            w2 = Workspace(name='W2')
            session.add_all([w1, w2])
            session.flush()
            line = Line(workspace_id=w1.id, uid='L', created_by_id=1)
            tag_w2 = Tag(workspace_id=w2.id, name='T2')
            session.add_all([line, tag_w2])
            session.flush()
            line.tags.append(tag_w2)
            with self.assertRaisesRegex(ValueError, 'Line tag workspace mismatch between Line and tag'):
                session.flush()

    def test_input_entity_tag_workspace_mismatch_raises(self):
        with Session(self.engine) as session:
            w1 = Workspace(name='W1')
            w2 = Workspace(name='W2')
            session.add_all([w1, w2])
            session.flush()
            ent = Sequence(workspace_id=w1.id, file_content='e.gb', name='E', seguid='SEGUID-E', created_by_id=1)
            tag_w2 = Tag(workspace_id=w2.id, name='T2')
            session.add_all([ent, tag_w2])
            session.flush()
            ent.tags.append(tag_w2)
            with self.assertRaisesRegex(ValueError, 'Sequence tag workspace mismatch between Sequence and tag'):
                session.flush()

    def test_line_and_entity_tag_same_workspace_pass(self):
        with Session(self.engine) as session:
            w1 = Workspace(name='W1')
            session.add(w1)
            session.flush()
            line = Line(workspace_id=w1.id, uid='L', created_by_id=1)
            ent = Sequence(workspace_id=w1.id, file_content='e.gb', name='E', seguid='SEGUID-E', created_by_id=1)
            tag = Tag(workspace_id=w1.id, name='T1')
            session.add_all([line, ent, tag])
            session.flush()
            line.tags.append(tag)
            ent.tags.append(tag)
            session.flush()


class TestLine(_MemoryDbTestCase):
    """Tests for ``Line`` properties."""

    def test_parent_ids_and_children_ids(self):
        """``parent_ids`` / ``children_ids`` mirror the graph edges."""
        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            parent = Line(workspace_id=ws.id, uid='P', created_by_id=1)
            child = Line(workspace_id=ws.id, uid='C', created_by_id=1)
            session.add_all([parent, child])
            session.flush()
            child.parents.append(parent)
            session.flush()
            session.refresh(parent)
            session.refresh(child)
            self.assertEqual(parent.children_ids, [child.id])
            self.assertEqual(child.parent_ids, [parent.id])

    def test_alleles_and_plasmids_filter_by_sequence_type(self):
        """Alleles vs plasmids split on linked ``Sequence.sequence_type``."""
        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            line = Line(workspace_id=ws.id, uid='L', created_by_id=1)
            session.add(line)
            session.flush()
            allele_seq = Sequence(
                workspace_id=ws.id,
                file_content='a.gb',
                sequence_type=SequenceType.allele,
                seguid='SEGUID-ALLELE',
                created_by_id=1,
            )
            plasmid_seq = Sequence(
                workspace_id=ws.id,
                file_content='p.gb',
                sequence_type=SequenceType.plasmid,
                seguid='SEGUID-PLASMID',
                created_by_id=1,
            )
            session.add_all([allele_seq, plasmid_seq])
            session.flush()
            sil_a = SequenceInLine(sequence_id=allele_seq.id, line_id=line.id)
            sil_p = SequenceInLine(sequence_id=plasmid_seq.id, line_id=line.id)
            session.add_all([sil_a, sil_p])
            session.flush()
            session.refresh(line)
            self.assertEqual(len(line.alleles), 1)
            self.assertEqual(line.alleles[0].id, sil_a.id)
            self.assertEqual(len(line.plasmids), 1)
            self.assertEqual(line.plasmids[0].id, sil_p.id)


class TestRequireValueAndRow(_MemoryDbTestCase):
    """Tests for miscellaneous functions."""

    def test_require_value_none_raises(self):
        with self.assertRaisesRegex(ValueError, 'test message'):
            _require_value(None, 'test message')

    def test_require_row_none_raises(self):
        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            with self.assertRaisesRegex(ValueError, 'Cannot resolve'):
                _require_row(session, Sequence, 'Sequence', row_id=999)


class TestForeignKeysApply(_MemoryDbTestCase):
    """Tests for foreign key constraints."""

    def test_foreign_keys_apply(self):
        with Session(self.engine) as session:
            ws = Workspace(name='W')
            session.add(ws)
            session.flush()
            line = Line(workspace_id=ws.id, uid='L', created_by_id=10)
            session.add(line)
            self.assertRaises(IntegrityError, session.commit)


class TestApiModelValidators(unittest.TestCase):
    """Edge-case branches in StrippedStr / apimodel validation."""

    def test_template_sequence_create_strip_name_non_string(self):
        from pydantic import ValidationError

        from opencloning_db.apimodels import TemplateSequenceCreate

        with pytest.raises(ValidationError):
            TemplateSequenceCreate(name=None, sequence_type=SequenceType.allele)

    def test_primer_update_strip_uid_non_string(self):
        from opencloning_db.apimodels import PrimerUpdate

        obj = PrimerUpdate(uid=None)
        assert obj.uid is None

    def test_primer_update_strip_name_single_char_ok(self):
        from opencloning_db.apimodels import PrimerUpdate

        obj = PrimerUpdate(name=' a ')
        assert obj.name == 'a'

    def test_primer_update_strip_name_empty_raises(self):
        from pydantic import ValidationError

        from opencloning_db.apimodels import PrimerUpdate

        with pytest.raises(ValidationError):
            PrimerUpdate(name='   ')

    def test_primer_update_strip_name_non_string(self):
        from opencloning_db.apimodels import PrimerUpdate

        obj = PrimerUpdate(name=None)
        assert obj.name is None

    def test_user_ref_none_returns_none(self):
        from opencloning_db.apimodels import _user_ref

        assert _user_ref(None) is None
