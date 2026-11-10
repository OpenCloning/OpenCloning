# @opencloning/opencloning-elabftw

## 2.1.1

### Patch Changes

- Updated dependencies [[`0b2a21d`](https://github.com/OpenCloning/OpenCloning_frontend/commit/0b2a21dde79f5539579bee39f0de49b01cd6c10c)]:
  - @opencloning/utils@2.1.1
  - @opencloning/ui@2.1.1

## 2.1.0

### Patch Changes

- Updated dependencies [[`c8c46d4`](https://github.com/OpenCloning/OpenCloning_frontend/commit/c8c46d4dc36cb8741d1bd89816c7ca82b89996b3)]:
  - @opencloning/ui@2.1.0
  - @opencloning/utils@2.1.0

## 2.0.0

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

## 1.10.0

### Patch Changes

- [#776](https://github.com/OpenCloning/OpenCloning_frontend/pull/776) [`5f84aea`](https://github.com/OpenCloning/OpenCloning_frontend/commit/5f84aea004a24499a5634c17678696925ee780cf) Thanks [@manulera](https://github.com/manulera)! - Hotfix for issue where to load resources the template categories were shown instead

- Updated dependencies [[`f7f376e`](https://github.com/OpenCloning/OpenCloning_frontend/commit/f7f376ee351d9b2da52413700836dc55ba54b5ea)]:
  - @opencloning/ui@1.10.0
  - @opencloning/utils@1.10.0

## 1.9.5

### Patch Changes

- Updated dependencies [[`73363e7`](https://github.com/OpenCloning/OpenCloning_frontend/commit/73363e7a7f7e494e20a54bd87e5dba97f8a9197e)]:
  - @opencloning/utils@1.9.5
  - @opencloning/ui@1.9.5

## 1.9.4

### Patch Changes

- [#769](https://github.com/OpenCloning/OpenCloning_frontend/pull/769) [`105210b`](https://github.com/OpenCloning/OpenCloning_frontend/commit/105210b8149af71101f348967b3096636aeeea09) Thanks [@manulera](https://github.com/manulera)! - Fix request payloads. Drop support for eLabFTW < 5.3. Related to https://github.com/elabftw/elabftw/issues/7218.

- Updated dependencies []:
  - @opencloning/ui@1.9.4
  - @opencloning/utils@1.9.4

## 1.9.3

### Patch Changes

- Updated dependencies [[`df69a1b`](https://github.com/OpenCloning/OpenCloning_frontend/commit/df69a1bfb3b3128e93d89eef48a29f81a54ebb82)]:
  - @opencloning/utils@1.9.3
  - @opencloning/ui@1.9.3

## 1.9.2

### Patch Changes

- Updated dependencies [[`06bb1a5`](https://github.com/OpenCloning/OpenCloning_frontend/commit/06bb1a513519f598e9ec3b5eec73544e2ed3958e), [`bc045f9`](https://github.com/OpenCloning/OpenCloning_frontend/commit/bc045f9e74b4d5b84250dcb5a77b93de99e4d684)]:
  - @opencloning/ui@1.9.2
  - @opencloning/utils@1.9.2

## 1.9.1

### Patch Changes

- Updated dependencies [[`e4d9515`](https://github.com/OpenCloning/OpenCloning_frontend/commit/e4d9515a7f6fcad09e5c196f3cb090f70fe3a156)]:
  - @opencloning/ui@1.9.1
  - @opencloning/utils@1.9.1

## 1.9.0

### Patch Changes

- Updated dependencies [[`6813620`](https://github.com/OpenCloning/OpenCloning_frontend/commit/6813620f4a47c44857045866d667474efbf9a64c)]:
  - @opencloning/utils@1.9.0
  - @opencloning/ui@1.9.0

## 1.8.2

### Patch Changes

- Updated dependencies [[`08144c0`](https://github.com/OpenCloning/OpenCloning_frontend/commit/08144c085cb5da37e902edc1a3b9c593c58ab680)]:
  - @opencloning/ui@1.8.2
  - @opencloning/utils@1.8.2

## 1.8.1

### Patch Changes

- Updated dependencies [[`8e841bd`](https://github.com/OpenCloning/OpenCloning_frontend/commit/8e841bdee4797df61bcf8d1972e3c3581d24fbfb)]:
  - @opencloning/ui@1.8.1
  - @opencloning/utils@1.8.1

## 1.8.0

### Patch Changes

- [#694](https://github.com/OpenCloning/OpenCloning_frontend/pull/694) [`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57) Thanks [@manulera](https://github.com/manulera)! - Drop close button on load history component

- Updated dependencies [[`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57), [`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57)]:
  - @opencloning/ui@1.8.0
  - @opencloning/utils@1.8.0

## 1.7.8

### Patch Changes

- [#693](https://github.com/manulera/OpenCloning_frontend/pull/693) [`e830407`](https://github.com/manulera/OpenCloning_frontend/commit/e830407749f4c016c0e7f7ce715f20fb36addebd) Thanks [@manulera](https://github.com/manulera)! - Use template as categoryKey when creating resource, for newer eLabFTW versions, see [this discussion](https://github.com/elabftw/elabftw/discussions/6764).

- Updated dependencies []:
  - @opencloning/ui@1.7.8
  - @opencloning/utils@1.7.8

## 1.7.7

### Patch Changes

- Updated dependencies [[`c5d9309`](https://github.com/manulera/OpenCloning_frontend/commit/c5d93099583fdfafafd40e9924d2216b596e0cec)]:
  - @opencloning/utils@1.7.7
  - @opencloning/ui@1.7.7

## 1.7.6

### Patch Changes

- Updated dependencies [[`c81b179`](https://github.com/manulera/OpenCloning_frontend/commit/c81b179b4fece50271ea214cab1f8a356e36811f), [`c81b179`](https://github.com/manulera/OpenCloning_frontend/commit/c81b179b4fece50271ea214cab1f8a356e36811f)]:
  - @opencloning/ui@1.7.6
  - @opencloning/utils@1.7.6

## 1.7.5

### Patch Changes

- Updated dependencies [[`034c738`](https://github.com/manulera/OpenCloning_frontend/commit/034c73840dc183b6b3584365c1db899d2f0c548b)]:
  - @opencloning/ui@1.7.5
  - @opencloning/utils@1.7.5

## 1.7.4

### Patch Changes

- Updated dependencies [[`04703a9`](https://github.com/manulera/OpenCloning_frontend/commit/04703a9269a5d4cc4bdde478c1ec61e5c73b0d2a)]:
  - @opencloning/utils@1.7.4
  - @opencloning/ui@1.7.4

## 1.7.3

### Patch Changes

- Updated dependencies [[`04827d6`](https://github.com/manulera/OpenCloning_frontend/commit/04827d6184c5a1276814f60ef3c3fee2c832a6fd)]:
  - @opencloning/ui@1.7.3
  - @opencloning/utils@1.7.3

## 1.7.2

### Patch Changes

- Updated dependencies [[`1f08cca`](https://github.com/manulera/OpenCloning_frontend/commit/1f08ccab8422d9cf9a9355d2770fa8997e53c96b)]:
  - @opencloning/ui@1.7.2
  - @opencloning/utils@1.7.2

## 1.7.1

### Patch Changes

- Updated dependencies [[`cfe95f5`](https://github.com/manulera/OpenCloning_frontend/commit/cfe95f5d79a4f147646d46d51b19a155941b2ad8)]:
  - @opencloning/utils@1.7.1
  - @opencloning/ui@1.7.1

## 1.7.0

### Patch Changes

- Updated dependencies [[`2943c1c`](https://github.com/manulera/OpenCloning_frontend/commit/2943c1c3a8b29a7081841d8ca9e2b36a2ad14a61)]:
  - @opencloning/utils@1.7.0
  - @opencloning/ui@1.7.0

## 1.6.0

### Minor Changes

- [#668](https://github.com/manulera/OpenCloning_frontend/pull/668) [`dd0df39`](https://github.com/manulera/OpenCloning_frontend/commit/dd0df39c5fbf65feaab09f90d123e3776efed6bd) Thanks [@manulera](https://github.com/manulera)! - Moved eLabFTW interface into a separate package

### Patch Changes

- Updated dependencies [[`dd0df39`](https://github.com/manulera/OpenCloning_frontend/commit/dd0df39c5fbf65feaab09f90d123e3776efed6bd), [`dd0df39`](https://github.com/manulera/OpenCloning_frontend/commit/dd0df39c5fbf65feaab09f90d123e3776efed6bd)]:
  - @opencloning/ui@1.6.0
  - @opencloning/utils@1.6.0
