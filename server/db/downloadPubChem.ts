import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

// Base URL for PubChem API
const PUBCHEM_API_BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const DATA_PATH = path.join(process.cwd(), 'data');

// Helper function to wait with exponential backoff
async function waitWithBackoff(retryAttempt: number): Promise<void> {
  // Start with 1 second, then 2, 4, 8, 16, etc.
  // Cap at 30 seconds to prevent excessive waiting
  const baseDelay = 1000;
  const maxDelay = 30000;
  const delay = Math.min(baseDelay * Math.pow(2, retryAttempt), maxDelay);
  
  // Add some randomness to prevent all retries happening at the same time
  // This helps with API rate limits (jitter)
  const jitter = Math.random() * 1000;
  const totalDelay = delay + jitter;
  
  console.log(`Waiting ${Math.round(totalDelay/1000)} seconds before retry ${retryAttempt + 1}...`);
  return new Promise(resolve => setTimeout(resolve, totalDelay));
}

// Function to fetch a compound by CID with retries
async function fetchCompoundByCID(cid: number, maxRetries: number = 3): Promise<any> {
  let retryAttempt = 0;
  
  while (retryAttempt <= maxRetries) {
    try {
      // Get the basic compound data
      const response = await axios.get(`${PUBCHEM_API_BASE_URL}/compound/cid/${cid}/record/JSON`, {
        // Set a timeout to prevent hanging requests
        timeout: 30000,
        // Add headers to identify our application
        headers: {
          'User-Agent': 'ChemBasePetko/1.0 (Chemical Compound Database; github.com/chembasepetko)'
        }
      });
      
      // Save raw data to disk for later use (useful for debugging)
      const data = response.data;
      return data;
    } catch (error: any) {
      // Check if this is a server error (5xx) which we should retry
      const isServerError = error.response && error.response.status >= 500;
      // Check if this is a rate limit error (429)
      const isRateLimitError = error.response && error.response.status === 429;
      
      if ((isServerError || isRateLimitError) && retryAttempt < maxRetries) {
        console.warn(`Attempt ${retryAttempt + 1}/${maxRetries} failed for CID ${cid}: ${error.message}`);
        retryAttempt++;
        
        // Wait with exponential backoff before retrying
        await waitWithBackoff(retryAttempt);
      } else {
        // Either we've exceeded retries or it's a non-retryable error
        if (error.response && error.response.status === 404) {
          console.log(`CID ${cid} not found (404)`);
        } else if (error.response && error.response.status === 400) {
          console.log(`Invalid CID ${cid} (400)`);
        } else {
          console.error(`Error fetching CID ${cid}:`, error.message);
        }
        return null;
      }
    }
  }
  
  console.error(`All ${maxRetries} retries failed for CID ${cid}`);
  return null;
}

// Function to fetch a list of random compounds
async function fetchRandomCompounds(count: number = 100): Promise<void> {
  try {
    // Make sure the data directory exists
    try {
      await fs.mkdir(DATA_PATH, { recursive: true });
    } catch (err) {
      // Directory may already exist, that's fine
    }
    
    console.log(`Will download ${count} random compounds from PubChem...`);
    
    // First, get a list of random CIDs
    // We'll generate random CIDs within a reasonable range that's likely to exist
    // PubChem has over 100 million compounds, but not all CIDs are sequential
    // We'll try a range of CIDs and validate them
    
    // Get a list of random CIDs (we'll request more than needed in case some are invalid)
    const maxCID = 150000; // A reasonable max CID that's likely to exist
    const cidsToTry = Array.from({ length: count * 3 }, () => Math.floor(Math.random() * maxCID) + 1);
    
    let downloadedCount = 0;
    // Increased batch size to maximize throughput while staying under 399 requests per second
    const batchSize = 40; 
    // Calculate time to wait between batches to maintain rate limit (in milliseconds)
    const requestsPerSecond = 399;
    const waitTime = Math.ceil((batchSize * 1000) / requestsPerSecond);
    
    console.log(`Rate limit set to ${requestsPerSecond} requests per second`);
    console.log(`Processing ${batchSize} compounds per batch with ${waitTime}ms between requests`);
    
    for (let i = 0; i < cidsToTry.length && downloadedCount < count; i += batchSize) {
      const batch = cidsToTry.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1} with ${batch.length} CIDs`);
      
      // Process each CID in parallel within the batch
      const batchPromises = batch.map(async (cid) => {
        if (downloadedCount >= count) return null;
        
        const compound = await fetchCompoundByCID(cid);
        if (!compound) return null;
        
        // Save the compound data
        const filename = path.join(DATA_PATH, `pubchem_compound_${cid}.json`);
        await fs.writeFile(filename, JSON.stringify(compound, null, 2), 'utf8');
        
        console.log(`Downloaded compound CID ${cid} to ${filename}`);
        downloadedCount++;
        
        return { cid, filename };
      });
      
      // Wait for all CIDs in the batch to be processed
      const results = await Promise.all(batchPromises);
      const successful = results.filter(Boolean);
      
      console.log(`Batch completed: ${successful.length}/${batch.length} compounds downloaded successfully`);
      console.log(`Total progress: ${downloadedCount}/${count} compounds downloaded`);
      
      // Wait just enough time to maintain our rate limit of 399 requests per second
      if (downloadedCount < count) {
        console.log(`Waiting ${waitTime}ms before next batch to maintain rate limit...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    console.log(`Finished downloading ${downloadedCount} compounds`);
  } catch (error) {
    console.error('Error fetching random compounds:', error);
    throw error;
  }
}

// Export the functions for use elsewhere
export { fetchCompoundByCID, fetchRandomCompounds };