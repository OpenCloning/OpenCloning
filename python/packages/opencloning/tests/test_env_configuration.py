import unittest
from pytest import MonkeyPatch
from importlib import reload
from fastapi.testclient import TestClient
import shutil
import glob
import os
import tempfile
import opencloning.main as main
import opencloning.app_settings as app_settings

test_files = os.path.join(os.path.dirname(__file__), 'test_files')


class TestServeFrontend(unittest.TestCase):
    def setUp(self):
        self._prev_cwd = os.getcwd()
        self._workdir = tempfile.mkdtemp()
        os.chdir(self._workdir)
        os.makedirs('frontend', exist_ok=True)
        for f in glob.glob(f'{test_files}/dummy_frontend/*'):
            if os.path.isdir(f):
                shutil.copytree(f, f'./frontend/{f.split("/")[-1]}', dirs_exist_ok=True)
            else:
                shutil.copy2(f, './frontend')

        MonkeyPatch().setenv('SERVE_FRONTEND', '1')
        reload(app_settings)
        reload(main)
        self.client = TestClient(main.app)

    def tearDown(self):
        MonkeyPatch().setenv('SERVE_FRONTEND', '0')
        reload(app_settings)
        reload(main)
        os.chdir(self._prev_cwd)
        shutil.rmtree(self._workdir, ignore_errors=True)

    def test_serve_frontend(self):
        # The index is served at the root
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('<noscript>You need to enable JavaScript to run this app.</noscript>', response.text)

        # The rest of files can be accessed:
        for file in ['config.json', 'favicon.ico', 'robots.txt', 'logo192.png', 'logo512.png', 'manifest.json']:
            response = self.client.get(f'/{file}')
            self.assertEqual(response.status_code, 200)

        # Can still make a normal request (e.g. enzymes)
        response = self.client.get('/restriction_enzyme_list')
        self.assertEqual(response.status_code, 200)
        self.assertIn('EcoRI', response.text)

        # If requesting a file that does not exist, it should return a 404
        response = self.client.get('/dummy_file.json')
        self.assertEqual(response.status_code, 404)

    def test_frontend_config_endpoint_uses_env_vars(self):
        monkeypatch = MonkeyPatch()
        try:
            monkeypatch.setenv('BACKEND_URL', 'https://api.example.org/')
            monkeypatch.setenv('DATABASE', 'production')
            monkeypatch.setenv('SHOW_APP_BAR', '0')
            monkeypatch.setenv('NO_EXTERNAL_REQUESTS', '1')
            monkeypatch.setenv('ENABLE_ASSEMBLER', 'False')
            monkeypatch.setenv('ENABLE_PLANNOTATE', 'false')
            monkeypatch.setenv('STATIC_CONTENT_PATH', '/srv/static')
            reload(app_settings)
            reload(main)
            client = TestClient(main.app)

            response = client.get('/config.json')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(
                response.json(),
                {
                    'backendUrl': 'https://api.example.org/',
                    'database': 'production',
                    'showAppBar': False,
                    'noExternalRequests': True,
                    'enableAssembler': False,
                    'enablePlannotate': False,
                    'staticContentPath': '/srv/static',
                },
            )
        finally:
            monkeypatch.undo()
