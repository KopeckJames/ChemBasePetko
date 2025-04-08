# Database Setup Guide for ChemSearch

This document provides instructions for setting up the two databases required for ChemSearch:

1. **Supabase** - Used for relational data storage
2. **Weaviate** - Used for vector search capabilities

## Supabase Setup

### Step 1: Create a Supabase Account and Project

1. Go to [Supabase](https://supabase.com) and sign up for an account
2. Create a new project
3. Note the URL and API key from the project settings

### Step 2: Create Tables in Supabase

You can set up the required tables in two ways:

#### Option 1: Direct SQL Execution

In the Supabase SQL Editor, execute the following SQL:

```sql
-- Create users table
CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- Add RLS policy
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable full access for authenticated users"
ON public.users
USING (auth.role() = 'authenticated');

-- Create compounds table
CREATE TABLE public.compounds (
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

-- Add RLS policy
ALTER TABLE public.compounds ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable full access for authenticated users"
ON public.compounds
USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for all users"
ON public.compounds
FOR SELECT
TO public
USING (true);

-- Add indexes
CREATE INDEX compounds_cid_idx ON public.compounds (cid);
CREATE INDEX compounds_name_idx ON public.compounds (name);
CREATE INDEX compounds_molecular_weight_idx ON public.compounds (molecular_weight);
CREATE INDEX compounds_chemical_class_idx ON public.compounds USING GIN (chemical_class);
```

#### Option 2: Using Migration Tools

If you're using a migration tool like Drizzle:

1. Configure Drizzle with your Supabase credentials
2. Run migrations: `npx drizzle-kit push`

### Step 3: Configure Environment Variables

Add the following to your `.env` file:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

## Weaviate Setup

### Step 1: Create a Weaviate Account

1. Go to [Weaviate Cloud Console](https://console.weaviate.cloud/) and sign up for an account
2. Create a new cluster (free sandbox is sufficient for testing)
3. Note the cluster URL and API key

### Step 2: Schema Configuration

The application will automatically set up the schema when it starts, but you can manually create it using the following schema definition:

```json
{
  "class": "Compound",
  "description": "Chemical compound from PubChem",
  "properties": [
    {
      "name": "cid",
      "dataType": ["int"],
      "description": "PubChem Compound ID"
    },
    {
      "name": "name",
      "dataType": ["text"],
      "description": "Primary name of the compound"
    },
    {
      "name": "iupacName",
      "dataType": ["text"],
      "description": "IUPAC name of the compound"
    },
    {
      "name": "formula",
      "dataType": ["text"],
      "description": "Chemical formula"
    },
    {
      "name": "molecularWeight",
      "dataType": ["number"],
      "description": "Molecular weight in g/mol"
    },
    {
      "name": "synonyms",
      "dataType": ["text[]"],
      "description": "Alternative names for the compound"
    },
    {
      "name": "description",
      "dataType": ["text"],
      "description": "Textual description of the compound"
    },
    {
      "name": "chemicalClass",
      "dataType": ["text[]"],
      "description": "Chemical classification terms"
    },
    {
      "name": "inchi",
      "dataType": ["text"],
      "description": "InChI identifier"
    },
    {
      "name": "inchiKey",
      "dataType": ["text"],
      "description": "InChI key"
    },
    {
      "name": "smiles",
      "dataType": ["text"],
      "description": "SMILES notation"
    },
    {
      "name": "imageUrl",
      "dataType": ["text"],
      "description": "URL to compound structure image"
    }
  ],
  "vectorizer": "text2vec-openai",
  "moduleConfig": {
    "text2vec-openai": {
      "model": "ada",
      "modelVersion": "002",
      "type": "text"
    }
  }
}
```

### Step 3: Configure Environment Variables

Add the following to your `.env` file:

```
WEAVIATE_URL=your-cluster-url.weaviate.cloud
WEAVIATE_API_KEY=your-weaviate-api-key
WEAVIATE_SCHEME=https
OPENAI_API_KEY=your-openai-api-key
```

**Note**: The OpenAI API key is required for text vectorization in Weaviate when using the `text2vec-openai` vectorizer.

## Data Loading

After setting up both databases, you can load PubChem compound data using the provided scripts:

```bash
# Download a sample of compounds
npm run download-compounds

# For large-scale batch download (adjust as needed)
npm run batch-download-compounds
```

The application will automatically load data from the `data` directory when it starts if the databases are empty.

## Testing Your Setup

To verify your database setup:

1. Start the application: `npm run dev`
2. Navigate to the search page
3. Try both keyword and semantic searches to confirm functionality

If you encounter any issues, check the application logs for specific error messages and verify your environment variables.