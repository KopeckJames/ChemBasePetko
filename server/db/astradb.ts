import { createClient } from "@astrajs/collections";
import { Compound, CompoundSearchResult, SearchQuery, SearchResponse } from "../../shared/schema";

// AstraDB configuration
// Use a database ID without special characters like @ for compatibility
const ASTRA_DB_ID = process.env.ASTRA_DB_ID || "3e51f067-28a56-4b98-b688-aac4942d7a77"; 
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
      astraClient = await createClient({
        astraDatabaseId: ASTRA_DB_ID,
        astraDatabaseRegion: ASTRA_DB_REGION,
        applicationToken: ASTRA_DB_TOKEN,
      });
      
      compoundsCollection = astraClient.namespace(ASTRA_DB_KEYSPACE).collection(ASTRA_DB_COLLECTION);
      console.log("Connected to AstraDB successfully");
    } catch (error) {
      console.error("Error connecting to AstraDB:", error);
      throw error;
    }
  }
  return astraClient;
}

/**
 * Initializes the AstraDB schema for chemical compounds
 */
export async function initializeSchema(): Promise<void> {
  try {
    await getClient();
    console.log("AstraDB schema initialized successfully");
  } catch (error) {
    console.error("Error initializing AstraDB schema:", error);
    throw error;
  }
}

/**
 * Adds a compound to the AstraDB database
 */
export async function addCompound(compound: Compound): Promise<void> {
  try {
    await getClient();
    
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
    
    // Add to AstraDB
    await compoundsCollection.create(documentId, vectorData);
    console.log(`Added compound ${compound.cid} to AstraDB`);
  } catch (error) {
    console.error(`Error adding compound ${compound.cid} to AstraDB:`, error);
    throw error;
  }
}

/**
 * Performs a semantic search in AstraDB
 */
export async function semanticSearch(
  searchQuery: SearchQuery
): Promise<SearchResponse> {
  try {
    await getClient();
    
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
  } catch (error) {
    console.error("Error performing semantic search in AstraDB:", error);
    throw error;
  }
}

/**
 * Gets a compound by CID from AstraDB
 */
export async function getCompoundByCid(cid: number): Promise<Compound | null> {
  try {
    await getClient();
    
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
  } catch (error) {
    console.error(`Error getting compound ${cid} from AstraDB:`, error);
    throw error;
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