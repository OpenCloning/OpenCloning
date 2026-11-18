# Changelog

## [3.0.0](https://github.com/OpenCloning/OpenCloning/compare/v2.2.2...v3.0.0) (2026-11-18)


### ⚠ BREAKING CHANGES

* drop mars for alignments + use debian-based image + require python 3.12 ([#245](https://github.com/OpenCloning/OpenCloning/issues/245))

### Features

* drop mars for alignments + use debian-based image + require python 3.12 ([#245](https://github.com/OpenCloning/OpenCloning/issues/245)) ([80d0fc1](https://github.com/OpenCloning/OpenCloning/commit/80d0fc144c748dce4eed31def58b6d69d4278297))
* Update styling to use MUI better, enable theming ([#246](https://github.com/OpenCloning/OpenCloning/issues/246)) ([859ad90](https://github.com/OpenCloning/OpenCloning/commit/859ad90f68d024ea54b3c5d9c4d36d487a4d6e51))


### Bug Fixes

* fix recreate schema (drop all tables, not just existing models) ([#119](https://github.com/OpenCloning/OpenCloning/issues/119)) ([bf01e01](https://github.com/OpenCloning/OpenCloning/commit/bf01e01e1036a8ad1e7e92169883f36b499940f8))
* handle origin-spanning parts in syntaxes ([#244](https://github.com/OpenCloning/OpenCloning/issues/244)) ([106466b](https://github.com/OpenCloning/OpenCloning/commit/106466ba3b3b0d51a94be69095d5b516dcbbf51d))
* improve async handling in the UI with waiting components ([#248](https://github.com/OpenCloning/OpenCloning/issues/248)) ([c1b4939](https://github.com/OpenCloning/OpenCloning/commit/c1b49391c332d48c1949934022138cc2ca93bc53))
* prevent 500 error when manually input sequences names contained spaces (API only / did not affect frontend) [#90](https://github.com/OpenCloning/OpenCloning/issues/90) ([#230](https://github.com/OpenCloning/OpenCloning/issues/230)) ([dc028f9](https://github.com/OpenCloning/OpenCloning/commit/dc028f9731002415351ee514746f077451c7752d))
* small issue fixes ([#135](https://github.com/OpenCloning/OpenCloning/issues/135) [#126](https://github.com/OpenCloning/OpenCloning/issues/126) [#200](https://github.com/OpenCloning/OpenCloning/issues/200)) ([#232](https://github.com/OpenCloning/OpenCloning/issues/232)) ([ae4adc7](https://github.com/OpenCloning/OpenCloning/commit/ae4adc7e2e4be4ea47c4aee844a936ac8386e2b1))

## [2.2.2](https://github.com/OpenCloning/OpenCloning/compare/v2.2.1...v2.2.2) (2026-11-13)


### Bug Fixes

* Fix too many requests to the db when checking sequencing data ([#115](https://github.com/OpenCloning/OpenCloning/issues/115)) ([16f5f10](https://github.com/OpenCloning/OpenCloning/commit/16f5f10c1262f522bd11fcad321f294825ebe0d1))

## [2.2.1](https://github.com/OpenCloning/OpenCloning/compare/v2.2.0...v2.2.1) (2026-11-13)


### Miscellaneous Chores

* release 2.2.1 ([#112](https://github.com/OpenCloning/OpenCloning/issues/112)) ([db2879a](https://github.com/OpenCloning/OpenCloning/commit/db2879ab0c34c1fd4f773dab6149712a3cfe2e34))

## [2.2.0](https://github.com/OpenCloning/OpenCloning/compare/v2.1.1...v2.2.0) (2026-11-12)


### Features

* bulk linking of sequencing data + sequencing data overview table ([#110](https://github.com/OpenCloning/OpenCloning/issues/110)) ([fabdc18](https://github.com/OpenCloning/OpenCloning/commit/fabdc18ae256f629e0133d67958ac9d7a4b17da5))
* enable filter by sequence type in bulk sequence import + fix error when assembler loads linear sequences ([#105](https://github.com/OpenCloning/OpenCloning/issues/105)) ([5fa16e2](https://github.com/OpenCloning/OpenCloning/commit/5fa16e2fdc516f29861a8e0e16c830a13e08742a))


### Bug Fixes

* delete clerk ci user in test cleanup ([#108](https://github.com/OpenCloning/OpenCloning/issues/108)) ([b5009ea](https://github.com/OpenCloning/OpenCloning/commit/b5009ea649358c276fa6946ecff1640589fecbf9))
