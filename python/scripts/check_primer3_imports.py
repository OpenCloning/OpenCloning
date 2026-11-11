#!/usr/bin/env python3
import ast
import sys
from pathlib import Path


def check_file(file_path):
    """Check if primer3 is imported in the file and if it's allowed."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    try:
        tree = ast.parse(content)
    except SyntaxError:
        print(f"Error: Could not parse {file_path}")
        return False

    # Check for primer3 imports
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)) and hasattr(node, 'module'):
            if node.module == 'primer3':
                # Only allow imports in primer3_functions.py
                if file_path.name != 'primer3_functions.py':
                    print(f'Error: primer3 import found in {file_path}')
                    print('primer3 should only be imported in primer3_functions.py')
                    return False

    return True


def main():
    files = sys.argv[1:]
    if not files:
        print('No files provided')
        sys.exit(1)

    failed = False
    for file_path in files:
        if not check_file(Path(file_path)):
            failed = True

    if failed:
        sys.exit(1)


if __name__ == '__main__':
    main()
