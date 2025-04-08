import { users, type User, type InsertUser, type Compound, type InsertCompound, type SearchQuery, type CompoundSearchResult, type SearchResponse } from "@shared/schema";
import * as astraDbClient from "./db/astradb";
import * as supabaseClient from "./db/supabase";
import { readJSON, processCompoundData } from "./db/processData";
import path from "path";
import fs from "fs";

// Storage interface for both users and compounds
export interface IStorage {
  // User methods (kept for compatibility)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Compound methods
  getCompound(cid: number): Promise<Compound | undefined>;
  getCompoundById(id: number): Promise<Compound | undefined>;
  createCompound(compound: InsertCompound): Promise<Compound>;
  getCompounds(limit?: number, offset?: number): Promise<Compound[]>;
  searchCompounds(searchQuery: SearchQuery): Promise<SearchResponse>;
  
  // Data processing methods
  initializeDatabase(): Promise<void>;
  loadPubChemData(limit?: number): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private compounds: Map<number, Compound>;
  private compoundsByCid: Map<number, Compound>;
  private currentUserId: number;
  private currentCompoundId: number;
  private dataInitialized: boolean;
  private dataPath: string;

  constructor() {
    this.users = new Map();
    this.compounds = new Map();
    this.compoundsByCid = new Map();
    this.currentUserId = 1;
    this.currentCompoundId = 1;
    this.dataInitialized = false;
    this.dataPath = path.resolve(process.cwd(), "data");
  }

  // User methods

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const [_, user] of this.users.entries()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Compound methods

  async getCompound(cid: number): Promise<Compound | undefined> {
    return this.compoundsByCid.get(cid);
  }

  async getCompoundById(id: number): Promise<Compound | undefined> {
    return this.compounds.get(id);
  }

  async createCompound(insertCompound: InsertCompound): Promise<Compound> {
    const id = this.currentCompoundId++;
    
    // Transform to ensure type compatibility
    const compound: Compound = { 
      id,
      cid: insertCompound.cid,
      name: insertCompound.name,
      iupacName: insertCompound.iupacName || null,
      formula: insertCompound.formula || null,
      molecularWeight: insertCompound.molecularWeight || null,
      synonyms: insertCompound.synonyms || null,
      description: insertCompound.description || null,
      chemicalClass: insertCompound.chemicalClass || null,
      inchi: insertCompound.inchi || null,
      inchiKey: insertCompound.inchiKey || null,
      smiles: insertCompound.smiles || null,
      properties: insertCompound.properties || {},
      isProcessed: false,
      imageUrl: insertCompound.imageUrl || null
    };
    
    this.compounds.set(id, compound);
    this.compoundsByCid.set(compound.cid, compound);
    
    console.log(`Added compound ${compound.name} (CID: ${compound.cid}) to memory storage`);
    
    return compound;
  }

  async getCompounds(limit: number = 100, offset: number = 0): Promise<Compound[]> {
    // Convert map values to array
    const compounds = Array.from(this.compounds.values());
    
    // Apply pagination
    return compounds.slice(offset, offset + limit);
  }

  async searchCompounds(searchQuery: SearchQuery): Promise<SearchResponse> {
    try {
      // If semantic search is requested and we have connected to AstraDB/Weaviate,
      // use vector database for search
      if (searchQuery.searchType === "semantic") {
        try {
          return await astraDbClient.semanticSearch(searchQuery);
        } catch (error) {
          console.error("Error performing semantic search in vector database:", error);
          console.log("Falling back to keyword search in memory storage");
          // Fall back to keyword search
          searchQuery.searchType = "keyword";
        }
      }
      
      // For keyword search or as fallback, use local search in memory storage
      // Convert map values to array
      const allCompounds = Array.from(this.compounds.values());
      
      // Extract search parameters
      const { query, page = 1, limit = 10, sort = "relevance", molecularWeight, chemicalClass } = searchQuery;
      const offset = (page - 1) * limit;
      
      // Filter compounds by search query
      let filteredCompounds = allCompounds;
      
      if (query && query.trim()) {
        const searchTerm = query.toLowerCase();
        filteredCompounds = filteredCompounds.filter(compound => {
          // Search in name, formula, and description
          const nameMatch = compound.name?.toLowerCase().includes(searchTerm);
          const formulaMatch = compound.formula?.toLowerCase().includes(searchTerm);
          const descriptionMatch = compound.description?.toLowerCase().includes(searchTerm);
          return nameMatch || formulaMatch || descriptionMatch;
        });
      }
      
      // Apply molecular weight filter if provided
      if (molecularWeight && molecularWeight !== "all") {
        filteredCompounds = filteredCompounds.filter(compound => 
          this.filterByMolecularWeight(compound, molecularWeight)
        );
      }
      
      // Apply chemical class filter if provided
      if (chemicalClass && chemicalClass !== "all") {
        filteredCompounds = filteredCompounds.filter(compound => 
          compound.chemicalClass && compound.chemicalClass.includes(chemicalClass)
        );
      }
      
      // Sort results
      const sortedCompounds = this.sortCompounds(filteredCompounds, sort);
      
      // Apply pagination
      const pagedCompounds = sortedCompounds.slice(offset, offset + limit);
      
      // Convert to CompoundSearchResult format
      const results: CompoundSearchResult[] = pagedCompounds.map(compound => ({
        cid: compound.cid,
        name: compound.name,
        iupacName: compound.iupacName !== null ? compound.iupacName : undefined,
        formula: compound.formula !== null ? compound.formula : undefined,
        molecularWeight: compound.molecularWeight !== null ? compound.molecularWeight : undefined,
        chemicalClass: compound.chemicalClass !== null ? compound.chemicalClass : undefined,
        description: compound.description !== null ? compound.description : undefined,
        similarity: 0, // No similarity score for keyword search
        imageUrl: compound.imageUrl || this.getDefaultImageUrl(compound.cid)
      }));
      
      // Sort the results for final presentation
      const sortedResults = this.sortSearchResults(results, sort);
      
      return {
        results: sortedResults,
        totalResults: filteredCompounds.length,
        page,
        totalPages: Math.ceil(filteredCompounds.length / limit),
        query
      };
    } catch (error) {
      console.error("Error searching compounds:", error);
      throw error;
    }
  }

