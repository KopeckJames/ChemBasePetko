import fs from 'fs/promises';
import { type InsertCompound } from '@shared/schema';

/**
 * Reads a JSON file from the given path
 */
export async function readJSON(filePath: string): Promise<any> {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading JSON file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Extracts specific properties from the raw PubChem compound data
 */
export async function processCompoundData(data: any): Promise<InsertCompound> {
  // Extract primary data from PubChem JSON
  try {
    // Handle different JSON formats from PubChem
    // The PC_Compounds format (from PubChem full data)
    if (data.PC_Compounds && Array.isArray(data.PC_Compounds) && data.PC_Compounds.length > 0) {
      return processPCCompound(data.PC_Compounds[0]);
    }
    
    // The direct compound format (from PubChem REST API)
    if (data.Record) {
      return processRecordFormat(data.Record);
    }
    
    // If the data is already in our expected format, just validate and return
    if (data.cid && data.name) {
      return validateCompound(data);
    }
    
    throw new Error('Unknown PubChem data format');
  } catch (error) {
    console.error('Error processing compound data:', error);
    throw error;
  }
}

/**
 * Process compound in PC_Compounds format
 */
function processPCCompound(compound: any): InsertCompound {
  // Get CID
  const cid = compound.id?.id?.cid || 0;
  if (!cid) {
    throw new Error('Missing compound ID (CID)');
  }
  
  // Initialize with defaults
  const result: InsertCompound = {
    cid,
    name: '',
    molecularWeight: 0,
    properties: {},
  };
  
  // Extract properties from the compound data
  if (compound.props && Array.isArray(compound.props)) {
    for (const prop of compound.props) {
      // Get name based on property types
      if (prop.urn?.label === 'IUPAC Name' && prop.value?.sval) {
        result.iupacName = prop.value.sval;
      }
      
      if (prop.urn?.label === 'Molecular Formula' && prop.value?.sval) {
        result.formula = prop.value.sval;
      }
      
      if (prop.urn?.label === 'Molecular Weight' && prop.value?.fval) {
        result.molecularWeight = prop.value.fval;
      }
      
      if (prop.urn?.label === 'InChI' && prop.value?.sval) {
        result.inchi = prop.value.sval;
      }
      
      if (prop.urn?.label === 'InChIKey' && prop.value?.sval) {
        result.inchiKey = prop.value.sval;
      }
      
      if (prop.urn?.label === 'SMILES' && prop.value?.sval) {
        result.smiles = prop.value.sval;
      }
    }
  }
  
  // Extract names
  if (compound.synonyms && Array.isArray(compound.synonyms)) {
    for (const synGroup of compound.synonyms) {
      if (synGroup.synonym && Array.isArray(synGroup.synonym)) {
        // Set the first synonym as the primary name if available
        if (synGroup.synonym.length > 0 && !result.name) {
          result.name = synGroup.synonym[0];
        }
        
        // Store all synonyms
        result.synonyms = synGroup.synonym;
      }
    }
  }
  
  // If we still don't have a name, use "Compound" + CID
  if (!result.name) {
    result.name = `Compound ${cid}`;
  }
  
  // Set default image URL
  result.imageUrl = `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${cid}&width=300&height=300`;
  
  // Add some default chemical classes if information is available
  const chemicalClasses: string[] = [];
  
  if (result.formula) {
    if (result.formula.includes('C') && result.formula.includes('H')) {
      chemicalClasses.push('Organic compounds');
      
      if (result.formula.includes('O')) {
        chemicalClasses.push('Oxygen-containing compounds');
      }
      
      if (result.formula.includes('N')) {
        chemicalClasses.push('Nitrogen-containing compounds');
      }
      
      if (result.formula.includes('S')) {
        chemicalClasses.push('Sulfur-containing compounds');
      }
    } else {
      chemicalClasses.push('Inorganic compounds');
    }
  }
  
  if (chemicalClasses.length > 0) {
    result.chemicalClass = chemicalClasses;
  }
  
  return result;
}

/**
 * Process compound in Record format (from PubChem REST API)
 */
function processRecordFormat(record: any): InsertCompound {
  const cid = record.id?.id?.cid || 0;
  if (!cid) {
    throw new Error('Missing compound ID (CID)');
  }
  
  // Initialize with defaults
  const result: InsertCompound = {
    cid,
    name: '',
    molecularWeight: 0,
    properties: {},
  };
  
  // Extract information from Record format
  if (record.recordTitle) {
    result.name = record.recordTitle;
  }
  
  if (record.iupacName) {
    result.iupacName = record.iupacName;
  }
  
  if (record.molecularFormula) {
    result.formula = record.molecularFormula;
  }
  
  if (record.molecularWeight) {
    result.molecularWeight = parseFloat(record.molecularWeight);
  }
  
  if (record.inchi) {
    result.inchi = record.inchi;
  }
  
  if (record.inchiKey) {
    result.inchiKey = record.inchiKey;
  }
  
  if (record.canonicalSmiles) {
    result.smiles = record.canonicalSmiles;
  }
  
  if (record.synonyms && Array.isArray(record.synonyms)) {
    result.synonyms = record.synonyms;
  }
  
  if (record.description) {
    result.description = record.description;
  }
  
  // Extract chemical classes
  if (record.chemicalClasses && Array.isArray(record.chemicalClasses)) {
    result.chemicalClass = record.chemicalClasses;
  } else {
    // Add some default chemical classes if information is available
    const chemicalClasses: string[] = [];
    
    if (result.formula) {
      if (result.formula.includes('C') && result.formula.includes('H')) {
        chemicalClasses.push('Organic compounds');
        
        if (result.formula.includes('O')) {
          chemicalClasses.push('Oxygen-containing compounds');
        }
        
        if (result.formula.includes('N')) {
          chemicalClasses.push('Nitrogen-containing compounds');
        }
        
        if (result.formula.includes('S')) {
          chemicalClasses.push('Sulfur-containing compounds');
        }
      } else {
        chemicalClasses.push('Inorganic compounds');
      }
    }
    
    if (chemicalClasses.length > 0) {
      result.chemicalClass = chemicalClasses;
    }
  }
  
  // Set default image URL
  result.imageUrl = `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${cid}&width=300&height=300`;
  
  // If we still don't have a name, use "Compound" + CID
  if (!result.name) {
    result.name = `Compound ${cid}`;
  }
  
  return result;
}

/**
 * Validates and completes a compound object that's already in our expected format
 */
function validateCompound(data: any): InsertCompound {
  if (!data.cid) {
    throw new Error('Missing compound ID (CID)');
  }
  
  if (!data.name) {
    data.name = `Compound ${data.cid}`;
  }
  
  // Ensure all fields have the correct type
  return {
    cid: Number(data.cid),
    name: String(data.name),
    iupacName: data.iupacName ? String(data.iupacName) : undefined,
    formula: data.formula ? String(data.formula) : undefined,
    molecularWeight: data.molecularWeight ? Number(data.molecularWeight) : undefined,
    synonyms: Array.isArray(data.synonyms) ? data.synonyms.map(String) : undefined,
    description: data.description ? String(data.description) : undefined,
    chemicalClass: Array.isArray(data.chemicalClass) ? data.chemicalClass.map(String) : undefined,
    inchi: data.inchi ? String(data.inchi) : undefined,
    inchiKey: data.inchiKey ? String(data.inchiKey) : undefined,
    smiles: data.smiles ? String(data.smiles) : undefined,
    imageUrl: data.imageUrl ? String(data.imageUrl) : `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${data.cid}&width=300&height=300`,
    properties: data.properties || {},
  };
}
