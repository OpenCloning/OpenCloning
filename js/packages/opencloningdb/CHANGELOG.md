# @opencloning/opencloningdb

## 1.9.1

### Patch Changes

- Updated dependencies [[`0b2a21d`](https://github.com/OpenCloning/OpenCloning_frontend/commit/0b2a21dde79f5539579bee39f0de49b01cd6c10c)]:
  - @opencloning/utils@2.1.1
  - @opencloning/ui@2.1.1

## 1.9.0

### Minor Changes

- [#786](https://github.com/OpenCloning/OpenCloning_frontend/pull/786) [`c8c46d4`](https://github.com/OpenCloning/OpenCloning_frontend/commit/c8c46d4dc36cb8741d1bd89816c7ca82b89996b3) Thanks [@manulera](https://github.com/manulera)! - Assembler: load plasmids from the database and upload the assemblies to it.

  - `@opencloning/ui`:
    - The Assembler's plasmid buttons are grouped into a "Load Plasmids" menu (from files, from the local server, from the database).
    - When the database interface provides `GetSequencesInBulkComponent`, plasmids can be loaded by tag or picked, and are used as `DatabaseSource`s. In that case the default plasmids of a syntax are not loaded.
    - When it provides `SubmitCloningStrategiesInBulkComponent`, a new "Upload to DB" button uploads the assemblies with their history, as in the bulk upload of sequences with history.
    - Both are new optional entries of the database interface (see `DummyInterface`).
  - `@opencloning/opencloningdb`:
    - Implements `GetSequencesInBulkComponent` and `SubmitCloningStrategiesInBulkComponent`.
    - Exports `TagMultiSelect` (with `allowCreate` and `onCreateError`), `BulkUploadModal`, `BulkUploadPreview` and `CommonTableRow`, moved from the `opencloningdb` app.
  - `opencloningdb`:
    - The "Upload sequences with history" button uses `SubmitCloningStrategiesInBulkComponent`. Its validation, submission and conflict messages are now shown in the dialog instead of as alerts.
    - The tag selects no longer drop excluded tags from the shared tags cache.
  - `syntax-builder`: the dev server runs on port 3000 and listens on `127.0.0.1`, like the other apps.

### Patch Changes

- Updated dependencies [[`c8c46d4`](https://github.com/OpenCloning/OpenCloning_frontend/commit/c8c46d4dc36cb8741d1bd89816c7ca82b89996b3)]:
  - @opencloning/ui@2.1.0
  - @opencloning/utils@2.1.0

## 1.8.8

### Patch Changes

- [#778](https://github.com/OpenCloning/OpenCloning_frontend/pull/778) [`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394) Thanks [@manulera](https://github.com/manulera)! - Only send the auth token to the backend, and rename the http client APIs.

  - `@opencloning/utils`: `@opencloning/utils/httpClients` exports `getBackendHttpClient(backendUrl, { authenticated })`, a client that can only reach the backend (`allowAbsoluteUrls: false`) and is the only one carrying the auth token, and `getExternalHttpClient()` for whitelisted external urls. Replaces `@opencloning/utils/getHttpClient` (`getHttpClient`, `getAuthenticatedHttpClient`). `attachAuthInterceptors` refuses clients that could send the token elsewhere.
  - `@opencloning/ui` (breaking): `useHttpClient` is renamed `useBackendHttpClient` and takes urls relative to `backendUrl`; `useBackendRoute` is removed; `useBackendAPI` is renamed `useSourceRequest` and `sendPostRequest` is renamed `sendSourceRequest`.
  - `@opencloning/opencloningdb`, `@opencloning/opencloning-elabftw`: clients can no longer be pointed at other hosts.

- [#778](https://github.com/OpenCloning/OpenCloning_frontend/pull/778) [`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394) Thanks [@manulera](https://github.com/manulera)! - Encode values interpolated into request URL paths to prevent client-side path traversal. A sample UID such as `../workspaces/1/users/5` could make a user's own request hit a different endpoint, e.g. "delete UID" removing a workspace member.

  - `@opencloning/utils`: new `encodePathSegment` (`@opencloning/utils/urlUtils`), which applies `encodeURIComponent` and rejects `.` and `..`.
  - `@opencloning/opencloningdb`: all path parameters in `endpoints.js` are encoded.
  - `@opencloning/opencloning-elabftw`: eLabFTW item and upload paths are encoded.
  - `@opencloning/ui`: the `example`, `key` and `template` URL parameters are encoded when loading examples and templates.

- Updated dependencies [[`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394), [`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394), [`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394)]:
  - @opencloning/utils@2.0.0
  - @opencloning/ui@2.0.0

## 1.8.7

### Patch Changes

- Updated dependencies [[`f7f376e`](https://github.com/OpenCloning/OpenCloning_frontend/commit/f7f376ee351d9b2da52413700836dc55ba54b5ea)]:
  - @opencloning/ui@1.10.0
  - @opencloning/utils@1.10.0

## 1.8.6

### Patch Changes

- [#771](https://github.com/OpenCloning/OpenCloning_frontend/pull/771) [`73363e7`](https://github.com/OpenCloning/OpenCloning_frontend/commit/73363e7a7f7e494e20a54bd87e5dba97f8a9197e) Thanks [@manulera](https://github.com/manulera)! - Keep OIDC sessions signed in by requesting a token on each API call instead of reusing a stored JWT

- Updated dependencies [[`73363e7`](https://github.com/OpenCloning/OpenCloning_frontend/commit/73363e7a7f7e494e20a54bd87e5dba97f8a9197e)]:
  - @opencloning/utils@1.9.5
  - @opencloning/ui@1.9.5

## 1.8.5

### Patch Changes

- Updated dependencies []:
  - @opencloning/ui@1.9.4
  - @opencloning/utils@1.9.4

## 1.8.4

### Patch Changes

- [#741](https://github.com/OpenCloning/OpenCloning_frontend/pull/741) [`c65f24a`](https://github.com/OpenCloning/OpenCloning_frontend/commit/c65f24ae853b45005e9a7f429236b8b8d7ea84fa) Thanks [@manulera](https://github.com/manulera)! - Add workspace functionality to add and remove users by owners

- Updated dependencies [[`df69a1b`](https://github.com/OpenCloning/OpenCloning_frontend/commit/df69a1bfb3b3128e93d89eef48a29f81a54ebb82)]:
  - @opencloning/utils@1.9.3
  - @opencloning/ui@1.9.3

## 1.8.3

### Patch Changes

- [#732](https://github.com/OpenCloning/OpenCloning_frontend/pull/732) [`cb5ddf4`](https://github.com/OpenCloning/OpenCloning_frontend/commit/cb5ddf4502a288357f8f853242fb35e5ad2a2207) Thanks [@manulera](https://github.com/manulera)! - Create lines from button in list, enables reference strain + transformation + mating

- [#732](https://github.com/OpenCloning/OpenCloning_frontend/pull/732) [`cb5ddf4`](https://github.com/OpenCloning/OpenCloning_frontend/commit/cb5ddf4502a288357f8f853242fb35e5ad2a2207) Thanks [@manulera](https://github.com/manulera)! - Auto-select new tag when creating it

- [#737](https://github.com/OpenCloning/OpenCloning_frontend/pull/737) [`b40f86f`](https://github.com/OpenCloning/OpenCloning_frontend/commit/b40f86fc3219d6016d8d5c8390b171affc8987f8) Thanks [@manulera](https://github.com/manulera)! - Add button for bulk-download to text files

- Updated dependencies [[`06bb1a5`](https://github.com/OpenCloning/OpenCloning_frontend/commit/06bb1a513519f598e9ec3b5eec73544e2ed3958e), [`bc045f9`](https://github.com/OpenCloning/OpenCloning_frontend/commit/bc045f9e74b4d5b84250dcb5a77b93de99e4d684)]:
  - @opencloning/ui@1.9.2
  - @opencloning/utils@1.9.2

## 1.8.2

### Patch Changes

- [#725](https://github.com/OpenCloning/OpenCloning_frontend/pull/725) [`093feb9`](https://github.com/OpenCloning/OpenCloning_frontend/commit/093feb9f9fc2aef437dc56cc70e64b26c656d6dd) Thanks [@manulera](https://github.com/manulera)! - Add support for bulk submission of cloning strategies

- [#724](https://github.com/OpenCloning/OpenCloning_frontend/pull/724) [`77771ac`](https://github.com/OpenCloning/OpenCloning_frontend/commit/77771ac74d72fbd43146490efeb60798773e4734) Thanks [@manulera](https://github.com/manulera)! - Bulk submit lines

- [#722](https://github.com/OpenCloning/OpenCloning_frontend/pull/722) [`871688a`](https://github.com/OpenCloning/OpenCloning_frontend/commit/871688a3576b4f2aa7ffbd8ca919b95daf01e9e4) Thanks [@manulera](https://github.com/manulera)! - Allow submitting template sequences in bulk

## 1.8.1

### Patch Changes

- [#713](https://github.com/OpenCloning/OpenCloning_frontend/pull/713) [`a30b4dd`](https://github.com/OpenCloning/OpenCloning_frontend/commit/a30b4dd3087ac422cc3de48014e6bdee5b98cfac) Thanks [@manulera](https://github.com/manulera)! - \* Add VITE_OPENCLONING_DB_BACKEND to environment variables, and use it to set the base URL for the OpenCloningDB backend.
  - Use error2String for better sign up error messages.
- Updated dependencies [[`e4d9515`](https://github.com/OpenCloning/OpenCloning_frontend/commit/e4d9515a7f6fcad09e5c196f3cb090f70fe3a156)]:
  - @opencloning/ui@1.9.1
  - @opencloning/utils@1.9.1

## 1.8.0

### Minor Changes

- [#711](https://github.com/OpenCloning/OpenCloning_frontend/pull/711) [`6813620`](https://github.com/OpenCloning/OpenCloning_frontend/commit/6813620f4a47c44857045866d667474efbf9a64c) Thanks [@manulera](https://github.com/manulera)! - Use authentication for cloning endpoints in opencloning-db

### Patch Changes

- Updated dependencies [[`6813620`](https://github.com/OpenCloning/OpenCloning_frontend/commit/6813620f4a47c44857045866d667474efbf9a64c)]:
  - @opencloning/utils@1.9.0
  - @opencloning/ui@1.9.0

## 1.7.2

### Patch Changes

- Updated dependencies [[`08144c0`](https://github.com/OpenCloning/OpenCloning_frontend/commit/08144c085cb5da37e902edc1a3b9c593c58ab680)]:
  - @opencloning/ui@1.8.2
  - @opencloning/utils@1.8.2

## 1.7.1

### Patch Changes

- Updated dependencies [[`8e841bd`](https://github.com/OpenCloning/OpenCloning_frontend/commit/8e841bdee4797df61bcf8d1972e3c3581d24fbfb)]:
  - @opencloning/ui@1.8.1
  - @opencloning/utils@1.8.1

## 1.7.0

### Minor Changes

- [#694](https://github.com/OpenCloning/OpenCloning_frontend/pull/694) [`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57) Thanks [@manulera](https://github.com/manulera)! - Add package and app for a dedicated OpenCloning database, OpenCloningDB

### Patch Changes

- Updated dependencies [[`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57), [`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57)]:
  - @opencloning/ui@1.8.0
  - @opencloning/utils@1.8.0
