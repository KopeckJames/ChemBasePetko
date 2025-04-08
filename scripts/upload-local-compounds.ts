import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { parse } from 'node:path';
import { Compound, InsertCompound } from '../shared/schema';
import { processCompoundData } from '../server/db/processData';
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
  const host = process.env.WEAVIATE_URL || '';
  const apiKey = process.env.WEAVIATE_API_KEY;

  if (!host) {
    throw new Error('WEAVIATE_URL environment variable is required');
  }

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
  const { data: tables, error } = await supabase
    .from('pg_tables')
    .select('tablename')
    .eq('schemaname', 'public');
  
  if (error) {
    console.error('Error checking tables:', error);
    throw error;
  }
  
  const tableNames = tables?.map(t => t.tablename) || [];
  
  if (!tableNames.includes('compounds')) {
    console.log('Creating compounds table...');
    
    // Create compounds table
    const { error: createError } = await supabase.rpc('create_compounds_table');
    
    if (createError) {
      // If RPC fails, try direct SQL
      const { error: sqlError } = await supabase.query(`
        CREATE TABLE IF NOT EXISTS public.compounds (
          id SERIAL PRIMARY KEY,
          cid INTEGER NOT NULL UNIQUE,
          name TEXT NOT NULL,
          iupac_name TEXT,
          formula TEXT,
          molecular_weight REAL,
          synonyms TEXT[],
          description TEXT,
          chemical_class TEXT[],
          inchi TEXT,
          inchi_key TEXT,
          smiles TEXT,
          properties JSONB,
          is_processed BOOLEAN DEFAULT FALSE,
          image_url TEXT
        );
        
        CREATE INDEX IF NOT EXISTS compounds_cid_idx ON public.compounds (cid);
        CREATE INDEX IF NOT EXISTS compounds_name_idx ON public.compounds (name);
        CREATE INDEX IF NOT EXISTS compounds_molecular_weight_idx ON public.compounds (molecular_weight);
        CREATE INDEX IF NOT EXISTS compounds_chemical_class_idx ON public.compounds USING GIN (chemical_class);
      `);
      
      if (sqlError) {
        console.error('Error creating compounds table:', sqlError);
        throw sqlError;
      }
    }
    
    console.log('Compounds table created successfully');
  } else {
    console.log('Compounds table already exists');
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
  
  // Insert compound
  const { data, error } = await supabase
    .from('compounds')
    .insert([compound])
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
      iupacName: compound.iupac_name,
      formula: compound.formula,
      molecularWeight: compound.molecular_weight,
      synonyms: compound.synonyms,
      description: compound.description,
      chemicalClass: compound.chemical_class,
      inchi: compound.inchi,
      inchiKey: compound.inchi_key,
      smiles: compound.smiles,
      imageUrl: compound.image_url || `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${compound.cid}&width=300&height=300`
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
    
    // Process the compound data
    const processedCompound = await processCompoundData(compoundData);
    
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
        await insertCompoundToWeaviate(compound);
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
  
  if (args.length < 1) {
    console.error('Usage: npm run upload-local-compounds <directory_or_file_path>');
    process.exit(1);
  }
  
  const inputPath = args[0];
  
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