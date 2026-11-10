# Changelog

## [2.1.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v2.0.1...opencloning-db-v2.1.0) (2026-11-06)


### Features

* Bulk request sequences endpoint - by ids or tag ([#545](https://github.com/OpenCloning/OpenCloning_backend/issues/545)) ([a8d1f30](https://github.com/OpenCloning/OpenCloning_backend/commit/a8d1f303306468ccb0d9399e4bb67cd95e318d3c))
* mcp server mvp ([#547](https://github.com/OpenCloning/OpenCloning_backend/issues/547)) ([364df10](https://github.com/OpenCloning/OpenCloning_backend/commit/364df107e3af4b159564603198a6639d02694028))

## [2.0.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v2.0.0...opencloning-db-v2.0.1) (2026-10-19)


### Bug Fixes

* security fixes (email matching, safeguard OIDC test mode, size limit for files, async endpoints only when needed, database_id validation when posting cloning strategy) ([#538](https://github.com/OpenCloning/OpenCloning_backend/issues/538)) ([0681968](https://github.com/OpenCloning/OpenCloning_backend/commit/0681968aba1253fc618c33b6c2b505d8bb04f868))

## [2.0.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.10.0...opencloning-db-v2.0.0) (2026-10-16)


### Features

* Changed to json login including request id and user id for observability ([#530](https://github.com/OpenCloning/OpenCloning_backend/issues/530)) ([5cdd615](https://github.com/OpenCloning/OpenCloning_backend/commit/5cdd61515dbe7a8d259b89468aaaac623f152032))


### Bug Fixes

* not return error stack in 401 response ([#536](https://github.com/OpenCloning/OpenCloning_backend/issues/536)) ([bfc6dc0](https://github.com/OpenCloning/OpenCloning_backend/commit/bfc6dc019fec582b1d8c09d6efd62a2fdf58c7c4))
* small fixes suggested by AI review of [#530](https://github.com/OpenCloning/OpenCloning_backend/issues/530) ([#534](https://github.com/OpenCloning/OpenCloning_backend/issues/534)) ([f998c88](https://github.com/OpenCloning/OpenCloning_backend/commit/f998c884ba63039fd22ef37d9733b8f824b916d5))
* support key rotation in oidc ([#535](https://github.com/OpenCloning/OpenCloning_backend/issues/535)) ([33a8805](https://github.com/OpenCloning/OpenCloning_backend/commit/33a88058b2ae5a5f74bb4cf2c2c05607b89af271))

## [1.10.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.9.6...opencloning-db-v1.10.0) (2026-09-28)


### Features

* Use OICD for log in ([#524](https://github.com/OpenCloning/OpenCloning_backend/issues/524)) ([7a7d092](https://github.com/OpenCloning/OpenCloning_backend/commit/7a7d0927129f45d8ebdae3e2ca315a806594ae94))

## [1.9.6](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.9.5...opencloning-db-v1.9.6) (2026-09-18)


### Miscellaneous Chores

* **opencloning-db:** Synchronize backend-packages versions

## [1.9.5](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.9.4...opencloning-db-v1.9.5) (2026-06-12)


### Miscellaneous Chores

* **opencloning-db:** Synchronize backend-packages versions

## [1.9.4](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.9.3...opencloning-db-v1.9.4) (2026-06-10)


### Bug Fixes

* trigger release [skip ci] ([#512](https://github.com/OpenCloning/OpenCloning_backend/issues/512)) ([9d88196](https://github.com/OpenCloning/OpenCloning_backend/commit/9d8819619d2eca9613caddfd231274050c58ba70))

## [1.9.3](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.9.2...opencloning-db-v1.9.3) (2026-06-10)


### Bug Fixes

* add workspace user admin accessible to owners ([#508](https://github.com/OpenCloning/OpenCloning_backend/issues/508)) ([7774141](https://github.com/OpenCloning/OpenCloning_backend/commit/7774141fe0a32878f603309cdd657673695f78b2))

## [1.9.2](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.9.1...opencloning-db-v1.9.2) (2026-06-09)


### Bug Fixes

* bulk export workspace + allow recursive export of cloning strategy via parameter ([#505](https://github.com/OpenCloning/OpenCloning_backend/issues/505)) ([500d8bf](https://github.com/OpenCloning/OpenCloning_backend/commit/500d8bf58a4b83466df8029d2745fa36c294ac5e))

## [1.9.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.9.0...opencloning-db-v1.9.1) (2026-06-09)


### Bug Fixes

* Bulk update SnapGene history ([#502](https://github.com/OpenCloning/OpenCloning_backend/issues/502)) ([c1b0154](https://github.com/OpenCloning/OpenCloning_backend/commit/c1b015462674c39ac55754f3faf01c205ca77529))
* rate-limit signup ([#503](https://github.com/OpenCloning/OpenCloning_backend/issues/503)) ([81ce061](https://github.com/OpenCloning/OpenCloning_backend/commit/81ce061c79b3de97aa76c8bf707dbd6af6143d24))
* use new parse_snapgene_history requiring no temp file ([#500](https://github.com/OpenCloning/OpenCloning_backend/issues/500)) ([752ec3e](https://github.com/OpenCloning/OpenCloning_backend/commit/752ec3eab75c6b39dc418d24e06bb08a4f5278dd))

## [1.9.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.8.1...opencloning-db-v1.9.0) (2026-06-05)


### Features

* make uid unique case-insensitive ([#496](https://github.com/OpenCloning/OpenCloning_backend/issues/496)) ([9ad7675](https://github.com/OpenCloning/OpenCloning_backend/commit/9ad767500174c929845d607d612f8148d3b3388a))


### Bug Fixes

* support bulk upload snapgene files as sequences ([#499](https://github.com/OpenCloning/OpenCloning_backend/issues/499)) ([a314a9c](https://github.com/OpenCloning/OpenCloning_backend/commit/a314a9c23fec467df8fe8cd1f68bb109a391ad4b))

## [1.8.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.8.0...opencloning-db-v1.8.1) (2026-06-03)


### Bug Fixes

* small bug in bulk submit + speed up db sync + update pydna ([#495](https://github.com/OpenCloning/OpenCloning_backend/issues/495)) ([17035ba](https://github.com/OpenCloning/OpenCloning_backend/commit/17035ba3ca8f6c9466e4e722d06d2a59f9a2e2e5))

## [1.8.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.7.0...opencloning-db-v1.8.0) (2026-06-02)


### Features

* drop S3 storage in favour of db storage of sequences and sequencing files ([#489](https://github.com/OpenCloning/OpenCloning_backend/issues/489)) ([87d4f32](https://github.com/OpenCloning/OpenCloning_backend/commit/87d4f329d7cd47f9433461e7772b1ce96a4bf1c0))


### Bug Fixes

* tag lines in bulk submit ([#492](https://github.com/OpenCloning/OpenCloning_backend/issues/492)) ([d5fea00](https://github.com/OpenCloning/OpenCloning_backend/commit/d5fea004d09218058a416222aa9ee894d042ad07))

## [1.7.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.6.1...opencloning-db-v1.7.0) (2026-06-01)


### Features

* add alembic + prevent repeated template sequence names ([#482](https://github.com/OpenCloning/OpenCloning_backend/issues/482)) ([204dbbd](https://github.com/OpenCloning/OpenCloning_backend/commit/204dbbdb0cb2703cb4127bb340ad90ee202debd1))
* allow tagging when bulk-submitting ([#484](https://github.com/OpenCloning/OpenCloning_backend/issues/484)) ([18d904c](https://github.com/OpenCloning/OpenCloning_backend/commit/18d904c516bf31fdd58e4a2ebe24b132bef9e6f6))


### Bug Fixes

* Bulk submit cloning strategies ([#488](https://github.com/OpenCloning/OpenCloning_backend/issues/488)) ([a97142e](https://github.com/OpenCloning/OpenCloning_backend/commit/a97142e2949a95bec60707b62a5e850d15fcf33d))
* bulk submit lines ([#486](https://github.com/OpenCloning/OpenCloning_backend/issues/486)) ([391e124](https://github.com/OpenCloning/OpenCloning_backend/commit/391e124ff4a05bd3b1d7fdc7e194a835e532dab1))
* bulk submit sequences + allow longer names ([#485](https://github.com/OpenCloning/OpenCloning_backend/issues/485)) ([1eee48d](https://github.com/OpenCloning/OpenCloning_backend/commit/1eee48d58acaac285a7d4563181ddddbfa11e177))

## [1.6.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.6.0...opencloning-db-v1.6.1) (2026-05-22)


### Miscellaneous Chores

* **opencloning-db:** Synchronize backend-packages versions

## [1.6.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.5.1...opencloning-db-v1.6.0) (2026-05-22)


### Features

* improve database settings via env vars ([#473](https://github.com/OpenCloning/OpenCloning_backend/issues/473)) ([60e82cf](https://github.com/OpenCloning/OpenCloning_backend/commit/60e82cf7146d41861de90e8f79c26ee8810ead30))


### Bug Fixes

* add init db command ([#471](https://github.com/OpenCloning/OpenCloning_backend/issues/471)) ([064f342](https://github.com/OpenCloning/OpenCloning_backend/commit/064f342cf55765ef366b89b2aa3dde7456e362b3))
* Admin settings ([#477](https://github.com/OpenCloning/OpenCloning_backend/issues/477)) ([897cd37](https://github.com/OpenCloning/OpenCloning_backend/commit/897cd37475258b1451495b277d9f6ae0752ca773))
* allow disable rate limit for frontend testing ([#479](https://github.com/OpenCloning/OpenCloning_backend/issues/479)) ([c0c7200](https://github.com/OpenCloning/OpenCloning_backend/commit/c0c720093747397715a2291e734711e73b28e5b7))
* Rate limit login ([#476](https://github.com/OpenCloning/OpenCloning_backend/issues/476)) ([1ad53d9](https://github.com/OpenCloning/OpenCloning_backend/commit/1ad53d939b7a5ac38c1f08ea3b1adff0afbcd6fe))
* Switched to single env var for db settings ([#478](https://github.com/OpenCloning/OpenCloning_backend/issues/478)) ([250540a](https://github.com/OpenCloning/OpenCloning_backend/commit/250540a1079e0749d4a7bca7046ec908268411cc))

## [1.5.1](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.5.0...opencloning-db-v1.5.1) (2026-05-20)


### Miscellaneous Chores

* **opencloning-db:** Synchronize backend-packages versions

## [1.5.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.4.0...opencloning-db-v1.5.0) (2026-05-20)


### Features

* require auth for cloning in combined app ([#465](https://github.com/OpenCloning/OpenCloning_backend/issues/465)) ([f1684a5](https://github.com/OpenCloning/OpenCloning_backend/commit/f1684a5815f349ef179b68a593acaf0d9a368a03))
* Switch to s3 storage for sequences and sequencing files in opencloning-db ([#462](https://github.com/OpenCloning/OpenCloning_backend/issues/462)) ([b89d1ce](https://github.com/OpenCloning/OpenCloning_backend/commit/b89d1ce37c8c118e5c771a3ca2c8c7534f2ea50a))

## [1.4.0](https://github.com/OpenCloning/OpenCloning_backend/compare/opencloning-db-v1.3.9...opencloning-db-v1.4.0) (2026-05-19)


### Features

* change opencloning-db docker-compose to mount file-storage ([#459](https://github.com/OpenCloning/OpenCloning_backend/issues/459)) ([e8653fd](https://github.com/OpenCloning/OpenCloning_backend/commit/e8653fd2c143018c1c232986a5258b2e38f811bc))
* use multiple workers in prod with gunicorn ([#461](https://github.com/OpenCloning/OpenCloning_backend/issues/461)) ([b9cc010](https://github.com/OpenCloning/OpenCloning_backend/commit/b9cc01024a9bcbfe33a657064f96cc0816052104))

## Changelog

All notable changes to this package will be documented in this file.
