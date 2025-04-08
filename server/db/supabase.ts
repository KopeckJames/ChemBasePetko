import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Compound, CompoundSearchResult, InsertCompound, SearchQuery, SearchResponse } from "../../shared/schema";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

let supabase: SupabaseClient | null = null;

/**
 * Gets the Supabase client, initializing it if needed
 */
export function getClient(): SupabaseClient {
  try {
    if (!supabase) {
      if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error("Missing Supabase URL or API key");
      }
      
      console.log(`Initializing Supabase client with URL: ${SUPABASE_URL.substring(0, 20)}...`);
      
      // Create the Supabase client with options to handle connection issues
      supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          // Increase timeouts for potentially slow or unreliable connections
          fetch: (url, options) => {
            const timeout = 15000; // 15 seconds timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            return fetch(url, {
              ...options,
              signal: controller.signal,
            }).then(response => {
              clearTimeout(timeoutId);
              return response;
            }).catch(error => {
              clearTimeout(timeoutId);
              if (error.name === 'AbortError') {
                throw new Error(`Request to Supabase timed out after ${timeout}ms`);
              }
              throw error;
            });
          }
        }
      });
      
      console.log("Connected to Supabase client successfully (connection not verified yet)");
    }
    return supabase;
  } catch (error) {
    console.error("Error creating Supabase client:", error);
    throw new Error(`Failed to create Supabase client: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Initializes the Supabase schema for chemical compounds
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const supabase = getClient();
    
    // First check if we can actually connect to Supabase
    console.log("Testing Supabase connection...");
    
    try {
      const { data, error } = await supabase.from('pg_catalog.pg_tables')
        .select('schemaname,tablename')
        .eq('schemaname', 'public')
        .limit(1);
        
      if (error) {
        console.error("Error testing Supabase connection:", error.message);
        throw new Error(`Cannot connect to Supabase: ${error.message}`);
      }
      
      console.log("Successfully connected to Supabase");
    } catch (connError) {
      console.error("Failed to connect to Supabase:", connError);
      throw new Error("Cannot connect to Supabase database");
    }
    
    // Now let's check if compounds table exists
    console.log("Checking if compounds table exists...");
    const { data: tableExists, error: tableCheckError } = await supabase
      .from('pg_catalog.pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .eq('tablename', 'compounds')
      .maybeSingle();
      
    if (tableCheckError) {
      console.error("Error checking if compounds table exists:", tableCheckError.message);
      throw new Error(`Failed to check if compounds table exists: ${tableCheckError.message}`);
    }
    
    // If table doesn't exist, create it using our schema
    if (!tableExists) {
      console.log("Compounds table doesn't exist, creating it...");
      
      // SQL to create the compounds table based on our schema
      const createTableSQL = `
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
        
        -- Create index on CID for fast lookups
        CREATE INDEX IF NOT EXISTS idx_compounds_cid ON public.compounds(cid);
        
        -- Create index for text search on name/formula/description
        CREATE INDEX IF NOT EXISTS idx_compounds_name ON public.compounds(name);
        CREATE INDEX IF NOT EXISTS idx_compounds_formula ON public.compounds(formula);
      `;
      
      // Execute the SQL query using rpc
      const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
      
      // If rpc method doesn't exist, we'll try to handle this more gracefully
      if (createError) {
        console.error("Error creating compounds table via rpc:", createError.message);
        console.log("Attempting to create table through another method...");
        
        // We'll try to use REST SQL API - this is a bit of a workaround but should work
        try {
          // Try using the compounds table in a SELECT to see if it already exists
          const { error: selectError } = await supabase
            .from('compounds')
            .select('id')
            .limit(1);
            
          if (selectError && selectError.code === '42P01') { // Table doesn't exist
            console.error("Compounds table doesn't exist but cannot create it directly in Supabase REST API");
            console.log("Please create the table manually in the Supabase dashboard or use migrations");
            throw new Error("Cannot create compounds table automatically");
          } else {
            console.log("Compounds table seems to exist despite earlier check");
          }
        } catch (altError) {
          console.error("Error with alternative table creation method:", altError);
          throw new Error("Failed to create compounds table");
        }
      } else {
        console.log("Successfully created compounds table");
      }
    } else {
      console.log("Compounds table already exists");
    }
    
    console.log("Supabase database initialized successfully");
  } catch (error) {
    console.error("Error initializing Supabase database:", error);
    throw new Error(`Supabase initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Adds a compound to the Supabase database
 */
export async function addCompound(compound: InsertCompound): Promise<Compound> {
  try {
    const supabase = getClient();
    
    // Check if compound with this CID already exists
    const { data: existingCompound, error: checkError } = await supabase
      .from('compounds')
      .select('id')
      .eq('cid', compound.cid)
      .maybeSingle();
    
    if (checkError) {
      console.error(`Error checking if compound ${compound.cid} exists in Supabase:`, 
        checkError.message,
        checkError.details,
        checkError.hint);
        
      // Create detailed error info for logging
      const errorInfo = {
        message: checkError.message,
        details: checkError.details,
        hint: checkError.hint,
        code: checkError.code
      };
      console.error(`Full error details: ${JSON.stringify(errorInfo)}`);
      
      throw new Error(`Supabase error checking compound: ${checkError.message}`);
    }
    
    if (existingCompound) {
      console.log(`Compound with CID ${compound.cid} already exists, skipping`);
      
      // Return the existing compound data
      const { data: fullCompound, error: getError } = await supabase
        .from('compounds')
        .select('*')
        .eq('cid', compound.cid)
        .single();
      
      if (getError) {
        console.error(`Error retrieving existing compound ${compound.cid} from Supabase:`, 
          getError.message,
          getError.details,
          getError.hint);
        throw new Error(`Supabase error retrieving compound: ${getError.message}`);
      }
      
      return fullCompound as Compound;
    }
    
    // Add new compound
    const { data, error } = await supabase
      .from('compounds')
      .insert([compound])
      .select()
      .single();
    
    if (error) {
      console.error(`Error adding compound ${compound.cid} to Supabase:`, 
        error.message, 
        error.details, 
        error.hint);
        
      // Create detailed error info for logging
      const errorInfo = {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      };
      console.error(`Full error details: ${JSON.stringify(errorInfo)}`);
      
      throw new Error(`Supabase error adding compound: ${error.message}`);
    }
    
    console.log(`Added compound ${compound.cid} to Supabase`);
    return data as Compound;
  } catch (error: any) {
    // Handle any other errors, providing a detailed error message for debugging
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      try {
        errorMessage = JSON.stringify(error);
      } catch (e) {
        errorMessage = "Unstringifiable error object";
      }
    } else if (error !== undefined && error !== null) {
      errorMessage = String(error);
    }
    
    console.error(`Error adding compound ${compound.cid} to Supabase:`, errorMessage);
    throw new Error(`Error with Supabase: ${errorMessage}`);
  }
}

/**
 * Gets a compound by CID from Supabase
 */
export async function getCompoundByCid(cid: number): Promise<Compound | null> {
  try {
    const supabase = getClient();
    
    const { data, error } = await supabase
      .from('compounds')
      .select('*')
      .eq('cid', cid)
      .maybeSingle();
    
    if (error) {
      console.error(`Error getting compound ${cid} from Supabase:`, error);
      throw error;
    }
    
    return data as Compound;
  } catch (error) {
    console.error(`Error getting compound ${cid} from Supabase:`, error);
    throw error;
  }
}

/**
 * Gets a compound by ID from Supabase
 */
export async function getCompoundById(id: number): Promise<Compound | null> {
  try {
    const supabase = getClient();
    
    const { data, error } = await supabase
      .from('compounds')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) {
      console.error(`Error getting compound ID ${id} from Supabase:`, error);
      throw error;
    }
    
    return data as Compound;
  } catch (error) {
    console.error(`Error getting compound ID ${id} from Supabase:`, error);
    throw error;
  }
}

