import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

// Base URL for PubChem API
const PUBCHEM_API_BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const DATA_PATH = path.join(process.cwd(), 'data');

// Function to fetch a compound by CID
async function fetchCompoundByCID(cid: number): Promise<any> {
  try {
    // Get the basic compound data
    const response = await axios.get(`${PUBCHEM_API_BASE_URL}/compound/cid/${cid}/record/JSON`);
    
    // Save raw data to disk for later use (useful for debugging)
    const data = response.data;
    return data;
  } catch (error) {
    console.error(`Error fetching CID ${cid}:`, error);
    return null;
  }
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
    const cidsToTry = Array.from({ length: count * 2 }, () => Math.floor(Math.random() * maxCID) + 1);
    
    let downloadedCount = 0;
    const batchSize = 10; // Process in smaller batches to avoid overwhelming the API
    
    for (let i = 0; i < cidsToTry.length && downloadedCount < count; i += batchSize) {
      const batch = cidsToTry.slice(i, i + batchSize);
      
      console.log(`Processing batch ${i/batchSize + 1} with CIDs: ${batch.join(', ')}`);
      
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
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Finished downloading ${downloadedCount} compounds`);
  } catch (error) {
    console.error('Error fetching random compounds:', error);
    throw error;
  }
}

// Export the functions for use elsewhere
export { fetchCompoundByCID, fetchRandomCompounds };