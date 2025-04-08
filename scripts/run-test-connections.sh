#!/bin/bash

# Script to test database connections for ChemSearch

set -e  # Exit on error

# Determine script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Run database connection test
echo "Testing database connections..."
cd "$ROOT_DIR"
npx tsx scripts/test-database-connections.ts

# If we reach here, the test was successful (script exits on error otherwise)
echo "Database connections successful!"