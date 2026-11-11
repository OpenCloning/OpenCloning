#!/bin/bash

# Delete all screenshots and run all tests in parallel
rm -f cypress/screenshots/*/*.png
rmdir cypress/screenshots/*
rm -rf coverage

# Default value for FILTER_OUT
FILTER_OUT=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --filter-out)
      FILTER_OUT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Run tests, filtering out based on pattern if provided
if [ -n "$FILTER_OUT" ]; then
  TEST_FILES=$(find cypress/e2e -name '*.cy.js' | grep -v "$FILTER_OUT")
else
  TEST_FILES=$(find cypress/e2e -name '*.cy.js')
fi

echo "$TEST_FILES" | parallel --group -j4 'yarn cypress run --config trashAssetsBeforeRuns=false --spec {}'
