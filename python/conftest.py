"""Root pytest configuration.

The tests mock outbound requests with `respx`'s global router (`respx.get(...)`, `@respx.mock`).
respx patches `httpcore` by default, but the app uses `httpx2`, which runs on `httpcore2`: the
`httpcore2` mocker comes from pytest-httpx2 (registered when the plugin loads), and here it
becomes the default one, so the tests that use the global router mock `httpx2` requests.
New tests can use the `httpx2_mock` fixture of pytest-httpx2 instead.
"""

import pytest_httpx2  # noqa: F401  (registers the 'httpcore2' mocker in respx)
import respx.mocks

respx.mocks.DEFAULT_MOCKER = 'httpcore2'
