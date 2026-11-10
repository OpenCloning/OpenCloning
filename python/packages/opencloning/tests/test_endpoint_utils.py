"""Unit tests for helpers in ``endpoint_utils``."""

import io
import unittest

from fastapi import HTTPException, UploadFile

from opencloning.endpoints.endpoint_utils import read_upload_with_limit


class ReadUploadWithLimitTest(unittest.TestCase):
    def test_unknown_size_over_limit_raises(self):
        """When the declared size is missing, content past the limit is rejected."""
        payload = b'A' * (1024 * 1024 + 1)
        upload = UploadFile(file=io.BytesIO(payload), size=None, filename='big.fasta')
        with self.assertRaises(HTTPException) as ctx:
            read_upload_with_limit(upload, max_size_mb=1)
        self.assertEqual(ctx.exception.status_code, 413)
        self.assertIn('big.fasta', ctx.exception.detail)
        self.assertIn('maximum size of 1 MB', ctx.exception.detail)
