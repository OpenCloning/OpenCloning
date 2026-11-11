# Monorepo migration: what's left

## 4. Files with no references in the repo (decide: keep or delete)

- [ ] `build_for_elabftw.sh`

## 5. Old repos (`OpenCloning_frontend`, `OpenCloning_backend`)

- [ ] Disable their release workflows, so two pipelines never push the same Docker tags.
- [ ] Migrate the open issues of both repos to `OpenCloning/OpenCloning`. Do this before archiving, since
  archived repos can't transfer issues, and open issues left behind stay frozen open (transfer or close them).
  Closed issues and all pull requests stay readable in the archived repos, and their links keep working.
  Transferred issues get new numbers, but their old URLs redirect.
  - [ ] Copy the labels first, so they match: `gh label clone OpenCloning/OpenCloning_frontend --repo OpenCloning/OpenCloning`
    (same for `OpenCloning_backend`). Then check the transferred issues kept them.
  - [ ] Transfer, e.g. per repo:
    `gh issue list --repo OpenCloning/OpenCloning_frontend --state open --limit 1000 --json number --jq '.[].number' | xargs -I{} gh issue transfer {} OpenCloning/OpenCloning --repo OpenCloning/OpenCloning_frontend`
  - [ ] Optionally tag the transferred issues by origin (e.g. `frontend` / `backend` labels) before transferring.
- [ ] Check that the Netlify site is not still linked to the old frontend repo for automatic builds.
- [ ] Archive both repos, with a README pointing to the monorepo.
