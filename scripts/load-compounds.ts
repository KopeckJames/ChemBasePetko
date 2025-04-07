import { storage } from '../server/storage';

/**
 * This script loads all previously downloaded compounds into the database and Weaviate
 */
async function main() {
  try {
    // Load all available compounds in the data directory
    console.log('Loading all available PubChem compounds into the database...');
    const loadedCount = await storage.loadPubChemData(1000);
    
    console.log(`Successfully loaded ${loadedCount} compounds into the database and Weaviate`);
    process.exit(0);
  } catch (error) {
    console.error('Error loading compounds:', error);
    process.exit(1);
  }
}

main();