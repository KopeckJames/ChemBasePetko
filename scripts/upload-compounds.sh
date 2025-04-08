#!/bin/bash

# Script to upload local compound data to the database

# Default directory to look for compound files
DEFAULT_DIR="./examples"

# Display help information
function show_help {
  echo "ChemSearch Compound Upload Utility"
  echo "=================================="
  echo ""
  echo "This script uploads chemical compound data from local JSON files to the ChemSearch database."
  echo ""
  echo "Usage:"
  echo "  $0 [options] [path]"
  echo ""
  echo "Options:"
  echo "  -h, --help     Show this help message"
  echo "  -t, --test     Test with example compounds in the ./examples directory"
  echo ""
  echo "Arguments:"
  echo "  path           Path to a JSON file or directory containing JSON files"
  echo "                 If not provided, defaults to ./examples directory"
  echo ""
  echo "Examples:"
  echo "  $0 ./my_compounds          # Upload all JSON files in the my_compounds directory"
  echo "  $0 ./my_compounds/aspirin.json  # Upload a single compound file"
  echo "  $0 --test                  # Upload example compounds from ./examples"
  echo ""
  echo "See UPLOAD_GUIDE.md for more detailed information."
}

# Process command line arguments
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  show_help
  exit 0
fi

# Test mode uses example compounds
if [[ "$1" == "-t" || "$1" == "--test" ]]; then
  INPUT_PATH="$DEFAULT_DIR"
  echo "Using example compounds from $INPUT_PATH"
else
  # Use the provided path or default to examples directory
  INPUT_PATH="${1:-$DEFAULT_DIR}"
fi

# Check if the input path exists
if [ ! -e "$INPUT_PATH" ]; then
  echo "Error: The specified path does not exist: $INPUT_PATH"
  echo "Run '$0 --help' for usage information."
  exit 1
fi

# Check if required environment variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "Warning: SUPABASE_URL and/or SUPABASE_KEY environment variables are not set."
  echo "Make sure your .env file contains these variables or export them before running this script."
  echo ""
  echo "For example:"
  echo "export SUPABASE_URL=your_supabase_url"
  echo "export SUPABASE_KEY=your_supabase_key"
  echo ""
fi

# Run the TypeScript script with the provided path
echo "Starting upload of compound data from: $INPUT_PATH"
npx tsx scripts/upload-local-compounds.ts "$INPUT_PATH"
