# opencloning

## 1.5.23

### Patch Changes

- Updated dependencies [[`0b2a21d`](https://github.com/OpenCloning/OpenCloning_frontend/commit/0b2a21dde79f5539579bee39f0de49b01cd6c10c)]:
  - @opencloning/utils@2.1.1
  - @opencloning/ui@2.1.1
  - @opencloning/opencloning-elabftw@2.1.1
  - @opencloning/store@2.1.1

## 1.5.22

### Patch Changes

- Updated dependencies [[`c8c46d4`](https://github.com/OpenCloning/OpenCloning_frontend/commit/c8c46d4dc36cb8741d1bd89816c7ca82b89996b3)]:
  - @opencloning/ui@2.1.0
  - @opencloning/opencloning-elabftw@2.1.0
  - @opencloning/store@2.1.0
  - @opencloning/utils@2.1.0

## 1.5.21

### Patch Changes

- [#778](https://github.com/OpenCloning/OpenCloning_frontend/pull/778) [`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394) Thanks [@manulera](https://github.com/manulera)! - Only send the auth token to the backend, and rename the http client APIs.

  - `@opencloning/utils`: `@opencloning/utils/httpClients` exports `getBackendHttpClient(backendUrl, { authenticated })`, a client that can only reach the backend (`allowAbsoluteUrls: false`) and is the only one carrying the auth token, and `getExternalHttpClient()` for whitelisted external urls. Replaces `@opencloning/utils/getHttpClient` (`getHttpClient`, `getAuthenticatedHttpClient`). `attachAuthInterceptors` refuses clients that could send the token elsewhere.
  - `@opencloning/ui` (breaking): `useHttpClient` is renamed `useBackendHttpClient` and takes urls relative to `backendUrl`; `useBackendRoute` is removed; `useBackendAPI` is renamed `useSourceRequest` and `sendPostRequest` is renamed `sendSourceRequest`.
  - `@opencloning/opencloningdb`, `@opencloning/opencloning-elabftw`: clients can no longer be pointed at other hosts.

- Updated dependencies [[`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394), [`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394), [`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394)]:
  - @opencloning/opencloning-elabftw@2.0.0
  - @opencloning/utils@2.0.0
  - @opencloning/ui@2.0.0
  - @opencloning/store@2.0.0

## 1.5.20

### Patch Changes

- Updated dependencies [[`5f84aea`](https://github.com/OpenCloning/OpenCloning_frontend/commit/5f84aea004a24499a5634c17678696925ee780cf), [`f7f376e`](https://github.com/OpenCloning/OpenCloning_frontend/commit/f7f376ee351d9b2da52413700836dc55ba54b5ea)]:
  - @opencloning/opencloning-elabftw@1.10.0
  - @opencloning/ui@1.10.0
  - @opencloning/store@1.10.0
  - @opencloning/utils@1.10.0

## 1.5.19

### Patch Changes

- Updated dependencies [[`73363e7`](https://github.com/OpenCloning/OpenCloning_frontend/commit/73363e7a7f7e494e20a54bd87e5dba97f8a9197e)]:
  - @opencloning/utils@1.9.5
  - @opencloning/opencloning-elabftw@1.9.5
  - @opencloning/ui@1.9.5
  - @opencloning/store@1.9.5

## 1.5.18

### Patch Changes

- Updated dependencies [[`105210b`](https://github.com/OpenCloning/OpenCloning_frontend/commit/105210b8149af71101f348967b3096636aeeea09)]:
  - @opencloning/opencloning-elabftw@1.9.4
  - @opencloning/ui@1.9.4
  - @opencloning/store@1.9.4
  - @opencloning/utils@1.9.4

## 1.5.17

### Patch Changes

- [#764](https://github.com/OpenCloning/OpenCloning_frontend/pull/764) [`49afc87`](https://github.com/OpenCloning/OpenCloning_frontend/commit/49afc8706ec67b6fcfd71be081371b66a07e42db) Thanks [@manulera](https://github.com/manulera)! - Change dependency resolution, remove vulns.

## 1.5.16

### Patch Changes

- Updated dependencies [[`df69a1b`](https://github.com/OpenCloning/OpenCloning_frontend/commit/df69a1bfb3b3128e93d89eef48a29f81a54ebb82)]:
  - @opencloning/utils@1.9.3
  - @opencloning/store@1.9.3
  - @opencloning/ui@1.9.3
  - @opencloning/opencloning-elabftw@1.9.3

## 1.5.15

### Patch Changes

- Updated dependencies [[`06bb1a5`](https://github.com/OpenCloning/OpenCloning_frontend/commit/06bb1a513519f598e9ec3b5eec73544e2ed3958e), [`bc045f9`](https://github.com/OpenCloning/OpenCloning_frontend/commit/bc045f9e74b4d5b84250dcb5a77b93de99e4d684)]:
  - @opencloning/ui@1.9.2
  - @opencloning/store@1.9.2
  - @opencloning/opencloning-elabftw@1.9.2
  - @opencloning/utils@1.9.2

## 1.5.14

### Patch Changes

- [#715](https://github.com/OpenCloning/OpenCloning_frontend/pull/715) [`e4d9515`](https://github.com/OpenCloning/OpenCloning_frontend/commit/e4d9515a7f6fcad09e5c196f3cb090f70fe3a156) Thanks [@manulera](https://github.com/manulera)! - Allow to copy features when editing annotation

- Updated dependencies [[`e4d9515`](https://github.com/OpenCloning/OpenCloning_frontend/commit/e4d9515a7f6fcad09e5c196f3cb090f70fe3a156)]:
  - @opencloning/ui@1.9.1
  - @opencloning/opencloning-elabftw@1.9.1
  - @opencloning/store@1.9.1
  - @opencloning/utils@1.9.1

## 1.5.13

### Patch Changes

- Updated dependencies [[`6813620`](https://github.com/OpenCloning/OpenCloning_frontend/commit/6813620f4a47c44857045866d667474efbf9a64c)]:
  - @opencloning/utils@1.9.0
  - @opencloning/ui@1.9.0
  - @opencloning/opencloning-elabftw@1.9.0
  - @opencloning/store@1.9.0

## 1.5.12

### Patch Changes

- Updated dependencies [[`08144c0`](https://github.com/OpenCloning/OpenCloning_frontend/commit/08144c085cb5da37e902edc1a3b9c593c58ab680)]:
  - @opencloning/ui@1.8.2
  - @opencloning/opencloning-elabftw@1.8.2
  - @opencloning/store@1.8.2
  - @opencloning/utils@1.8.2

## 1.5.11

### Patch Changes

- [#699](https://github.com/OpenCloning/OpenCloning_frontend/pull/699) [`8e841bd`](https://github.com/OpenCloning/OpenCloning_frontend/commit/8e841bdee4797df61bcf8d1972e3c3581d24fbfb) Thanks [@manulera](https://github.com/manulera)! - Improve snapgene warning

- Updated dependencies [[`8e841bd`](https://github.com/OpenCloning/OpenCloning_frontend/commit/8e841bdee4797df61bcf8d1972e3c3581d24fbfb)]:
  - @opencloning/ui@1.8.1
  - @opencloning/opencloning-elabftw@1.8.1
  - @opencloning/store@1.8.1
  - @opencloning/utils@1.8.1

## 1.5.10

### Patch Changes

- [#694](https://github.com/OpenCloning/OpenCloning_frontend/pull/694) [`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57) Thanks [@manulera](https://github.com/manulera)! - Update examples to remove unused primers that were lingering there

- Updated dependencies [[`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57), [`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57), [`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57), [`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57)]:
  - @opencloning/opencloning-elabftw@1.8.0
  - @opencloning/store@1.8.0
  - @opencloning/ui@1.8.0
  - @opencloning/utils@1.8.0

## 1.5.9

### Patch Changes

- [#693](https://github.com/manulera/OpenCloning_frontend/pull/693) [`e830407`](https://github.com/manulera/OpenCloning_frontend/commit/e830407749f4c016c0e7f7ce715f20fb36addebd) Thanks [@manulera](https://github.com/manulera)! - Use template as categoryKey when creating resource, for newer eLabFTW versions, see [this discussion](https://github.com/elabftw/elabftw/discussions/6764).

- Updated dependencies [[`e830407`](https://github.com/manulera/OpenCloning_frontend/commit/e830407749f4c016c0e7f7ce715f20fb36addebd)]:
  - @opencloning/opencloning-elabftw@1.7.8
  - @opencloning/ui@1.7.8
  - @opencloning/store@1.7.8
  - @opencloning/utils@1.7.8

## 1.5.8

### Patch Changes

- [#689](https://github.com/manulera/OpenCloning_frontend/pull/689) [`c5d9309`](https://github.com/manulera/OpenCloning_frontend/commit/c5d93099583fdfafafd40e9924d2216b596e0cec) Thanks [@manulera](https://github.com/manulera)! - Added experimental feature for domestication that relies on API calls to goldenbraidpro

- Updated dependencies [[`c5d9309`](https://github.com/manulera/OpenCloning_frontend/commit/c5d93099583fdfafafd40e9924d2216b596e0cec)]:
  - @opencloning/utils@1.7.7
  - @opencloning/ui@1.7.7
  - @opencloning/opencloning-elabftw@1.7.7
  - @opencloning/store@1.7.7

## 1.5.7

### Patch Changes

- [#686](https://github.com/manulera/OpenCloning_frontend/pull/686) [`c81b179`](https://github.com/manulera/OpenCloning_frontend/commit/c81b179b4fece50271ea214cab1f8a356e36811f) Thanks [@manulera](https://github.com/manulera)! - useBackendAPI now shows x-warning messages when the backend returns a failed request with that header. This is used and tested for partial restriction-ligation.

- Updated dependencies [[`c81b179`](https://github.com/manulera/OpenCloning_frontend/commit/c81b179b4fece50271ea214cab1f8a356e36811f), [`c81b179`](https://github.com/manulera/OpenCloning_frontend/commit/c81b179b4fece50271ea214cab1f8a356e36811f)]:
  - @opencloning/ui@1.7.6
  - @opencloning/opencloning-elabftw@1.7.6
  - @opencloning/store@1.7.6
  - @opencloning/utils@1.7.6

## 1.5.6

### Patch Changes

- [#684](https://github.com/manulera/OpenCloning_frontend/pull/684) [`034c738`](https://github.com/manulera/OpenCloning_frontend/commit/034c73840dc183b6b3584365c1db899d2f0c548b) Thanks [@manulera](https://github.com/manulera)! - Allow recombinase genome setting

- Updated dependencies [[`034c738`](https://github.com/manulera/OpenCloning_frontend/commit/034c73840dc183b6b3584365c1db899d2f0c548b)]:
  - @opencloning/store@1.7.5
  - @opencloning/ui@1.7.5
  - @opencloning/utils@1.7.5
  - @opencloning/opencloning-elabftw@1.7.5

## 1.5.5

### Patch Changes

- [#682](https://github.com/manulera/OpenCloning_frontend/pull/682) [`04703a9`](https://github.com/manulera/OpenCloning_frontend/commit/04703a9269a5d4cc4bdde478c1ec61e5c73b0d2a) Thanks [@manulera](https://github.com/manulera)! - Fix bug when copying pcr products

- Updated dependencies [[`04703a9`](https://github.com/manulera/OpenCloning_frontend/commit/04703a9269a5d4cc4bdde478c1ec61e5c73b0d2a)]:
  - @opencloning/utils@1.7.4
  - @opencloning/ui@1.7.4
  - @opencloning/opencloning-elabftw@1.7.4
  - @opencloning/store@1.7.4

## 1.5.4

### Patch Changes

- [#679](https://github.com/manulera/OpenCloning_frontend/pull/679) [`cd7a6d5`](https://github.com/manulera/OpenCloning_frontend/commit/cd7a6d5286913a26dc294ba6d0d753702d652851) Thanks [@manulera](https://github.com/manulera)! - Fix Dockerfile

## 1.5.3

### Patch Changes

- [#677](https://github.com/manulera/OpenCloning_frontend/pull/677) [`04827d6`](https://github.com/manulera/OpenCloning_frontend/commit/04827d6184c5a1276814f60ef3c3fee2c832a6fd) Thanks [@manulera](https://github.com/manulera)! - Now loads history from Snapgene files

- Updated dependencies [[`04827d6`](https://github.com/manulera/OpenCloning_frontend/commit/04827d6184c5a1276814f60ef3c3fee2c832a6fd)]:
  - @opencloning/ui@1.7.3
  - @opencloning/opencloning-elabftw@1.7.3
  - @opencloning/store@1.7.3
  - @opencloning/utils@1.7.3

## 1.5.2

### Patch Changes

- Updated dependencies [[`1f08cca`](https://github.com/manulera/OpenCloning_frontend/commit/1f08ccab8422d9cf9a9355d2770fa8997e53c96b)]:
  - @opencloning/ui@1.7.2
  - @opencloning/opencloning-elabftw@1.7.2
  - @opencloning/store@1.7.2
  - @opencloning/utils@1.7.2

## 1.5.1

### Patch Changes

- Updated dependencies [[`cfe95f5`](https://github.com/manulera/OpenCloning_frontend/commit/cfe95f5d79a4f147646d46d51b19a155941b2ad8)]:
  - @opencloning/utils@1.7.1
  - @opencloning/opencloning-elabftw@1.7.1
  - @opencloning/ui@1.7.1
  - @opencloning/store@1.7.1

## 1.5.0

### Minor Changes

- [#670](https://github.com/manulera/OpenCloning_frontend/pull/670) [`2943c1c`](https://github.com/manulera/OpenCloning_frontend/commit/2943c1c3a8b29a7081841d8ca9e2b36a2ad14a61) Thanks [@manulera](https://github.com/manulera)! - Fix import structure

### Patch Changes

- Updated dependencies [[`2943c1c`](https://github.com/manulera/OpenCloning_frontend/commit/2943c1c3a8b29a7081841d8ca9e2b36a2ad14a61)]:
  - @opencloning/store@1.7.0
  - @opencloning/utils@1.7.0
  - @opencloning/ui@1.7.0
  - @opencloning/opencloning-elabftw@1.7.0

## 1.4.8

### Patch Changes

- [#668](https://github.com/manulera/OpenCloning_frontend/pull/668) [`dd0df39`](https://github.com/manulera/OpenCloning_frontend/commit/dd0df39c5fbf65feaab09f90d123e3776efed6bd) Thanks [@manulera](https://github.com/manulera)! - Added LICENSE to package.json

- Updated dependencies [[`dd0df39`](https://github.com/manulera/OpenCloning_frontend/commit/dd0df39c5fbf65feaab09f90d123e3776efed6bd), [`dd0df39`](https://github.com/manulera/OpenCloning_frontend/commit/dd0df39c5fbf65feaab09f90d123e3776efed6bd)]:
  - @opencloning/opencloning-elabftw@1.6.0
  - @opencloning/ui@1.6.0
  - @opencloning/store@1.6.0
  - @opencloning/utils@1.6.0

## 1.4.7

### Patch Changes

- [#665](https://github.com/manulera/OpenCloning_frontend/pull/665) [`d3477f1`](https://github.com/manulera/OpenCloning_frontend/commit/d3477f1354b92b61cb8f4299b4a9648b67f26ab0) Thanks [@manulera](https://github.com/manulera)! - Add support for user-defined recombinases

- Updated dependencies [[`d3477f1`](https://github.com/manulera/OpenCloning_frontend/commit/d3477f1354b92b61cb8f4299b4a9648b67f26ab0)]:
  - @opencloning/utils@1.5.6
  - @opencloning/ui@1.5.6
  - @opencloning/store@1.5.6

## 1.4.6

### Patch Changes

- [#662](https://github.com/manulera/OpenCloning_frontend/pull/662) [`8f51251`](https://github.com/manulera/OpenCloning_frontend/commit/8f51251e4dc39535bd037dfa67748b599a483ee9) Thanks [@manulera](https://github.com/manulera)! - Syntax overview full screen

## 1.4.5

### Patch Changes

- Updated dependencies [[`f69d0d6`](https://github.com/manulera/OpenCloning_frontend/commit/f69d0d6b5c4558b502bf13f20fac9fa183cfc8f2)]:
  - @opencloning/ui@1.5.5
  - @opencloning/store@1.5.5
  - @opencloning/utils@1.5.5

## 1.4.4

### Patch Changes

- [#657](https://github.com/manulera/OpenCloning_frontend/pull/657) [`36f5e08`](https://github.com/manulera/OpenCloning_frontend/commit/36f5e08a0dc346842ec922706735362929b5ac84) Thanks [@manulera](https://github.com/manulera)! - Plasmid syntax tables showing which part is contained in each plasmid can now be sorted

- Updated dependencies [[`36f5e08`](https://github.com/manulera/OpenCloning_frontend/commit/36f5e08a0dc346842ec922706735362929b5ac84)]:
  - @opencloning/ui@1.5.4
  - @opencloning/store@1.5.4
  - @opencloning/utils@1.5.4

## 1.4.3

### Patch Changes

- [#655](https://github.com/manulera/OpenCloning_frontend/pull/655) [`b34e83f`](https://github.com/manulera/OpenCloning_frontend/commit/b34e83f0b8813de7744d3d71ad779be0df2f75cf) Thanks [@manulera](https://github.com/manulera)! - Changes to Assembler naming:

  - Handle slashes in downloaded file names (were being turned into subfolders)
  - Allow users to change names of outputs in assembler

- [#655](https://github.com/manulera/OpenCloning_frontend/pull/655) [`b34e83f`](https://github.com/manulera/OpenCloning_frontend/commit/b34e83f0b8813de7744d3d71ad779be0df2f75cf) Thanks [@manulera](https://github.com/manulera)! - In Assembler tab, allow users to see an overview of the Syntax

- Updated dependencies [[`b34e83f`](https://github.com/manulera/OpenCloning_frontend/commit/b34e83f0b8813de7744d3d71ad779be0df2f75cf), [`b34e83f`](https://github.com/manulera/OpenCloning_frontend/commit/b34e83f0b8813de7744d3d71ad779be0df2f75cf)]:
  - @opencloning/utils@1.5.3
  - @opencloning/ui@1.5.3
  - @opencloning/store@1.5.3

## 1.4.2

### Patch Changes

- Updated dependencies [[`e529568`](https://github.com/manulera/OpenCloning_frontend/commit/e5295684d62b25954e6095fc63fa7c9e65551fb6)]:
  - @opencloning/ui@1.5.2
  - @opencloning/store@1.5.2
  - @opencloning/utils@1.5.2

## 1.4.1

### Patch Changes

- [#651](https://github.com/manulera/OpenCloning_frontend/pull/651) [`b5c89e2`](https://github.com/manulera/OpenCloning_frontend/commit/b5c89e23aa1065319cb07a9ac48a26693dd0a21a) Thanks [@manulera](https://github.com/manulera)! - Allow primer design of Gibson and similar assembly methods to include fragments that are not amplified. Similar to what the NEBuilder planner does, where not all products are amplified. Perhaps in the future it would be useful to also allow the option to restore the restriction sites on the edge.

- Updated dependencies [[`b5c89e2`](https://github.com/manulera/OpenCloning_frontend/commit/b5c89e23aa1065319cb07a9ac48a26693dd0a21a), [`b5c89e2`](https://github.com/manulera/OpenCloning_frontend/commit/b5c89e23aa1065319cb07a9ac48a26693dd0a21a)]:
  - @opencloning/ui@1.5.1
  - @opencloning/store@1.5.1
  - @opencloning/utils@1.5.1

## 1.4.0

### Minor Changes

- [#648](https://github.com/manulera/OpenCloning_frontend/pull/648) [`800ebcd`](https://github.com/manulera/OpenCloning_frontend/commit/800ebcd4ed610ad89d538e1d59314977aae40583) Thanks [@manulera](https://github.com/manulera)! - Multiple enzymes can be used in the Assembler

### Patch Changes

- Updated dependencies [[`800ebcd`](https://github.com/manulera/OpenCloning_frontend/commit/800ebcd4ed610ad89d538e1d59314977aae40583)]:
  - @opencloning/utils@1.5.0
  - @opencloning/ui@1.5.0
  - @opencloning/store@1.5.0

## 1.3.12

### Patch Changes

- Updated dependencies [[`27744a3`](https://github.com/manulera/OpenCloning_frontend/commit/27744a3e5cebd6d41cb11a76f3d4d367f5a4edc8)]:
  - @opencloning/ui@1.4.11
  - @opencloning/store@1.4.11
  - @opencloning/utils@1.4.11

## 1.3.11

### Patch Changes

- [#642](https://github.com/manulera/OpenCloning_frontend/pull/642) [`3028e98`](https://github.com/manulera/OpenCloning_frontend/commit/3028e98b60be89288327cc1b6dac87cb2479a3c7) Thanks [@manulera](https://github.com/manulera)! - When downloading from assembler, if name is too long change to id_construct

- Updated dependencies [[`3028e98`](https://github.com/manulera/OpenCloning_frontend/commit/3028e98b60be89288327cc1b6dac87cb2479a3c7)]:
  - @opencloning/ui@1.4.10
  - @opencloning/store@1.4.10
  - @opencloning/utils@1.4.10

## 1.3.10

### Patch Changes

- [#640](https://github.com/manulera/OpenCloning_frontend/pull/640) [`2a8015b`](https://github.com/manulera/OpenCloning_frontend/commit/2a8015b63534c56dc7a7ae38b5fab7f14db1262d) Thanks [@manulera](https://github.com/manulera)! - Improve width of assembler plasmids dropdowns

- Updated dependencies [[`2a8015b`](https://github.com/manulera/OpenCloning_frontend/commit/2a8015b63534c56dc7a7ae38b5fab7f14db1262d)]:
  - @opencloning/ui@1.4.9
  - @opencloning/store@1.4.9
  - @opencloning/utils@1.4.9

## 1.3.9

### Patch Changes

- Updated dependencies [[`600d6e3`](https://github.com/manulera/OpenCloning_frontend/commit/600d6e341feb308fe62d22dc11d6b1e256dd43d4)]:
  - @opencloning/ui@1.4.8
  - @opencloning/store@1.4.8
  - @opencloning/utils@1.4.8

## 1.3.8

### Patch Changes

- [#631](https://github.com/manulera/OpenCloning_frontend/pull/631) [`40dd956`](https://github.com/manulera/OpenCloning_frontend/commit/40dd956d0f6c729ad0690578bf232610a063523f) Thanks [@manulera](https://github.com/manulera)! - Add links to assembler documentation and to create your own syntax in the builder

- [#631](https://github.com/manulera/OpenCloning_frontend/pull/631) [`40dd956`](https://github.com/manulera/OpenCloning_frontend/commit/40dd956d0f6c729ad0690578bf232610a063523f) Thanks [@manulera](https://github.com/manulera)! - Add link to documentation for the Assembler, and add deprecation notice for MoClo templates

- [#631](https://github.com/manulera/OpenCloning_frontend/pull/631) [`40dd956`](https://github.com/manulera/OpenCloning_frontend/commit/40dd956d0f6c729ad0690578bf232610a063523f) Thanks [@manulera](https://github.com/manulera)! - improve alignment of sequences in the AssemblerPart by improving css

- Updated dependencies [[`40dd956`](https://github.com/manulera/OpenCloning_frontend/commit/40dd956d0f6c729ad0690578bf232610a063523f), [`40dd956`](https://github.com/manulera/OpenCloning_frontend/commit/40dd956d0f6c729ad0690578bf232610a063523f), [`40dd956`](https://github.com/manulera/OpenCloning_frontend/commit/40dd956d0f6c729ad0690578bf232610a063523f)]:
  - @opencloning/ui@1.4.7
  - @opencloning/store@1.4.7
  - @opencloning/utils@1.4.7

## 1.3.7

### Patch Changes

- [#629](https://github.com/manulera/OpenCloning_frontend/pull/629) [`8820965`](https://github.com/manulera/OpenCloning_frontend/commit/8820965e5a91ec29bb0c9788191123f996a8ecd8) Thanks [@manulera](https://github.com/manulera)! - \* improve category names + clear plasmids when loading new syntax
  - improve handling of files uploaded by user or associated with kit
  - Allow downloading the results from the Assembler.
- Updated dependencies [[`8820965`](https://github.com/manulera/OpenCloning_frontend/commit/8820965e5a91ec29bb0c9788191123f996a8ecd8)]:
  - @opencloning/ui@1.4.6
  - @opencloning/store@1.4.6
  - @opencloning/utils@1.4.6

## 1.3.6

### Patch Changes

- [#627](https://github.com/manulera/OpenCloning_frontend/pull/627) [`74e5365`](https://github.com/manulera/OpenCloning_frontend/commit/74e53653a27c2dc64f19afd984981c0fb70fc747) Thanks [@manulera](https://github.com/manulera)! - Allow selecting sub-assemblies from a kit

- Updated dependencies [[`74e5365`](https://github.com/manulera/OpenCloning_frontend/commit/74e53653a27c2dc64f19afd984981c0fb70fc747)]:
  - @opencloning/ui@1.4.5
  - @opencloning/store@1.4.5
  - @opencloning/utils@1.4.5

## 1.3.5

### Patch Changes

- [#624](https://github.com/manulera/OpenCloning_frontend/pull/624) [`c333aa3`](https://github.com/manulera/OpenCloning_frontend/commit/c333aa3f5eda8ab7a65799d589ba6e9b376e2d24) Thanks [@manulera](https://github.com/manulera)! - Assigning plasmids to categories handles palindromic parts

- Updated dependencies [[`c333aa3`](https://github.com/manulera/OpenCloning_frontend/commit/c333aa3f5eda8ab7a65799d589ba6e9b376e2d24)]:
  - @opencloning/ui@1.4.4
  - @opencloning/store@1.4.4
  - @opencloning/utils@1.4.4

## 1.3.4

### Patch Changes

- Updated dependencies [[`03cec1c`](https://github.com/manulera/OpenCloning_frontend/commit/03cec1c53e6e8365bb8bf9617ed3128b65ab18cc)]:
  - @opencloning/ui@1.4.3
  - @opencloning/store@1.4.3
  - @opencloning/utils@1.4.3

## 1.3.3

### Patch Changes

- [#620](https://github.com/manulera/OpenCloning_frontend/pull/620) [`1c2dbef`](https://github.com/manulera/OpenCloning_frontend/commit/1c2dbef236d54b4980599cd6acc4fdabced13f1d) Thanks [@manulera](https://github.com/manulera)! - Fix assembler using BsaI by default always

- Updated dependencies [[`1c2dbef`](https://github.com/manulera/OpenCloning_frontend/commit/1c2dbef236d54b4980599cd6acc4fdabced13f1d)]:
  - @opencloning/ui@1.4.2
  - @opencloning/store@1.4.2
  - @opencloning/utils@1.4.2

## 1.3.2

### Patch Changes

- [#616](https://github.com/manulera/OpenCloning_frontend/pull/616) [`1419d5c`](https://github.com/manulera/OpenCloning_frontend/commit/1419d5cb80f738b737076e4d3b958c31eeb0f7b4) Thanks [@manulera](https://github.com/manulera)! - Allow to "select all" when importing static sequences from server

- Updated dependencies [[`1419d5c`](https://github.com/manulera/OpenCloning_frontend/commit/1419d5cb80f738b737076e4d3b958c31eeb0f7b4)]:
  - @opencloning/ui@1.4.1
  - @opencloning/store@1.4.1
  - @opencloning/utils@1.4.1

## 1.3.1

### Patch Changes

- [#614](https://github.com/manulera/OpenCloning_frontend/pull/614) [`9b193ea`](https://github.com/manulera/OpenCloning_frontend/commit/9b193ea4ad0f523bed31052208705ab1859060ba) Thanks [@manulera](https://github.com/manulera)! - Fix release of multi-platform images

## 1.3.0

### Minor Changes

- [#611](https://github.com/manulera/OpenCloning_frontend/pull/611) [`74a58c4`](https://github.com/manulera/OpenCloning_frontend/commit/74a58c463a32bf6443eaf062094dc4aac5c76b5a) Thanks [@manulera](https://github.com/manulera)! - Adds functionality to load files (sequences and syntaxes) from a local public folder, providing an alternative to uploading files manually. The implementation enables users to pre-configure collections of sequences and syntaxes that can be easily selected through a UI.

  **Changes:**

  - Added `useRequestForEffect` hook for managing async requests with retry capability
  - Added `useServerStaticFiles` hook for fetching and managing local file collections
  - Added `ServerStaticFileSelect` component for selecting files from the local collection with category filtering
  - Added `SourceServerStaticFile` component and integrated it into the source selection flow
  - Added local file loading capability to the assembler's plasmid uploader and syntax loader
  - Configured build system to copy example collection folder to public directory during development
  - Added comprehensive test coverage for all new components and functionality

### Patch Changes

- Updated dependencies [[`74a58c4`](https://github.com/manulera/OpenCloning_frontend/commit/74a58c463a32bf6443eaf062094dc4aac5c76b5a)]:
  - @opencloning/ui@1.4.0
  - @opencloning/store@1.4.0
  - @opencloning/utils@1.4.0

## 1.2.4

### Patch Changes

- Updated dependencies [[`1e4bfbf`](https://github.com/manulera/OpenCloning_frontend/commit/1e4bfbfb805e841d9a91cf650ebf632ac62b1248)]:
  - @opencloning/ui@1.3.3
  - @opencloning/store@1.3.3
  - @opencloning/utils@1.3.3

## 1.2.3

### Patch Changes

- Updated dependencies [[`ff60c18`](https://github.com/manulera/OpenCloning_frontend/commit/ff60c18c1500e8b9046f0810cbd69fe1a65c550c)]:
  - @opencloning/ui@1.3.2
  - @opencloning/store@1.3.2
  - @opencloning/utils@1.3.2

## 1.2.2

### Patch Changes

- Updated dependencies [[`b9b821d`](https://github.com/manulera/OpenCloning_frontend/commit/b9b821d562417b85b69dbf53ddaac324474d4e6b)]:
  - @opencloning/ui@1.3.1
  - @opencloning/store@1.3.1
  - @opencloning/utils@1.3.1

## 1.2.1

### Patch Changes

- Updated dependencies [[`d5a456d`](https://github.com/manulera/OpenCloning_frontend/commit/d5a456d70ccfe949b21aae260d2c99507ff6a88e)]:
  - @opencloning/store@1.3.0
  - @opencloning/utils@1.3.0
  - @opencloning/ui@1.3.0

## 1.2.0

### Minor Changes

- [#595](https://github.com/manulera/OpenCloning_frontend/pull/595) [`1b28cc5`](https://github.com/manulera/OpenCloning_frontend/commit/1b28cc5852460a072982dc529b58fc9607fae21f) Thanks [@manulera](https://github.com/manulera)! - Minor improvements and bug fixes:

  - include name of tracks in alignment + update ove to display correct Track Properties table
  - fix display main sequence when alignments are present
  - change default minimum hib length to 14 for primer design
  - Gibson primer design: default to circular assembly, force circular for single input assemblies
  - Gibson primer design: make product sequence preview circular when assembly is circular
  - Primer design: in circular assemblies of one fragment only, display the spacer before the fragment in the preview.

### Patch Changes

- Updated dependencies [[`1b28cc5`](https://github.com/manulera/OpenCloning_frontend/commit/1b28cc5852460a072982dc529b58fc9607fae21f)]:
  - @opencloning/ui@1.2.0
  - @opencloning/store@1.2.0
  - @opencloning/utils@1.2.0

## 1.1.2

### Patch Changes

- [#592](https://github.com/manulera/OpenCloning_frontend/pull/592) [`57092ae`](https://github.com/manulera/OpenCloning_frontend/commit/57092ae54d96485e84191d6c20ade9e9a6838a65) Thanks [@manulera](https://github.com/manulera)! - Remove partial overlap option from restriction and ligation overlap, related to https://github.com/manulera/OpenCloning_backend/pull/389

- Updated dependencies [[`57092ae`](https://github.com/manulera/OpenCloning_frontend/commit/57092ae54d96485e84191d6c20ade9e9a6838a65)]:
  - @opencloning/ui@1.1.2
  - @opencloning/store@1.1.2
  - @opencloning/utils@1.1.2

## 1.1.1

### Patch Changes

- Updated dependencies [[`81bcca3`](https://github.com/manulera/OpenCloning_frontend/commit/81bcca3c4a38e32793dab1cc60862f8ae61b3bb9)]:
  - @opencloning/ui@1.1.1
  - @opencloning/store@1.1.1
  - @opencloning/utils@1.1.1

## 1.1.0

### Minor Changes

- [#570](https://github.com/manulera/OpenCloning_frontend/pull/570) [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0) Thanks [@manulera](https://github.com/manulera)! - Switch to using provider for configuration rather than state

- [#570](https://github.com/manulera/OpenCloning_frontend/pull/570) [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0) Thanks [@manulera](https://github.com/manulera)! - Handle version display with scripts

### Patch Changes

- [#574](https://github.com/manulera/OpenCloning_frontend/pull/574) [`6df1c20`](https://github.com/manulera/OpenCloning_frontend/commit/6df1c2060d5776a30a00daaedfb0ec2cc685284d) Thanks [@manulera](https://github.com/manulera)! - Last dummy test to check if auto pre-release works

- [#570](https://github.com/manulera/OpenCloning_frontend/pull/570) [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0) Thanks [@manulera](https://github.com/manulera)! - testing a test release to npm

- [#570](https://github.com/manulera/OpenCloning_frontend/pull/570) [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0) Thanks [@manulera](https://github.com/manulera)! - Releases work on npm now through `YARN_NPM_AUTH_TOKEN=<> yarn changeset publish`, this is enabled by patch, see Readme. This properly handles workspaces (in package.json in each of the packages, `"@opencloning/store": "workspace:*",` is replaced by the actual version).

- Updated dependencies [[`6df1c20`](https://github.com/manulera/OpenCloning_frontend/commit/6df1c2060d5776a30a00daaedfb0ec2cc685284d), [`07106ac`](https://github.com/manulera/OpenCloning_frontend/commit/07106ac0c8f9321d0b33994ed086a76eb79739a3), [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0), [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0), [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0), [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0), [`83dab1c`](https://github.com/manulera/OpenCloning_frontend/commit/83dab1c2a7cca2b17aa8039b74d15c47e467b2f0)]:
  - @opencloning/store@1.1.0
  - @opencloning/ui@1.1.0
  - @opencloning/utils@1.1.0

## 1.1.0-dev.5

### Patch Changes

- 6df1c20: Last dummy test to check if auto pre-release works
- Updated dependencies [6df1c20]
  - @opencloning/store@1.1.0-dev.5
  - @opencloning/ui@1.1.0-dev.5
  - @opencloning/utils@1.1.0-dev.5

## 1.1.0-dev.4

### Patch Changes

- Updated dependencies [07106ac]
  - @opencloning/ui@1.1.0-dev.4
  - @opencloning/store@1.1.0-dev.4
  - @opencloning/utils@1.1.0-dev.4

## 1.1.0-test.3

### Patch Changes

- Updated dependencies [a870a5e]
  - @opencloning/ui@1.1.0-test.3
  - @opencloning/store@1.1.0-test.3
  - @opencloning/utils@1.1.0-test.3

## 1.1.0-test.2

### Minor Changes

- d46f09d: Handle version display with scripts

### Patch Changes

- Updated dependencies [d46f09d]
  - @opencloning/store@1.1.0-test.2
  - @opencloning/utils@1.1.0-test.2
  - @opencloning/ui@1.1.0-test.2

## 1.1.0-test.1

### Minor Changes

- 02dbc55: Switch to using provider for configuration rather than state

### Patch Changes

- Updated dependencies [02dbc55]
  - @opencloning/store@1.1.0-test.1
  - @opencloning/ui@1.1.0-test.1
  - @opencloning/utils@1.1.0-test.1

## 1.0.2-test.0

### Patch Changes

- testing a test release to npm
- e0fb5ee: Releases work on npm now through `YARN_NPM_AUTH_TOKEN=<> yarn changeset publish`, this is enabled by patch, see Readme. This properly handles workspaces (in package.json in each of the packages, `"@opencloning/store": "workspace:*",` is replaced by the actual version).
- Updated dependencies
- Updated dependencies [e0fb5ee]
  - @opencloning/store@1.0.2-test.0
  - @opencloning/utils@1.0.2-test.0
  - @opencloning/ui@1.0.2-test.0

## 1.0.1

### Patch Changes

- a072fee: Dummy change to test releasing
- Updated dependencies [a072fee]
  - @opencloning/store@1.0.1
  - @opencloning/utils@1.0.1
  - @opencloning/ui@1.0.1

## 1.0.0

### Major Changes

- babe2f9: Switch to monorepo structure and use changesets

### Minor Changes

- 8cd33bb: Rearrange dependencies

### Patch Changes

- Updated dependencies [8cd33bb]
- Updated dependencies [babe2f9]
  - @opencloning/store@1.0.0
  - @opencloning/utils@1.0.0
  - @opencloning/ui@1.0.0
