import { createClient } from "@astrajs/collections";
import { Compound, CompoundSearchResult, SearchQuery, SearchResponse } from "../../shared/schema";

// AstraDB (DataStax) configuration
// We're using the organization ID and database name from the token (1) file
const ASTRA_DB_ID = process.env.ASTRA_DB_ID || "351f0672-8a56-4b98-b688-aac4942d7a77"; 
const ASTRA_ORG_ID = process.env.ASTRA_ORG_ID || "351f0672-8a56-4b98-b688-aac4942d7a77"; 
const ASTRA_DB_NAME = process.env.ASTRA_DB_NAME || "chemsearch";
const ASTRA_DB_REGION = process.env.ASTRA_DB_REGION || "us-east1";
const ASTRA_DB_KEYSPACE = process.env.ASTRA_DB_KEYSPACE || "chemsearch";
const ASTRA_DB_COLLECTION = "compounds";
const ASTRA_DB_TOKEN = process.env.ASTRA_DB_TOKEN || "AstraCS:YeyhvYemXipawpEtFvyOGPip:2e89f5a83866f2ff4ce7b1ac408809f0d6f17e8b4dff151d721759f972eee73e";

let astraClient: any = null;
let compoundsCollection: any = null;

/**
 * Gets the AstraDB client, initializing it if needed
 */
async function getClient(): Promise<any> {
  if (!astraClient) {
    console.log("Initializing AstraDB client...");
    try {
      // Check required environment variables
      if (!ASTRA_DB_TOKEN) {
        console.error("Missing ASTRA_DB_TOKEN environment variable");
        return null;
      }
      
      if (!ASTRA_DB_ID) {
        console.error("Missing ASTRA_DB_ID environment variable");
        return null;
      }
      
      if (!ASTRA_DB_REGION) {
        console.error("Missing ASTRA_DB_REGION environment variable");
        return null;
      }
      
      // Test network connectivity to the DataStax API endpoint first
      const testEndpoint = `https://${ASTRA_DB_ID}-${ASTRA_DB_REGION}.apps.astra.datastax.com`;
      console.log(`Testing network connectivity to DataStax at ${testEndpoint}...`);
      
      try {
        // We use a timeout to avoid waiting too long for DNS resolution
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(testEndpoint, { 
          method: 'HEAD',
          signal: controller.signal
        }).catch(error => {
          console.error("Network error during connectivity test:", error);
          throw new Error(`Network connection failed: ${error.message}`);
        });
        
        clearTimeout(timeoutId);
        
        console.log(`Network connectivity test status: ${response.status} (even a 404 is OK as it means the host was reached)`);
      } catch (networkError) {
        console.error("Network connectivity test to DataStax failed:", 
          networkError instanceof Error ? networkError.message : String(networkError));
        console.log("This is likely a DNS resolution issue or connectivity problem");
        return null;
      }
      
      // Standard approach to connect to AstraDB/DataStax
      try {
        console.log("Connecting to DataStax using standard approach...");
        
        // The API expects these standard parameters
        astraClient = await createClient({
          astraDatabaseId: ASTRA_DB_ID,
          astraDatabaseRegion: ASTRA_DB_REGION,
          applicationToken: ASTRA_DB_TOKEN
        });
        
        console.log("Connected to DataStax client successfully");
      } catch (error) {
        console.error("Error connecting to DataStax:", error);
        
        // Log detailed error info to help debug
        if (error instanceof Error) {
          console.error(`Error type: ${error.name}, Message: ${error.message}`);
          console.error(`Stack trace: ${error.stack}`);
        } else {
          console.error(`Non-Error object thrown: ${JSON.stringify(error)}`);
        }
        
        // Instead of throwing, we'll log the error and return null
        // This will cause operations to fail gracefully and allow fallback to in-memory storage
        console.log("Will use in-memory storage as fallback");
        return null;
      }
      
      // Only try to create collection if client was initialized
      if (astraClient) {
        try {
          console.log(`Creating collection namespace ${ASTRA_DB_KEYSPACE}.${ASTRA_DB_COLLECTION}...`);
          compoundsCollection = astraClient.namespace(ASTRA_DB_KEYSPACE).collection(ASTRA_DB_COLLECTION);
          
          // Try a basic operation to verify connection works
          try {
            console.log("Testing DataStax collection with a simple operation...");
            const testDocId = "connection-test";
            const testDoc = { id: testDocId, test: true, timestamp: new Date().toISOString() };
            
            // Try to update (creates if doesn't exist)
            await compoundsCollection.update(testDocId, testDoc);
            console.log("DataStax collection test successful");
          } catch (opError) {
            console.error("Error testing collection operation:", 
              opError instanceof Error ? opError.message : String(opError));
            console.log("Collection exists but operations may not work");
          }
          
          console.log("Connected to AstraDB collection successfully");
        } catch (collectionError) {
          console.error("Error accessing collection:", 
            collectionError instanceof Error ? collectionError.message : String(collectionError));
          
          // Return null to indicate we should fall back to in-memory
          astraClient = null;
          compoundsCollection = null;
          return null;
        }
      }
    } catch (error) {
      console.error("Error in overall AstraDB connection process:", 
        error instanceof Error ? error.message : String(error));
      
      // Reset variables to ensure clean state
      astraClient = null;
      compoundsCollection = null;
      
      // Return null to indicate we should fall back to in-memory
      return null;
    }
  }
  
  return astraClient;
}

