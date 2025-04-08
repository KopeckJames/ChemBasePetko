-- SQL script to set up the required tables in Supabase for ChemSearch

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- Add RLS policy for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users
CREATE POLICY IF NOT EXISTS "Enable full access for authenticated users"
ON public.users
USING (auth.role() = 'authenticated');

-- Create compounds table if it doesn't exist
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

-- Add RLS policy for compounds
ALTER TABLE public.compounds ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for compounds
CREATE POLICY IF NOT EXISTS "Enable full access for authenticated users"
ON public.compounds
USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Enable read access for all users"
ON public.compounds
FOR SELECT
TO public
USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS compounds_cid_idx ON public.compounds (cid);
CREATE INDEX IF NOT EXISTS compounds_name_idx ON public.compounds (name);
CREATE INDEX IF NOT EXISTS compounds_molecular_weight_idx ON public.compounds (molecular_weight);
CREATE INDEX IF NOT EXISTS compounds_chemical_class_idx ON public.compounds USING GIN (chemical_class);

-- Create a version function for connection testing
CREATE OR REPLACE FUNCTION public.version()
RETURNS text
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT version();
$$;

-- Grant execute permission on the version function
GRANT EXECUTE ON FUNCTION public.version() TO public;

-- Add some helpful comments
COMMENT ON TABLE public.compounds IS 'Chemical compounds from PubChem';
COMMENT ON TABLE public.users IS 'Application users';
COMMENT ON FUNCTION public.version IS 'Returns PostgreSQL version for connection testing';
