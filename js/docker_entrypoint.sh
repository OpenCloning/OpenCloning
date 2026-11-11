#!/bin/sh

# Create config.json with env vars
envsubst < config.env.json > config.json
npx http-server --port 3000
