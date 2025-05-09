#!/bin/bash
set -e

# This script runs inside the wab-backend container on start

# Fix corepack permission issues
mkdir -p /app/.cache/node/corepack/v1
export HOME=/app
export COREPACK_HOME=/app/.cache/node/corepack/v1
echo "Fixed corepack permissions, using $HOME/.cache for corepack"

# Wait for database to be ready (optional but recommended)
# Example: using pg_isready (requires postgresql-client in the image)
# Adjust host/port/user based on provided env vars
# Loops 5 times with a 3-second delay
echo "Waiting for database connection..."
retries=5
until pg_isready -h "${POSTGRES_HOST:-db}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-wab}" -d "${POSTGRES_DATABASE:-wab}" -t 1 || [ $retries -eq 0 ]; do
  echo "Waiting for database connection... $((retries--)) remaining attempts..."
  sleep 3
done

if ! pg_isready -h "${POSTGRES_HOST:-db}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-wab}" -d "${POSTGRES_DATABASE:-wab}" -q; then
  echo "Database connection failed after multiple attempts. Exiting."
  exit 1
fi

echo "Database connected."

# Navigate to the correct directory
cd /app/platform/wab

# Run DB setup commands using environment variables
# Use PGPASSWORD for psql, DATABASE_URI should be picked up by yarn scripts if available
echo "Creating extensions..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h "${POSTGRES_HOST:-db}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-wab}" -d "${POSTGRES_DATABASE:-wab}" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' || echo "UUID extension already exists or psql command failed."

echo "Running migrations..."
yarn typeorm migration:run

echo "Seeding database..."
yarn seed

echo "Updating plume package..."
yarn plume:dev update

echo "Database setup complete. Starting backend server..."

# Execute the original CMD
exec bash tools/backend-server.bash 