  // Helper methods for searching and filtering

  private filterByMolecularWeight(compound: Compound, filter: string): boolean {
    if (!compound.molecularWeight) return false;
    
    switch(filter) {
      case "lt_100":
        return compound.molecularWeight < 100;
      case "100-200":
        return compound.molecularWeight >= 100 && compound.molecularWeight <= 200;
      case "200-500":
        return compound.molecularWeight > 200 && compound.molecularWeight <= 500;
      case "gt_500":
        return compound.molecularWeight > 500;
      default:
        return true;
    }
  }

  private sortCompounds(compounds: Compound[], sortBy: string): Compound[] {
    switch(sortBy) {
      case "molecular_weight":
        return [...compounds].sort((a, b) => {
          const weightA = a.molecularWeight || 0;
          const weightB = b.molecularWeight || 0;
          return weightA - weightB;
        });
      case "name":
        return [...compounds].sort((a, b) => {
          const nameA = a.name || "";
          const nameB = b.name || "";
          return nameA.localeCompare(nameB);
        });
      case "relevance":
      default:
        // For relevance, we keep the current order (which would be based on match quality in a real system)
        return compounds;
    }
  }

  private sortSearchResults(results: CompoundSearchResult[], sortBy: string): CompoundSearchResult[] {
    switch(sortBy) {
      case "molecular_weight":
        return [...results].sort((a, b) => {
          const weightA = a.molecularWeight || 0;
          const weightB = b.molecularWeight || 0;
          return weightA - weightB;
        });
      case "name":
        return [...results].sort((a, b) => {
          const nameA = a.name || "";
          const nameB = b.name || "";
          return nameA.localeCompare(nameB);
        });
      case "relevance":
      default:
        // For relevance, sort by similarity score
        return [...results].sort((a, b) => {
          const simA = a.similarity || 0;
          const simB = b.similarity || 0;
          return simB - simA; // Higher similarity first
        });
    }
  }

  private getDefaultImageUrl(cid: number): string {
    return `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${cid}&width=300&height=300`;
  }

  // Data initialization methods

  async ensureInitialized(): Promise<void> {
    if (!this.dataInitialized) {
      await this.initializeDatabase();
    }
  }

  async initializeDatabase(): Promise<void> {
    // Track external database connection status
    let supabaseConnected = false;
    let astradbConnected = false;
    
    console.log("Initializing database...");
    
    // Initialize external database connections
    try {
      await supabaseClient.initializeDatabase();
      supabaseConnected = true;
      console.log("Supabase database initialized successfully");
    } catch (error) {
      console.error("Error initializing Supabase:", error instanceof Error ? error.message : String(error));
      console.log("Will continue with in-memory storage for relational data");
    }
    
    try {
      await astraDbClient.initializeSchema();
      astradbConnected = true;
      console.log("AstraDB database initialized successfully");
    } catch (error) {
      console.error("Error initializing AstraDB:", error instanceof Error ? error.message : String(error));
      console.log("Will continue with in-memory storage for vector search");
    }
    
    if (!supabaseConnected && !astradbConnected) {
      console.log("NOTICE: Both external databases are unavailable. Using in-memory storage only.");
      console.log("Some functionality may be limited, but the application will continue to work.");
    } else if (!supabaseConnected) {
      console.log("NOTICE: Supabase is unavailable. Using in-memory storage for relational data.");
      console.log("AstraDB will be used for vector search.");
    } else if (!astradbConnected) {
      console.log("NOTICE: AstraDB is unavailable. Using in-memory storage for vector search.");
      console.log("Supabase will be used for relational data.");
    } else {
      console.log("NOTICE: All external databases are connected and working properly.");
    }
    
    // Load sample data from files
    try {
      const loadCount = await this.loadPubChemData(20);
      console.log(`Loaded ${loadCount} PubChem compounds during initialization`);
    } catch (error) {
      console.error("Error loading PubChem data:", error instanceof Error ? error.message : String(error));
      console.log("Continuing initialization without loading compound data");
    }
    
    this.dataInitialized = true;
    console.log("Database initialization complete");
  }

