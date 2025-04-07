import fs from 'fs';
import path from 'path';

/**
 * This script checks how many compounds have been downloaded so far
 */
async function main() {
  try {
    const dataPath = path.resolve(process.cwd(), "data");
    
    // Check if data directory exists
    if (!fs.existsSync(dataPath)) {
      console.log('Data directory does not exist. No compounds have been downloaded yet.');
      return;
    }
    
    // Count PubChem JSON files
    const files = fs.readdirSync(dataPath)
      .filter(file => file.startsWith('pubchem_compound_') && file.endsWith('.json'));
    
    console.log(`Download progress: ${files.length} compounds downloaded so far`);
    
    // List the first 5 compounds as examples
    if (files.length > 0) {
      console.log('\nExample compounds:');
      files.slice(0, 5).forEach(file => {
        const cid = file.replace('pubchem_compound_', '').replace('.json', '');
        console.log(`- CID ${cid}`);
      });
    }
    
    console.log('\nDownload target: 1000 compounds');
    const percentComplete = Math.round((files.length / 1000) * 100);
    console.log(`Progress: ${percentComplete}% complete`);

    process.exit(0);
  } catch (error) {
    console.error('Error checking download progress:', error);
    process.exit(1);
  }
}

main();