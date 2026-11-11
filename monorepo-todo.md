# Monorepo migration: what's left

- [ ] CI check that the committed `python/stubs/db` match `opencloning-cli db stubs` output (fail on
  `git diff python/stubs`), so stale stubs can't silently pass the JS tests.
- [ ] Dependabot entry for GitHub Actions versions (grouped weekly PRs, prefix `ci`).
- [ ] Docs: `docker-compose.yml` still says Addgene needs a "username / password" (it is now `ADDGENE_TOKEN`), and
  `js/README.md` says the project uses "yarn 3" (it is Yarn 4).
- [ ] Deferred on purpose:
  - [ ] Deploying the `opencloningdb` app (it is versioned, but no release artifact). Its API URL and
    Clerk key are baked in at build time, so it needs a target (Netlify site, Docker image, ...).
  - [ ] Versioning/publishing `opencloning-mcp` (still at 0.1.0, not released).

## 4. Files with no references in the repo (decide: keep or delete)

- [ ] `build_for_elabftw.sh`
- [ ] `python/TODO.md`, `js/strict_mode_problems.md`: move their content to GitHub issues, then delete.

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

## 6. First release

- [ ] Check the first release PR: version 2.1.2 (fixes only) or 2.2.0 (any `feat:`), changelog, and the
  `chore: sync uv.lock for release` commit.
- [ ] After merging it, check every publish job: PyPI, npm (trusted publishing), Docker images (backend,
  frontend, combined), Netlify.
- [ ] Then set each npm package to "Require two-factor authentication and disallow tokens".
