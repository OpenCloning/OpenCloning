#!/usr/bin/env sh

echo -e "\033[1;34m>\033[0m Checking for \033[1;33mit.only()\033[0m or \033[1;33mit.skip()\033[0m in test files..."

TEST_FILES=$(find . -not -path "./node_modules/*" -a \( -name "*.cy.js" -o -name "*.cy.jsx" -o -name "*.test.js" \))

# it.only() is never allowed
if grep -rn 'it.only(' $TEST_FILES; then
  echo "Error: Found it.only() in test files. Please remove it before committing."
  exit 1
fi

# it.skip() is only allowed if the same line has an "allow-skip" comment, e.g.
#   it.skip('does X', () => { // allow-skip: external service is down
if grep -rn 'it.skip(' $TEST_FILES | grep -v 'allow-skip'; then
  echo "Error: Found it.skip() in test files. Please remove it, or add an 'allow-skip: <reason>' comment on the same line."
  exit 1
fi
