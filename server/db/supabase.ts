import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type Compound, type User, type InsertCompound } from '@shared/schema';

// Supabase configuration from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

// Check if Supabase credentials are available
if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_KEY or SUPABASE_ANON_KEY environment variables must be set for Supabase integration');
}

// Helper function to sanitize Supabase URL
function sanitizeSupabaseUrl(url: string): string {
  // Make sure URL ends with '/rest/v1'
  if (!url.endsWith('/rest/v1')) {
    // Remove trailing slash if present
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    return `${baseUrl}/rest/v1`;
  }
  return url;
}

// Create Supabase client with sanitized URL
let supabase: SupabaseClient;
try {
  const sanitizedUrl = supabaseUrl ? sanitizeSupabaseUrl(supabaseUrl) : '';
  supabase = createClient(
    sanitizedUrl,
    supabaseKey || ''
  );
  console.log(`Supabase client created with URL: ${sanitizedUrl}`);
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  // Create a minimal client that will properly report errors when used
  supabase = createClient('', '');
}

/**
 * Gets a user by ID
 */
export async function getUser(id: number): Promise<User | undefined> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as User;
  } catch (error) {
    console.error(`Error getting user ${id} from Supabase:`, error);
    throw new Error(`Failed to get user ${id} from Supabase: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets a user by username
 */
export async function getUserByUsername(username: string): Promise<User | undefined> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "No rows returned" which is OK for us
    return data as User || undefined;
  } catch (error) {
    console.error(`Error getting user ${username} from Supabase:`, error);
    throw new Error(`Failed to get user ${username} from Supabase: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates a new user
 */
export async function createUser(user: { username: string, password: string }): Promise<User> {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert(user)
      .select()
      .single();
    
    if (error) throw error;
    return data as User;
  } catch (error) {
    console.error(`Error creating user in Supabase:`, error);
    throw new Error(`Failed to create user in Supabase: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets a compound by ID
 */
export async function getCompoundById(id: number): Promise<Compound | undefined> {
  try {
    const { data, error } = await supabase
      .from('compounds')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as Compound || undefined;
  } catch (error) {
    console.error(`Error getting compound with ID ${id} from Supabase:`, error);
    throw new Error(`Failed to get compound with ID ${id} from Supabase: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets a compound by CID
 */
export async function getCompoundByCid(cid: number): Promise<Compound | undefined> {
  try {
    const { data, error } = await supabase
      .from('compounds')
      .select('*')
      .eq('cid', cid)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as Compound || undefined;
  } catch (error) {
    console.error(`Error getting compound with CID ${cid} from Supabase:`, error);
    throw new Error(`Failed to get compound with CID ${cid} from Supabase: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates a new compound
 */
export async function createCompound(compound: InsertCompound): Promise<Compound> {
  try {
    // Handle array data types
    const compoundData = {
      ...compound,
      // Convert array types to PostgreSQL compatible format
      synonyms: compound.synonyms || [],
      chemicalClass: compound.chemicalClass || []
    };

    const { data, error } = await supabase
      .from('compounds')
      .insert(compoundData)
      .select()
      .single();
    
    if (error) throw error;
    return data as Compound;
  } catch (error) {
    console.error(`Error creating compound in Supabase:`, error);
    throw new Error(`Failed to create compound in Supabase: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets multiple compounds with pagination
 */
export async function getCompounds(limit: number = 10, offset: number = 0): Promise<Compound[]> {
  try {
    const { data, error } = await supabase
      .from('compounds')
      .select('*')
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    return data as Compound[];
  } catch (error) {
    console.error(`Error getting compounds from Supabase:`, error);
    throw new Error(`Failed to get compounds from Supabase: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Batch insert compounds for better performance
 */
export async function batchInsertCompounds(compounds: InsertCompound[]): Promise<number> {
  try {
    // Handle array data for each compound
    const compoundsData = compounds.map(compound => ({
      ...compound,
      synonyms: compound.synonyms || [],
      chemicalClass: compound.chemicalClass || []
    }));

    const { data, error } = await supabase
      .from('compounds')
      .insert(compoundsData);
    
    if (error) throw error;
    return compounds.length;
  } catch (error) {
    console.error(`Error batch inserting compounds in Supabase:`, error);
    throw new Error(`Failed to batch insert compounds in Supabase: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if tables exist in Supabase
 */
export async function createTablesIfNotExist(): Promise<void> {
  try {
    // Check if tables exist by querying them
    const { error: userTableError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    const { error: compoundTableError } = await supabase
      .from('compounds')
      .select('id')
      .limit(1);
    
    // Log the status of the tables
    if (userTableError && userTableError.code === 'PGRST104') {
      console.log('Users table does not exist in Supabase. Please create it manually.');
    } else {
      console.log('Users table exists in Supabase.');
    }
    
    if (compoundTableError && compoundTableError.code === 'PGRST104') {
      console.log('Compounds table does not exist in Supabase. Please create it manually.');
    } else {
      console.log('Compounds table exists in Supabase.');
    }
    
    // In a production environment, we would create tables via migrations
    // For this example, we'll assume the tables already exist in Supabase
    console.log('Use the SQL script in scripts/supabase-setup.sql to create the tables manually if needed');
  } catch (error) {
    console.error('Error checking tables in Supabase:', error);
    throw new Error(`Failed to check tables in Supabase: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Checks if the Supabase connection is working
 */
export async function testConnection(): Promise<boolean> {
  try {
    // Just check if we can access the database by querying the system tables
    // This is a simple query that should work even if no tables exist yet
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    // Even if no users exist, we should not get a connection error
    if (error && error.code !== 'PGRST104' && error.code !== 'PGRST116') {
      // PGRST104 means relation doesn't exist, which is fine - we'll create it
      // PGRST116 means no rows returned, which is also fine
      throw error;
    }
    
    console.log('Connected to Supabase database successfully');
    return true;
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return false;
  }
}

/**
 * Initialize the database structure if needed
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Check if connection works
    const connectionWorks = await testConnection();
    if (!connectionWorks) {
      throw new Error('Could not connect to Supabase database');
    }
    
    console.log('Supabase database connection established');
    
    // Check and create tables if they don't exist
    // Note: In a production environment, you would use proper migrations
    // Either through SQL or a migration tool like Drizzle
    await createTablesIfNotExist();
    
    console.log('Supabase database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Supabase database:', error);
    throw new Error(`Failed to initialize Supabase database: ${error instanceof Error ? error.message : String(error)}`);
  }
}