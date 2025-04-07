import fs from 'fs/promises';
import path from 'path';

const PROGRESS_FILE = path.join(process.cwd(), 'data', 'download_progress.json');
const DATA_PATH = path.join(process.cwd(), 'data');

/**
 * Script to check the current progress of the compound downloads
 * Can be run with: npx tsx scripts/check-progress.ts
 */
async function checkProgress() {
  try {
    // Check if progress file exists
    try {
      await fs.access(PROGRESS_FILE);
    } catch (err) {
      console.error('No download progress file found. Has a download been started?');
      return;
    }
    
    // Read progress file
    const progressData = await fs.readFile(PROGRESS_FILE, 'utf8');
    const progress = JSON.parse(progressData);
    
    console.log('======== Download Progress Summary ========');
    console.log(`Status: ${progress.status}`);
    console.log(`Downloaded: ${progress.downloadedCount}/${progress.totalCount} compounds (${(progress.downloadedCount/progress.totalCount*100).toFixed(2)}%)`);
    console.log(`Last update: ${progress.lastUpdate}`);
    console.log(`Recent batches: ${progress.batches.length}`);
    
    // Count actual files to see if they match reported numbers
    const files = await fs.readdir(DATA_PATH);
    const compoundFiles = files.filter(file => file.startsWith('pubchem_compound_') && file.endsWith('.json'));
    
    console.log('\n======== File System Status ========');
    console.log(`Compound files on disk: ${compoundFiles.length}`);
    
    // Check the latest log files
    try {
      const stdoutLogPath = path.join(DATA_PATH, 'download_stdout.log');
      const stderrLogPath = path.join(DATA_PATH, 'download_stderr.log');
      
      let stdoutStats, stderrStats;
      
      try {
        stdoutStats = await fs.stat(stdoutLogPath);
      } catch (err) {
        console.log('No stdout log file found.');
      }
      
      try {
        stderrStats = await fs.stat(stderrLogPath);
      } catch (err) {
        console.log('No stderr log file found.');
      }
      
      if (stdoutStats) {
        console.log(`\nStdout log last modified: ${stdoutStats.mtime}`);
        console.log(`Stdout log size: ${(stdoutStats.size / 1024).toFixed(2)} KB`);
      }
      
      if (stderrStats) {
        console.log(`\nStderr log last modified: ${stderrStats.mtime}`);
        console.log(`Stderr log size: ${(stderrStats.size / 1024).toFixed(2)} KB`);
        
        // If error log is not empty, show the last few errors
        if (stderrStats.size > 0) {
          console.log('\n======== Recent Errors ========');
          // Read last 5KB of error logs
          const buffer = Buffer.alloc(Math.min(stderrStats.size, 5 * 1024));
          const fd = await fs.open(stderrLogPath, 'r');
          await fd.read(buffer, 0, buffer.length, stderrStats.size - buffer.length);
          await fd.close();
          
          console.log(buffer.toString('utf8'));
        }
      }
    } catch (err) {
      console.error('Error checking log files:', err);
    }
    
    // Check for latest batch info
    if (progress.batches && progress.batches.length > 0) {
      const lastBatch = progress.batches[progress.batches.length - 1];
      console.log('\n======== Latest Batch Info ========');
      console.log(JSON.stringify(lastBatch, null, 2));
    }
    
  } catch (error) {
    console.error('Error checking progress:', error);
  }
}

// Run immediately
checkProgress();