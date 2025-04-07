import { storage } from '../server/storage';
import * as weaviateClient from '../server/db/weaviate';

const SEARCH_QUERIES = [
  "Anti-inflammatory compounds",
  "Compounds that can be used as solvents",
  "Compounds with similar structure to aspirin",
  "Alcohols used in medicine",
  "Organic compounds with nitrogen atoms",
];

async function main() {
  try {
    console.log("Testing semantic search functionality...");
    
    // Test each search query and print results
    for (const query of SEARCH_QUERIES) {
      console.log(`\n\nQuery: "${query}"`);
      console.log("=".repeat(40));
      
      const startTime = Date.now();
      const results = await weaviateClient.semanticSearch(query, 5, 0);
      const duration = Date.now() - startTime;
      
      console.log(`Found ${results.totalResults} results in ${duration}ms`);
      
      // Print each result
      results.results.forEach((compound, index) => {
        console.log(`\n${index + 1}. ${compound.name} (CID: ${compound.cid})`);
        console.log(`   Formula: ${compound.formula}`);
        console.log(`   Molecular Weight: ${compound.molecularWeight}`);
        console.log(`   Description: ${compound.description?.substring(0, 100)}${compound.description?.length > 100 ? '...' : ''}`);
        console.log(`   Similarity: ${compound.similarity !== undefined ? `${compound.similarity}%` : 'N/A'}`);
      });
    }
    
    console.log("\n\nSemantic search test completed!");
    process.exit(0);
  } catch (error) {
    console.error('Error in test-semantic-search script:', error);
    process.exit(1);
  }
}

main();