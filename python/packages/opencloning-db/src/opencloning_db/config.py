"""
Application configuration.

Runtime config is loaded lazily from environment variables via ``get_config()``.
Tests and other callers can still instantiate ``Config`` directly.
"""

import os
from urllib.parse import urlparse

from opencloning.app_settings import ALLOWED_ORIGINS
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator
from sqlalchemy.engine import make_url

_LOCAL_HOSTNAMES = {'localhost', '127.0.0.1'}

_REQUIRED_ENV_VARS = (
    'OPENCLONING_DB_URL',
    'OIDC_ISSUER_URL',
)


def parse_bool(value: str | bool) -> bool:
    return value in {'1', 'TRUE', 'true', 'True', True}


class OidcConfig(BaseModel):
    """OIDC bearer-token authentication settings."""

    model_config = ConfigDict(frozen=True)

    issuer_url: str = Field(
        description='OIDC issuer URL used for discovery and JWT validation.',
    )
    subject_claim: str = Field(default='sub', description='JWT claim used as external subject.')
    email_claim: str = Field(default='email', description='JWT claim used for email and legacy linking.')
    name_claim: str = Field(default='name', description='JWT claim used for display_name when present.')
    authorized_parties: list[str] = Field(
        description='Allowed azp claim values for session JWTs.',
    )
    test_mode: bool = Field(
        default=False,
        description='Accept test:<subject> bearer tokens without JWKS when OIDC_TEST_MODE=1.',
    )

    @field_validator('authorized_parties', mode='before')
    @classmethod
    def _normalize_authorized_parties(cls, value: list[str]) -> list[str]:
        if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
            raise ValueError('authorized_parties must be a list of strings')
        return [str(origin).rstrip('/') for origin in value if str(origin).rstrip('/') != '']

    @computed_field  # type: ignore[prop-decorator]
    @property
    def provider_name(self) -> str:
        """Stored in ``User.auth_provider``, derived from ``issuer_url`` hostname."""
        hostname = urlparse(self.issuer_url).hostname
        return f'oidc:{hostname}'

    @classmethod
    def from_env(cls) -> 'OidcConfig':
        authorized_parties = os.environ.get('OIDC_AUTHORIZED_PARTIES') or ALLOWED_ORIGINS
        if isinstance(authorized_parties, str):
            authorized_parties = authorized_parties.split(',')
        test_mode = parse_bool(os.getenv('OIDC_TEST_MODE', False))
        if test_mode:
            # Test mode accepts unsigned tokens, so it must be an explicit opt-in for local throwaway instances.
            if not parse_bool(os.getenv('OPENCLONING_TESTING', False)):
                raise RuntimeError('OIDC_TEST_MODE=1 requires OPENCLONING_TESTING=1')
            # Config sanity check only (catches a real frontend pointed at a test-mode backend).
            # It does not restrict network access: any client that can reach the port can send
            # test tokens, so test-mode servers must only be exposed on trusted networks.
            non_local = [
                origin
                for origin in [*authorized_parties, *ALLOWED_ORIGINS]
                if urlparse(origin).hostname not in _LOCAL_HOSTNAMES
            ]
            if non_local:
                raise RuntimeError(
                    'OIDC_TEST_MODE=1 is only allowed when all origins are localhost, '
                    f'found: {", ".join(sorted(set(non_local)))}'
                )
        return cls(
            issuer_url=os.environ['OIDC_ISSUER_URL'],
            subject_claim=os.environ.get('OIDC_SUBJECT_CLAIM', 'sub'),
            email_claim=os.environ.get('OIDC_EMAIL_CLAIM', 'email'),
            name_claim=os.environ.get('OIDC_NAME_CLAIM', 'name'),
            authorized_parties=authorized_parties,
            test_mode=test_mode,
        )


def _load_config_from_env() -> 'Config':
    missing_vars = [env_name for env_name in _REQUIRED_ENV_VARS if not os.environ.get(env_name)]
    if missing_vars:
        missing = ', '.join(missing_vars)
        raise RuntimeError(
            'Missing required OpenCloning environment variables: ' f'{missing}. For local development load .env.dev'
        )

    optional_settings = {}
    if os.environ.get('MAX_SEQUENCING_FILE_SIZE_MB'):
        optional_settings['max_sequencing_file_size_mb'] = os.environ['MAX_SEQUENCING_FILE_SIZE_MB']
    return Config(
        database_url=os.environ['OPENCLONING_DB_URL'],
        oidc_config=OidcConfig.from_env(),
        **optional_settings,
    )


class Config(BaseModel):
    """OpenCloning database configuration."""

    model_config = ConfigDict(frozen=True)

    @field_validator('database_url')
    @classmethod
    def _validate_database_url(cls, value: str) -> str:
        url = make_url(value)
        if url.get_backend_name() != 'postgresql':
            raise ValueError('Only PostgreSQL database URLs are supported.')
        if url.drivername != 'postgresql+psycopg':
            raise ValueError(
                'Only PostgreSQL database URLs using the psycopg driver are supported ' '(postgresql+psycopg://...).'
            )
        return value

    database_url: str = Field(
        description='SQLAlchemy PostgreSQL URL using the psycopg (v3) driver (postgresql+psycopg://...)',
    )
    oidc_config: OidcConfig = Field(
        description='OIDC authentication settings.',
    )
    max_sequencing_file_size_mb: int = Field(
        default=20,
        gt=0,
        description='Maximum size (in MB) of each uploaded sequencing file.',
    )


config: Config | None = None


def _peek_config() -> Config | None:
    return config


def get_config() -> Config:
    global config
    if config is None:
        config = _load_config_from_env()
    return config


def set_config(new_config: Config | None) -> None:
    global config
    config = new_config