/**
 * Initializes the AstraDB schema for chemical compounds
 */
export async function initializeSchema(): Promise<void> {
  try {
    const client = await getClient();
    
    if (!client) {
      console.log("AstraDB client is null, falling back to in-memory storage");
      return;
    }
    
    console.log("AstraDB schema initialized successfully");
  } catch (error) {
    console.error("Error initializing AstraDB schema:", error);
    console.log("Will use in-memory storage as fallback");
    // Don't throw the error, let the system fall back to in-memory storage
  }
}

/**
 * Adds a compound to the AstraDB database
 */
export async function addCompound(compound: Compound): Promise<void> {
  try {
    const client = await getClient();
    
    // If client is null, we're in fallback mode
    if (!client || !compoundsCollection) {
      console.log(`Skipping AstraDB insertion for compound ${compound.cid} - using in-memory storage`);
      return;
    }
    
    // Generate a document ID based on CID
    const documentId = `compound_${compound.cid}`;
    
    // Prepare vector data
    const vectorData = {
      id: documentId,
      cid: compound.cid,
      name: compound.name,
      formula: compound.formula,
      smiles: compound.smiles,
      inchi: compound.inchi,
      inchiKey: compound.inchiKey,
      molecularWeight: compound.molecularWeight,
      synonyms: compound.synonyms || [],
      chemicalClass: compound.chemicalClass,
      description: compound.description,
      iupacName: compound.iupacName,
      properties: compound.properties || {},
      imageUrl: compound.imageUrl || `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${compound.cid}&width=300&height=300`,
      created_at: new Date().toISOString(),
    };
    
    try {
      // Add to AstraDB
      await compoundsCollection.create(documentId, vectorData);
      console.log(`Added compound ${compound.cid} to AstraDB`);
    } catch (insertError) {
      console.error(`Error inserting compound ${compound.cid} into AstraDB:`, insertError);
      // Don't throw, just log the error and continue
    }
  } catch (error) {
    console.error(`Error in AstraDB addCompound for ${compound.cid}:`, error);
    // Don't throw the error - this allows the in-memory storage to still work
  }
}

/**
 * Performs a semantic search in AstraDB
 */
