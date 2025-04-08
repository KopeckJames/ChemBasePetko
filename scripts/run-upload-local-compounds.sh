#!/bin/bash

# Script to upload local compound data to the database

# Check if input path is provided
if [ $# -lt 1 ]; then
  echo "Usage: $0 <path_to_local_compound_data>"
  echo "Example: $0 ./my_compounds"
  echo "Example: $0 ./my_compounds/compound1.json"
  exit 1
fi

INPUT_PATH="$1"

# Check if the input path exists
if [ ! -e "$INPUT_PATH" ]; then
  echo "Error: The specified path does not exist: $INPUT_PATH"
  exit 1
fi

# Run the TypeScript script with the provided path
echo "Starting upload of compound data from: $INPUT_PATH"
npx tsx scripts/upload-local-compounds.ts "$INPUT_PATH"
