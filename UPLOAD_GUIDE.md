# Chemical Compound Upload Guide

This guide explains how to upload your own chemical compound data to the Chemical Vector Database.

## Supported File Formats

The uploader currently supports compound data in JSON format with the following structures:

1. PubChem JSON format (PC_Compounds or Record format)
2. Custom JSON format matching our compound schema

## File Preparation

### Option 1: PubChem Data

If you have data from PubChem, it should already be in a compatible format. You can download compound data from PubChem in JSON format:

1. Visit [PubChem](https://pubchem.ncbi.nlm.nih.gov/)
2. Search for compounds of interest
3. Download the compound data in JSON format

### Option 2: Custom JSON Format

If you're preparing your own data, create JSON files that match the following structure:

```json
{
  "cid": 123456,  // Unique compound identifier
  "name": "Compound Name",
  "iupacName": "IUPAC Systematic Name",
  "formula": "C6H12O6",  // Molecular formula
  "inchiKey": "ABCDEFGHIJKLMNOP-ABCDEFGHIJ-N",  // InChI Key
  "canonicalSmiles": "C1C(C(C(C(C1O)O)O)O)O",  // SMILES representation
  "molecularWeight": 180.156,  // Molecular weight in g/mol
  "xlogp": -2.8,  // XLogP value
  "rotatable_bond_count": 5,  // Number of rotatable bonds
  "h_bond_donor_count": 5,  // Number of hydrogen bond donors
  "h_bond_acceptor_count": 6,  // Number of hydrogen bond acceptors
  "chemical_class": "Carbohydrates",  // Chemical class/category
  "complexity": 232,  // Complexity score
  "description": "Description of the compound and its properties",
  "pharmacology": "Information about pharmacological properties",
  "image_url": "https://example.com/compound.png"  // Optional image URL
}
```

> **Note**: Not all fields are required. The system will handle missing data appropriately.

## Uploading Compounds

### Using the Command Line Script

1. Place your JSON files in a directory (e.g., `./my-compounds`)

2. Run the upload script:

```bash
npx tsx scripts/upload-local-compounds.ts ./my-compounds
```

3. The script will:
   - Process each JSON file in the directory
   - Validate and transform the data
   - Upload compounds to both Supabase and Weaviate
   - Report on success/failure for each compound

### Batch Processing

For large datasets, the system handles batch processing automatically:

- Files are processed in parallel for efficiency
- Progress tracking helps monitor large uploads
- Error handling allows skipping problematic files without failing the entire batch

## Data Transformation

During upload, the system performs several transformations:

1. Data validation against the compound schema
2. Property name normalization (camelCase to snake_case for database storage)
3. Missing field handling with appropriate defaults
4. Vector embedding generation for semantic search
5. Duplicate detection to prevent reimporting the same compound

## Troubleshooting

### Common Upload Issues

1. **Invalid JSON Format**
   - Ensure your JSON files are valid (use a JSON validator if necessary)
   - Each file should contain a single compound object or an array of compound objects

2. **Missing Required Fields**
   - At minimum, each compound should have a unique identifier (CID)
   - Other fields will be filled with defaults if possible

3. **Database Connection Issues**
   - Verify that your database connections are working
   - Run `./scripts/test-database-connections.ts` to verify connectivity

## Advanced Usage

### Programmatic Upload

You can also upload compounds programmatically by importing the database functions:

```typescript
import { processCompoundData } from '../server/db/processData';
import { createCompound } from '../server/db/supabase';
import { addCompound } from '../server/db/weaviate';

async function uploadCompound(compoundData: any) {
  // Process and validate the compound data
  const processedCompound = await processCompoundData(compoundData);
  
  // Upload to Supabase
  const compound = await createCompound(processedCompound);
  
  // Upload to Weaviate
  await addCompound(compound);
  
  return compound;
}
```

### Custom Data Processing

If you need to process data in a custom format, you can extend the `processCompoundData` function in `server/db/processData.ts` to handle your specific format.
