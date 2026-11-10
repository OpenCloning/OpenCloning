# syntax-builder

## 0.5.22

### Patch Changes

- Updated dependencies [[`0b2a21d`](https://github.com/OpenCloning/OpenCloning_frontend/commit/0b2a21dde79f5539579bee39f0de49b01cd6c10c)]:
  - @opencloning/utils@2.1.1
  - @opencloning/ui@2.1.1

## 0.5.21

### Patch Changes

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

- Updated dependencies [[`c8c46d4`](https://github.com/OpenCloning/OpenCloning_frontend/commit/c8c46d4dc36cb8741d1bd89816c7ca82b89996b3)]:
  - @opencloning/ui@2.1.0
  - @opencloning/utils@2.1.0

## 0.5.20

### Patch Changes

- Updated dependencies [[`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394), [`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394), [`fe1d81c`](https://github.com/OpenCloning/OpenCloning_frontend/commit/fe1d81c6f4b85f6317a2a9e46cc68c571c79c394)]:
  - @opencloning/utils@2.0.0
  - @opencloning/ui@2.0.0

## 0.5.19

### Patch Changes

- Updated dependencies [[`f7f376e`](https://github.com/OpenCloning/OpenCloning_frontend/commit/f7f376ee351d9b2da52413700836dc55ba54b5ea)]:
  - @opencloning/ui@1.10.0
  - @opencloning/utils@1.10.0

## 0.5.18

### Patch Changes

- Updated dependencies [[`73363e7`](https://github.com/OpenCloning/OpenCloning_frontend/commit/73363e7a7f7e494e20a54bd87e5dba97f8a9197e)]:
  - @opencloning/utils@1.9.5
  - @opencloning/ui@1.9.5

## 0.5.17

### Patch Changes

- Updated dependencies []:
  - @opencloning/ui@1.9.4
  - @opencloning/utils@1.9.4

## 0.5.16

### Patch Changes

- [#764](https://github.com/OpenCloning/OpenCloning_frontend/pull/764) [`49afc87`](https://github.com/OpenCloning/OpenCloning_frontend/commit/49afc8706ec67b6fcfd71be081371b66a07e42db) Thanks [@manulera](https://github.com/manulera)! - Change dependency resolution, remove vulns.

## 0.5.15

### Patch Changes

- Updated dependencies [[`df69a1b`](https://github.com/OpenCloning/OpenCloning_frontend/commit/df69a1bfb3b3128e93d89eef48a29f81a54ebb82)]:
  - @opencloning/utils@1.9.3
  - @opencloning/ui@1.9.3

## 0.5.14

### Patch Changes

- Updated dependencies [[`06bb1a5`](https://github.com/OpenCloning/OpenCloning_frontend/commit/06bb1a513519f598e9ec3b5eec73544e2ed3958e), [`bc045f9`](https://github.com/OpenCloning/OpenCloning_frontend/commit/bc045f9e74b4d5b84250dcb5a77b93de99e4d684)]:
  - @opencloning/ui@1.9.2
  - @opencloning/utils@1.9.2

## 0.5.13

### Patch Changes

- Updated dependencies [[`e4d9515`](https://github.com/OpenCloning/OpenCloning_frontend/commit/e4d9515a7f6fcad09e5c196f3cb090f70fe3a156)]:
  - @opencloning/ui@1.9.1
  - @opencloning/utils@1.9.1

## 0.5.12

### Patch Changes

- Updated dependencies [[`6813620`](https://github.com/OpenCloning/OpenCloning_frontend/commit/6813620f4a47c44857045866d667474efbf9a64c)]:
  - @opencloning/utils@1.9.0
  - @opencloning/ui@1.9.0

## 0.5.11

### Patch Changes

- Updated dependencies [[`08144c0`](https://github.com/OpenCloning/OpenCloning_frontend/commit/08144c085cb5da37e902edc1a3b9c593c58ab680)]:
  - @opencloning/ui@1.8.2
  - @opencloning/utils@1.8.2

## 0.5.10

### Patch Changes

- Updated dependencies [[`8e841bd`](https://github.com/OpenCloning/OpenCloning_frontend/commit/8e841bdee4797df61bcf8d1972e3c3581d24fbfb)]:
  - @opencloning/ui@1.8.1
  - @opencloning/utils@1.8.1

## 0.5.9

### Patch Changes

- Updated dependencies [[`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57), [`2ff9010`](https://github.com/OpenCloning/OpenCloning_frontend/commit/2ff90103c1d9e8e984533e51ecf4dc7978756a57)]:
  - @opencloning/ui@1.8.0
  - @opencloning/utils@1.8.0

## 0.5.8

### Patch Changes

- Updated dependencies []:
  - @opencloning/ui@1.7.8
  - @opencloning/utils@1.7.8

## 0.5.7

### Patch Changes

- Updated dependencies [[`c5d9309`](https://github.com/manulera/OpenCloning_frontend/commit/c5d93099583fdfafafd40e9924d2216b596e0cec)]:
  - @opencloning/utils@1.7.7
  - @opencloning/ui@1.7.7

## 0.5.6

### Patch Changes

- Updated dependencies [[`c81b179`](https://github.com/manulera/OpenCloning_frontend/commit/c81b179b4fece50271ea214cab1f8a356e36811f), [`c81b179`](https://github.com/manulera/OpenCloning_frontend/commit/c81b179b4fece50271ea214cab1f8a356e36811f)]:
  - @opencloning/ui@1.7.6
  - @opencloning/utils@1.7.6

## 0.5.5

### Patch Changes

- Updated dependencies [[`034c738`](https://github.com/manulera/OpenCloning_frontend/commit/034c73840dc183b6b3584365c1db899d2f0c548b)]:
  - @opencloning/ui@1.7.5
  - @opencloning/utils@1.7.5

## 0.5.4

### Patch Changes

- Updated dependencies [[`04703a9`](https://github.com/manulera/OpenCloning_frontend/commit/04703a9269a5d4cc4bdde478c1ec61e5c73b0d2a)]:
  - @opencloning/utils@1.7.4
  - @opencloning/ui@1.7.4

## 0.5.3

### Patch Changes

- Updated dependencies [[`04827d6`](https://github.com/manulera/OpenCloning_frontend/commit/04827d6184c5a1276814f60ef3c3fee2c832a6fd)]:
  - @opencloning/ui@1.7.3
  - @opencloning/utils@1.7.3

## 0.5.2

### Patch Changes

- Updated dependencies [[`1f08cca`](https://github.com/manulera/OpenCloning_frontend/commit/1f08ccab8422d9cf9a9355d2770fa8997e53c96b)]:
  - @opencloning/ui@1.7.2
  - @opencloning/utils@1.7.2

## 0.5.1

### Patch Changes

- Updated dependencies [[`cfe95f5`](https://github.com/manulera/OpenCloning_frontend/commit/cfe95f5d79a4f147646d46d51b19a155941b2ad8)]:
  - @opencloning/utils@1.7.1
  - @opencloning/ui@1.7.1

## 0.5.0

### Minor Changes

- [#670](https://github.com/manulera/OpenCloning_frontend/pull/670) [`2943c1c`](https://github.com/manulera/OpenCloning_frontend/commit/2943c1c3a8b29a7081841d8ca9e2b36a2ad14a61) Thanks [@manulera](https://github.com/manulera)! - Fix import structure

### Patch Changes

- Updated dependencies [[`2943c1c`](https://github.com/manulera/OpenCloning_frontend/commit/2943c1c3a8b29a7081841d8ca9e2b36a2ad14a61)]:
  - @opencloning/utils@1.7.0
  - @opencloning/ui@1.7.0

## 0.4.7

### Patch Changes

- [#668](https://github.com/manulera/OpenCloning_frontend/pull/668) [`dd0df39`](https://github.com/manulera/OpenCloning_frontend/commit/dd0df39c5fbf65feaab09f90d123e3776efed6bd) Thanks [@manulera](https://github.com/manulera)! - Added LICENSE to package.json

- Updated dependencies [[`dd0df39`](https://github.com/manulera/OpenCloning_frontend/commit/dd0df39c5fbf65feaab09f90d123e3776efed6bd), [`dd0df39`](https://github.com/manulera/OpenCloning_frontend/commit/dd0df39c5fbf65feaab09f90d123e3776efed6bd)]:
  - @opencloning/ui@1.6.0
  - @opencloning/utils@1.6.0

## 0.4.6

### Patch Changes

- Updated dependencies [[`d3477f1`](https://github.com/manulera/OpenCloning_frontend/commit/d3477f1354b92b61cb8f4299b4a9648b67f26ab0)]:
  - @opencloning/utils@1.5.6
  - @opencloning/ui@1.5.6

## 0.4.5

### Patch Changes

- Updated dependencies [[`f69d0d6`](https://github.com/manulera/OpenCloning_frontend/commit/f69d0d6b5c4558b502bf13f20fac9fa183cfc8f2)]:
  - @opencloning/ui@1.5.5
  - @opencloning/utils@1.5.5

## 0.4.4

### Patch Changes

- [#657](https://github.com/manulera/OpenCloning_frontend/pull/657) [`36f5e08`](https://github.com/manulera/OpenCloning_frontend/commit/36f5e08a0dc346842ec922706735362929b5ac84) Thanks [@manulera](https://github.com/manulera)! - Plasmid syntax tables showing which part is contained in each plasmid can now be sorted

- Updated dependencies [[`36f5e08`](https://github.com/manulera/OpenCloning_frontend/commit/36f5e08a0dc346842ec922706735362929b5ac84)]:
  - @opencloning/ui@1.5.4
  - @opencloning/utils@1.5.4

## 0.4.3

### Patch Changes

- [#655](https://github.com/manulera/OpenCloning_frontend/pull/655) [`b34e83f`](https://github.com/manulera/OpenCloning_frontend/commit/b34e83f0b8813de7744d3d71ad779be0df2f75cf) Thanks [@manulera](https://github.com/manulera)! - Changes to Assembler naming:

  - Handle slashes in downloaded file names (were being turned into subfolders)
  - Allow users to change names of outputs in assembler

- Updated dependencies [[`b34e83f`](https://github.com/manulera/OpenCloning_frontend/commit/b34e83f0b8813de7744d3d71ad779be0df2f75cf), [`b34e83f`](https://github.com/manulera/OpenCloning_frontend/commit/b34e83f0b8813de7744d3d71ad779be0df2f75cf)]:
  - @opencloning/utils@1.5.3
  - @opencloning/ui@1.5.3

## 0.4.2

### Patch Changes

- Updated dependencies [[`e529568`](https://github.com/manulera/OpenCloning_frontend/commit/e5295684d62b25954e6095fc63fa7c9e65551fb6)]:
  - @opencloning/ui@1.5.2
  - @opencloning/utils@1.5.2

## 0.4.1

### Patch Changes

- Updated dependencies [[`b5c89e2`](https://github.com/manulera/OpenCloning_frontend/commit/b5c89e23aa1065319cb07a9ac48a26693dd0a21a), [`b5c89e2`](https://github.com/manulera/OpenCloning_frontend/commit/b5c89e23aa1065319cb07a9ac48a26693dd0a21a)]:
  - @opencloning/ui@1.5.1
  - @opencloning/utils@1.5.1

## 0.4.0

### Minor Changes

- [#648](https://github.com/manulera/OpenCloning_frontend/pull/648) [`800ebcd`](https://github.com/manulera/OpenCloning_frontend/commit/800ebcd4ed610ad89d538e1d59314977aae40583) Thanks [@manulera](https://github.com/manulera)! - Multiple enzymes can be used in the Assembler

### Patch Changes

- Updated dependencies [[`800ebcd`](https://github.com/manulera/OpenCloning_frontend/commit/800ebcd4ed610ad89d538e1d59314977aae40583)]:
  - @opencloning/utils@1.5.0
  - @opencloning/ui@1.5.0

## 0.3.4

### Patch Changes

- Updated dependencies [[`27744a3`](https://github.com/manulera/OpenCloning_frontend/commit/27744a3e5cebd6d41cb11a76f3d4d367f5a4edc8)]:
  - @opencloning/ui@1.4.11
  - @opencloning/utils@1.4.11

## 0.3.3

### Patch Changes

- Updated dependencies [[`3028e98`](https://github.com/manulera/OpenCloning_frontend/commit/3028e98b60be89288327cc1b6dac87cb2479a3c7)]:
  - @opencloning/ui@1.4.10
  - @opencloning/utils@1.4.10

## 0.3.2

### Patch Changes

- Updated dependencies [[`2a8015b`](https://github.com/manulera/OpenCloning_frontend/commit/2a8015b63534c56dc7a7ae38b5fab7f14db1262d)]:
  - @opencloning/ui@1.4.9
  - @opencloning/utils@1.4.9

## 0.3.1

### Patch Changes

- Updated dependencies [[`600d6e3`](https://github.com/manulera/OpenCloning_frontend/commit/600d6e341feb308fe62d22dc11d6b1e256dd43d4)]:
  - @opencloning/ui@1.4.8
  - @opencloning/utils@1.4.8

## 0.3.0

### Minor Changes

- [#633](https://github.com/manulera/OpenCloning_frontend/pull/633) [`c38dce4`](https://github.com/manulera/OpenCloning_frontend/commit/c38dce4e97ebc126b21de8b29cbe213c884d91e5) Thanks [@manulera](https://github.com/manulera)! - Now allows overhangs of length >=3

## 0.2.11

### Patch Changes

- [#631](https://github.com/manulera/OpenCloning_frontend/pull/631) [`40dd956`](https://github.com/manulera/OpenCloning_frontend/commit/40dd956d0f6c729ad0690578bf232610a063523f) Thanks [@manulera](https://github.com/manulera)! - improve alignment of sequences in the AssemblerPart by improving css

- [#631](https://github.com/manulera/OpenCloning_frontend/pull/631) [`40dd956`](https://github.com/manulera/OpenCloning_frontend/commit/40dd956d0f6c729ad0690578bf232610a063523f) Thanks [@manulera](https://github.com/manulera)! - improve first page syntax builder w

- Updated dependencies [[`40dd956`](https://github.com/manulera/OpenCloning_frontend/commit/40dd956d0f6c729ad0690578bf232610a063523f), [`40dd956`](https://github.com/manulera/OpenCloning_frontend/commit/40dd956d0f6c729ad0690578bf232610a063523f), [`40dd956`](https://github.com/manulera/OpenCloning_frontend/commit/40dd956d0f6c729ad0690578bf232610a063523f)]:
  - @opencloning/ui@1.4.7
  - @opencloning/utils@1.4.7

## 0.2.10

### Patch Changes

- Updated dependencies [[`8820965`](https://github.com/manulera/OpenCloning_frontend/commit/8820965e5a91ec29bb0c9788191123f996a8ecd8)]:
  - @opencloning/ui@1.4.6
  - @opencloning/utils@1.4.6

## 0.2.9

### Patch Changes

- [#627](https://github.com/manulera/OpenCloning_frontend/pull/627) [`74e5365`](https://github.com/manulera/OpenCloning_frontend/commit/74e53653a27c2dc64f19afd984981c0fb70fc747) Thanks [@manulera](https://github.com/manulera)! - Allow selecting sub-assemblies from a kit

- Updated dependencies [[`74e5365`](https://github.com/manulera/OpenCloning_frontend/commit/74e53653a27c2dc64f19afd984981c0fb70fc747)]:
  - @opencloning/ui@1.4.5
  - @opencloning/utils@1.4.5

## 0.2.8

### Patch Changes

- [#624](https://github.com/manulera/OpenCloning_frontend/pull/624) [`c333aa3`](https://github.com/manulera/OpenCloning_frontend/commit/c333aa3f5eda8ab7a65799d589ba6e9b376e2d24) Thanks [@manulera](https://github.com/manulera)! - Assigning plasmids to categories handles palindromic parts

- Updated dependencies [[`c333aa3`](https://github.com/manulera/OpenCloning_frontend/commit/c333aa3f5eda8ab7a65799d589ba6e9b376e2d24)]:
  - @opencloning/ui@1.4.4
  - @opencloning/utils@1.4.4

## 0.2.7

### Patch Changes

- [#622](https://github.com/manulera/OpenCloning_frontend/pull/622) [`03cec1c`](https://github.com/manulera/OpenCloning_frontend/commit/03cec1c53e6e8365bb8bf9617ed3128b65ab18cc) Thanks [@manulera](https://github.com/manulera)! - Fix loading external assemblies in syntax builder by extracting config out of ExistingSyntaxDialog component

- Updated dependencies [[`03cec1c`](https://github.com/manulera/OpenCloning_frontend/commit/03cec1c53e6e8365bb8bf9617ed3128b65ab18cc)]:
  - @opencloning/ui@1.4.3
  - @opencloning/utils@1.4.3

## 0.2.6

### Patch Changes

- Updated dependencies [[`1c2dbef`](https://github.com/manulera/OpenCloning_frontend/commit/1c2dbef236d54b4980599cd6acc4fdabced13f1d)]:
  - @opencloning/ui@1.4.2
  - @opencloning/utils@1.4.2

## 0.2.5

### Patch Changes

- Updated dependencies [[`1419d5c`](https://github.com/manulera/OpenCloning_frontend/commit/1419d5cb80f738b737076e4d3b958c31eeb0f7b4)]:
  - @opencloning/ui@1.4.1
  - @opencloning/utils@1.4.1

## 0.2.4

### Patch Changes

- Updated dependencies [[`74a58c4`](https://github.com/manulera/OpenCloning_frontend/commit/74a58c463a32bf6443eaf062094dc4aac5c76b5a)]:
  - @opencloning/ui@1.4.0
  - @opencloning/utils@1.4.0

## 0.2.3

### Patch Changes

- Updated dependencies [[`1e4bfbf`](https://github.com/manulera/OpenCloning_frontend/commit/1e4bfbfb805e841d9a91cf650ebf632ac62b1248)]:
  - @opencloning/ui@1.3.3
  - @opencloning/utils@1.3.3

## 0.2.2

### Patch Changes

- Updated dependencies [[`ff60c18`](https://github.com/manulera/OpenCloning_frontend/commit/ff60c18c1500e8b9046f0810cbd69fe1a65c550c)]:
  - @opencloning/ui@1.3.2
  - @opencloning/utils@1.3.2

## 0.2.1

### Patch Changes

- [#602](https://github.com/manulera/OpenCloning_frontend/pull/602) [`b9b821d`](https://github.com/manulera/OpenCloning_frontend/commit/b9b821d562417b85b69dbf53ddaac324474d4e6b) Thanks [@manulera](https://github.com/manulera)! - Allow users to submit their own syntax from JSON file. Not validated yet so wrong syntaxes will trigger an error.

- [#602](https://github.com/manulera/OpenCloning_frontend/pull/602) [`b9b821d`](https://github.com/manulera/OpenCloning_frontend/commit/b9b821d562417b85b69dbf53ddaac324474d4e6b) Thanks [@manulera](https://github.com/manulera)! - - Improved validation of color input in syntax builder app to not rely on browser DOM.
  - Improved graph error messages.
- Updated dependencies [[`b9b821d`](https://github.com/manulera/OpenCloning_frontend/commit/b9b821d562417b85b69dbf53ddaac324474d4e6b)]:
  - @opencloning/ui@1.3.1
  - @opencloning/utils@1.3.1

## 0.2.0

### Minor Changes

- [#597](https://github.com/manulera/OpenCloning_frontend/pull/597) [`d5a456d`](https://github.com/manulera/OpenCloning_frontend/commit/d5a456d70ccfe949b21aae260d2c99507ff6a88e) Thanks [@manulera](https://github.com/manulera)! - Initial creation of syntax editor, where users can define a MoClo syntax to be used in OpenCloning

### Patch Changes

- Updated dependencies [[`d5a456d`](https://github.com/manulera/OpenCloning_frontend/commit/d5a456d70ccfe949b21aae260d2c99507ff6a88e)]:
  - @opencloning/utils@1.3.0
  - @opencloning/ui@1.3.0
