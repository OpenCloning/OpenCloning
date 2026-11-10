#!/usr/bin/env sh

echo -e "\033[1;34m>\033[0m Checking for axios outside of client files..."

ALL_FILES=$(find packages -name "*.js" -o -name "*.jsx" | grep -v "test.js")
ALL_FILES="$ALL_FILES $(find apps -name "*.js" -o -name "*.jsx" | grep -v "test.js"| grep -v "apps/syntax-builder"|grep -v "apps/opencloning/build")"


EXCLUDED_PATHS="node_modules|dist|build"
FILES_WITH_AXIOS=$(grep -l "import.*axios\|axios.*import" $ALL_FILES | grep -v -E "$EXCLUDED_PATHS")

ACCEPTED_FILES="packages/utils/src/utils/httpClients.js packages/opencloning-elabftw/src/common.js packages/opencloningdb/src/common.js"


for file in $FILES_WITH_AXIOS; do
  if ! echo "$ACCEPTED_FILES" | grep -q "$file"; then
    echo "Error: Found axios import in $file. Axios should only be used in client files ($ACCEPTED_FILES)."
    exit 1
  fi
done

