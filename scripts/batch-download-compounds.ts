import { storage } from '../server/storage';
import fs from 'fs/promises';
import path from 'path';
import { updateProgress } from './update-progress';
import { fetchCompoundByCID } from '../server/db/downloadPubChem';

// Number of compounds to download - 144,000 as requested
const TOTAL_COUNT = 144000;
// Batch size for database loading
const BATCH_SIZE = 500;
// Batch size for downloads - decreased to reduce server load
const DOWNLOAD_BATCH_SIZE = 10;
// Rate limit for PubChem API (requests per second) - reduced to be more conservative
const REQUESTS_PER_SECOND = 10;
// Calculate wait time between batches to maintain rate limit (milliseconds)
const WAIT_TIME = Math.ceil((DOWNLOAD_BATCH_SIZE * 1000) / REQUESTS_PER_SECOND);
// Number of retries for database loading errors
const MAX_DB_RETRIES = 3;
// Maximum CID to try
const MAX_CID = 150000;
// Data path
const DATA_PATH = path.join(process.cwd(), 'data');

// Function to get existing CIDs to avoid duplicates
async function getExistingCIDs(): Promise<Set<number>> {
  const files = await fs.readdir(DATA_PATH);
  const cidSet = new Set<number>();
  
  for (const file of files) {
    if (file.startsWith('pubchem_compound_') && file.endsWith('.json')) {
      const cidStr = file.replace('pubchem_compound_', '').replace('.json', '');
      const cid = parseInt(cidStr, 10);
      if (!isNaN(cid)) {
        cidSet.add(cid);
      }
    }
  }
  
  console.log(`Found ${cidSet.size} existing compounds to avoid duplicates`);
  return cidSet;
}

// Function to generate random unique CIDs
function generateRandomCIDs(count: number, existingCIDs: Set<number>): number[] {
  const cids: number[] = [];
  let attempts = 0;
  
  while (cids.length < count && attempts < count * 10) {
    const cid = Math.floor(Math.random() * MAX_CID) + 1;
    
    // Only add if not already in the existing list or newly generated list
    if (!existingCIDs.has(cid) && !cids.includes(cid)) {
      cids.push(cid);
    }
    
    attempts++;
  }
  
  return cids;
}

