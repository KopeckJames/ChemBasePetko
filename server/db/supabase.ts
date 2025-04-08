import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Compound, CompoundSearchResult, InsertCompound, SearchQuery, SearchResponse } from "../../shared/schema";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

let supabase: SupabaseClient | null = null;

/**
 * Gets the Supabase client, initializing it if needed
 */
export function getClient(): SupabaseClient {
  if (!supabase) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Missing Supabase URL or API key");
    }
    
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Connected to Supabase successfully");
  }
  return supabase;
}

/**
 * Initializes the Supabase schema for chemical compounds
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const supabase = getClient();
    
    // Check if compounds table exists, create it if not
    const { error } = await supabase.rpc('create_compounds_table_if_not_exists', {});
    
    if (error) {
      // If RPC doesn't exist, create the table directly
      await supabase.from('compounds').select('id').limit(1).maybeSingle();
      console.log("Compounds table exists or was created successfully");
    }
    
    console.log("Supabase database initialized successfully");
  } catch (error) {
    console.error("Error initializing Supabase database:", error);
    // Instead of throwing, we'll log and continue
    console.log("Continuing without Supabase table creation - it may already exist");
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