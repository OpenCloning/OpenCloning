# Changelog

## [2.1.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v2.0.1...opencloning-cli-v2.1.0) (2026-11-06)


### Features

* Bulk request sequences endpoint - by ids or tag ([#545](https://github.com/OpenCloning/OpenCloning_backend/issues/545)) ([a8d1f30](https://github.com/OpenCloning/OpenCloning_backend/commit/a8d1f303306468ccb0d9399e4bb67cd95e318d3c))

## [2.0.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v2.0.0...opencloning-cli-v2.0.1) (2026-10-19)


### Bug Fixes

* security fixes (email matching, safeguard OIDC test mode, size limit for files, async endpoints only when needed, database_id validation when posting cloning strategy) ([#538](https://github.com/OpenCloning/OpenCloning_backend/issues/538)) ([0681968](https://github.com/OpenCloning/OpenCloning_backend/commit/0681968aba1253fc618c33b6c2b505d8bb04f868))

## [2.0.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.10.0...opencloning-cli-v2.0.0) (2026-10-16)


### Miscellaneous Chores

* **opencloning-cli:** Synchronize backend-packages versions

## [1.10.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.9.6...opencloning-cli-v1.10.0) (2026-09-28)


### Features

* Use OICD for log in ([#524](https://github.com/OpenCloning/OpenCloning_backend/issues/524)) ([7a7d092](https://github.com/OpenCloning/OpenCloning_backend/commit/7a7d0927129f45d8ebdae3e2ca315a806594ae94))

## [1.9.6](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.9.5...opencloning-cli-v1.9.6) (2026-09-18)


### Miscellaneous Chores

* **opencloning-cli:** Synchronize backend-packages versions
* Add `no-control-socket` flag to gunicorn (for Docker)

## [1.9.5](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.9.4...opencloning-cli-v1.9.5) (2026-06-12)


### Miscellaneous Chores

* **opencloning-cli:** Synchronize backend-packages versions

## [1.9.4](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.9.3...opencloning-cli-v1.9.4) (2026-06-10)


### Miscellaneous Chores

* **opencloning-cli:** Synchronize backend-packages versions

## [1.9.3](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.9.2...opencloning-cli-v1.9.3) (2026-06-10)


### Miscellaneous Chores

* **opencloning-cli:** Synchronize backend-packages versions

## [1.9.2](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.9.1...opencloning-cli-v1.9.2) (2026-06-09)


### Miscellaneous Chores

* **opencloning-cli:** Synchronize backend-packages versions

## [1.9.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.9.0...opencloning-cli-v1.9.1) (2026-06-09)


### Miscellaneous Chores

* **opencloning-cli:** Synchronize backend-packages versions

## [1.9.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.8.1...opencloning-cli-v1.9.0) (2026-06-05)


### Features

* make uid unique case-insensitive ([#496](https://github.com/OpenCloning/OpenCloning_backend/issues/496)) ([9ad7675](https://github.com/OpenCloning/OpenCloning_backend/commit/9ad767500174c929845d607d612f8148d3b3388a))

## [1.8.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.8.0...opencloning-cli-v1.8.1) (2026-06-03)


### Bug Fixes

* improve cli speed ([#493](https://github.com/OpenCloning/OpenCloning_backend/issues/493)) ([1e093a7](https://github.com/OpenCloning/OpenCloning_backend/commit/1e093a7a56744b9e54d6185aac0a006a2646be15))

## [1.8.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.7.0...opencloning-cli-v1.8.0) (2026-06-02)


### Features

* drop S3 storage in favour of db storage of sequences and sequencing files ([#489](https://github.com/OpenCloning/OpenCloning_backend/issues/489)) ([87d4f32](https://github.com/OpenCloning/OpenCloning_backend/commit/87d4f329d7cd47f9433461e7772b1ce96a4bf1c0))

## [1.7.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.6.1...opencloning-cli-v1.7.0) (2026-06-01)


### Features

* add alembic + prevent repeated template sequence names ([#482](https://github.com/OpenCloning/OpenCloning_backend/issues/482)) ([204dbbd](https://github.com/OpenCloning/OpenCloning_backend/commit/204dbbdb0cb2703cb4127bb340ad90ee202debd1))

## [1.6.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.6.0...opencloning-cli-v1.6.1) (2026-05-22)


### Miscellaneous Chores

* **opencloning-cli:** Synchronize backend-packages versions

## [1.6.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.5.1...opencloning-cli-v1.6.0) (2026-05-22)


### Features

* improve database settings via env vars ([#473](https://github.com/OpenCloning/OpenCloning_backend/issues/473)) ([60e82cf](https://github.com/OpenCloning/OpenCloning_backend/commit/60e82cf7146d41861de90e8f79c26ee8810ead30))


### Bug Fixes

* add init db command ([#471](https://github.com/OpenCloning/OpenCloning_backend/issues/471)) ([064f342](https://github.com/OpenCloning/OpenCloning_backend/commit/064f342cf55765ef366b89b2aa3dde7456e362b3))
* Admin settings ([#477](https://github.com/OpenCloning/OpenCloning_backend/issues/477)) ([897cd37](https://github.com/OpenCloning/OpenCloning_backend/commit/897cd37475258b1451495b277d9f6ae0752ca773))

## [1.5.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.5.0...opencloning-cli-v1.5.1) (2026-05-20)


### Miscellaneous Chores

* **opencloning-cli:** Synchronize backend-packages versions

## [1.5.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.4.0...opencloning-cli-v1.5.0) (2026-05-20)


### Features

* Switch to s3 storage for sequences and sequencing files in opencloning-db ([#462](https://github.com/OpenCloning/OpenCloning_backend/issues/462)) ([b89d1ce](https://github.com/OpenCloning/OpenCloning_backend/commit/b89d1ce37c8c118e5c771a3ca2c8c7534f2ea50a))

## [1.4.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-cli-v1.3.9...opencloning-cli-v1.4.0) (2026-05-19)


### Miscellaneous Chores

* **opencloning-cli:** Synchronize backend-packages versions

## Changelog

All notable changes to this package will be documented in this file.
