#!/usr/bin/env bash
# Run inside the container: bash .devcontainer/check-isolation.sh
set -u
pass=0; fail=0
check() {
  if eval "$2" >/dev/null 2>&1; then echo "PASS  $1"; pass=$((pass+1))
  else echo "FAIL  $1"; fail=$((fail+1)); fi
}

check "running as non-root"                 '[ "$(id -u)" -ne 0 ]'
check "no SSH agent forwarded"              '[ -z "${SSH_AUTH_SOCK:-}" ]'
check "no host credentials in home"         '[ ! -e ~/.ssh ] && [ ! -e ~/.aws ] && [ ! -e ~/.config/doctl ] && [ ! -e ~/.gitconfig ]'
check "git has no credential helper"        '[ -z "$(git config --get-all credential.helper)" ]'
check "git credential fill returns nothing" '! (printf "protocol=https\nhost=github.com\n\n" | GIT_TERMINAL_PROMPT=0 timeout 5 git credential fill | grep -q "^password=")'
# check "example.com blocked"                 '! curl -sS -m 5 -o /dev/null https://example.com'
check "Claude API reachable"                'curl -sS -m 10 -o /dev/null https://api.anthropic.com'
check "PyPI files reachable"                'curl -sS -m 10 -o /dev/null https://files.pythonhosted.org'
check "NCBI reachable"                      'curl -sS -m 10 -o /dev/null https://eutils.ncbi.nlm.nih.gov'
check "postgres sidecar reachable"          'pg_isready -h localhost -p 5432'
check "Claude Code installed"               'claude --version'
check "python venv available"               '/opt/venv/bin/python --version'
check "node and yarn available"             'node --version && yarn --version'
check "bw not installed"                    '! command -v bw'
check ".git is read-only"                   '! touch /workspace/.git/write-test'
# check ".devcontainer read-only"             '! touch /workspace/.devcontainer/write-test'
check "secrets folder hidden"               '[ -z "$(ls -A /workspace/secrets 2>/dev/null)" ]'

echo; echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
