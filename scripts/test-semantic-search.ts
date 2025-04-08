import { semanticSearch } from '../server/db/weaviate';
import { getCompoundByCid } from '../server/db/supabase';

// Environment variables are loaded automatically by Node.js

// Sample queries to test
const TEST_QUERIES = [
  "anti-inflammatory",
  "pain relief",
  "antibacterial",
  "cancer treatment",
  "antiviral",
  "blood pressure",
  "diabetes",
  "antioxidant"
];

// Function to print compound details
function printCompound(compound: any) {
  console.log(`
--------------------------------------
CID: ${compound.cid}
Name: ${compound.name}
Formula: ${compound.formula || 'N/A'}
Molecular Weight: ${compound.molecularWeight || 'N/A'}
Similarity: ${compound.similarity !== undefined ? `${compound.similarity}%` : 'N/A'}
Description: ${compound.description ? compound.description.substring(0, 100) + '...' : 'N/A'}
--------------------------------------
  `);
}

// Main test function
async function testSemanticSearch() {
  console.log('Testing Weaviate semantic search functionality...');
  
  // First, check environment variables
  const envVars = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY,
    WEAVIATE_URL: process.env.WEAVIATE_URL,
    WEAVIATE_API_KEY: process.env.WEAVIATE_API_KEY,
    WEAVIATE_SCHEME: process.env.WEAVIATE_SCHEME || 'https'
  };
  
  // Verify required environment variables
  const missingVars = Object.entries(envVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);
  
  if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please set these variables in your .env file or environment');
    return;
  }
  
  console.log('✅ All required environment variables are set');
  
  // Check if database has compounds
  try {
    // Try to get a specific compound (aspirin, CID 2244)
    console.log('Attempting to retrieve aspirin (CID 2244) from the database...');
    const aspirin = await getCompoundByCid(2244);
    
    if (aspirin) {
      console.log('\n✅ Found aspirin (CID 2244) in the database:');
      printCompound(aspirin);
    } else {
      console.log('\n⚠️ Aspirin not found in database. Testing with compounds with other CIDs...');
      
      // Try to get any compound, checking a few common CIDs
      let foundCompound = false;
      for (const cid of [1, 5, 10, 100, 200]) {
        console.log(`Attempting to retrieve compound with CID ${cid}...`);
        const compound = await getCompoundByCid(cid);
        
        if (compound) {
          console.log(`Found compound with CID ${cid} in the database:`);
          printCompound(compound);
          foundCompound = true;
          break;
        }
      }
      
      if (!foundCompound) {
        console.warn('\n⚠️ No compounds found in the database. Please load some data first.');
        return;
      }
    }
    
    // Test semantic search with each query
    for (const query of TEST_QUERIES) {
      console.log(`\n🔍 Testing semantic search with query: "${query}"`);
      
      try {
        const searchResult = await semanticSearch(query, 3, 0, 'similarity');
        
        if (searchResult.results.length > 0) {
          console.log(`Found ${searchResult.totalResults} results. Top 3 results:`);
          
          // Print top results
          searchResult.results.forEach(compound => {
            printCompound(compound);
          });
        } else {
          console.warn(`⚠️ No results found for query "${query}"`);
        }
      } catch (error) {
        console.error(`❌ Error testing semantic search with query "${query}":`, error);
      }
    }
    
    console.log('\n✅ Semantic search testing complete!');
    
  } catch (error) {
    console.error('❌ Error testing database connectivity:', error);
    
    // Check specific error causes
    if (error instanceof Error) {
      if (error.message.includes('Weaviate')) {
        console.error('\n⚠️ Weaviate connection error. Please check your configuration:');
        console.error('- Ensure WEAVIATE_URL, WEAVIATE_API_KEY, and WEAVIATE_SCHEME are set correctly');
        console.error('- Verify the Weaviate instance is running');
        console.error('- Check your network connectivity to the Weaviate server');
      } else if (error.message.includes('Supabase') || error.message.includes('database')) {
        console.error('\n⚠️ Supabase connection error. Please check your configuration:');
        console.error('- Ensure SUPABASE_URL and SUPABASE_KEY are set correctly');
        console.error('- Verify the Supabase project is active');
        console.error('- Check the database tables exist');
      } else if (error.message.includes('OpenAI') || error.message.includes('embedding')) {
        console.error('\n⚠️ OpenAI API error. Please check your configuration:');
        console.error('- Ensure OPENAI_API_KEY is set correctly');
        console.error('- Verify your OpenAI account is active and has sufficient credits');
      }
    }
    
    console.error('\nPlease check the DATABASE_SETUP.md file for setup instructions.');
  }
}

// Run the test function
async function main() {
  try {
    await testSemanticSearch();
  } catch (error) {
    console.error('Unhandled error during test:', error);
    process.exit(1);
  }
}

// Execute the script
main();