import { createClient } from '@supabase/supabase-js';
import { type Compound, type User } from '@shared/schema';
import { drizzle } from 'drizzle-orm/supabase-js';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

// Supabase configuration from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Check if Supabase credentials are available
if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_KEY environment variables must be set for Supabase integration');
}

// Create Supabase client
const supabase = createClient(
  supabaseUrl || '',
  supabaseKey || ''
);

// Create Drizzle ORM instance with Supabase
const db = drizzle(supabase, { schema });

/**
 * Gets a user by ID
 */
export async function getUser(id: number): Promise<User | undefined> {
  try {
    const results = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return results[0];
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
    const results = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return results[0];
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
    const results = await db.insert(schema.users).values(user).returning();
    return results[0];
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
    const results = await db.select().from(schema.compounds).where(eq(schema.compounds.id, id));
    return results[0];
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
    const results = await db.select().from(schema.compounds).where(eq(schema.compounds.cid, cid));
    return results[0];
  } catch (error) {
    console.error(`Error getting compound with CID ${cid} from Supabase:`, error);
    throw new Error(`Failed to get compound with CID ${cid} from Supabase: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates a new compound
 */
export async function createCompound(compound: Omit<Compound, 'id'>): Promise<Compound> {
  try {
    const results = await db.insert(schema.compounds).values(compound).returning();
    return results[0];
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
    return await db.select().from(schema.compounds).limit(limit).offset(offset);
  } catch (error) {
    console.error(`Error getting compounds from Supabase:`, error);
    throw new Error(`Failed to get compounds from Supabase: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Checks if the Supabase connection is working
 */
export async function testConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('compounds').select('count', { count: 'exact', head: true });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return false;
  }
}

/**
 * Initialize the database structure if needed
 * This is a placeholder since Drizzle would normally handle migrations
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Check if connection works
    const connectionWorks = await testConnection();
    if (!connectionWorks) {
      throw new Error('Could not connect to Supabase database');
    }
    
    console.log('Supabase database connection established');
    
    // In a real implementation, we would use Drizzle migrations
    // This is just a placeholder to ensure the connection is working
  } catch (error) {
    console.error('Failed to initialize Supabase database:', error);
    throw new Error(`Failed to initialize Supabase database: ${error instanceof Error ? error.message : String(error)}`);
  }
}