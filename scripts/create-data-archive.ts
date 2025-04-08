/**
 * Script to create a downloadable archive of PubChem compound data
 * Can be run with: npx tsx scripts/create-data-archive.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

async function createDataArchive() {
  try {
    console.log('Creating data archive...');
    
    // Create downloads directory if it doesn't exist
    const downloadsPath = path.join(process.cwd(), 'downloads');
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
    
    // Create the archive
    const archivePath = path.join(downloadsPath, 'pubchem_compounds.zip');
    
    // Get list of compound files
    const dataDir = path.join(process.cwd(), 'data');
    const files = fs.readdirSync(dataDir)
      .filter(file => file.startsWith('pubchem_compound_') && file.endsWith('.json'));
    
    console.log(`Found ${files.length} PubChem compound files`);
    
    // Create zip archive
    await execPromise(`zip -r ${archivePath} data/pubchem_compound_*.json data/download_progress.json data/download_*.log`);
    
    // Check archive size
    const stats = fs.statSync(archivePath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    console.log(`Archive created successfully at: ${archivePath}`);
    console.log(`Archive size: ${fileSizeInMB.toFixed(2)} MB`);
    console.log(`Contains ${files.length} compound files`);
    
    // Show download instructions
    console.log('\nTo download this archive:');
    console.log('1. Open the Replit file explorer');
    console.log('2. Navigate to the "downloads" folder');
    console.log('3. Right-click on "pubchem_compounds.zip"');
    console.log('4. Select "Download"');
    
  } catch (error) {
    console.error('Error creating data archive:', error);
  }
}

createDataArchive()
  .then(() => console.log('Archive creation complete'))
  .catch(err => console.error('Archive creation failed:', err));