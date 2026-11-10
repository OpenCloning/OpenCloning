

```bash
docker-compose up -d
docker exec elabftw bin/init db:install
docker exec -it elabftw bin/console db:update
```

If you want to be able to interact with the application via the dev server of the frontend:

* Set the right env vars in the frontend repository
* In the docker yaml:
```
- ALLOW_ORIGIN=*
- ALLOW_METHODS=GET, POST, PATCH, DELETE
- ALLOW_HEADERS=Content-Type, Authorization, Location
```
