import unittest
from fastapi.testclient import TestClient

import opencloning.main as _main

client = TestClient(_main.app)


class GreetingTest(unittest.TestCase):
    def test_greeting(self):
        response = client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('<a href="./docs">here</a>', response.text)
