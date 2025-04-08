import { InsertCompound } from '../shared/schema';
import * as fs from 'fs';

// Create a sample compound
// Our schema apparently uses camelCase properties internally
const testCompound: InsertCompound = {
  cid: 123,
  name: "Test Compound",
  iupacName: "Test IUPAC Name",
  formula: "C6H12O6",
  molecularWeight: 180.16,
  synonyms: ["Test", "Sample"],
  description: "Test description",
  chemicalClass: ["Test Class"],
  inchi: "Test InChI",
  inchiKey: "Test InChI Key",
  smiles: "Test SMILES",
  imageUrl: "https://example.com/image.png",
  properties: { test: true },
};

console.log("Valid InsertCompound:", testCompound);

// Write the test compound to a file
fs.writeFileSync('debug-compound.json', JSON.stringify(testCompound, null, 2));
console.log("Wrote test compound to debug-compound.json");