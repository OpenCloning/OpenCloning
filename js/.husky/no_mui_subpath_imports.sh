#!/usr/bin/env sh

echo -e "\033[1;34m>\033[0m Checking for MUI subpath imports..."

# Get staged files that are JS/JSX files in packages/ui/src
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E "(apps|packages)/.*/src/.*\.(js|jsx)$")

if [ -z "$STAGED_FILES" ]; then
  echo -e "\033[1;32m✓\033[0m No files in apps or packages staged, skipping MUI import check"
  exit 0
fi

VIOLATIONS=0

for file in $STAGED_FILES; do
  # Check for MUI material subpath imports (e.g., import Component from '@mui/material/Component')
  if grep -q "from '@mui/material/[A-Z]" "$file" 2>/dev/null; then
    echo -e "\033[1;31m✗\033[0m Found MUI material subpath import in: $file"
    echo "   Use: import { Component } from '@mui/material'"
    echo "   Instead of: import Component from '@mui/material/Component'"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
  
  # Check for MUI icons subpath imports (e.g., import Icon from '@mui/icons-material/Icon')
  if grep -q "from '@mui/icons-material/" "$file" 2>/dev/null; then
    echo -e "\033[1;31m✗\033[0m Found MUI icons subpath import in: $file"
    echo "   Use: import { Icon } from '@mui/icons-material'"
    echo "   Instead of: import Icon from '@mui/icons-material/Icon'"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo -e "\033[1;31mError:\033[0m Found $VIOLATIONS violation(s). Please fix MUI imports before committing."
  echo "   MUI components and icons must be imported from the main package, not subpaths."
  echo "   This ensures proper module resolution when the package is installed from npm."
  exit 1
fi

echo -e "\033[1;32m✓\033[0m No MUI subpath imports found"
