/**
 * Database Connection Test Script
 * 
 * This script tests connections to both Supabase and Weaviate databases
 * to verify your environment is correctly set up.
 */

import { createClient } from '@supabase/supabase-js';
import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

// Constants
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const WEAVIATE_URL = process.env.WEAVIATE_URL || '';
const WEAVIATE_SCHEME = process.env.WEAVIATE_SCHEME || 'https';
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY || '';

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getWeaviateClient(): Promise<WeaviateClient> {
  const clientConfig: any = {
    host: WEAVIATE_URL,
    scheme: WEAVIATE_SCHEME,
  };

  // Add API key if provided
  if (WEAVIATE_API_KEY) {
    clientConfig.apiKey = new weaviate.ApiKey(WEAVIATE_API_KEY);
  }

  return weaviate.client(clientConfig);
}

async function testSupabaseConnection() {
  console.log(chalk.blue('🔄 Testing Supabase connection...'));
  
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Supabase URL or API key is missing from environment variables');
    }
    
    // Helper function to sanitize Supabase URL for connection
    function sanitizeSupabaseUrl(url: string): string {
      // Remove '/rest/v1' if present for connection test
      if (url.endsWith('/rest/v1')) {
        return url.slice(0, -8);
      }
      // Remove trailing slash if present
      return url.endsWith('/') ? url.slice(0, -1) : url;
    }
    
    // Create a clean client for testing
    const sanitizedUrl = sanitizeSupabaseUrl(SUPABASE_URL);
    console.log(`Connecting to Supabase at ${sanitizedUrl}`);
    
    const testClient = createClient(sanitizedUrl, SUPABASE_KEY);
    
    // Test the connection with a simple query
    const { data, error } = await testClient
      .from('compounds')
      .select('count')
      .limit(1);
    
    // PGRST104: Relation "public.compounds" does not exist (table doesn't exist)
    // This is acceptable during setup, as we'll create it later
    if (error && error.code !== 'PGRST104') {
      throw new Error(`Supabase query error: ${error.message}`);
    }
    
    console.log(chalk.green('✅ Successfully connected to Supabase!'));
    
    // Check if the compounds table exists
    try {
      if (error && error.code === 'PGRST104') {
        console.log(chalk.yellow('⚠️ The compounds table doesn\'t exist in your Supabase project.'));
        console.log(chalk.yellow('   It will be created automatically when you upload compounds'));
        console.log(chalk.yellow('   or you can create it manually using the SQL script in DATABASE_SETUP.md.'));
      } else {
        console.log(chalk.green('✅ The compounds table exists and is accessible.'));
        
        // Try to get a count of compounds by querying all records
        const { data: compounds, error: countError } = await testClient
          .from('compounds')
          .select('id');
        
        if (!countError && compounds) {
          console.log(chalk.green(`   Found ${compounds.length} compounds in the database.`));
        }
      }
    } catch (tableError) {
      console.log(chalk.yellow('⚠️ Couldn\'t check compounds table existence.'));
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Supabase connection failed: ${error instanceof Error ? error.message : String(error)}`));
    console.error(chalk.yellow('Check your SUPABASE_URL and SUPABASE_KEY environment variables.'));
    console.error(chalk.yellow('Make sure your Supabase project is running and accessible.'));
    return false;
  }
}

async function testWeaviateConnection() {
  console.log(chalk.blue('🔄 Testing Weaviate connection...'));
  
  try {
    if (!WEAVIATE_URL) {
      throw new Error('Weaviate URL is missing from environment variables');
    }
    
    // Check if WEAVIATE_URL already includes the scheme
    const weaviateFullUrl = WEAVIATE_URL.startsWith('http') ? 
      WEAVIATE_URL : 
      `${WEAVIATE_SCHEME}://${WEAVIATE_URL}`;
    
    console.log(`Connecting to Weaviate at ${weaviateFullUrl}`);
    
    // Get client and test connection
    const client = await getWeaviateClient();
    const metaData = await client.misc.metaGetter().do();
    
    console.log(chalk.green(`✅ Successfully connected to Weaviate version ${metaData.version}!`));
    
    // Check if the Compound class exists
    try {
      const schema = await client.schema.getter().do();
      const compoundClass = schema.classes?.find((c: any) => c.class === 'Compound');
      
      if (!compoundClass) {
        console.log(chalk.yellow('⚠️ The Compound class doesn\'t exist in Weaviate.'));
        console.log(chalk.yellow('   It will be created automatically when you upload compounds.'));
      } else {
        console.log(chalk.green('✅ The Compound class exists in Weaviate.'));
      }
    } catch (schemaError) {
      console.log(chalk.yellow('⚠️ Couldn\'t check Compound class existence.'));
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Weaviate connection failed: ${error instanceof Error ? error.message : String(error)}`));
    console.error(chalk.yellow('Check your WEAVIATE_URL, WEAVIATE_SCHEME, and WEAVIATE_API_KEY environment variables.'));
    return false;
  }
}

async function main() {
  console.log(chalk.bold('📊 Chemical Vector Database - Connection Test'));
  console.log('------------------------------------------------');
  
  // Test Supabase connection
  const supabaseSuccess = await testSupabaseConnection();
  
  console.log('------------------------------------------------');
  
  // Test Weaviate connection
  const weaviateSuccess = await testWeaviateConnection();
  
  console.log('------------------------------------------------');
  
  // Summary
  if (supabaseSuccess && weaviateSuccess) {
    console.log(chalk.green.bold('🎉 All database connections are working correctly!'));
    console.log(chalk.green('Your environment is properly set up for the Chemical Vector Database.'));
  } else {
    console.log(chalk.red.bold('❌ Some database connections failed.'));
    console.log(chalk.yellow('Please check the errors above and fix your configuration.'));
    console.log(chalk.yellow('Refer to DATABASE_SETUP.md for detailed setup instructions.'));
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});