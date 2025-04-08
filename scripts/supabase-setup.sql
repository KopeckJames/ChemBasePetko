-- Function to create users table if it doesn't exist
CREATE OR REPLACE FUNCTION create_users_table()
RETURNS void AS $$
BEGIN
    -- Check if table exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
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
        
        RAISE NOTICE 'Created users table with RLS policies';
    ELSE
        RAISE NOTICE 'Users table already exists, skipping creation';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create compounds table if it doesn't exist
CREATE OR REPLACE FUNCTION create_compounds_table()
RETURNS void AS $$
BEGIN
    -- Check if table exists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'compounds') THEN
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
        
        RAISE NOTICE 'Created compounds table with RLS policies and indexes';
    ELSE
        RAISE NOTICE 'Compounds table already exists, skipping creation';
    END IF;
END;
$$ LANGUAGE plpgsql;