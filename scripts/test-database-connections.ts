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
    
    // Test the connection with a simpler query
    const { data, error } = await supabase
      .from('compounds')
      .select('*')
      .limit(1);
    
    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }
    
    console.log(chalk.green('✅ Successfully connected to Supabase!'));
    
    // Check if the compounds table exists
    try {
      const { error: tableError } = await supabase
        .from('compounds')
        .select('id')
        .limit(1);
      
      if (tableError) {
        console.log(chalk.yellow('⚠️ The compounds table doesn\'t exist or is not accessible.'));
        console.log(chalk.yellow('   You may need to run the SQL setup script in DATABASE_SETUP.md.'));
      } else {
        console.log(chalk.green('✅ The compounds table exists and is accessible.'));
      }
    } catch (tableError) {
      console.log(chalk.yellow('⚠️ Couldn\'t check compounds table existence.'));
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Supabase connection failed: ${error instanceof Error ? error.message : String(error)}`));
    console.error(chalk.yellow('Check your SUPABASE_URL and SUPABASE_KEY environment variables.'));
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