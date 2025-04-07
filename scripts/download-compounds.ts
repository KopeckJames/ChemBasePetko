import { fetchRandomCompounds } from '../server/db/downloadPubChem';
import { storage } from '../server/storage';

// Number of compounds to download - increased to 1000 as requested
const COUNT = 1000;

async function main() {
  try {
    // Step 1: Download compounds from PubChem
    console.log(`Downloading ${COUNT} random compounds from PubChem...`);
    console.log(`This will take some time as we are respecting PubChem API rate limits (399 requests/second)`);
    await fetchRandomCompounds(COUNT);
    
    // Step 2: Reload the database from the downloaded files
    console.log(`Reloading database from downloaded files...`);
    await storage.initializeDatabase();
    
    console.log('Process completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error in download-compounds script:', error);
    process.exit(1);
  }
}

main();