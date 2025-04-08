#!/bin/bash

# Script to upload compound data files to the ChemSearch database
# Usage: ./run-upload-compounds.sh [path_to_directory] [--test]

set -e  # Exit on error

# Determine script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Default directory to examples if not provided
DATA_DIR=""
USE_TEST_DATA=false

# Parse arguments
for arg in "$@"; do
  if [ "$arg" = "--test" ]; then
    USE_TEST_DATA=true
  elif [ -d "$arg" ]; then
    DATA_DIR="$arg"
  fi
done

# If --test is specified, use the examples directory
if [ "$USE_TEST_DATA" = true ]; then
  DATA_DIR="${ROOT_DIR}/examples"
  echo "Using test data from: $DATA_DIR"
fi

# Check if directory is provided or valid
if [ -z "$DATA_DIR" ]; then
  echo "Error: No directory specified."
  echo "Usage: $0 [path_to_directory] [--test]"
  echo "  --test    Use example compounds from examples directory"
  exit 1
fi

if [ ! -d "$DATA_DIR" ]; then
  echo "Error: Directory '$DATA_DIR' does not exist."
  exit 1
fi

# Count JSON files
JSON_FILES=$(find "$DATA_DIR" -name "*.json" | wc -l)
if [ "$JSON_FILES" -eq 0 ]; then
  echo "Error: No JSON files found in directory: $DATA_DIR"
  echo "Compound data files must be in JSON format."
  exit 1
fi

echo "Found $JSON_FILES JSON files in $DATA_DIR"

# Run the upload script
echo "Starting upload process..."
cd "$ROOT_DIR"
npx tsx scripts/upload-local-compounds.ts --directory "$DATA_DIR"

echo "Upload process complete."
