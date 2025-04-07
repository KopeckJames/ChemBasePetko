import { storage } from '../server/storage';
import fs from 'fs/promises';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data');
// Batch size for database loading
const BATCH_SIZE = 500; 
// Maximum number of retries for loading data
const MAX_RETRIES = 3;

/**
 * Script to load downloaded compounds into the database
 * Can be run with: npx tsx scripts/load-compounds.ts [limit]
 * The optional limit argument will limit how many compounds to load
 */
async function loadCompounds() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    let limit = Infinity;
    
    if (args.length > 0 && !isNaN(parseInt(args[0]))) {
      limit = parseInt(args[0]);
      console.log(`Will load up to ${limit} compounds`);
    } else {
      console.log(`Will load all available compounds`);
    }
    
    // Initialize database first
    console.log('Initializing database...');
    await storage.initializeDatabase();
    
    // Get list of downloaded files
    const files = await fs.readdir(DATA_PATH);
    const compoundFiles = files
      .filter(file => file.startsWith('pubchem_compound_') && file.endsWith('.json'))
      .sort(); // Sort to ensure consistent ordering
      
    console.log(`Found ${compoundFiles.length} compound files to process`);
    
    if (compoundFiles.length === 0) {
      console.log('No compound files found. Have you downloaded any compounds yet?');
      return;
    }
    
    // Apply the limit if specified
    const filesToProcess = limit < compoundFiles.length 
      ? compoundFiles.slice(0, limit) 
      : compoundFiles;
      
    console.log(`Will process ${filesToProcess.length} compounds`);
    
    // Process in batches
    let totalLoaded = 0;
    
    for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
      const batch = filesToProcess.slice(i, i + BATCH_SIZE);
      console.log(`\nProcessing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(filesToProcess.length/BATCH_SIZE)} (${batch.length} compounds)`);
      
      let retryCount = 0;
      let success = false;
      
      while (!success && retryCount <= MAX_RETRIES) {
        try {
          // We can leverage the existing loadPubChemData method
          // It will reload up to BATCH_SIZE compounds from the data directory
          const batchLoaded = await storage.loadPubChemData(batch.length);
          
          console.log(`Loaded batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batchLoaded} compounds`);
          totalLoaded += batchLoaded;
          console.log(`Total progress: ${totalLoaded}/${filesToProcess.length} compounds loaded`);
          success = true;
        } catch (error) {
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            console.error(`Error loading batch (attempt ${retryCount}/${MAX_RETRIES}):`, error);
            console.log(`Waiting before retry...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else {
            console.error(`All ${MAX_RETRIES} attempts failed to load batch. Skipping to next batch.`, error);
          }
        }
      }
    }
    
    console.log(`\n======== Loading Complete ========`);
    console.log(`Successfully loaded ${totalLoaded}/${filesToProcess.length} compounds into database`);
    
  } catch (error) {
    console.error('Error in load-compounds script:', error);
    process.exit(1);
  }
}

// Run the script
loadCompounds();