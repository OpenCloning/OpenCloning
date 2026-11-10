"""
Client for the Addgene Developers API, see https://docs.developers.addgene.org
"""

from fastapi import HTTPException

from . import app_settings
from .http_client import Response, get_http_client

ADDGENE_API_URL = 'https://api.developers.addgene.org'


def _auth_headers() -> dict[str, str]:
    token = app_settings.settings.ADDGENE_TOKEN
    if token is None:
        raise HTTPException(
            503,
            'Addgene access requires an API token. Please set the ADDGENE_TOKEN environment variable '
            'and ensure your use complies with Addgene Terms of Use. For more information, see README.md.',
        )
    return {'Authorization': f'Token {token}'}


def _check_response(resp: Response) -> None:
    if resp.status_code in (401, 403):
        raise HTTPException(
            503,
            'Addgene rejected the ADDGENE_TOKEN (invalid, expired or missing the required scopes). '
            'For more information, see README.md.',
        )


def genbank_api_url(sequence_id: int | str) -> str:
    """Canonical (stable) url from which the genbank file of an Addgene sequence is downloaded."""
    return f'{ADDGENE_API_URL}/download/genbank/{sequence_id}/'


async def get_plasmid_with_sequences(addgene_id: str) -> dict:
    if not addgene_id.isdigit():
        raise HTTPException(404, 'wrong addgene id')
    async with get_http_client() as client:
        resp = await client.get(
            f'{ADDGENE_API_URL}/catalog/plasmid-with-sequences/{addgene_id}/', headers=_auth_headers()
        )
    _check_response(resp)
    if resp.status_code == 404:
        raise HTTPException(404, 'wrong addgene id')
    resp.raise_for_status()
    return resp.json()


async def download_genbank(sequence_id: int | str) -> str:
    """Download the genbank file of a sequence. The API answers with a redirect to a presigned url."""
    async with get_http_client() as client:
        # httpx drops the Authorization header when the redirect goes to another origin
        resp = await client.get(genbank_api_url(sequence_id), headers=_auth_headers(), follow_redirects=True)
    _check_response(resp)
    if resp.status_code != 200:
        raise HTTPException(503, 'Failed to download sequence file from Addgene')
    return resp.text
