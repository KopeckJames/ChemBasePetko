# Compound Upload Guide

This guide explains how to upload chemical compound data to the database system.

## Overview

The system supports uploading compound data from local JSON files. This is useful when you:

1. Have pre-processed chemical data
2. Want to batch import multiple compounds
3. Need to use your own custom compound data

## Prerequisites

1. Database connections properly set up (see DATABASE_SETUP.md)
2. Environment variables configured in `.env`
3. Compound data in JSON format

## JSON Format Options

The system supports two JSON formats:

### 1. PubChem PC_Compounds Format

This is a rich format that includes complete structure and property data from PubChem. Here's a simplified example (see `examples/aspirin.json` for a complete example):

```json
{
  "PC_Compounds": [
    {
      "id": { "id": { "cid": 2244 } },
      "props": [
        {
          "urn": { "label": "IUPAC Name" },
          "value": { "sval": "2-acetoxybenzoic acid" }
        },
        {
          "urn": { "label": "InChI" },
          "value": { "sval": "InChI=1S/C9H8O4/c1-6(10)13..." }
        }
      ]
    }
  ],
  "PC_Compounds_extras": {
    "CID": 2244,
    "name": "Aspirin",
    "molecular_formula": "C9H8O4",
    "iupac_name": "2-acetoxybenzoic acid",
    "molecular_weight": 180.159,
    "description": "Aspirin, also known as acetylsalicylic acid...",
    "synonyms": ["Aspirin", "Acetylsalicylic acid", "ASA"],
    "chemical_class": ["Aromatic compound", "Carboxylic acid"]
  }
}
```

### 2. Simple Direct Format

This is a simplified format that contains just the essential compound properties:

```json
{
  "cid": 2244,
  "name": "Aspirin",
  "iupacName": "2-acetoxybenzoic acid",
  "formula": "C9H8O4",
  "molecularWeight": 180.159,
  "synonyms": ["Aspirin", "Acetylsalicylic acid", "ASA"],
  "description": "Aspirin, also known as acetylsalicylic acid...",
  "chemicalClass": ["Aromatic compound", "Carboxylic acid"],
  "inchi": "InChI=1S/C9H8O4/c1-6(10)13...",
  "inchiKey": "BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
  "smiles": "CC(=O)OC1=CC=CC=C1C(=O)O",
  "properties": {
    "xlogp": 1.2,
    "complexity": 225
  }
}
```

> **Note:** Property names can be either camelCase (e.g., `iupacName`) or snake_case (e.g., `iupac_name`). The system handles both formats.

## Required Fields

The minimum required fields for a valid compound are:

- `cid` (Compound ID, integer)
- `name` (Compound name, string)

All other fields are optional but recommended for better search results.

## Using the Upload Script

To upload compounds, use the `upload-local-compounds.ts` script:

### Upload a Single File

```bash
npx tsx scripts/upload-local-compounds.ts --file /path/to/compound.json
```

### Upload All Files in a Directory

```bash
npx tsx scripts/upload-local-compounds.ts --directory /path/to/directory
```

### Test Upload with Example Compounds

```bash
./scripts/run-test-upload.sh
```

## Batch Processing

The upload script processes files in batches to avoid overwhelming the database. For large datasets, consider splitting your files into manageable directories.

## Troubleshooting

### Common Errors

1. **Invalid JSON format**:
   Ensure your JSON files are valid and follow one of the supported formats.

2. **Missing required fields**:
   Make sure each compound has at least a `cid` and `name`.

3. **Database connection issues**:
   Verify your database connections are working using `scripts/test-database-connections.ts`.

4. **Column not found errors**:
   Make sure your database schema matches the expected structure in `DATABASE_SETUP.md`.

## Example Files

The `examples/` directory contains sample compound files:

- `aspirin.json`: Example of a compound in PubChem PC_Compounds format
- `caffeine.json`: Another example compound

Study these examples to understand the expected format for your own data.