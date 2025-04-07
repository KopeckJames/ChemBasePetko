import { fetchRandomCompounds } from '../server/db/downloadPubChem';
import { storage } from '../server/storage';

// Number of compounds to download
const COUNT = 100;

async function main() {
  try {
    // Step 1: Download compounds from PubChem
    console.log(`Downloading ${COUNT} random compounds from PubChem...`);
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