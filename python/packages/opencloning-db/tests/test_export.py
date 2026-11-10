"""Workspace export endpoint."""

from sqlalchemy import select
from sqlalchemy.orm import Session
import pytest
from opencloning_db.models import Sequence, BaseSequence
from opencloning_linkml.datamodel.models import CloningStrategy, DatabaseSource

from .helpers import (
    assert_get_invalid_workspace_id_422,
    assert_get_missing_workspace_header_422,
    assert_get_non_member_workspace_403,
    assert_get_unauthenticated_401,
    workspace_headers,
)

pytest_plugins = ['tests.test_sequences']

readonly_db = pytest.mark.readonly_db


def _get_export(client, token: str, workspace_id: int):
    return client.get('/export', headers=workspace_headers(token, workspace_id))


def _cloning_strategy_subset(exported: dict, expected: dict) -> None:
    assert {seq['id'] for seq in expected['sequences']}.issubset({seq['id'] for seq in exported['sequences']})
    assert {source['id'] for source in expected['sources']}.issubset({source['id'] for source in exported['sources']})
    assert {primer['id'] for primer in expected['primers']}.issubset({primer['id'] for primer in exported['primers']})


@readonly_db
def test_export_access_control(sequences_client):
    """Auth and workspace membership guards."""
    c = sequences_client
    assert_get_missing_workspace_header_422(c['client'], '/export', c['token_owner_w1'])
    assert_get_invalid_workspace_id_422(c['client'], '/export', c['token_owner_w1'])
    assert_get_unauthenticated_401(c['client'], '/export', c['w1'])
    assert_get_non_member_workspace_403(c['client'], '/export', c['token_owner_w2'], c['w1'])


@readonly_db
def test_export_w1_payload(sequences_client):
    """Export returns workspace-scoped entities, id-based refs, members, and cloning strategies."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_w1']
    w1 = sequences_client['w1']
    headers = workspace_headers(tok, w1)

    response = _get_export(c, tok, w1)
    assert response.status_code == 200, response.text
    payload = response.json()

    assert {primer['id'] for primer in payload['primers']} == {
        sequences_client['primer1_id'],
        sequences_client['primer2_id'],
    }
    sequence_ids = {seq['id'] for seq in payload['sequences']}
    base_sequence_ids_in_db = set()
    with Session(sequences_client['engine']) as session:
        base_sequence_ids_in_db = {
            seq.id for seq in session.scalars(select(BaseSequence).where(BaseSequence.workspace_id == w1))
        }
    assert base_sequence_ids_in_db == sequence_ids
    assert {tag['id'] for tag in payload['tags']} == {
        sequences_client['filter_tag_id'],
        sequences_client['bulk_tag_id'],
    }

    assert len(payload['lines']) == 1
    line = payload['lines'][0]
    assert line['uid'] == 'line-for-seq-filter'
    assert line['sequence_ids'] == [sequences_client['pcr_template_id']]
    assert line['parent_ids'] == []
    assert line['tag_ids'] == []
    assert line['created_by_id'] == sequences_client['owner_w1_id']

    # Tag ids are included
    pcr_product = next(s for s in payload['sequences'] if s['id'] == sequences_client['pcr_product_id'])
    assert pcr_product['tag_ids'] == [sequences_client['filter_tag_id']]
    assert pcr_product['created_by_id'] == sequences_client['owner_w1_id']

    # UIDs are included
    seq_w1 = next(s for s in payload['sequences'] if s['id'] == sequences_client['seq_w1_id'])
    assert seq_w1['sample_uids'] == ['UID-W1']

    primer = next(p for p in payload['primers'] if p['id'] == sequences_client['primer1_id'])
    assert primer['created_by_id'] == sequences_client['owner_w1_id']

    assert len(payload['users']) == 5
    assert {user['display_name'] for user in payload['users']} == {
        'Owner W1',
        'Viewer W1',
        'Owner Both',
        'Owner W1 Viewer W2',
        'Editor W1',
    }

    exported = payload['cloning_strategy']
    for sequence_id in (sequences_client['pcr_product_id'], sequences_client['gateway_product_id']):
        strategy_r = c.get(
            f'/sequences/{sequence_id}/cloning_strategy',
            headers=headers,
            params={'recursive': True},
        )
        assert strategy_r.status_code == 200, strategy_r.text
        _cloning_strategy_subset(exported, strategy_r.json())

    with Session(sequences_client['engine']) as session:
        sequence_ids_in_db = {seq.id for seq in session.scalars(select(Sequence).where(Sequence.workspace_id == w1))}
    assert len(exported['sequences']) == len(sequence_ids_in_db)
    assert len(exported['sources']) == len(sequence_ids_in_db)
    cs = CloningStrategy.model_validate(exported)

    assert len([s for s in cs.sources if isinstance(s, DatabaseSource)]) == 0


@readonly_db
def test_export_w2_isolated_from_w1(sequences_client):
    """Export for another workspace does not include w1 entities."""
    c = sequences_client['client']
    tok = sequences_client['token_owner_w2']

    response = _get_export(c, tok, sequences_client['w2'])
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload['lines'] == []
    assert {seq['id'] for seq in payload['sequences']} == {sequences_client['seq_w2_id']}
    assert {tag['id'] for tag in payload['tags']} == {sequences_client['filter_tag_w2_id']}
    assert sequences_client['pcr_product_id'] not in {seq['id'] for seq in payload['sequences']}
    assert sequences_client['primer1_id'] not in {primer['id'] for primer in payload['primers']}

    exported = payload['cloning_strategy']
    assert sequences_client['pcr_product_id'] not in {seq['id'] for seq in exported['sequences']}
    assert sequences_client['primer1_id'] not in {primer['id'] for primer in exported['primers']}
    strategy_r = c.get(
        f"/sequences/{sequences_client['seq_w2_id']}/cloning_strategy",
        headers=workspace_headers(tok, sequences_client['w2']),
        params={'recursive': True},
    )
    assert strategy_r.status_code == 200, strategy_r.text
    _cloning_strategy_subset(exported, strategy_r.json())

    assert len(payload['users']) == 3
    assert {user['display_name'] for user in payload['users']} == {
        'Owner W2',
        'Owner Both',
        'Owner W1 Viewer W2',
    }
