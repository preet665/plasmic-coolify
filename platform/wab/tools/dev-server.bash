#!/usr/bin/env bash

cmd=${1:-dev}
port=${PORT:-3003}

if [[ $REACT_APP_DEV_HOST_PROXY ]]; then
  HOST_URL=${REACT_APP_DEV_HOST_PROXY}/static/host.html
elif [[ $REACT_APP_DEV_PROXY ]]; then
  HOST_URL=https://host.plasmicdev.com/static/host.html
else
  HOST_URL=http://157.90.224.29:${HOSTSERVER_PORT:-3005}/static/host.html
fi

# Determine the correct public URL
# Use REACT_APP_DEV_PROXY if set, otherwise use the server's IP and port
if [[ $REACT_APP_DEV_PROXY ]]; then
  FINAL_PUBLIC_URL=$REACT_APP_DEV_PROXY
else
  # Explicitly use the server's IP and port with HTTP
  FINAL_PUBLIC_URL=http://157.90.224.29:$port
fi

# === Add Logging Here ===
echo "[dev-server.bash] port=$port"
echo "[dev-server.bash] HOST_URL=$HOST_URL"
echo "[dev-server.bash] FINAL_PUBLIC_URL=$FINAL_PUBLIC_URL"

REACT_APP_DEFAULT_HOST_URL=${HOST_URL} \
  REACT_APP_PUBLIC_URL=${FINAL_PUBLIC_URL} \
  PUBLIC_URL=${FINAL_PUBLIC_URL} \
  PORT=$port \
  NODE_OPTIONS="--max-old-space-size=16384" \
  yarn rsbuild $cmd
