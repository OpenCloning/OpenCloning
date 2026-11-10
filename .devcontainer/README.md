# Dev container

Isolated development environment for OpenCloning: the app container, its own Postgres, and a firewall that only allows the hosts the project needs.

```sh
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
```

Once inside, `check-isolation.sh` should report no failures.

## Known issue: `additional privileges requested`

With recent Docker versions, building the dev container can fail straight away with:

```
additional privileges requested: pass "--allow=fs.read=.../Dockerfile-with-features" to grant requested privileges
```

This is a Docker Compose bug, not a problem with this configuration. Since Buildx v0.37.2, Compose builds refuse to read a Dockerfile outside the build context, and the Dev Containers tooling always generates one in a temporary folder. It is fixed upstream in [docker/compose#14325](https://github.com/docker/compose/pull/14325) and goes away once your Docker Desktop includes that Compose release.

Until then, set this variable in the shell you build from:

```sh
BUILDX_BAKE_ENTITLEMENTS_FS=0 devcontainer up --workspace-folder .
```

If you use VS Code's "Reopen in Container", export the variable in your shell profile (`~/.zshrc` on macOS) and restart VS Code.

The variable turns off a Docker security check for all Compose builds, so remove it from your profile once Docker is updated. `COMPOSE_BAKE=false` does not help: Compose 5 always builds this way.
