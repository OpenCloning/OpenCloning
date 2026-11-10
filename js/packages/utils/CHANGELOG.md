# @opencloning/utils

## 2.1.1

### Patch Changes

- [#790](https://github.com/OpenCloning/OpenCloning_frontend/pull/790) [`0b2a21d`](https://github.com/OpenCloning/OpenCloning_frontend/commit/0b2a21dde79f5539579bee39f0de49b01cd6c10c) Thanks [@manulera](https://github.com/manulera)! - Support for fetchin sequences created by the OC mcp server

- Updated dependencies []:
  - @opencloning/store@2.1.1

## 2.1.0

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@2.1.0

## 2.0.0

### Major Changes

- [#778](https://github.com/OpenCloning/OpenCloning_frontend/pull/778) [`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394) Thanks [@manulera](https://github.com/manulera)! - Only send the auth token to the backend, and rename the http client APIs.

  - `@opencloning/utils`: `@opencloning/utils/httpClients` exports `getBackendHttpClient(backendUrl, { authenticated })`, a client that can only reach the backend (`allowAbsoluteUrls: false`) and is the only one carrying the auth token, and `getExternalHttpClient()` for whitelisted external urls. Replaces `@opencloning/utils/getHttpClient` (`getHttpClient`, `getAuthenticatedHttpClient`). `attachAuthInterceptors` refuses clients that could send the token elsewhere.
  - `@opencloning/ui` (breaking): `useHttpClient` is renamed `useBackendHttpClient` and takes urls relative to `backendUrl`; `useBackendRoute` is removed; `useBackendAPI` is renamed `useSourceRequest` and `sendPostRequest` is renamed `sendSourceRequest`.
  - `@opencloning/opencloningdb`, `@opencloning/opencloning-elabftw`: clients can no longer be pointed at other hosts.

### Minor Changes

- [#778](https://github.com/OpenCloning/OpenCloning_frontend/pull/778) [`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394) Thanks [@manulera](https://github.com/manulera)! - Encode values interpolated into request URL paths to prevent client-side path traversal. A sample UID such as `../workspaces/1/users/5` could make a user's own request hit a different endpoint, e.g. "delete UID" removing a workspace member.

  - `@opencloning/utils`: new `encodePathSegment` (`@opencloning/utils/urlUtils`), which applies `encodeURIComponent` and rejects `.` and `..`.
  - `@opencloning/opencloningdb`: all path parameters in `endpoints.js` are encoded.
  - `@opencloning/opencloning-elabftw`: eLabFTW item and upload paths are encoded.
  - `@opencloning/ui`: the `example`, `key` and `template` URL parameters are encoded when loading examples and templates.

### Patch Changes

- [#778](https://github.com/OpenCloning/OpenCloning_frontend/pull/778) [`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394) Thanks [@manulera](https://github.com/manulera)! - Safer white-list url checking

- Updated dependencies []:
  - @opencloning/store@2.0.0

## 1.10.0

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.10.0

## 1.9.5

### Patch Changes

- [#771](https://github.com/OpenCloning/OpenCloning_frontend/pull/771) [`73363e7`](https://github.com/OpenCloning/OpenCloning_frontend/commit/73363e7a7f7e494e20a54bd87e5dba97f8a9197e) Thanks [@manulera](https://github.com/manulera)! - Keep OIDC sessions signed in by requesting a token on each API call instead of reusing a stored JWT

- Updated dependencies []:
  - @opencloning/store@1.9.5

## 1.9.4

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.9.4

## 1.9.3

### Patch Changes

- [#762](https://github.com/OpenCloning/OpenCloning_frontend/pull/762) [`df69a1b`](https://github.com/OpenCloning/OpenCloning_frontend/commit/df69a1bfb3b3128e93d89eef48a29f81a54ebb82) Thanks [@manulera](https://github.com/manulera)! - Fix QuotaExceededError when adding more than ~10 AB1/sequencing files (OpenCloning/OpenCloning#82). The raw contents of the verification files used to be persisted in Web Storage (localStorage, later sessionStorage), which has a quota of ~5 MB, so submitting around 10+ AB1 files failed with `QuotaExceededError` and the files/alignments disappeared. The contents are now kept in an in-memory store for the duration of the tab session, which has no quota.

- Updated dependencies [[`df69a1b`](https://github.com/OpenCloning/OpenCloning_frontend/commit/df69a1bfb3b3128e93d89eef48a29f81a54ebb82)]:
  - @opencloning/store@1.9.3

## 1.9.2

### Patch Changes

- Updated dependencies [[`bc045f9`](https://github.com/OpenCloning/OpenCloning_frontend/commit/bc045f9e74b4d5b84250dcb5a77b93de99e4d684)]:
  - @opencloning/store@1.9.2

## 1.9.1

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.9.1

## 1.9.0

### Minor Changes

- [#711](https://github.com/OpenCloning/OpenCloning_frontend/pull/711) [`6813620`](https://github.com/OpenCloning/OpenCloning_frontend/commit/6813620f4a47c44857045866d667474efbf9a64c) Thanks [@manulera](https://github.com/manulera)! - Use authentication for cloning endpoints in opencloning-db

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.9.0

## 1.8.2

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.8.2

## 1.8.1

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.8.1

## 1.8.0

### Minor Changes

- [#694](https://github.com/OpenCloning/OpenCloning_frontend/pull/694) [`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57) Thanks [@manulera](https://github.com/manulera)! - \* Add alignment functionality functions.

### Patch Changes

- Updated dependencies [[`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57)]:
  - @opencloning/store@1.8.0

## 1.7.8

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.7.8

## 1.7.7

### Patch Changes

- [#689](https://github.com/manulera/OpenCloning_frontend/pull/689) [`c5d9309`](https://github.com/manulera/OpenCloning_frontend/commit/c5d93099583fdfafafd40e9924d2216b596e0cec) Thanks [@manulera](https://github.com/manulera)! - Added experimental feature for domestication that relies on API calls to goldenbraidpro

- Updated dependencies []:
  - @opencloning/store@1.7.7

## 1.7.6

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.7.6

## 1.7.5

### Patch Changes

- Updated dependencies [[`034c738`](https://github.com/manulera/OpenCloning_frontend/commit/034c73840dc183b6b3584365c1db899d2f0c548b)]:
  - @opencloning/store@1.7.5

## 1.7.4

### Patch Changes

- [#682](https://github.com/manulera/OpenCloning_frontend/pull/682) [`04703a9`](https://github.com/manulera/OpenCloning_frontend/commit/04703a9269a5d4cc4bdde478c1ec61e5c73b0d2a) Thanks [@manulera](https://github.com/manulera)! - Fix bug when copying pcr products

- Updated dependencies []:
  - @opencloning/store@1.7.4

## 1.7.3

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.7.3

## 1.7.2

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.7.2

## 1.7.1

### Patch Changes

- [#672](https://github.com/manulera/OpenCloning_frontend/pull/672) [`cfe95f5`](https://github.com/manulera/OpenCloning_frontend/commit/cfe95f5d79a4f147646d46d51b19a155941b2ad8) Thanks [@manulera](https://github.com/manulera)! - Ignore header case when importing primers from tabular file

- Updated dependencies []:
  - @opencloning/store@1.7.1

## 1.7.0

### Minor Changes

- [#670](https://github.com/manulera/OpenCloning_frontend/pull/670) [`2943c1c`](https://github.com/manulera/OpenCloning_frontend/commit/2943c1c3a8b29a7081841d8ca9e2b36a2ad14a61) Thanks [@manulera](https://github.com/manulera)! - Fix import structure

### Patch Changes

- Updated dependencies [[`2943c1c`](https://github.com/manulera/OpenCloning_frontend/commit/2943c1c3a8b29a7081841d8ca9e2b36a2ad14a61)]:
  - @opencloning/store@1.7.0

## 1.6.0

### Patch Changes

- [#668](https://github.com/manulera/OpenCloning_frontend/pull/668) [`dd0df39`](https://github.com/manulera/OpenCloning_frontend/commit/dd0df39c5fbf65feaab09f90d123e3776efed6bd) Thanks [@manulera](https://github.com/manulera)! - Added LICENSE to package.json

- Updated dependencies [[`dd0df39`](https://github.com/manulera/OpenCloning_frontend/commit/dd0df39c5fbf65feaab09f90d123e3776efed6bd)]:
  - @opencloning/store@1.6.0

## 1.5.6

### Patch Changes

- [#665](https://github.com/manulera/OpenCloning_frontend/pull/665) [`d3477f1`](https://github.com/manulera/OpenCloning_frontend/commit/d3477f1354b92b61cb8f4299b4a9648b67f26ab0) Thanks [@manulera](https://github.com/manulera)! - Add support for user-defined recombinases

- Updated dependencies []:
  - @opencloning/store@1.5.6

## 1.5.5

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.5.5

## 1.5.4

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.5.4

## 1.5.3

### Patch Changes

- [#655](https://github.com/manulera/OpenCloning_frontend/pull/655) [`b34e83f`](https://github.com/manulera/OpenCloning_frontend/commit/b34e83f0b8813de7744d3d71ad779be0df2f75cf) Thanks [@manulera](https://github.com/manulera)! - Changes to Assembler naming:

  - Handle slashes in downloaded file names (were being turned into subfolders)
  - Allow users to change names of outputs in assembler

- Updated dependencies []:
  - @opencloning/store@1.5.3

## 1.5.2

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.5.2

## 1.5.1

### Patch Changes

- [#651](https://github.com/manulera/OpenCloning_frontend/pull/651) [`b5c89e2`](https://github.com/manulera/OpenCloning_frontend/commit/b5c89e23aa1065319cb07a9ac48a26693dd0a21a) Thanks [@manulera](https://github.com/manulera)! - Allow primer design of Gibson and similar assembly methods to include fragments that are not amplified. Similar to what the NEBuilder planner does, where not all products are amplified. Perhaps in the future it would be useful to also allow the option to restore the restriction sites on the edge.

- Updated dependencies [[`b5c89e2`](https://github.com/manulera/OpenCloning_frontend/commit/b5c89e23aa1065319cb07a9ac48a26693dd0a21a)]:
  - @opencloning/store@1.5.1

## 1.5.0

### Minor Changes

- [#648](https://github.com/manulera/OpenCloning_frontend/pull/648) [`800ebcd`](https://github.com/manulera/OpenCloning_frontend/commit/800ebcd4ed610ad89d538e1d59314977aae40583) Thanks [@manulera](https://github.com/manulera)! - Multiple enzymes can be used in the Assembler

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.5.0

## 1.4.11

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.4.11

## 1.4.10

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.4.10

## 1.4.9

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.4.9

## 1.4.8

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.4.8

## 1.4.7

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.4.7

## 1.4.6

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.4.6

## 1.4.5

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.4.5

## 1.4.4

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.4.4

## 1.4.3

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.4.3

## 1.4.2

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.4.2

## 1.4.1

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.4.1

## 1.4.0

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.4.0

## 1.3.3

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.3.3

## 1.3.2

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.3.2

## 1.3.1

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.3.1

## 1.3.0

### Minor Changes

- [#597](https://github.com/manulera/OpenCloning_frontend/pull/597) [`d5a456d`](https://github.com/manulera/OpenCloning_frontend/commit/d5a456d70ccfe949b21aae260d2c99507ff6a88e) Thanks [@manulera](https://github.com/manulera)! - Changes associated with new "Syntax Builder" application for creating and managing modular cloning syntaxes, along with significant refactoring of assembler components to support both the new app and the existing OpenCloning application.

  - Added a new standalone app (`apps/syntax-builder`) for building and editing cloning syntaxes with visual previews
  - Refactored assembler components to be more modular and reusable across applications
  - Enhanced file parsing utilities to support bidirectional conversion between JSON and delimited formats
  - Added graph-based validation and visualization for syntax parts using the graphology library

### Patch Changes

- Updated dependencies [[`d5a456d`](https://github.com/manulera/OpenCloning_frontend/commit/d5a456d70ccfe949b21aae260d2c99507ff6a88e)]:
  - @opencloning/store@1.3.0

## 1.2.0

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.2.0

## 1.1.2

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.1.2

## 1.1.1

### Patch Changes

- Updated dependencies []:
  - @opencloning/store@1.1.1

## 1.1.0

### Minor Changes

- [#570](https://github.com/manulera/OpenCloning_frontend/pull/570) [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0) Thanks [@manulera](https://github.com/manulera)! - Handle version display with scripts

### Patch Changes

- [#574](https://github.com/manulera/OpenCloning_frontend/pull/574) [`6df1c20`](https://github.com/manulera/OpenCloning_frontend/commit/6df1c2060d5776a30a00daaedfb0ec2cc685284d) Thanks [@manulera](https://github.com/manulera)! - Last dummy test to check if auto pre-release works

- [#570](https://github.com/manulera/OpenCloning_frontend/pull/570) [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0) Thanks [@manulera](https://github.com/manulera)! - testing a test release to npm

- [#570](https://github.com/manulera/OpenCloning_frontend/pull/570) [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0) Thanks [@manulera](https://github.com/manulera)! - Releases work on npm now through `YARN_NPM_AUTH_TOKEN=<> yarn changeset publish`, this is enabled by patch, see Readme. This properly handles workspaces (in package.json in each of the packages, `"@opencloning/store": "workspace:*",` is replaced by the actual version).

- Updated dependencies [[`6df1c20`](https://github.com/manulera/OpenCloning_frontend/commit/6df1c2060d5776a30a00daaedfb0ec2cc685284d), [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0), [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0), [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0), [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0)]:
  - @opencloning/store@1.1.0

## 1.1.0-dev.5

### Patch Changes

- 6df1c20: Last dummy test to check if auto pre-release works
- Updated dependencies [6df1c20]
  - @opencloning/store@1.1.0-dev.5

## 1.1.0-dev.4

### Patch Changes

- @opencloning/store@1.1.0-dev.4

## 1.1.0-test.3

### Patch Changes

- @opencloning/store@1.1.0-test.3

## 1.1.0-test.2

### Minor Changes

- d46f09d: Handle version display with scripts

### Patch Changes

- Updated dependencies [d46f09d]
  - @opencloning/store@1.1.0-test.2

## 1.1.0-test.1

### Patch Changes

- Updated dependencies [02dbc55]
  - @opencloning/store@1.1.0-test.1

## 1.0.2-test.0

### Patch Changes

- testing a test release to npm
- e0fb5ee: Releases work on npm now through `YARN_NPM_AUTH_TOKEN=<> yarn changeset publish`, this is enabled by patch, see Readme. This properly handles workspaces (in package.json in each of the packages, `"@opencloning/store": "workspace:*",` is replaced by the actual version).
- Updated dependencies
- Updated dependencies [e0fb5ee]
  - @opencloning/store@1.0.2-test.0

## 1.0.1

### Patch Changes

- a072fee: Dummy change to test releasing
- Updated dependencies [a072fee]
  - @opencloning/store@1.0.1

## 1.0.0

### Major Changes

- babe2f9: Switch to monorepo structure and use changesets

### Minor Changes

- 8cd33bb: Rearrange dependencies

### Patch Changes

- Updated dependencies [8cd33bb]
- Updated dependencies [babe2f9]
  - @opencloning/store@1.0.0
