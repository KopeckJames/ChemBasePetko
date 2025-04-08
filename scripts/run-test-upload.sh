#!/bin/bash

# Simple script to test the upload functionality with example compounds
# This is useful for quickly verifying that the upload system works

echo "Testing upload functionality with example compounds..."

# Find the examples directory
EXAMPLES_DIR="examples"

if [ ! -d "$EXAMPLES_DIR" ]; then
  echo "❌ Error: Examples directory not found. Please make sure you're running this from the project root."
  exit 1
fi

echo "Using examples directory: $(pwd)/$EXAMPLES_DIR"

# Process each example file
for FILE in "$EXAMPLES_DIR"/*.json; do
  FILENAME=$(basename "$FILE")
  
  echo "Uploading file: $FILENAME"
  npx tsx scripts/upload-local-compounds.ts --file "$FILE"
  
  echo "------------------------------------"
done

echo "Test upload complete!"