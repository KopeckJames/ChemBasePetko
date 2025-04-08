import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { parse } from 'node:path';
import { Compound, InsertCompound } from '../shared/schema';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Weaviate client
let weaviateClient: WeaviateClient;
async function getWeaviateClient(): Promise<WeaviateClient> {
  if (weaviateClient) return weaviateClient;

  const scheme = process.env.WEAVIATE_SCHEME || 'https';
  let host = process.env.WEAVIATE_URL || '';
  const apiKey = process.env.WEAVIATE_API_KEY;

  if (!host) {
    throw new Error('WEAVIATE_URL environment variable is required');
  }

  // Remove scheme prefix if present in the URL
  if (host.startsWith('http://') || host.startsWith('https://')) {
    host = host.replace(/^https?:\/\//, '');
    console.log(`Extracted host from URL: ${host}`);
  }

  console.log(`Connecting to Weaviate at ${scheme}://${host}`);

  const clientConfig: any = {
    scheme,
    host,
  };

  if (apiKey) {
    clientConfig.apiKey = new weaviate.ApiKey(apiKey);
  }

  // Optional: OpenAI API key for vectorization
  if (process.env.OPENAI_API_KEY) {
    clientConfig.headers = {
      'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY
    };
  }

  weaviateClient = weaviate.client(clientConfig);
  return weaviateClient;
}

// Check if the schema exists in Weaviate, and create it if it doesn't
async function ensureWeaviateSchema(): Promise<void> {
  const client = await getWeaviateClient();
  
  try {
    // Check if Compound class exists
    await client.schema.classGetter().withClassName('Compound').do();
    console.log('Weaviate schema already exists');
  } catch (error) {
    console.log('Creating Weaviate schema...');
    
    // Create the schema
    const classObj = {
      class: 'Compound',
      description: 'Chemical compound from PubChem',
      properties: [
        {
          name: 'cid',
          dataType: ['int'],
          description: 'PubChem Compound ID'
        },
        {
          name: 'name',
          dataType: ['text'],
          description: 'Primary name of the compound'
        },
        {
          name: 'iupacName',
          dataType: ['text'],
          description: 'IUPAC name of the compound'
        },
        {
          name: 'formula',
          dataType: ['text'],
          description: 'Chemical formula'
        },
        {
          name: 'molecularWeight',
          dataType: ['number'],
          description: 'Molecular weight in g/mol'
        },
        {
          name: 'synonyms',
          dataType: ['text[]'],
          description: 'Alternative names for the compound'
        },
        {
          name: 'description',
          dataType: ['text'],
          description: 'Textual description of the compound'
        },
        {
          name: 'chemicalClass',
          dataType: ['text[]'],
          description: 'Chemical classification terms'
        },
        {
          name: 'inchi',
          dataType: ['text'],
          description: 'InChI identifier'
        },
        {
          name: 'inchiKey',
          dataType: ['text'],
          description: 'InChI key'
        },
        {
          name: 'smiles',
          dataType: ['text'],
          description: 'SMILES notation'
        },
        {
          name: 'imageUrl',
          dataType: ['text'],
          description: 'URL to compound structure image'
        }
      ],
      vectorizer: 'text2vec-openai',
      moduleConfig: {
        'text2vec-openai': {
          model: 'ada',
          modelVersion: '002',
          type: 'text'
        }
      }
    };
    
    await client.schema.classCreator().withClass(classObj).do();
    console.log('Weaviate schema created successfully');
  }
}

// Ensure Supabase tables exist
async function ensureSupabaseTables(): Promise<void> {
  // Check if compounds table exists
  try {
    const { error } = await supabase
      .from('compounds')
      .select('id')
      .limit(1);
    
    if (error && error.code === 'PGRST104') {
      // Table doesn't exist
      console.log('Creating compounds table...');
      
      // Create the table using execute SQL
      const { error: sqlError } = await supabase.rpc('create_compounds_table', {});
      
      if (sqlError) {
        console.error('Could not create table using RPC, trying direct SQL');
        // Using direct SQL doesn't directly work with Supabase JavaScript client
        // We'll need to use REST API instead
        console.log('Please create the table manually using the SQL script: scripts/supabase-setup.sql');
        
        throw new Error('Could not create compounds table');
      }
    } else {
      console.log('Compounds table already exists');
    }
  } catch (error) {
    console.error('Error checking compounds table:', error);
    console.log('Creating compounds table...');
    
    // Use the SQL script provided
    console.log('Please run the SQL script in scripts/supabase-setup.sql to create the tables manually');
    throw new Error('Could not create database tables. Use the SQL script instead.');
  }
}

// Insert a compound into Supabase
async function insertCompoundToSupabase(compound: InsertCompound): Promise<boolean> {
  // Check if compound already exists
  const { data: existingCompound } = await supabase
    .from('compounds')
    .select('id')
    .eq('cid', compound.cid)
    .maybeSingle();
  
  if (existingCompound) {
    console.log(`Compound with CID ${compound.cid} already exists in Supabase, skipping`);
    return false;
  }
  
  // Convert from camelCase to snake_case for database insertion
  const dbCompound = {
    cid: compound.cid,
    name: compound.name,
    iupac_name: compound.iupacName,
    formula: compound.formula,
    molecular_weight: compound.molecularWeight,
    synonyms: compound.synonyms,
    description: compound.description,
    chemical_class: compound.chemicalClass,
    inchi: compound.inchi,
    inchi_key: compound.inchiKey,
    smiles: compound.smiles,
    image_url: compound.imageUrl,
    properties: compound.properties
  };
  
  // Insert compound
  const { data, error } = await supabase
    .from('compounds')
    .insert([dbCompound])
    .select()
    .single();
  
  if (error) {
    console.error(`Error inserting compound with CID ${compound.cid}:`, error);
    return false;
  }
  
  console.log(`Inserted compound with CID ${compound.cid} into Supabase`);
  return true;
}

// Insert a compound into Weaviate
async function insertCompoundToWeaviate(compound: Compound): Promise<boolean> {
  try {
    const client = await getWeaviateClient();
    
    // Check if compound already exists
    const existingResult = await client.graphql
      .get()
      .withClassName('Compound')
      .withFields('cid')
      .withWhere({
        path: ['cid'],
        operator: 'Equal',
        valueNumber: compound.cid
      })
      .withLimit(1)
      .do();
    
    if (existingResult?.data?.Get?.Compound?.length > 0) {
      console.log(`Compound with CID ${compound.cid} already exists in Weaviate, skipping`);
      return false;
    }
    
    // Format compound for Weaviate
    const weaviateCompound = {
      cid: compound.cid,
      name: compound.name,
      iupacName: compound.iupacName,
      formula: compound.formula,
      molecularWeight: compound.molecularWeight,
      synonyms: compound.synonyms,
      description: compound.description,
      chemicalClass: compound.chemicalClass,
      inchi: compound.inchi,
      inchiKey: compound.inchiKey,
      smiles: compound.smiles,
      imageUrl: compound.imageUrl || `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${compound.cid}&width=300&height=300`
    };
    
    // Add to Weaviate
    await client.data
      .creator()
      .withClassName('Compound')
      .withProperties(weaviateCompound)
      .do();
    
    console.log(`Inserted compound with CID ${compound.cid} into Weaviate`);
    return true;
  } catch (error) {
    console.error(`Error inserting compound with CID ${compound.cid} into Weaviate:`, error);
    return false;
  }
}

// Process a single compound file
async function processCompoundFile(filePath: string): Promise<boolean> {
  try {
    console.log(`Processing file: ${filePath}`);
    
    // Read and parse the JSON file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const compoundData = JSON.parse(fileContent);
    
    // Process PubChem format if present
    let processedCompound: InsertCompound;
    
    // If it's in PC_Compounds format (from our examples)
    if (compoundData.PC_Compounds && compoundData.PC_Compounds_extras) {
      const extras = compoundData.PC_Compounds_extras;
      
      processedCompound = {
        cid: Number(extras.CID),
        name: extras.name,
        iupacName: extras.iupac_name,
        formula: extras.molecular_formula,
        molecularWeight: extras.molecular_weight,
        synonyms: extras.synonyms || [],
        description: extras.description,
        chemicalClass: extras.chemical_class || [],
        inchi: compoundData.PC_Compounds[0]?.props?.find((p: any) => p.urn?.label === 'InChI')?.value?.sval,
        inchiKey: compoundData.PC_Compounds[0]?.props?.find((p: any) => p.urn?.label === 'InChIKey')?.value?.sval,
        smiles: extras.canonical_smiles,
        imageUrl: `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${extras.CID}&width=300&height=300`,
        properties: {
          complexity: extras.complexity,
          xlogp: extras.xlogp,
          hydrogen_bond_donor_count: extras.hydrogen_bond_donor_count,
          hydrogen_bond_acceptor_count: extras.hydrogen_bond_acceptor_count,
          rotatable_bond_count: extras.rotatable_bond_count,
          topological_polar_surface_area: extras.topological_polar_surface_area,
          exact_mass: extras.exact_mass,
          monoisotopic_mass: extras.monoisotopic_mass,
          charge: extras.charge
        },
      };
    } else {
      // Direct format
      processedCompound = {
        cid: Number(compoundData.cid),
        name: compoundData.name,
        iupacName: compoundData.iupacName || compoundData.iupac_name,
        formula: compoundData.formula,
        molecularWeight: compoundData.molecularWeight || compoundData.molecular_weight,
        synonyms: compoundData.synonyms || [],
        description: compoundData.description,
        chemicalClass: compoundData.chemicalClass || compoundData.chemical_class || [],
        inchi: compoundData.inchi,
        inchiKey: compoundData.inchiKey || compoundData.inchi_key,
        smiles: compoundData.smiles,
        imageUrl: compoundData.imageUrl || compoundData.image_url || `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${compoundData.cid}&width=300&height=300`,
        properties: compoundData.properties || {},
      };
    }
    
    // Insert into Supabase
    const supabaseResult = await insertCompoundToSupabase(processedCompound);
    
    if (supabaseResult) {
      // If successfully inserted into Supabase, get the full compound and insert into Weaviate
      const { data: compound } = await supabase
        .from('compounds')
        .select('*')
        .eq('cid', processedCompound.cid)
        .single();
      
      if (compound) {
        // Convert snake_case from Supabase to camelCase for Weaviate
        // Creating a properly typed object to pass to Weaviate
        const weaviateCompound: Compound = {
          id: compound.id,
          cid: compound.cid,
          name: compound.name,
          iupacName: compound.iupac_name,
          formula: compound.formula,
          molecularWeight: compound.molecular_weight,
          synonyms: compound.synonyms || [],
          description: compound.description,
          chemicalClass: compound.chemical_class || [],
          inchi: compound.inchi,
          inchiKey: compound.inchi_key,
          smiles: compound.smiles,
          imageUrl: compound.image_url,
          properties: compound.properties || {},
          isProcessed: compound.is_processed
        };
        
        await insertCompoundToWeaviate(weaviateCompound);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return false;
  }
}

// Process a batch of compound files
async function processBatch(filePaths: string[]): Promise<void> {
  console.log(`Processing batch of ${filePaths.length} files`);
  
  // Process files in batches of 10 to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize);
    await Promise.all(batch.map(filePath => processCompoundFile(filePath)));
    console.log(`Processed ${Math.min(i + batchSize, filePaths.length)} of ${filePaths.length} files`);
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  let inputPath = '';
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--directory' || args[i] === '-d') {
      if (i + 1 < args.length) {
        inputPath = args[i + 1];
        i++; // Skip the next argument since we used it
      }
    } else if (args[i] === '--file' || args[i] === '-f') {
      if (i + 1 < args.length) {
        inputPath = args[i + 1];
        i++; // Skip the next argument since we used it
      }
    } else if (!inputPath && !args[i].startsWith('-')) {
      // If we haven't set inputPath yet and this isn't a flag, use it as the input path
      inputPath = args[i];
    }
  }
  
  if (!inputPath) {
    console.error('Usage: npx tsx scripts/upload-local-compounds.ts [--directory/-d path] [--file/-f path]');
    process.exit(1);
  }
  
  // Check if environment variables are set
  if (!supabaseUrl || !supabaseKey) {
    console.error('SUPABASE_URL and SUPABASE_KEY environment variables must be set');
    process.exit(1);
  }
  
  try {
    // Ensure database tables and schema exist
    await ensureSupabaseTables();
    await ensureWeaviateSchema();
    
    // Process input path
    const stats = fs.statSync(inputPath);
    
    if (stats.isFile()) {
      // Process single file
      if (inputPath.toLowerCase().endsWith('.json')) {
        await processCompoundFile(inputPath);
      } else {
        console.error('Only JSON files are supported');
      }
    } else if (stats.isDirectory()) {
      // Process directory
      console.log(`Reading compounds from directory: ${inputPath}`);
      
      // Get all JSON files in the directory
      const files = fs.readdirSync(inputPath)
        .filter(file => file.toLowerCase().endsWith('.json'))
        .map(file => path.join(inputPath, file));
      
      console.log(`Found ${files.length} JSON files`);
      
      if (files.length > 0) {
        await processBatch(files);
      } else {
        console.log('No JSON files found in the directory');
      }
    } else {
      console.error('Input path is neither a file nor a directory');
    }
    
    console.log('Upload completed successfully');
  } catch (error) {
    console.error('Error during upload process:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});