export async function semanticSearch(
  searchQuery: SearchQuery
): Promise<SearchResponse> {
  try {
    const client = await getClient();
    
    // If client is null, we're in fallback mode
    if (!client || !compoundsCollection) {
      console.log("AstraDB client is null, returning empty search results");
      return {
        results: [],
        totalResults: 0,
        page: searchQuery.page || 1,
        totalPages: 0,
        query: searchQuery.query || ""
      };
    }
    
    const { query, page = 1, limit = 10, sort } = searchQuery;
    const sortBy = sort || "molecular_weight";
    const skip = (page - 1) * limit;
    
    // Build filter conditions based on searchQuery
    let filterConditions: any = {};
    
    if (searchQuery.molecularWeight) {
      // Parse molecular weight range
      let weightRange = [0, 10000]; // Default range
      
      switch(searchQuery.molecularWeight) {
        case "lt_100":
          weightRange = [0, 100];
          break;
        case "100-200":
          weightRange = [100, 200];
          break;
        case "200-500":
          weightRange = [200, 500];
          break;
        case "gt_500":
          weightRange = [500, 10000];
          break;
      }
      
      filterConditions.molecularWeight = {
        $gte: weightRange[0],
        $lte: weightRange[1]
      };
    }
    
    if (searchQuery.chemicalClass && searchQuery.chemicalClass !== "all") {
      filterConditions.chemicalClass = searchQuery.chemicalClass;
    }
    
    // Perform search in AstraDB
    const searchOptions: any = {
      sort: getSortOptions(sortBy),
      limit: limit,
      skip: skip,
    };
    
    if (Object.keys(filterConditions).length > 0) {
      searchOptions.filter = filterConditions;
    }
    
    try {
      // Perform text search if query is provided
      let results;
      if (query && query.trim()) {
        results = await compoundsCollection.find({ 
          name: { $regex: `.*${query}.*`, $options: "i" }
        }, searchOptions);
      } else {
        results = await compoundsCollection.find(filterConditions, searchOptions);
      }
      
      // Convert results to CompoundSearchResult format
      const results_array: CompoundSearchResult[] = results.data.map((doc: any) => ({
        id: Number(doc.id.replace("compound_", "")),
        cid: doc.cid,
        name: doc.name,
        formula: doc.formula,
        smiles: doc.smiles || "",
        molecularWeight: doc.molecularWeight,
        description: doc.description || "",
        chemicalClass: doc.chemicalClass || null,
        imageUrl: doc.imageUrl || `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${doc.cid}&width=300&height=300`,
        similarity: 1 // Default similarity score for now
      }));
      
      // Count total results for pagination
      const countResponse = await compoundsCollection.find(filterConditions, { count: true });
      const total = countResponse.count || 0;
      
      return {
        results: results_array,
        totalResults: total,
        page,
        totalPages: Math.ceil(total / limit),
        query: query || ""
      };
    } catch (searchError) {
      console.error("Error during AstraDB search operation:", searchError);
      // Return empty results instead of throwing an error
      return {
        results: [],
        totalResults: 0,
        page: searchQuery.page || 1,
        totalPages: 0,
        query: searchQuery.query || ""
      };
    }
  } catch (error) {
    console.error("Error performing semantic search in AstraDB:", error);
    // Return empty results instead of throwing
    return {
      results: [],
      totalResults: 0,
      page: searchQuery.page || 1,
      totalPages: 0,
      query: searchQuery.query || ""
    };
  }
}

/**
 * Gets a compound by CID from AstraDB
 */
export async function getCompoundByCid(cid: number): Promise<Compound | null> {
  try {
    const client = await getClient();
    
    // If client is null, we're in fallback mode
    if (!client || !compoundsCollection) {
      console.log(`AstraDB client is null, cannot get compound ${cid}`);
      return null;
    }
    
    try {
      const documentId = `compound_${cid}`;
      const response = await compoundsCollection.get(documentId);
      
      if (!response) {
        return null;
      }
      
      // Convert AstraDB document to Compound format
      return {
        id: parseInt(response.id.replace("compound_", "")),
        cid: response.cid,
        name: response.name,
        iupacName: response.iupacName || response.name,
        formula: response.formula,
        molecularWeight: response.molecularWeight,
        synonyms: response.synonyms || [],
        description: response.description || "",
        chemicalClass: response.chemicalClass || [],
        inchi: response.inchi || "",
        inchiKey: response.inchiKey || "",
        smiles: response.smiles || "",
        properties: response.properties || {},
        isProcessed: true,
        imageUrl: response.imageUrl || `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${response.cid}&width=300&height=300`
      };
    } catch (getError) {
      console.error(`Error retrieving compound ${cid} from AstraDB:`, getError);
      return null;
    }
  } catch (error) {
    console.error(`Error in getCompoundByCid for ${cid} from AstraDB:`, error);
    // Return null instead of throwing error
    return null;
  }
}

/**
 * Helper function to get sort options based on the sort parameter
 */
function getSortOptions(sortBy: string): any {
  switch (sortBy) {
    case "molecular_weight":
      return { molecularWeight: "asc" };
    case "molecular_weight_desc":
      return { molecularWeight: "desc" };
    case "name":
      return { name: "asc" };
    case "name_desc":
      return { name: "desc" };
    case "relevance":
    default:
      return { cid: "asc" };
  }
}