# Guide to Uploading Local Chemical Compound Data

This guide explains how to upload your local chemical compound data to the ChemSearch database system.

## Prerequisites

Before you begin, make sure you have:

1. Set up your environment variables in the `.env` file:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   WEAVIATE_URL=your_weaviate_url
   WEAVIATE_API_KEY=your_weaviate_api_key
   WEAVIATE_SCHEME=https
   OPENAI_API_KEY=your_openai_api_key (optional, for better vector search)
   ```

2. Prepared your chemical compound data files in JSON format. The files should follow one of these structures:

   **Option 1: PubChem JSON format**
   Files from the PubChem API or PubChem download service.

   **Option 2: Simplified JSON format**
   ```json
   {
     "cid": 2244,
     "name": "Aspirin",
     "iupac_name": "2-acetoxybenzoic acid",
     "formula": "C9H8O4",
     "molecular_weight": 180.16,
     "synonyms": ["Acetylsalicylic acid", "ASA"],
     "description": "Analgesic and antipyretic drug",
     "chemical_class": ["Benzoic acids", "Carboxylic acids"],
     "inchi": "InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)",
     "inchi_key": "BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
     "smiles": "CC(=O)OC1=CC=CC=C1C(=O)O"
   }
   ```

## How to Use the Upload Script

### Step 1: Organize Your Data Files

Place your compound JSON files in a directory on your local machine. You can either:
- Put all files in a single directory
- Keep individual files in various locations

### Step 2: Run the Upload Script

Use the provided shell script to upload your data:

```bash
./scripts/run-upload-local-compounds.sh /path/to/your/data
```

### Examples:

Upload a single file:
```bash
./scripts/run-upload-local-compounds.sh /path/to/aspirin.json
```

Upload all JSON files in a directory:
```bash
./scripts/run-upload-local-compounds.sh /path/to/compound_directory
```

## What the Script Does

1. Checks if the Supabase and Weaviate databases are configured properly
2. Creates necessary database tables and schemas if they don't exist
3. Reads and processes each compound file
4. Uploads each compound to both Supabase and Weaviate
5. Handles duplicates by skipping compounds that already exist
6. Processes files in batches to avoid overwhelming the databases

## Troubleshooting

If you encounter errors:

1. **Database connection issues**: Check your environment variables and ensure your database services are running
2. **Invalid JSON files**: Verify your files are valid JSON and follow the expected format
3. **Permission issues**: Make sure the script is executable (`chmod +x scripts/run-upload-local-compounds.sh`)
4. **Rate limiting**: If uploading large numbers of compounds, the script may be affected by API rate limits

## Notes

- The upload process will skip compounds that already exist in the database (based on CID)
- Large datasets may take time to process - be patient
- The script logs progress to the console so you can monitor the upload process
