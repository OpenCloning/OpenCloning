# `--json` recipes

Use `--json` when a script must parse output. For one-off reading, default human output is
usually better: it inlines code frames with errors and interleaves network events in log order.

- With `--json`, stdout is JSON. Without it, stdout is a table — do not pipe default output into
  a parser.
- Failures are prose on stderr with exit `1`. Branch on exit code, not message text.

In tight loops, prefer the project binary over `npx` (each `npx` call pays a resolver tax):

```bash
B=./node_modules/.bin/cypress   # or npx cypress when not looping
```

## Null-safe field extraction

A JSON `null` must not reach shell comparisons. Python's missing-key default does not apply to
`null`, and comparing timestamps to the literal `None` wedges a poll loop silently.

```bash
field() { python3 -c "import sys,json;v=json.load(sys.stdin).get('$1');print('' if v is None else v)"; }
$B tap status --json | field status
```

Without Python, extract one scalar key per `sed`/`grep` call. GNU `sed` alternation for two keys
fails silently on macOS. A one-liner `node -e` reader works wherever Cypress runs:

```bash
$B tap status --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).status))'
```

`grep` + `cut -d'"' -f4` works for always-quoted scalars like `status`, but **`startedAt` can be
`null` unquoted** — `cut` yields empty and is easy to misread elsewhere. Prefer `field` or:

```bash
$B tap status --json | sed -n 's/.*"startedAt": *"\{0,1\}\([^",]*\).*/\1/p'   # ISO stamp or null
```

## Session discovery

With no running session, `sessions --json` prints guidance prose at exit `0` (not a JSON array).
A bare `json.load` on stdout fails exactly when you are checking liveness. Prefer `status
--json`, which always returns `{"status":"not connected"}` when nothing is reachable.

To resolve a pid for the cwd when sessions might be empty:

```bash
$B tap sessions --json 2>/dev/null | python3 -c "
import sys, json, os
raw = sys.stdin.read()
try: sessions = json.loads(raw)
except ValueError: sessions = []
p = os.getcwd()
print(next((s['pid'] for s in sessions if s['projectRoot'] == p), ''))"
```

When both e2e and component sessions share a `projectRoot`, also match `testingType`. Only
`status` names the session it answered for; pass `--session <pid>` on every other command.

## Fresh-verdict poll

Copy the poller in [session-lifecycle.md](session-lifecycle.md). Gate on terminal `status`,
changed `startedAt`, and the expected `spec` — not on having observed `loading` or `running`.

## Reporter JSON keys

Rendered columns and JSON keys disagree in easy-to-misread ways:

| Rendered              | JSON                                              |
| --------------------- | ------------------------------------------------- |
| `ROUTES` `MATCHER`    | `routes[].url` (matcher path, not full URL)       |
| `ROUTES` `#`          | `routes[].numResponses`                           |
| `ROUTES` `ALIAS`      | `routes[].alias` (**string**)                     |
| `SPIES / STUBS` block | `agents[]` (`callCount`, not `calls`)             |
| `ALIAS(ES)` column    | `agents[].aliases` (**list**)                     |

`routes[].alias` and `agents[].aliases` are different keys on different objects. Using the wrong
one returns empty for every row and looks like "nothing was stubbed."

`commands[].network.url` is the full request URL; `routes[].url` is the intercept matcher.

Top-level test title is `test.title`, not `title`.

## Collect test ids

`reporter --json` puts top-level `it()` tests in `tests[]` and suite members in
`suites[].tests[]`. Read both:

```bash
$B tap reporter --json | python3 -c "
import sys,json
d=json.load(sys.stdin)
for t in d.get('tests',[]) + [t for s in d.get('suites',[]) for t in s.get('tests',[])]:
    print(t['id'], t['state'], t['title'], sep='\t')"
```

Nested `describe` blocks may arrive flattened with `>`-joined suite titles; still walk
`suites[]` rather than hand-picking ids.

## Quick sanity on a green run

After a passing verdict, spot-check `reporter --test-id <id>`:

- `routes[].numResponses` is nonzero for intercepts the test is meant to exercise.
- `agents[].callCount` is nonzero when a stub or spy must run.
- Request rows in the log show `(stubbed)` when you expect intercepts; an `e` row with a
  `network` object and `stubbed: false` hit the real network.

`reporter` and `command` can answer during a run with partial data that looks final. Confirm a
terminal `status` before trusting them.
