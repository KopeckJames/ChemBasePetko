import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { processCompoundData } from '../server/db/processData';
import { batchInsertCompounds } from '../server/db/supabase';
import { addCompound } from '../server/db/weaviate';
import type { Compound, InsertCompound } from '../shared/schema';

// Constants
const DATA_DIR = path.resolve(process.cwd(), 'data');
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');

// Configure PubChem API settings
const PUBCHEM_BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const BATCH_SIZE = 10; // Number of compounds to fetch in a single batch
const RATE_LIMIT = 5; // Number of batches per second (max 399 requests/second from PubChem)
const DELAY_BETWEEN_BATCHES = 1000 / RATE_LIMIT; // Milliseconds between batch requests
const RETRY_DELAY = 5000; // Delay in milliseconds before retrying after a failed request
const MAX_RETRIES = 3; // Maximum number of retries for a failed request
const BATCH_DB_SIZE = 500; // Number of compounds to batch insert into database

// Progress tracking
interface ProgressData {
  totalCompounds: number;
  downloadedCompounds: number;
  lastCompoundId: number;
  failures: number;
  timeStarted: string;
  lastUpdated: string;
}

/**
 * Loads progress data from file if it exists
 */
function loadProgress(): ProgressData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading progress file:', error);
    }
  }

  // Default progress data
  return {
    totalCompounds: 144000, // Default total (roughly matches PubChem small molecule count)
    downloadedCompounds: 0,
    lastCompoundId: 0,
    failures: 0,
    timeStarted: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Saves progress data to file
 */
function saveProgress(progress: ProgressData): void {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Sleeps for the specified milliseconds
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches a compound from PubChem by CID
 */
async function fetchCompound(cid: number, retries = 0): Promise<any> {
  try {
    const url = `${PUBCHEM_BASE_URL}/compound/cid/${cid}/JSON`;
    const response = await axios.get(url, {
      timeout: 10000 // 10 second timeout
    });

    return response.data;
  } catch (error: any) {
    // Handle rate limiting or server errors
    if (error.response && error.response.status === 503) {
      console.warn(`Rate limited or server busy for CID ${cid}. Retrying after delay...`);
      if (retries < MAX_RETRIES) {
        // Exponential backoff
        const delay = RETRY_DELAY * Math.pow(2, retries);
        await sleep(delay);
        return fetchCompound(cid, retries + 1);
      }
    }
    
    console.error(`Failed to fetch compound CID ${cid} after ${retries} retries:`, error.message);
    throw error;
  }
}

/**
 * Main function to download compounds in batches
 */
async function downloadCompoundsInBatches(): Promise<void> {
  // Create data directory if it doesn't exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
  }

  // Load progress data
  const progress = loadProgress();
  console.log(`Starting download from CID ${progress.lastCompoundId + 1}`);
  console.log(`Downloaded so far: ${progress.downloadedCompounds} out of ${progress.totalCompounds} (${(progress.downloadedCompounds / progress.totalCompounds * 100).toFixed(2)}%)`);

  // Batch processing variables
  let batchCompounds: InsertCompound[] = [];
  let currentBatchSize = 0;
  
  try {
    // Continue from where we left off
    let currentCid = progress.lastCompoundId + 1;
    
    while (progress.downloadedCompounds < progress.totalCompounds) {
      const batchCids: number[] = [];
      
      // Create a batch of CIDs to fetch
      for (let i = 0; i < BATCH_SIZE; i++) {
        batchCids.push(currentCid + i);
      }
      
      console.log(`Fetching batch of ${BATCH_SIZE} compounds starting from CID ${currentCid}`);
      
      // Fetch compounds in parallel, but limit concurrency
      const batchResults = await Promise.allSettled(
        batchCids.map(cid => fetchCompound(cid))
      );
      
      // Process results
      let batchSuccesses = 0;
      
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const cid = batchCids[i];
        
        if (result.status === 'fulfilled') {
          try {
            // Process compound data
            const compoundData = result.value;
            const compound = await processCompoundData(compoundData);
            
            // Add to batch for database insertion
            batchCompounds.push(compound);
            currentBatchSize++;
            
            // Create a file with the compound data
            const compoundFile = path.join(DATA_DIR, `compound_${cid}.json`);
            fs.writeFileSync(compoundFile, JSON.stringify(compoundData, null, 2));
            
            batchSuccesses++;
            progress.downloadedCompounds++;
            
            // Add directly to Weaviate
            try {
              // Create a compound with ID for Weaviate
              const weaviateCompound: Compound = {
                id: cid,
                cid: compound.cid,
                name: compound.name,
                iupacName: compound.iupacName || null,
                formula: compound.formula || null,
                molecularWeight: compound.molecularWeight || null,
                synonyms: compound.synonyms || [],
                description: compound.description || "",
                chemicalClass: compound.chemicalClass || [],
                inchi: compound.inchi || "",
                inchiKey: compound.inchiKey || "",
                smiles: compound.smiles || "",
                properties: compound.properties || {},
                isProcessed: true,
                imageUrl: compound.imageUrl || null
              };
              
              await addCompound(weaviateCompound);
            } catch (weaviateError) {
              console.error(`Error adding compound ${cid} to Weaviate:`, weaviateError);
            }
            
          } catch (processingError) {
            console.error(`Error processing compound ${cid}:`, processingError);
            progress.failures++;
          }
        } else {
          console.error(`Failed to fetch compound ${cid}:`, result.reason);
          progress.failures++;
        }
      }
      
      console.log(`Batch complete. Processed ${batchSuccesses} of ${BATCH_SIZE} compounds successfully`);
      
      // Update progress
      progress.lastCompoundId = currentCid + BATCH_SIZE - 1;
      saveProgress(progress);
      
      // Batch insert to database if we've reached the threshold
      if (currentBatchSize >= BATCH_DB_SIZE) {
        try {
          console.log(`Batch inserting ${batchCompounds.length} compounds to database...`);
          await batchInsertCompounds(batchCompounds);
          console.log('Batch insert complete');
          batchCompounds = [];
          currentBatchSize = 0;
        } catch (dbError) {
          console.error('Error batch inserting compounds:', dbError);
        }
      }
      
      // Update currentCid for next batch
      currentCid += BATCH_SIZE;
      
      // Rate limiting
      console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await sleep(DELAY_BETWEEN_BATCHES);
      
      // Log progress every 10 batches
      if (currentCid % (BATCH_SIZE * 10) === 0) {
        const percentage = (progress.downloadedCompounds / progress.totalCompounds * 100).toFixed(2);
        console.log(`
=== PROGRESS UPDATE ===
Downloaded: ${progress.downloadedCompounds} compounds
Total: ${progress.totalCompounds} compounds
Percentage: ${percentage}%
Failures: ${progress.failures}
Current CID: ${currentCid}
======================
        `);
      }
    }
    
    // Insert any remaining compounds
    if (batchCompounds.length > 0) {
      try {
        console.log(`Final batch insert of ${batchCompounds.length} compounds...`);
        await batchInsertCompounds(batchCompounds);
        console.log('Final batch insert complete');
      } catch (dbError) {
        console.error('Error in final batch insert:', dbError);
      }
    }
    
    console.log(`
=== DOWNLOAD COMPLETE ===
Total downloaded: ${progress.downloadedCompounds} compounds
Failures: ${progress.failures}
Time started: ${progress.timeStarted}
Time completed: ${new Date().toISOString()}
=======================
    `);
    
  } catch (error) {
    console.error('Unhandled error during download:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('Starting batch download of PubChem compounds...');
  
  try {
    await downloadCompoundsInBatches();
  } catch (error) {
    console.error('Download process failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

// Export for use in other modules
export { downloadCompoundsInBatches };