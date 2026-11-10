# Dockerfile
FROM postgres:18-alpine3.22
RUN apk add --no-cache curl aws-cli
