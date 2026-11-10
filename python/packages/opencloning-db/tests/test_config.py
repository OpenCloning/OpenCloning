import unittest
from unittest.mock import patch
import os
from pydantic import ValidationError
from opencloning_db.config import Config, OidcConfig
import opencloning_db.config as app_config

_TEST_DATABASE_URL = 'postgresql+psycopg://dbuser:dbpassword@localhost:5432/opencloning_dev'
common_args = Config(
    database_url=_TEST_DATABASE_URL,
    oidc_config=OidcConfig(
        issuer_url='https://test.example',
        authorized_parties=[
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:3002',
        ],
        test_mode=False,
    ),
).model_dump()


class TestConfig(unittest.TestCase):
    """Tests for Config helpers."""

    def test_get_config_loads_required_values_from_env(self):
        """Runtime config is loaded lazily from the required env vars."""
        previous_config = app_config.config
        with patch.dict(
            os.environ,
            {
                'OPENCLONING_DB_URL': 'postgresql+psycopg://dbuser:dbpassword@localhost:5432/opencloning_dev',
                'OIDC_ISSUER_URL': 'https://idp.example.dev',
            },
            clear=True,
        ):
            app_config.set_config(None)
            cfg = app_config.get_config()
        app_config.set_config(previous_config)
        self.assertEqual(cfg.database_url, 'postgresql+psycopg://dbuser:dbpassword@localhost:5432/opencloning_dev')
        self.assertEqual(cfg.oidc_config.issuer_url, 'https://idp.example.dev')
        self.assertEqual(cfg.max_sequencing_file_size_mb, 20)

    def test_max_sequencing_file_size_from_env(self):
        with patch.dict(
            os.environ,
            {
                'OPENCLONING_DB_URL': 'postgresql+psycopg://dbuser:dbpassword@localhost:5432/opencloning_dev',
                'OIDC_ISSUER_URL': 'https://idp.example.dev',
                'MAX_SEQUENCING_FILE_SIZE_MB': '5',
            },
            clear=True,
        ):
            cfg = app_config._load_config_from_env()
        self.assertEqual(cfg.max_sequencing_file_size_mb, 5)

    def test_max_sequencing_file_size_from_env_is_validated(self):
        for value in ('0', '-1', 'abc'):
            with (
                self.subTest(value=value),
                patch.dict(
                    os.environ,
                    {
                        'OPENCLONING_DB_URL': 'postgresql+psycopg://dbuser:dbpassword@localhost:5432/opencloning_dev',
                        'OIDC_ISSUER_URL': 'https://idp.example.dev',
                        'MAX_SEQUENCING_FILE_SIZE_MB': value,
                    },
                    clear=True,
                ),
            ):
                with self.assertRaises(ValidationError):
                    app_config._load_config_from_env()

    def test_config_is_frozen(self):
        cfg = Config(
            database_url='postgresql+psycopg://dbuser:dbpassword@localhost:5432/opencloning_dev',
            oidc_config=OidcConfig(issuer_url='https://idp.example.dev', authorized_parties=['http://localhost:3000']),
        )
        with self.assertRaises(ValidationError):
            cfg.max_sequencing_file_size_mb = 5
        with self.assertRaises(ValidationError):
            cfg.oidc_config.test_mode = True

    def test_get_config_requires_runtime_env_vars(self):
        """Missing env vars produce one actionable runtime error."""
        previous_config = app_config.config
        with patch.dict(os.environ, {}, clear=True):
            app_config.set_config(None)
            with self.assertRaises(RuntimeError) as exc_info:
                app_config.get_config()
        app_config.set_config(previous_config)

        message = str(exc_info.exception)
        self.assertIn('OPENCLONING_DB_URL', message)
        self.assertIn('OIDC_ISSUER_URL', message)
        self.assertIn('.env.dev', message)

    def test_oidc_config_normalizes_authorized_parties(self):
        """Trailing slashes and blank CSV entries are stripped at model validation."""
        oidc = OidcConfig(
            issuer_url='https://test.example',
            authorized_parties=['https://app.example/', 'https://admin.example/'],
        )
        self.assertEqual(oidc.authorized_parties, ['https://app.example', 'https://admin.example'])

    def test_oidc_from_env_uses_allowed_origins_when_authorized_parties_unset(self):
        """When OIDC_AUTHORIZED_PARTIES is unset, authorized_parties come from ALLOWED_ORIGINS."""
        custom_origins = ['https://app.custom.example', 'https://admin.custom.example']
        with patch('opencloning_db.config.ALLOWED_ORIGINS', custom_origins):
            with patch.dict(
                os.environ,
                {'OIDC_ISSUER_URL': 'https://idp.example.dev'},
                clear=True,
            ):
                oidc = OidcConfig.from_env()
        self.assertEqual(oidc.authorized_parties, custom_origins)

    def test_oidc_from_env_test_mode_guards(self):
        """OIDC_TEST_MODE requires OPENCLONING_TESTING and only localhost origins."""
        with patch.dict(
            os.environ,
            {
                'OIDC_ISSUER_URL': 'https://idp.example.dev',
                'OIDC_TEST_MODE': '1',
            },
            clear=True,
        ):
            with self.assertRaisesRegex(RuntimeError, 'requires OPENCLONING_TESTING=1'):
                OidcConfig.from_env()

        with patch.dict(
            os.environ,
            {
                'OIDC_ISSUER_URL': 'https://idp.example.dev',
                'OIDC_TEST_MODE': '1',
                'OPENCLONING_TESTING': '1',
            },
            clear=True,
        ):
            oidc = OidcConfig.from_env()
        self.assertTrue(oidc.test_mode)

        with patch.dict(
            os.environ,
            {
                'OIDC_ISSUER_URL': 'https://idp.example.dev',
                'OIDC_TEST_MODE': '1',
                'OPENCLONING_TESTING': '1',
                'OIDC_AUTHORIZED_PARTIES': 'http://localhost:3000,https://app.example.com',
            },
            clear=True,
        ):
            with self.assertRaisesRegex(RuntimeError, 'only allowed when all origins are localhost'):
                OidcConfig.from_env()

        with patch('opencloning_db.config.ALLOWED_ORIGINS', ['https://app.example.com']):
            with patch.dict(
                os.environ,
                {
                    'OIDC_ISSUER_URL': 'https://idp.example.dev',
                    'OIDC_TEST_MODE': '1',
                    'OPENCLONING_TESTING': '1',
                    'OIDC_AUTHORIZED_PARTIES': 'http://127.0.0.1:3000',
                },
                clear=True,
            ):
                with self.assertRaisesRegex(RuntimeError, 'only allowed when all origins are localhost'):
                    OidcConfig.from_env()

        with patch.dict(
            os.environ,
            {
                'OIDC_ISSUER_URL': 'https://idp.example.dev',
                'OPENCLONING_TESTING': '1',
            },
            clear=True,
        ):
            oidc = OidcConfig.from_env()
        self.assertFalse(oidc.test_mode)

    def test_oidc_from_env_authorized_parties_can_differ_from_allowed_origins(self):
        """OIDC_AUTHORIZED_PARTIES overrides ALLOWED_ORIGINS when explicitly set."""
        custom_origins = ['https://app.custom.example']
        with patch('opencloning_db.config.ALLOWED_ORIGINS', custom_origins):
            with patch.dict(
                os.environ,
                {
                    'OIDC_ISSUER_URL': 'https://idp.example.dev',
                    'OIDC_AUTHORIZED_PARTIES': 'https://idp-app.example,https://other.example/',
                },
                clear=True,
            ):
                oidc = OidcConfig.from_env()
        self.assertEqual(oidc.authorized_parties, ['https://idp-app.example', 'https://other.example'])
        self.assertNotEqual(oidc.authorized_parties, custom_origins)

    def test_database_url_rejects_sqlite(self):
        """SQLite URLs are no longer accepted."""
        with self.assertRaises(ValidationError):
            Config(
                **(common_args | {'database_url': 'sqlite:///tmp/test.db'}),
            )

    def test_database_url_rejects_default_postgresql_driver(self):
        """Bare postgresql:// selects psycopg2 in SQLAlchemy; this package depends on psycopg3."""
        with self.assertRaises(ValidationError) as exc_info:
            Config(
                **(common_args | {'database_url': 'postgresql://dbuser:dbpassword@localhost:5432/opencloning_dev'}),
            )
        self.assertIn('postgresql+psycopg', str(exc_info.exception))
