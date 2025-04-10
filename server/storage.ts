import { users, type User, type InsertUser, type Compound, type InsertCompound, type SearchQuery, type CompoundSearchResult, type SearchResponse } from "@shared/schema";
import * as weaviateClient from "./db/weaviate";
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
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
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
    // Ensure null values for optional fields that might be undefined
    const compound: Compound = { 
      ...insertCompound, 
      id,
      isProcessed: false,
      iupacName: insertCompound.iupacName || null,
      formula: insertCompound.formula || null,
      molecularWeight: insertCompound.molecularWeight || null,
      synonyms: insertCompound.synonyms || null,
      description: insertCompound.description || null,
      chemicalClass: insertCompound.chemicalClass || null,
      inchi: insertCompound.inchi || null,
      inchiKey: insertCompound.inchiKey || null,
      smiles: insertCompound.smiles || null,
      properties: insertCompound.properties || null,
      imageUrl: insertCompound.imageUrl || null
    };
    
    this.compounds.set(id, compound);
    this.compoundsByCid.set(compound.cid, compound);
    
    return compound;
  }

  async getCompounds(limit: number = 100, offset: number = 0): Promise<Compound[]> {
    const compounds = Array.from(this.compounds.values());
    return compounds.slice(offset, offset + limit);
  }

  async searchCompounds(searchQuery: SearchQuery): Promise<SearchResponse> {
    await this.ensureInitialized();
    
    const { query, searchType, molecularWeight, chemicalClass, sort, page, limit } = searchQuery;
    
    let results: CompoundSearchResult[] = [];
    let totalResults = 0;
    
    // Get results from Weaviate if it's a semantic search
    if (searchType === "semantic") {
      const weaviateResults = await weaviateClient.semanticSearch(query, limit, (page - 1) * limit);
      results = weaviateResults.results;
      totalResults = weaviateResults.totalResults;
    } else {
      // For keyword search, perform a simple in-memory search
      const compounds = Array.from(this.compounds.values());
      const filteredCompounds = compounds.filter(compound => {
        // Basic keyword match on name, synonyms, description
        const matchesKeyword = 
          compound.name.toLowerCase().includes(query.toLowerCase()) ||
          (compound.description?.toLowerCase().includes(query.toLowerCase())) ||
          (compound.synonyms?.some(syn => syn.toLowerCase().includes(query.toLowerCase())));
        
        // Apply molecular weight filter if specified (ignore "all" value)
        const matchesMolWeight = !molecularWeight || molecularWeight === "all" || 
          this.filterByMolecularWeight(compound, molecularWeight);
        
        // Apply chemical class filter if specified (ignore "all" value)
        const matchesChemClass = !chemicalClass || chemicalClass === "all" || 
          (compound.chemicalClass?.some(cls => cls.toLowerCase().includes(chemicalClass.toLowerCase())));
        
        return matchesKeyword && matchesMolWeight && matchesChemClass;
      });
      
      // Apply sorting
      const sortedCompounds = this.sortCompounds(filteredCompounds, sort);
      
      // Apply pagination
      totalResults = sortedCompounds.length;
      const paginatedCompounds = sortedCompounds.slice((page - 1) * limit, page * limit);
      
      // Convert to CompoundSearchResult format
      results = paginatedCompounds.map(compound => {
        // Convert from DB type (null) to API type (undefined)
        return {
          cid: compound.cid,
          name: compound.name,
          iupacName: compound.iupacName || undefined,
          formula: compound.formula || undefined,
          molecularWeight: compound.molecularWeight || undefined,
          chemicalClass: compound.chemicalClass || undefined,
          description: compound.description || undefined,
          imageUrl: compound.imageUrl || this.getDefaultImageUrl(compound.cid),
          similarity: 0 // No similarity score for keyword search
        };
      });
    }
    
    // Apply filters to semantic search results if needed
    if (searchType === "semantic" && (molecularWeight || chemicalClass)) {
      results = results.filter(result => {
        const compound = this.compoundsByCid.get(result.cid);
        if (!compound) return false;
        
        const matchesMolWeight = !molecularWeight || this.filterByMolecularWeight(compound, molecularWeight);
        const matchesChemClass = !chemicalClass || 
          (compound.chemicalClass?.some(cls => cls.toLowerCase().includes(chemicalClass.toLowerCase())));
        
        return matchesMolWeight && matchesChemClass;
      });
      
      // Update total after filtering
      totalResults = results.length;
    }
    
    // Apply sorting if needed for semantic search
    if (searchType === "semantic" && sort !== "relevance") {
      results = this.sortSearchResults(results, sort);
    }
    
    return {
      results,
      totalResults,
      page,
      totalPages: Math.ceil(totalResults / limit),
      query
    };
  }

  // Helper methods for filtering and sorting

  private filterByMolecularWeight(compound: Compound, filter: string): boolean {
    if (!compound.molecularWeight) return false;
    
    switch (filter) {
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
    switch (sortBy) {
      case "molecular_weight":
        return [...compounds].sort((a, b) => {
          if (!a.molecularWeight) return 1;
          if (!b.molecularWeight) return -1;
          return a.molecularWeight - b.molecularWeight;
        });
      case "name":
        return [...compounds].sort((a, b) => a.name.localeCompare(b.name));
      default:
        return compounds;
    }
  }

  private sortSearchResults(results: CompoundSearchResult[], sortBy: string): CompoundSearchResult[] {
    switch (sortBy) {
      case "molecular_weight":
        return [...results].sort((a, b) => {
          if (!a.molecularWeight) return 1;
          if (!b.molecularWeight) return -1;
          return a.molecularWeight - b.molecularWeight;
        });
      case "name":
        return [...results].sort((a, b) => a.name.localeCompare(b.name));
      default:
        return results;
    }
  }

  private getDefaultImageUrl(cid: number): string {
    return `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${cid}&width=300&height=300`;
  }

  // Database initialization and data loading

  async ensureInitialized(): Promise<void> {
    if (!this.dataInitialized) {
      await this.initializeDatabase();
    }
  }

  async initializeDatabase(): Promise<void> {
    try {
      console.log("Initializing Weaviate database...");
      await weaviateClient.initializeSchema();
      
      // If there are no compounds in memory, try to load some
      if (this.compounds.size === 0) {
        // Create data directory if it doesn't exist
        if (!fs.existsSync(this.dataPath)) {
          fs.mkdirSync(this.dataPath, { recursive: true });
          console.log(`Created data directory: ${this.dataPath}`);
        }
        
        // Try to load some data - limit to 20 compounds for faster startup
        await this.loadPubChemData(20);
      }
      
      this.dataInitialized = true;
      console.log("Database initialization complete");
    } catch (error) {
      console.error("Failed to initialize database:", error);
      throw error;
    }
  }

  async loadPubChemData(limit: number = 1000): Promise<number> {
    try {
      console.log(`Loading up to ${limit} PubChem compounds...`);
      
      // Check if data directory exists
      if (!fs.existsSync(this.dataPath)) {
        console.log(`Creating data directory: ${this.dataPath}`);
        fs.mkdirSync(this.dataPath, { recursive: true });
      }
      
      // Get list of JSON files in the data directory
      const files = fs.readdirSync(this.dataPath)
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(this.dataPath, file));
      
      if (files.length === 0) {
        console.log("No JSON files found in data directory. Please download PubChem compound data files.");
        return 0;
      }
      
      let loadedCount = 0;
      
      for (const file of files) {
        if (loadedCount >= limit) break;
        
        const jsonData = await readJSON(file);
        
        // Process each compound in the JSON file
        for (const compoundData of Array.isArray(jsonData) ? jsonData : [jsonData]) {
          if (loadedCount >= limit) break;
          
          try {
            // Process the raw compound data
            const compound = await processCompoundData(compoundData);
            
            // Add to memory storage
            const createdCompound = await this.createCompound(compound);
            
            // Add to Weaviate
            await weaviateClient.addCompound(createdCompound);
            
            loadedCount++;
            
            // Mark as processed
            createdCompound.isProcessed = true;
            
            if (loadedCount % 100 === 0) {
              console.log(`Loaded ${loadedCount} compounds...`);
            }
          } catch (error) {
            console.error(`Error processing compound:`, error);
          }
        }
      }
      
      console.log(`Successfully loaded ${loadedCount} compounds`);
      return loadedCount;
    } catch (error) {
      console.error("Error loading PubChem data:", error);
      throw error;
    }
  }
}