  async loadPubChemData(limit: number = 1000): Promise<number> {
    try {
      // Check if data directory exists
      if (!fs.existsSync(this.dataPath)) {
        console.log(`Creating data directory: ${this.dataPath}`);
        fs.mkdirSync(this.dataPath, { recursive: true });
      }
      
      // Get list of JSON files in the data directory, only including compound files
      const files = fs.readdirSync(this.dataPath)
        .filter(file => file.startsWith('pubchem_compound_') && file.endsWith('.json'))
        .map(file => path.join(this.dataPath, file));
      
      if (files.length === 0) {
        console.log("No JSON files found in data directory. Please download PubChem compound data files.");
        return 0;
      }
      
      let loadedCount = 0;
      let availableFiles = files;
      
      // Skip files for compounds we already have in our database
      if (this.compoundsByCid.size > 0) {
        const existingCids = Array.from(this.compoundsByCid.keys());
        availableFiles = files.filter(file => {
          const filenameParts = path.basename(file).split('_');
          const cidPart = filenameParts[filenameParts.length - 1].replace('.json', '');
          const cid = parseInt(cidPart, 10);
          return !isNaN(cid) && !existingCids.includes(cid);
        });
        
        console.log(`Filtered out ${files.length - availableFiles.length} files for compounds already in database`);
      }
      
      // Sort files to ensure consistent loading order
      availableFiles.sort();
      
      // Process files up to the limit
      const filesToProcess = availableFiles.slice(0, limit);
      console.log(`Processing ${filesToProcess.length} compound files...`);
      
      // Process in batches for better performance
      const batchSize = 50;
      for (let i = 0; i < filesToProcess.length; i += batchSize) {
        const batch = filesToProcess.slice(i, i + batchSize);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (file) => {
          try {
            const jsonData = await readJSON(file);
            
            // Process each compound in the JSON file
            for (const compoundData of Array.isArray(jsonData) ? jsonData : [jsonData]) {
              try {
                // Process the raw compound data
                const compound = await processCompoundData(compoundData);
                
                // Check if we already have this compound
                const existingCompound = await this.getCompound(compound.cid);
                if (existingCompound) {
                  console.log(`Compound CID ${compound.cid} already exists in database, skipping`);
                  return null;
                }
                
                // Add to memory storage
                const createdCompound = await this.createCompound(compound);
                
                // Add to Supabase relational database
                try {
                  await supabaseClient.addCompound(compound);
                } catch (dbError) {
                  console.error(`Error adding compound ${compound.cid} to Supabase:`, 
                    dbError instanceof Error ? dbError.message : String(dbError));
                  // Continue with in-memory storage even if Supabase fails
                }
                
                // Add to AstraDB vector database  
                try {
                  await astraDbClient.addCompound(createdCompound);
                } catch (dbError) {
                  console.error(`Error adding compound ${compound.cid} to AstraDB:`, 
                    dbError instanceof Error ? dbError.message : String(dbError));
                  // Continue with in-memory storage even if AstraDB fails
                }
                
                // Mark as processed
                createdCompound.isProcessed = true;
                
                return createdCompound;
              } catch (error) {
                console.error(`Error processing compound in file ${file}:`, error);
                return null;
              }
            }
          } catch (error) {
            console.error(`Error processing file ${file}:`, error);
            return null;
          }
        });
        
        // Wait for all compounds in the batch to be processed
        const results = await Promise.all(batchPromises);
        const successfulLoads = results.filter(Boolean);
        loadedCount += successfulLoads.length;
        
        console.log(`Loaded batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(filesToProcess.length/batchSize)}: ${successfulLoads.length} compounds`);
        console.log(`Total progress: ${loadedCount}/${limit} compounds loaded`);
      }
      
      console.log(`Successfully loaded ${loadedCount} compounds into database`);
      return loadedCount;
    } catch (error) {
      console.error("Error loading PubChem data:", error);
      throw error;
    }
  }
}

export const storage = new MemStorage();
