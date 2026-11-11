import unittest
import tempfile
import os
import glob
import shutil
from opencloning.bug_fixing.backend_v0_3 import main as fix_backend_v0_3_script
import json
from opencloning._version import __version__

test_files_dir = os.path.join(os.path.dirname(__file__), 'test_files', 'bug_fixing')


class TestBugFixing(unittest.TestCase):

    def which_sources_are_templates(self, file_path: str) -> set[int]:
        with open(file_path, 'r') as f:
            data = json.load(f)

        return set(s['id'] for s in data['sequences'] if s['type'] == 'TemplateSequence')

    def test_backend_v0_3_script(self):
        # Copy JSON files from test_files/bug_fixing directory, excluding 'fixed.json' files

        # Find JSON files to test
        json_files = glob.glob(os.path.join(test_files_dir, '*.json'))
        json_files = [f for f in json_files if 'fixed.json' not in f]

        # Create a temporary directory to copy files
        with tempfile.TemporaryDirectory() as temp_dir:
            # Copy each JSON file to the temp directory
            temp_files = []
            for file_path in json_files:
                temp_file_path = os.path.join(temp_dir, os.path.basename(file_path))
                shutil.copy(file_path, temp_file_path)
                temp_files.append(temp_file_path)
            for file_path in temp_files:
                fix_backend_v0_3_script(file_path)
                fixed_path = file_path.replace('.json', '_needs_fixing.json')

                # Homologous recombination and gateway correct do not have a problem
                if 'homologous_recombination' in file_path or 'gateway_correct' in file_path:
                    self.assertFalse(os.path.exists(fixed_path))
                else:
                    self.assertTrue(os.path.exists(fixed_path))
                    with open(fixed_path, 'r') as f:
                        data = json.load(f)
                    self.assertEqual(data['backend_version'], __version__)

                # Tests which source ids are expected to be transformed into templates
                if 'pcr_spanning_origin' in file_path:
                    self.assertEqual(self.which_sources_are_templates(fixed_path), {2})
                elif 'gateway_13bp_overlap' in file_path:
                    self.assertEqual(self.which_sources_are_templates(fixed_path), {5, 6})
                elif 'gateway_13bp_followed_by_digestion' in file_path:
                    self.assertEqual(self.which_sources_are_templates(fixed_path), {5, 6})
                elif 'digestion_spanning_origin' in file_path:
                    self.assertEqual(self.which_sources_are_templates(fixed_path), {3})
                elif 'example_error_assembly_origin_spanning_feature.json' in file_path:
                    self.assertEqual(self.which_sources_are_templates(fixed_path), {5})