/**
 * Supabase implementation of the storage interface
 */
export class SupabaseStorage implements IStorage {
  private dataInitialized: boolean;
  private dataPath: string;

  constructor() {
    this.dataInitialized = false;
    this.dataPath = path.resolve(process.cwd(), "data");
  }

  // User methods

  async getUser(id: number): Promise<User | undefined> {
    return await supabaseClient.getUser(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return await supabaseClient.getUserByUsername(username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return await supabaseClient.createUser(insertUser);
  }

  // Compound methods

  async getCompound(cid: number): Promise<Compound | undefined> {
    return await supabaseClient.getCompoundByCid(cid);
  }

  async getCompoundById(id: number): Promise<Compound | undefined> {
    return await supabaseClient.getCompoundById(id);
  }

  async createCompound(insertCompound: InsertCompound): Promise<Compound> {
    try {
      // Create compound in Supabase
      const compound = await supabaseClient.createCompound(insertCompound);
      
      // Also add to Weaviate for search capabilities
      await weaviateClient.addCompound(compound);
      
      return compound;
    } catch (error) {
      console.error(`Error creating compound in SupabaseStorage:`, error);
      throw new Error(`Failed to create compound: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCompounds(limit: number = 100, offset: number = 0): Promise<Compound[]> {
    return await supabaseClient.getCompounds(limit, offset);
  }

  async searchCompounds(searchQuery: SearchQuery): Promise<SearchResponse> {
    await this.ensureInitialized();
    
    try {
      const { query, searchType, molecularWeight, chemicalClass, sort, page, limit } = searchQuery;
      
      // Use Weaviate for semantic search
      if (searchType === "semantic") {
        return await weaviateClient.semanticSearch(query, limit, (page - 1) * limit, sort as any);
      }
      
      // For keyword search, get compounds from Supabase and filter them
      // This is a simplified implementation - in production, you'd use SQL filtering
      const compounds = await supabaseClient.getCompounds(1000, 0); // Get a large batch for filtering
      
      // Filter compounds based on query and other criteria
      const filteredCompounds = compounds.filter(compound => {
        // Basic keyword match on name, synonyms, description
        const matchesKeyword = 
          compound.name.toLowerCase().includes(query.toLowerCase()) ||
          (compound.description?.toLowerCase().includes(query.toLowerCase())) ||
          (compound.synonyms?.some(syn => syn.toLowerCase().includes(query.toLowerCase())));
        
        // Apply molecular weight filter if specified
        const matchesMolWeight = !molecularWeight || molecularWeight === "all" || 
          this.filterByMolecularWeight(compound, molecularWeight);
        
        // Apply chemical class filter if specified
        const matchesChemClass = !chemicalClass || chemicalClass === "all" || 
          (compound.chemicalClass?.some(cls => cls.toLowerCase().includes(chemicalClass.toLowerCase())));
        
        return matchesKeyword && matchesMolWeight && matchesChemClass;
      });
      
      // Sort results
      const sortedCompounds = this.sortCompounds(filteredCompounds, sort);
      
      // Apply pagination
      const totalResults = sortedCompounds.length;
      const paginatedCompounds = sortedCompounds.slice((page - 1) * limit, page * limit);
      
      // Convert to CompoundSearchResult format
      const results: CompoundSearchResult[] = paginatedCompounds.map(compound => ({
        cid: compound.cid,
        name: compound.name,
        iupacName: compound.iupacName || undefined,
        formula: compound.formula || undefined,
        molecularWeight: compound.molecularWeight || undefined,
        chemicalClass: compound.chemicalClass || undefined,
        description: compound.description || undefined,
        imageUrl: compound.imageUrl || this.getDefaultImageUrl(compound.cid),
        similarity: 0 // No similarity score for keyword search
      }));
      
      return {
        results,
        totalResults,
        page,
        totalPages: Math.ceil(totalResults / limit),
        query
      };
    } catch (error) {
      console.error("Error searching compounds in database:", error);
      throw new Error(`Cannot search compounds in database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper methods

  private filterByMolecularWeight(compound: Compound, filter: string): boolean {
    if (!compound.molecularWeight) return false;
    
    switch (filter) {
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
    switch (sortBy) {
      case "molecular_weight":
        return [...compounds].sort((a, b) => {
          if (!a.molecularWeight) return 1;
          if (!b.molecularWeight) return -1;
          return a.molecularWeight - b.molecularWeight;
        });
      case "name":
        return [...compounds].sort((a, b) => a.name.localeCompare(b.name));
      default:
        return compounds;
    }
  }

  private getDefaultImageUrl(cid: number): string {
    return `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${cid}&width=300&height=300`;
  }

  // Database initialization and data loading

  async ensureInitialized(): Promise<void> {
    if (!this.dataInitialized) {
      await this.initializeDatabase();
    }
  }

  async initializeDatabase(): Promise<void> {
    try {
      console.log("Initializing Supabase and Weaviate databases...");
      
      // Initialize Weaviate for vector search
      await weaviateClient.initializeSchema();
      
      // Initialize Supabase
      await supabaseClient.initializeDatabase();
      
      // If Supabase is empty, load some initial data
      const compounds = await this.getCompounds(10);
      if (compounds.length === 0) {
        // Create data directory if it doesn't exist
        if (!fs.existsSync(this.dataPath)) {
          fs.mkdirSync(this.dataPath, { recursive: true });
          console.log(`Created data directory: ${this.dataPath}`);
        }
        
        // Try to load some data - limit to 20 compounds for faster startup
        await this.loadPubChemData(20);
      }
      
      this.dataInitialized = true;
      console.log("Database initialization complete");
    } catch (error) {
      console.error("Failed to initialize database:", error);
      throw error;
    }
  }

  async loadPubChemData(limit: number = 1000): Promise<number> {
    try {
      console.log(`Loading up to ${limit} PubChem compounds...`);
      
      // Check if data directory exists
      if (!fs.existsSync(this.dataPath)) {
        console.log(`Creating data directory: ${this.dataPath}`);
        fs.mkdirSync(this.dataPath, { recursive: true });
      }
      
      // Get list of JSON files in the data directory
      const files = fs.readdirSync(this.dataPath)
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(this.dataPath, file));
      
      if (files.length === 0) {
        console.log("No JSON files found in data directory. Please download PubChem compound data files.");
        return 0;
      }
      
      let loadedCount = 0;
      let batchCompounds: InsertCompound[] = [];
      
      for (const file of files) {
        if (loadedCount >= limit) break;
        
        const jsonData = await readJSON(file);
        
        // Process each compound in the JSON file
        for (const compoundData of Array.isArray(jsonData) ? jsonData : [jsonData]) {
          if (loadedCount >= limit) break;
          
          try {
            // Process the raw compound data
            const compound = await processCompoundData(compoundData);
            
            // Add to batch for Supabase
            batchCompounds.push(compound);
            
            // Add to Weaviate for vector search
            // We need to create a Compound type with all required fields
            const weaviateCompound: Compound = {
              id: compound.cid, // Use CID as ID for Weaviate
              cid: compound.cid,
              name: compound.name,
              iupacName: compound.iupacName || null,
              formula: compound.formula || null,
              molecularWeight: compound.molecularWeight || null,
              synonyms: compound.synonyms || [],
              description: compound.description || "",
              chemicalClass: compound.chemicalClass || [],
              inchi: compound.inchi || "",
              inchiKey: compound.inchiKey || "",
              smiles: compound.smiles || "",
              properties: compound.properties || {},
              isProcessed: true,
              imageUrl: compound.imageUrl || null
            };
            await weaviateClient.addCompound(weaviateCompound);
            
            loadedCount++;
            
            // Batch insert every 500 compounds or at the end
            if (batchCompounds.length >= 500 || loadedCount >= limit || loadedCount >= jsonData.length) {
              if (batchCompounds.length > 0) {
                await supabaseClient.batchInsertCompounds(batchCompounds);
                console.log(`Batch inserted ${batchCompounds.length} compounds`);
                batchCompounds = [];
              }
            }
            
            if (loadedCount % 100 === 0) {
              console.log(`Loaded ${loadedCount} compounds...`);
            }
          } catch (error) {
            console.error(`Error processing compound:`, error);
          }
        }
      }
      
      // Insert any remaining compounds
      if (batchCompounds.length > 0) {
        await supabaseClient.batchInsertCompounds(batchCompounds);
        console.log(`Batch inserted ${batchCompounds.length} compounds`);
      }
      
      console.log(`Successfully loaded ${loadedCount} compounds`);
      return loadedCount;
    } catch (error) {
      console.error("Error loading PubChem data:", error);
      throw error;
    }
  }
}

// Use SupabaseStorage as our storage implementation
export const storage = new SupabaseStorage();
