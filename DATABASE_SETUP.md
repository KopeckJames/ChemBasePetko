# Database Setup Guide

## Overview

This project uses two databases to store and query chemical compound data:

1. **Supabase PostgreSQL** - Relational database for storing structured compound data
2. **Weaviate Vector Database** - Vector database for semantic search capabilities

This guide will help you set up both databases correctly.

## Prerequisites

1. A Supabase account and project
2. A Weaviate instance (cloud or self-hosted)
3. Environment variables set up in `.env`

## Environment Variables

Create an `.env` file in the root directory with the following variables:

```
# Supabase credentials
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Weaviate credentials
WEAVIATE_URL=your_weaviate_url
WEAVIATE_SCHEME=https
WEAVIATE_API_KEY=your_weaviate_api_key

# Optional: For text2vec-openai vectorizer
OPENAI_API_KEY=your_openai_api_key
```

## Supabase Setup

### Option 1: Run the SQL Script

The easiest way to set up your Supabase database is to run the SQL script in the SQL editor of your Supabase dashboard:

```sql
-- Create the compounds table if it doesn't exist
CREATE TABLE IF NOT EXISTS compounds (
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
  properties JSONB DEFAULT '{}'::jsonb,
  is_processed BOOLEAN DEFAULT FALSE,
  image_url TEXT
);

-- Create indexes for efficient searching
CREATE INDEX IF NOT EXISTS idx_compounds_cid ON compounds(cid);
CREATE INDEX IF NOT EXISTS idx_compounds_name ON compounds(name);
CREATE INDEX IF NOT EXISTS idx_compounds_formula ON compounds(formula);
CREATE INDEX IF NOT EXISTS idx_compounds_smiles ON compounds(smiles);

-- Create the users table (kept for compatibility)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);
```

### Option 2: Run the Database Initialization Script

Alternatively, you can run the database initialization script:

```bash
npx tsx scripts/test-database-connections.ts
```

This will test the connections to both databases and verify that they're properly set up.

## Weaviate Setup

Weaviate will be initialized automatically when you run the upload scripts or the application. The schema includes:

- Class: `Compound`
- Properties: All compound data fields
- Vectorizer: `text2vec-openai` (requires OpenAI API key)

## Understanding Column Names

There's an important aspect to understand about our column names:

- In the PostgreSQL database, columns use `snake_case` naming (e.g., `iupac_name`, `chemical_class`)
- In our TypeScript code, we use `camelCase` properties (e.g., `iupacName`, `chemicalClass`)

This conversion happens automatically through our Drizzle ORM setup. The schema in `shared/schema.ts` defines this mapping.

## Troubleshooting

### Common Errors

1. **Column not found errors:**
   If you see errors like "Could not find the 'chemicalClass' column", it means your database schema doesn't match what our code expects. Make sure to run the SQL script above to create all required columns.

2. **Connection errors:**
   Double-check your environment variables to ensure they have the correct credentials.

3. **Authentication errors:**
   Make sure your Supabase and Weaviate API keys have the correct permissions.

### Testing Connections

You can verify your database connections at any time:

```bash
npx tsx scripts/test-database-connections.ts
```

For more detailed troubleshooting, check the console logs during application startup.