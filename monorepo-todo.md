# Monorepo migration: what's left

## 1. Ship it

- [ ] Commit the pending changes and open a PR to `master`.
- [ ] Get CI green on that PR. Not yet confirmed on GitHub:
  - [ ] e2e tests start without `wait-on` (the "Socket closed before the connection was established" fix).
  - [ ] Component tests pass with the backend allowing `http://localhost:5173`.
- [ ] Locally, confirm the 4 component specs that failed against the combined backend
  (`VerificationFileDialog`, `PrimerList`, `EnzymeMultiSelect` and another primers spec) pass with
  `just dev-api-cloning` + `just cypress-component`.
- [ ] Rebuild the dev container, to pick up the `just` completions and `ALLOWED_ORIGINS` with 5173 from `.env.dev`.

## 2. GitHub settings (`OpenCloning/OpenCloning`)

- [ ] Actions secrets (Settings → Secrets and variables → Actions):
  - [ ] `RELEASE_PLEASE_TOKEN`: fine-grained PAT, owner `OpenCloning`, only this repo, Contents + Pull requests +
    Issues read/write. Set a reminder for its expiry (after it, CI silently stops running on release PRs).
  - [ ] `CODECOV_TOKEN` (also set up the repo on codecov.io)
  - [ ] `NCBI_API_KEY`, `ADDGENE_TOKEN`
  - [ ] `OIDC_ISSUER_URL`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
  - [ ] `DOCKER_USERNAME`, `DOCKER_PASSWORD`
  - [ ] `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `VITE_UMAMI_WEBSITE_ID`
  - [ ] Delete `NPM_TOKEN` if it was created (npm uses trusted publishing).
- [ ] Dependabot secrets (Settings → Secrets and variables → Dependabot), so Dependabot PRs can pass CI:
  `CODECOV_TOKEN`, `NCBI_API_KEY`, `ADDGENE_TOKEN`, `OIDC_ISSUER_URL`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`.
- [ ] PyPI trusted publisher for `opencloning` and `opencloning-db`: repo `OpenCloning/OpenCloning`,
  workflow `release.yml`, environment `publish`.
- [x] npm trusted publisher for the 5 `@opencloning/*` packages (publish directly, no dist-tags).
- [ ] Merge settings (Settings → General → Pull Requests): squash only, default commit message
  "Pull request title", merge commits and rebase off, delete head branches.
- [ ] Ruleset for `master` (Settings → Rules → Rulesets): include default branch, restrict deletions,
  block force pushes, require a PR (squash only), require status checks `ci-ok` and
  `semantic-pull-request`. Add the checks after they have run once (see `ci-ok` below).

## 3. Code

- [ ] Add a `ci-ok` job to `ci.yml` that needs all jobs and fails only if one failed or was cancelled
  (skipped is fine), so path-filtered and matrix jobs don't block required checks. Exclude `pytest (fresh)`,
  so upstream dependency breakage warns without blocking merges.
- [ ] CI check that the committed `python/stubs/db` match `opencloning-cli db stubs` output (fail on
  `git diff python/stubs`), so stale stubs can't silently pass the JS tests.
- [ ] Dependabot entry for GitHub Actions versions (grouped weekly PRs, prefix `ci`).
- [ ] Docs: `docker-compose.yml` still says Addgene needs a "username / password" (it is now `ADDGENE_TOKEN`), and
  `js/README.md` says the project uses "yarn 3" (it is Yarn 4).
- [ ] Deferred on purpose:
  - [ ] Deploying the `opencloningdb` app (it is versioned, but no release artifact). Its API URL and
    Clerk key are baked in at build time, so it needs a target (Netlify site, Docker image, ...).
  - [ ] Versioning/publishing `opencloning-mcp` (still at 0.1.0, not released).
  - [ ] The frontend Docker image is now only pushed on releases; the old frontend CI also pushed
    `opencloningfrontend:latest` on every master push. Re-add if something depends on it.

## 4. Files with no references in the repo (decide: keep or delete)

- [ ] `second_step.png`, `starting_point.png` (may be embedded elsewhere through raw GitHub URLs)
- [ ] `demo_video.md`
- [ ] `build_for_elabftw.sh`
- [ ] `docker_separate/`
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
