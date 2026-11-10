#!/usr/bin/env sh

# Track if any files were fixed
fixed_files=0

# Get list of staged files
staged_files=$(git diff --cached --name-only --diff-filter=ACMR)

# Check each staged file for missing newline
for file in $staged_files; do
    # Skip if file doesn't exist or is empty
    if [ ! -f "$file" ] || [ ! -s "$file" ]; then
        continue
    fi

    # Check file extension
    case "$file" in
        # Source code and config files
        *.js|*.jsx|*.ts|*.tsx|*.css|*.scss|*.html|*.json|*.yml|*.yaml|*.toml|*.md|*.sh|*.rc|*.txt)
            if ! tail -c1 "$file" | read -r _; then
                echo "Adding newline to: $file"
                echo "" >> "$file"
                git add "$file"
                fixed_files=1
            fi
            ;;
    esac
done

if [ $fixed_files -eq 1 ]; then
    echo "Error: Some files were missing newlines and have been fixed."
    echo "Please review the changes and commit them."
    exit 1
fi
