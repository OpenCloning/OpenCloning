import unittest
import pytest
from importlib import reload

from opencloning import app_settings


class TestAppSettings(unittest.TestCase):
    def setUp(self):
        self.monkeypatch = pytest.MonkeyPatch()
        self.monkeypatch.delenv('ADDGENE_TOKEN', raising=False)
        self.monkeypatch2 = pytest.MonkeyPatch()
        reload(app_settings)

    def tearDown(self):
        self.monkeypatch2.undo()
        self.monkeypatch.undo()
        reload(app_settings)

    def test_default_values(self):
        self.assertEqual(app_settings.settings.SERVE_FRONTEND, False)
        self.assertEqual(app_settings.settings.BATCH_CLONING, True)
        # self.assertEqual(app_settings.settings.NCBI_API_KEY, None) > This is different in the CI
        self.assertEqual(
            app_settings.settings.ALLOWED_ORIGINS,
            ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3002'],
        )
        self.assertEqual(app_settings.settings.MAX_SEQUENCE_FILE_SIZE_MB, 10)
        self.assertEqual(app_settings.settings.MAX_REQUEST_BODY_SIZE_MB, 100)
        self.assertEqual(app_settings.settings.PLANNOTATE_URL, None)
        self.assertEqual(app_settings.settings.PLANNOTATE_TIMEOUT, 20)
        self.assertEqual(app_settings.settings.PROXY_URL, None)
        self.assertEqual(app_settings.settings.PROXY_CERT_FILE, None)
        self.assertEqual(app_settings.settings.ADDGENE_TOKEN, None)

    def test_settings_from_env(self):
        self.monkeypatch2.setenv('SERVE_FRONTEND', '1')
        self.monkeypatch2.setenv('BATCH_CLONING', '0')
        self.monkeypatch2.setenv('NCBI_API_KEY', 'test')
        self.monkeypatch2.setenv('ALLOWED_ORIGINS', 'hello,bye')
        self.monkeypatch2.setenv('MAX_SEQUENCE_FILE_SIZE_MB', '3')
        self.monkeypatch2.setenv('MAX_REQUEST_BODY_SIZE_MB', '50')
        self.monkeypatch2.setenv('PLANNOTATE_URL', 'http://dummy/url')
        self.monkeypatch2.setenv('PLANNOTATE_TIMEOUT', '30')
        self.monkeypatch2.setenv('PROXY_URL', 'http://dummy/url')
        self.monkeypatch2.setenv('PROXY_CERT_FILE', 'dummy/cert.pem')
        self.monkeypatch2.setenv('ADDGENE_TOKEN', 'dummy-token')

        reload(app_settings)

        self.assertEqual(app_settings.settings.SERVE_FRONTEND, True)
        self.assertEqual(app_settings.settings.MAX_SEQUENCE_FILE_SIZE_MB, 3)
        self.assertEqual(app_settings.settings.MAX_REQUEST_BODY_SIZE_MB, 50)
        self.assertEqual(app_settings.settings.BATCH_CLONING, False)
        self.assertEqual(app_settings.settings.NCBI_API_KEY, 'test')
        self.assertEqual(app_settings.settings.ALLOWED_ORIGINS, ['hello', 'bye'])
        self.assertEqual(app_settings.settings.PLANNOTATE_URL, 'http://dummy/url/')  # Trailing slash added
        self.assertEqual(app_settings.settings.PLANNOTATE_TIMEOUT, 30)
        self.assertEqual(app_settings.settings.PROXY_URL, 'http://dummy/url')
        self.assertEqual(app_settings.settings.PROXY_CERT_FILE, 'dummy/cert.pem')
        self.assertEqual(app_settings.settings.ADDGENE_TOKEN, 'dummy-token')

        # Test boolean inputs
        self.monkeypatch2.setenv('SERVE_FRONTEND', 'True')
        reload(app_settings)
        self.assertEqual(app_settings.settings.SERVE_FRONTEND, True)

        self.monkeypatch2.setenv('SERVE_FRONTEND', 'TRUE')
        reload(app_settings)
        self.assertEqual(app_settings.settings.SERVE_FRONTEND, True)

        self.monkeypatch2.setenv('SERVE_FRONTEND', 'true')
        reload(app_settings)
        self.assertEqual(app_settings.settings.SERVE_FRONTEND, True)

    def test_frontend_config_from_env(self):
        self.assertEqual(app_settings.frontend_config.backendUrl, 'http://localhost:8000/')
        self.assertEqual(app_settings.frontend_config.database, None)
        self.assertEqual(app_settings.frontend_config.showAppBar, True)
        self.assertEqual(app_settings.frontend_config.noExternalRequests, False)
        self.assertEqual(app_settings.frontend_config.enableAssembler, True)
        self.assertEqual(app_settings.frontend_config.enablePlannotate, True)
        self.assertEqual(app_settings.frontend_config.staticContentPath, None)

        self.monkeypatch2.setenv('BACKEND_URL', 'http://dummy-backend:8000/')
        self.monkeypatch2.setenv('DATABASE', 'blah')
        self.monkeypatch2.setenv('SHOW_APP_BAR', '0')
        self.monkeypatch2.setenv('NO_EXTERNAL_REQUESTS', '1')
        self.monkeypatch2.setenv('ENABLE_ASSEMBLER', 'False')
        self.monkeypatch2.setenv('ENABLE_PLANNOTATE', 'false')
        self.monkeypatch2.setenv('STATIC_CONTENT_PATH', '/tmp/static')

        reload(app_settings)

        self.assertEqual(app_settings.frontend_config.backendUrl, 'http://dummy-backend:8000/')
        self.assertEqual(app_settings.frontend_config.database, 'blah')
        self.assertEqual(app_settings.frontend_config.showAppBar, False)
        self.assertEqual(app_settings.frontend_config.noExternalRequests, True)
        self.assertEqual(app_settings.frontend_config.enableAssembler, False)
        self.assertEqual(app_settings.frontend_config.enablePlannotate, False)
        self.assertEqual(app_settings.frontend_config.staticContentPath, '/tmp/static')

    def test_allowed_origins_empty_string(self):
        self.monkeypatch2.setenv('ALLOWED_ORIGINS', 'hello,,bye')
        reload(app_settings)
        self.assertEqual(app_settings.settings.ALLOWED_ORIGINS, ['hello', 'bye'])
        self.monkeypatch2.setenv('ALLOWED_ORIGINS', '')
        reload(app_settings)
        self.assertEqual(app_settings.settings.ALLOWED_ORIGINS, [])
        self.monkeypatch2.undo()
        reload(app_settings)
