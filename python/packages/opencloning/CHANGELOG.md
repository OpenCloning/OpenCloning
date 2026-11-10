# Changelog

## [2.1.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v2.0.1...opencloning-v2.1.0) (2026-11-06)


### Features

* Bulk request sequences endpoint - by ids or tag ([#545](https://github.com/OpenCloning/OpenCloning_backend/issues/545)) ([a8d1f30](https://github.com/OpenCloning/OpenCloning_backend/commit/a8d1f303306468ccb0d9399e4bb67cd95e318d3c))
* mcp server mvp ([#547](https://github.com/OpenCloning/OpenCloning_backend/issues/547)) ([364df10](https://github.com/OpenCloning/OpenCloning_backend/commit/364df107e3af4b159564603198a6639d02694028))

## [2.0.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v2.0.0...opencloning-v2.0.1) (2026-10-19)


### Bug Fixes

* return 400 instead of 500 when restriction_and_ligation overhangs contain ambiguous bases ([#537](https://github.com/OpenCloning/OpenCloning_backend/issues/537)) ([e2265ba](https://github.com/OpenCloning/OpenCloning_backend/commit/e2265ba0a7321323897864ac10f7accf1f312b24))
* security fixes (email matching, safeguard OIDC test mode, size limit for files, async endpoints only when needed, database_id validation when posting cloning strategy) ([#538](https://github.com/OpenCloning/OpenCloning_backend/issues/538)) ([0681968](https://github.com/OpenCloning/OpenCloning_backend/commit/0681968aba1253fc618c33b6c2b505d8bb04f868))

## [2.0.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.10.0...opencloning-v2.0.0) (2026-10-16)


### ⚠ BREAKING CHANGES

* drop RECORD_STUBS functionality ([#532](https://github.com/OpenCloning/OpenCloning_backend/issues/532))

### Features

* Changed to json login including request id and user id for observability ([#530](https://github.com/OpenCloning/OpenCloning_backend/issues/530)) ([5cdd615](https://github.com/OpenCloning/OpenCloning_backend/commit/5cdd61515dbe7a8d259b89468aaaac623f152032))
* drop RECORD_STUBS functionality ([#532](https://github.com/OpenCloning/OpenCloning_backend/issues/532)) ([032f365](https://github.com/OpenCloning/OpenCloning_backend/commit/032f365bf91a55b0fcec0aba1c2df74740941a62))


### Bug Fixes

* small fixes suggested by AI review of [#530](https://github.com/OpenCloning/OpenCloning_backend/issues/530) ([#534](https://github.com/OpenCloning/OpenCloning_backend/issues/534)) ([f998c88](https://github.com/OpenCloning/OpenCloning_backend/commit/f998c884ba63039fd22ef37d9733b8f824b916d5))
* use addgene API instead of log in credentials and set agent header for wekwikgene ([#539](https://github.com/OpenCloning/OpenCloning_backend/issues/539)) ([310c68a](https://github.com/OpenCloning/OpenCloning_backend/commit/310c68af8fcb1cf085e205581db8c717a8005a92))

## [1.10.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.9.6...opencloning-v1.10.0) (2026-09-28)


### Features

* Use OICD for log in ([#524](https://github.com/OpenCloning/OpenCloning_backend/issues/524)) ([7a7d092](https://github.com/OpenCloning/OpenCloning_backend/commit/7a7d0927129f45d8ebdae3e2ca315a806594ae94))

## [1.9.6](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.9.5...opencloning-v1.9.6) (2026-09-18)


### Bug Fixes

* add https://sequences.addgene.org/ to allowlist ([#518](https://github.com/OpenCloning/OpenCloning_backend/issues/518)) ([3dc0027](https://github.com/OpenCloning/OpenCloning_backend/commit/3dc002783402b144c966d53dcf220a60c2e8da2e))

## [1.9.5](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.9.4...opencloning-v1.9.5) (2026-06-12)


### Bug Fixes

* change pombe form to not rely on PPPP for primer design and work for cerevisiae as well ([#514](https://github.com/OpenCloning/OpenCloning_backend/issues/514)) ([40d656f](https://github.com/OpenCloning/OpenCloning_backend/commit/40d656fab04d3994ab4736bfbcf55c383f6c8e7a))

## [1.9.4](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.9.3...opencloning-v1.9.4) (2026-06-10)


### Miscellaneous Chores

* **opencloning:** Synchronize backend-packages versions

## [1.9.3](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.9.2...opencloning-v1.9.3) (2026-06-10)


### Miscellaneous Chores

* **opencloning:** Synchronize backend-packages versions

## [1.9.2](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.9.1...opencloning-v1.9.2) (2026-06-09)


### Miscellaneous Chores

* **opencloning:** Synchronize backend-packages versions

## [1.9.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.9.0...opencloning-v1.9.1) (2026-06-09)


### Bug Fixes

* Bulk update SnapGene history ([#502](https://github.com/OpenCloning/OpenCloning_backend/issues/502)) ([c1b0154](https://github.com/OpenCloning/OpenCloning_backend/commit/c1b015462674c39ac55754f3faf01c205ca77529))
* use new parse_snapgene_history requiring no temp file ([#500](https://github.com/OpenCloning/OpenCloning_backend/issues/500)) ([752ec3e](https://github.com/OpenCloning/OpenCloning_backend/commit/752ec3eab75c6b39dc418d24e06bb08a4f5278dd))

## [1.9.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.8.1...opencloning-v1.9.0) (2026-06-05)


### Features

* make uid unique case-insensitive ([#496](https://github.com/OpenCloning/OpenCloning_backend/issues/496)) ([9ad7675](https://github.com/OpenCloning/OpenCloning_backend/commit/9ad767500174c929845d607d612f8148d3b3388a))


### Bug Fixes

* support bulk upload snapgene files as sequences ([#499](https://github.com/OpenCloning/OpenCloning_backend/issues/499)) ([a314a9c](https://github.com/OpenCloning/OpenCloning_backend/commit/a314a9c23fec467df8fe8cd1f68bb109a391ad4b))

## [1.8.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.8.0...opencloning-v1.8.1) (2026-06-03)


### Bug Fixes

* small bug in bulk submit + speed up db sync + update pydna ([#495](https://github.com/OpenCloning/OpenCloning_backend/issues/495)) ([17035ba](https://github.com/OpenCloning/OpenCloning_backend/commit/17035ba3ca8f6c9466e4e722d06d2a59f9a2e2e5))

## [1.8.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.7.0...opencloning-v1.8.0) (2026-06-02)


### Miscellaneous Chores

* **opencloning:** Synchronize backend-packages versions

## [1.7.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.6.1...opencloning-v1.7.0) (2026-06-01)


### Bug Fixes

* Bulk submit cloning strategies ([#488](https://github.com/OpenCloning/OpenCloning_backend/issues/488)) ([a97142e](https://github.com/OpenCloning/OpenCloning_backend/commit/a97142e2949a95bec60707b62a5e850d15fcf33d))

## [1.6.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.6.0...opencloning-v1.6.1) (2026-05-22)


### Bug Fixes

* setting env var ALLOWED_ORIGINS to empty string results in empty list ([#480](https://github.com/OpenCloning/OpenCloning_backend/issues/480)) ([fb818d4](https://github.com/OpenCloning/OpenCloning_backend/commit/fb818d4f336b0683cf5352dd1dcde4a7c4919158))

## [1.6.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.5.1...opencloning-v1.6.0) (2026-05-22)


### Miscellaneous Chores

* **opencloning:** Synchronize backend-packages versions

## [1.5.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.5.0...opencloning-v1.5.1) (2026-05-20)


### Bug Fixes

* rename gunicorn env vars ([#468](https://github.com/OpenCloning/OpenCloning_backend/issues/468)) ([0f6f737](https://github.com/OpenCloning/OpenCloning_backend/commit/0f6f737b77bc6206cd69851be5674b8e3d3e9533))

## [1.5.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.4.0...opencloning-v1.5.0) (2026-05-20)


### Miscellaneous Chores

* **opencloning:** Synchronize backend-packages versions

## [1.4.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-v1.3.9...opencloning-v1.4.0) (2026-05-19)


### Features

* use multiple workers in prod with gunicorn ([#461](https://github.com/OpenCloning/OpenCloning_backend/issues/461)) ([b9cc010](https://github.com/OpenCloning/OpenCloning_backend/commit/b9cc01024a9bcbfe33a657064f96cc0816052104))

## Changelog

All notable changes to this package will be documented in this file. For previous versions, see the [releases page](https://github.com/OpenCloning/OpenCloning_backend/releases), up to version 1.3.9.
