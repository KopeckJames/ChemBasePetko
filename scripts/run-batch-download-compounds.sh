#!/bin/bash
# Script to run the batch compound downloader

echo "Starting PubChem batch compound download..."
npx tsx scripts/batch-download-compounds.ts
