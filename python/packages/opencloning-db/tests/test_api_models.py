from opencloning_db.apimodels import TagCreate
from unittest import TestCase
from pydantic import ValidationError


class TestTagCreate(TestCase):

    def test_strip_tag_name(self):
        tag_create = TagCreate(name='  Tag Name  ')
        assert tag_create.name == 'Tag Name'

    def test_strip_tag_name_empty(self):
        self.assertRaises(ValidationError, TagCreate, name='')

    # This one is for coverage completion
    def test_other_type_raises_validation_error(self):
        self.assertRaises(ValidationError, TagCreate, name=123)