// Main function to download and process compounds in batches
async function batchDownloadCompounds() {
  try {
    console.log(`Starting batch download of ${TOTAL_COUNT} compounds...`);
    console.log(`Will process in batches of ${BATCH_SIZE} for database loading`);
    
    // Get existing CIDs to avoid duplicates
    const existingCIDs = await getExistingCIDs();
    let downloadedCount = 0;
    let batchCount = 0;
    let currentBatchSize = 0;
    
    while (downloadedCount < TOTAL_COUNT) {
      // Calculate how many compounds to download in this iteration
      const remainingTotal = TOTAL_COUNT - downloadedCount;
      const batchTarget = Math.min(BATCH_SIZE, remainingTotal);
      
      console.log(`\n=== Starting download batch ${++batchCount} (${batchTarget} compounds) ===`);
      console.log(`Downloaded so far: ${downloadedCount}/${TOTAL_COUNT}`);
      
      // We'll generate 3x the CIDs we need in case some fail
      const cidsToTry = generateRandomCIDs(batchTarget * 3, existingCIDs);
      let batchDownloadedCount = 0;
      currentBatchSize = 0;
      
      // Process CIDs in smaller batches to respect API rate limits
      for (let i = 0; i < cidsToTry.length && batchDownloadedCount < batchTarget; i += DOWNLOAD_BATCH_SIZE) {
        const batch = cidsToTry.slice(i, i + DOWNLOAD_BATCH_SIZE);
        
        console.log(`Processing download mini-batch ${Math.floor(i/DOWNLOAD_BATCH_SIZE) + 1} with ${batch.length} CIDs`);
        
        // Process each CID in parallel within the batch
        const batchPromises = batch.map(async (cid) => {
          if (batchDownloadedCount >= batchTarget) return null;
          
          const compound = await fetchCompoundByCID(cid);
          if (!compound) return null;
          
          // Save the compound data
          const filename = path.join(DATA_PATH, `pubchem_compound_${cid}.json`);
          await fs.writeFile(filename, JSON.stringify(compound, null, 2), 'utf8');
          
          // Add to existing CIDs set to avoid duplicates
          existingCIDs.add(cid);
          
          console.log(`Downloaded compound CID ${cid}`);
          batchDownloadedCount++;
          currentBatchSize++;
          
          return { cid, filename };
        });
        
        // Wait for all CIDs in the batch to be processed
        const results = await Promise.all(batchPromises);
        const successful = results.filter(Boolean);
        
        console.log(`Mini-batch completed: ${successful.length}/${batch.length} compounds downloaded successfully`);
        
        // Wait to maintain rate limit
        if (batchDownloadedCount < batchTarget) {
          console.log(`Waiting ${WAIT_TIME}ms before next batch to maintain rate limit...`);
          await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
        }
      }
      
      downloadedCount += batchDownloadedCount;
      console.log(`Batch ${batchCount} completed: ${batchDownloadedCount} compounds downloaded`);
      console.log(`Total progress: ${downloadedCount}/${TOTAL_COUNT} compounds (${(downloadedCount/TOTAL_COUNT*100).toFixed(2)}%)`);
      
      // Update progress file
      const batchInfo = {
        batchNumber: batchCount,
        downloadedInBatch: batchDownloadedCount,
        totalDownloaded: downloadedCount,
        percentComplete: (downloadedCount/TOTAL_COUNT*100).toFixed(2)
      };
      await updateProgress('downloading', downloadedCount, TOTAL_COUNT, batchInfo);
      
      // Load this batch into the database
      if (currentBatchSize > 0) {
        console.log(`\n=== Loading batch ${batchCount} (${currentBatchSize} compounds) into database ===`);
        
        let dbRetryCount = 0;
        let dbSuccess = false;
        
        while (!dbSuccess && dbRetryCount <= MAX_DB_RETRIES) {
          try {
            // Update progress to indicate database loading
            await updateProgress('loading_database', downloadedCount, TOTAL_COUNT, {
              batchNumber: batchCount,
              batchSize: currentBatchSize,
              attempt: dbRetryCount + 1
            });
            
            await storage.loadPubChemData(currentBatchSize);
            console.log(`Successfully loaded batch ${batchCount} into database`);
            dbSuccess = true;
            
            // Update progress to indicate success
            await updateProgress('database_loaded', downloadedCount, TOTAL_COUNT, {
              batchNumber: batchCount,
              batchSize: currentBatchSize,
              success: true
            });
          } catch (error) {
            dbRetryCount++;
            if (dbRetryCount <= MAX_DB_RETRIES) {
              console.error(`Error loading batch ${batchCount} into database (attempt ${dbRetryCount}/${MAX_DB_RETRIES}):`, error);
              console.log(`Waiting before retry...`);
              
              // Update progress to indicate database loading failure
              await updateProgress('database_load_failed', downloadedCount, TOTAL_COUNT, {
                batchNumber: batchCount,
                batchSize: currentBatchSize,
                attempt: dbRetryCount,
                error: String(error)
              });
              
              // Wait before retrying database operation
              await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
              console.error(`All ${MAX_DB_RETRIES} attempts failed to load batch ${batchCount} into database:`, error);
              
              // Update progress to indicate all retries failed
              await updateProgress('database_load_failed_max_retries', downloadedCount, TOTAL_COUNT, {
                batchNumber: batchCount,
                batchSize: currentBatchSize,
                maxRetries: MAX_DB_RETRIES,
                error: String(error)
              });
            }
          }
        }
      }
    }
    
    console.log(`\n=== Download and loading complete! ===`);
    console.log(`Total compounds downloaded: ${downloadedCount}`);
    
    // Update progress file to indicate completion
    await updateProgress('completed', downloadedCount, TOTAL_COUNT, {
      finalStatus: 'success',
      totalDownloaded: downloadedCount,
      completionTime: new Date().toISOString()
    });
    
    process.exit(0);
  } catch (error) {
    // Get the current status to determine how many were downloaded
    let currentDownloaded = 0;
    try {
      const progressData = await fs.readFile(path.join(DATA_PATH, 'download_progress.json'), 'utf8');
      const progress = JSON.parse(progressData);
      currentDownloaded = progress.downloadedCount || 0;
    } catch (e) {
      // Ignore errors reading the file
    }
    
    console.error('Error in batch-download-compounds script:', error);
    
    // Update progress file to indicate critical error
    await updateProgress('failed', currentDownloaded, TOTAL_COUNT, {
      error: String(error),
      errorTime: new Date().toISOString()
    }).catch(progressError => {
      console.error('Failed to update progress file with error status:', progressError);
    });
    
    process.exit(1);
  }
}

// Create a function to initialize and start the download process
async function initialize() {
  try {
    // Initialize progress file with starting status
    await updateProgress('initializing', 0, TOTAL_COUNT, {
      startTime: new Date().toISOString()
    });
    
    // Initialize the database first to ensure Weaviate schema is set up
    console.log('Initializing database...');
    await storage.initializeDatabase();
    
    // Update progress
    await updateProgress('initialized', 0, TOTAL_COUNT, {
      databaseInitialized: true,
      initTime: new Date().toISOString()
    });
    
    console.log('Database initialized. Starting batch downloads...');
    await batchDownloadCompounds();
  } catch (error) {
    console.error('Failed during initialization:', error);
    
    // Update progress file with error
    await updateProgress('initialization_failed', 0, TOTAL_COUNT, {
      error: String(error),
      errorTime: new Date().toISOString()
    }).catch(progressError => {
      console.error('Failed to update progress file with error status:', progressError);
    });
    
    process.exit(1);
  }
}

// Start the initialization and download process
initialize();