import fs from 'fs/promises';
import path from 'path';

// Path to the progress file
const PROGRESS_FILE = path.join(process.cwd(), 'data', 'download_progress.json');

/**
 * Updates the download progress file with the latest information
 * This is called from the batch-download-compounds.ts script
 */
export async function updateProgress(status: string, downloadedCount: number, totalCount: number, batchInfo: any = null) {
  try {
    // Make sure the data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (err) {
      // Directory may already exist, that's fine
    }
    
    // Count actual downloaded files
    let actualDownloadedCount = downloadedCount;
    try {
      const files = await fs.readdir(dataDir);
      const compoundFiles = files.filter(file => file.startsWith('pubchem_compound_') && file.endsWith('.json'));
      actualDownloadedCount = compoundFiles.length;
      console.log(`Actual downloaded files count: ${actualDownloadedCount}`);
    } catch (err) {
      console.error('Error counting downloaded files:', err);
      // Continue with the provided count if we can't count files
    }
    
    // Read the existing progress if any
    let progress: any = {
      status: 'starting',
      downloadedCount: actualDownloadedCount,
      totalCount,
      lastUpdate: new Date().toISOString(),
      batches: []
    };
    
    try {
      const progressData = await fs.readFile(PROGRESS_FILE, 'utf8');
      progress = JSON.parse(progressData);
      // Update with actual count but keep other properties
    } catch (err) {
      // File may not exist yet, which is fine
    }
    
    // Update the progress
    progress.status = status;
    progress.downloadedCount = actualDownloadedCount;
    progress.totalCount = totalCount;
    progress.lastUpdate = new Date().toISOString();
    
    // Add batch info if provided
    if (batchInfo) {
      progress.batches.push({
        ...batchInfo,
        timestamp: new Date().toISOString()
      });
      
      // Keep only the last 50 batches to avoid the file growing too large
      if (progress.batches.length > 50) {
        progress.batches = progress.batches.slice(-50);
      }
    }
    
    // Write the updated progress
    await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
    
    return progress;
  } catch (error) {
    console.error('Error updating progress file:', error);
    // Don't throw as this is not critical and shouldn't stop the download process
    return null;
  }
}

// If this script is run directly, update and log the current progress
// For ESM compatibility we'll check this differently
if (import.meta.url.endsWith('update-progress.ts')) {
  // First try to read the existing progress file
  fs.readFile(PROGRESS_FILE, 'utf8')
    .then(async (data) => {
      try {
        const progress = JSON.parse(data);
        console.log('Current progress before update:');
        console.log(`Status: ${progress.status}`);
        console.log(`Downloaded: ${progress.downloadedCount}/${progress.totalCount} compounds (${(progress.downloadedCount/progress.totalCount*100).toFixed(2)}%)`);
        
        // Now update the progress with actual file count
        const updatedProgress = await updateProgress(progress.status || 'running', 0, progress.totalCount || 144000);
        
        console.log('\nUpdated progress:');
        console.log(`Status: ${updatedProgress.status}`);
        console.log(`Downloaded: ${updatedProgress.downloadedCount}/${updatedProgress.totalCount} compounds (${(updatedProgress.downloadedCount/updatedProgress.totalCount*100).toFixed(2)}%)`);
        console.log(`Last update: ${updatedProgress.lastUpdate}`);
      } catch (err) {
        console.error('Error updating progress:', err);
      }
    })
    .catch(async (err) => {
      console.error('No progress file found or error reading progress, creating new one:', err.message);
      // Create a new progress file
      const updatedProgress = await updateProgress('initialized', 0, 144000);
      console.log('\nCreated new progress file:');
      console.log(`Status: ${updatedProgress.status}`);
      console.log(`Downloaded: ${updatedProgress.downloadedCount}/${updatedProgress.totalCount} compounds (${(updatedProgress.downloadedCount/updatedProgress.totalCount*100).toFixed(2)}%)`);
    });
}