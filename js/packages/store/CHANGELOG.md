# @opencloning/store

## 2.1.1

## 2.1.0

## 2.0.0

## 1.10.0

## 1.9.5

## 1.9.4

## 1.9.3

### Patch Changes

- [#762](https://github.com/OpenCloning/OpenCloning_frontend/pull/762) [`df69a1b`](https://github.com/OpenCloning/OpenCloning_frontend/commit/df69a1bfb3b3128e93d89eef48a29f81a54ebb82) Thanks [@manulera](https://github.com/manulera)! - Fix QuotaExceededError when adding more than ~10 AB1/sequencing files (OpenCloning/OpenCloning#82). The raw contents of the verification files used to be persisted in Web Storage (localStorage, later sessionStorage), which has a quota of ~5 MB, so submitting around 10+ AB1 files failed with `QuotaExceededError` and the files/alignments disappeared. The contents are now kept in an in-memory store for the duration of the tab session, which has no quota.

## 1.9.2

### Patch Changes

- [#736](https://github.com/OpenCloning/OpenCloning_frontend/pull/736) [`bc045f9`](https://github.com/OpenCloning/OpenCloning_frontend/commit/bc045f9e74b4d5b84250dcb5a77b93de99e4d684) Thanks [@manulera](https://github.com/manulera)! - \* Unify load paths under single hook
  - Remove warnings when adding db files to design tab

## 1.9.1

## 1.9.0

## 1.8.2

## 1.8.1

## 1.8.0

### Patch Changes

- [#694](https://github.com/OpenCloning/OpenCloning_frontend/pull/694) [`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57) Thanks [@manulera](https://github.com/manulera)! - Update how store is setup, using legacy_createStore.

## 1.7.8

## 1.7.7

## 1.7.6

## 1.7.5

### Patch Changes

- [#684](https://github.com/manulera/OpenCloning_frontend/pull/684) [`034c738`](https://github.com/manulera/OpenCloning_frontend/commit/034c73840dc183b6b3584365c1db899d2f0c548b) Thanks [@manulera](https://github.com/manulera)! - Allow recombinase genome setting

## 1.7.4

## 1.7.3

## 1.7.2

## 1.7.1

## 1.7.0

### Minor Changes

- [#670](https://github.com/manulera/OpenCloning_frontend/pull/670) [`2943c1c`](https://github.com/manulera/OpenCloning_frontend/commit/2943c1c3a8b29a7081841d8ca9e2b36a2ad14a61) Thanks [@manulera](https://github.com/manulera)! - Fix import structure

## 1.6.0

### Patch Changes

- [#668](https://github.com/manulera/OpenCloning_frontend/pull/668) [`dd0df39`](https://github.com/manulera/OpenCloning_frontend/commit/dd0df39c5fbf65feaab09f90d123e3776efed6bd) Thanks [@manulera](https://github.com/manulera)! - Added LICENSE to package.json

## 1.5.6

## 1.5.5

## 1.5.4

## 1.5.3

## 1.5.2

## 1.5.1

### Patch Changes

- [#651](https://github.com/manulera/OpenCloning_frontend/pull/651) [`b5c89e2`](https://github.com/manulera/OpenCloning_frontend/commit/b5c89e23aa1065319cb07a9ac48a26693dd0a21a) Thanks [@manulera](https://github.com/manulera)! - Allow primer design of Gibson and similar assembly methods to include fragments that are not amplified. Similar to what the NEBuilder planner does, where not all products are amplified. Perhaps in the future it would be useful to also allow the option to restore the restriction sites on the edge.

## 1.5.0

## 1.4.11

## 1.4.10

## 1.4.9

## 1.4.8

## 1.4.7

## 1.4.6

## 1.4.5

## 1.4.4

## 1.4.3

## 1.4.2

## 1.4.1

## 1.4.0

## 1.3.3

## 1.3.2

## 1.3.1

## 1.3.0

### Minor Changes

- [#597](https://github.com/manulera/OpenCloning_frontend/pull/597) [`d5a456d`](https://github.com/manulera/OpenCloning_frontend/commit/d5a456d70ccfe949b21aae260d2c99507ff6a88e) Thanks [@manulera](https://github.com/manulera)! - Changes associated with new "Syntax Builder" application for creating and managing modular cloning syntaxes, along with significant refactoring of assembler components to support both the new app and the existing OpenCloning application.

  - Added a new standalone app (`apps/syntax-builder`) for building and editing cloning syntaxes with visual previews
  - Refactored assembler components to be more modular and reusable across applications
  - Enhanced file parsing utilities to support bidirectional conversion between JSON and delimited formats
  - Added graph-based validation and visualization for syntax parts using the graphology library

## 1.2.0

## 1.1.2

## 1.1.1

## 1.1.0

### Minor Changes

- [#570](https://github.com/manulera/OpenCloning_frontend/pull/570) [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0) Thanks [@manulera](https://github.com/manulera)! - Switch to using provider for configuration rather than state

- [#570](https://github.com/manulera/OpenCloning_frontend/pull/570) [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0) Thanks [@manulera](https://github.com/manulera)! - Handle version display with scripts

### Patch Changes

- [#574](https://github.com/manulera/OpenCloning_frontend/pull/574) [`6df1c20`](https://github.com/manulera/OpenCloning_frontend/commit/6df1c2060d5776a30a00daaedfb0ec2cc685284d) Thanks [@manulera](https://github.com/manulera)! - Last dummy test to check if auto pre-release works

- [#570](https://github.com/manulera/OpenCloning_frontend/pull/570) [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0) Thanks [@manulera](https://github.com/manulera)! - testing a test release to npm

- [#570](https://github.com/manulera/OpenCloning_frontend/pull/570) [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0) Thanks [@manulera](https://github.com/manulera)! - Releases work on npm now through `YARN_NPM_AUTH_TOKEN=<> yarn changeset publish`, this is enabled by patch, see Readme. This properly handles workspaces (in package.json in each of the packages, `"@opencloning/store": "workspace:*",` is replaced by the actual version).

## 1.1.0-dev.5

### Patch Changes

- 6df1c20: Last dummy test to check if auto pre-release works

## 1.1.0-dev.4

## 1.1.0-test.3

## 1.1.0-test.2

### Minor Changes

- d46f09d: Handle version display with scripts

## 1.1.0-test.1

### Minor Changes

- 02dbc55: Switch to using provider for configuration rather than state

## 1.0.2-test.0

### Patch Changes

- testing a test release to npm
- e0fb5ee: Releases work on npm now through `YARN_NPM_AUTH_TOKEN=<> yarn changeset publish`, this is enabled by patch, see Readme. This properly handles workspaces (in package.json in each of the packages, `"@opencloning/store": "workspace:*",` is replaced by the actual version).

## 1.0.1

### Patch Changes

- a072fee: Dummy change to test releasing

## 1.0.0

### Major Changes

- babe2f9: Switch to monorepo structure and use changesets

### Minor Changes

- 8cd33bb: Rearrange dependencies
