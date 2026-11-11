docker pull manulera/opencloningbackend:prod
docker pull manulera/opencloningfrontend:prod-baseurl-opencloning
docker build --build-arg BACKEND_TAG=prod --build-arg FRONTEND_TAG=prod-baseurl-opencloning -t manulera/opencloning:local .
