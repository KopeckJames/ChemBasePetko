-- Supabase table creation script for the Chemical Vector DB project
-- Run this script to set up your database schema

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

-- Create a function that can be called via RPC to create the tables
CREATE OR REPLACE FUNCTION create_compounds_table()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
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
END;
$$;