/**
 * Gets all compounds from Supabase with pagination
 */
export async function getCompounds(limit: number = 100, offset: number = 0): Promise<Compound[]> {
  try {
    const supabase = getClient();
    
    const { data, error } = await supabase
      .from('compounds')
      .select('*')
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error("Error getting compounds from Supabase:", error);
      throw error;
    }
    
    return data as Compound[];
  } catch (error) {
    console.error("Error getting compounds from Supabase:", error);
    throw error;
  }
}

/**
 * Performs a search in Supabase
 */
export async function searchCompounds(
  searchQuery: SearchQuery
): Promise<SearchResponse> {
  try {
    const supabase = getClient();
    
    const { query, page = 1, limit = 10, sort = "molecular_weight", molecularWeight, chemicalClass } = searchQuery;
    const offset = (page - 1) * limit;
    
    // Start building the query
    let supabaseQuery = supabase
      .from('compounds')
      .select('*', { count: 'exact' });
    
    // Add text search if query is provided
    if (query && query.trim()) {
      supabaseQuery = supabaseQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%,formula.ilike.%${query}%`);
    }
    
    // Add molecular weight filter if provided
    if (molecularWeight) {
      let weightRange = [0, 10000]; // Default range
      
      switch(molecularWeight) {
        case "lt_100":
          weightRange = [0, 100];
          break;
        case "100-200":
          weightRange = [100, 200];
          break;
        case "200-500":
          weightRange = [200, 500];
          break;
        case "gt_500":
          weightRange = [500, 10000];
          break;
      }
      
      supabaseQuery = supabaseQuery
        .gte('molecularWeight', weightRange[0])
        .lte('molecularWeight', weightRange[1]);
    }
    
    // Add chemical class filter if provided
    if (chemicalClass && chemicalClass !== "all") {
      supabaseQuery = supabaseQuery.eq('chemicalClass', chemicalClass);
    }
    
    // Add sorting
    switch (sort) {
      case "molecular_weight":
        supabaseQuery = supabaseQuery.order('molecularWeight', { ascending: true });
        break;
      case "name":
        supabaseQuery = supabaseQuery.order('name', { ascending: true });
        break;
      case "relevance":
      default:
        supabaseQuery = supabaseQuery.order('id', { ascending: true });
    }
    
    // Add pagination
    supabaseQuery = supabaseQuery.range(offset, offset + limit - 1);
    
    // Execute query
    const { data, error, count } = await supabaseQuery;
    
    if (error) {
      console.error("Error searching compounds in Supabase:", error);
      throw error;
    }
    
    // Convert to CompoundSearchResult format
    const results: CompoundSearchResult[] = (data || []).map((compound: any) => ({
      id: compound.id,
      cid: compound.cid,
      name: compound.name,
      formula: compound.formula || undefined,
      smiles: compound.smiles || "",
      molecularWeight: compound.molecularWeight,
      description: compound.description || "",
      chemicalClass: compound.chemicalClass || null,
      imageUrl: compound.imageUrl || `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${compound.cid}&width=300&height=300`,
      similarity: 0 // No similarity score for database search
    }));
    
    return {
      results,
      totalResults: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
      query: query || ""
    };
  } catch (error) {
    console.error("Error searching compounds in Supabase:", error);
    throw error;
  }
}