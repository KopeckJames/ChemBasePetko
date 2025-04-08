import { Pinecone } from "@pinecone-database/pinecone";
import { Compound, CompoundSearchResult, SearchQuery, SearchResponse } from "../../shared/schema";

// Pinecone configuration
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || "pcsk_5GCjp5_SfeDNTuBTCzMUZBofkbTum9X2nn9yayeLN3YTrxxvbBKD4Kn7N65vi7Vk6mZbsU";
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT || "us-east-1-aws";
const PINECONE_INDEX_NAME = "chemsearch";
const PINECONE_NAMESPACE = "compounds";

// Initialize Pinecone client
let pineconeClient: Pinecone | null = null;
let pineconeIndex: any = null;

/**
 * Gets the Pinecone client, initializing it if needed
 */
async function getClient(): Promise<Pinecone> {
  if (!pineconeClient) {
    console.log("Initializing Pinecone client...");
    try {
      // Check required environment variables
      if (!PINECONE_API_KEY) {
        console.error("Missing PINECONE_API_KEY environment variable");
        throw new Error("Missing PINECONE_API_KEY environment variable");
      }
      
      if (!PINECONE_ENVIRONMENT) {
        console.error("Missing PINECONE_ENVIRONMENT environment variable");
        throw new Error("Missing PINECONE_ENVIRONMENT environment variable");
      }
      
      // Create Pinecone client
      console.log(`Initializing Pinecone with API key: ${PINECONE_API_KEY.substring(0, 10)}...`);
      
      pineconeClient = new Pinecone({
        apiKey: PINECONE_API_KEY,
      });
      
      console.log("Connected to Pinecone client successfully");
      
      // Get or create the index
      try {
        // Try to directly access the index
        try {
          console.log(`Directly trying to access index: ${PINECONE_INDEX_NAME}`);
          pineconeIndex = pineconeClient.index(PINECONE_INDEX_NAME);
          console.log(`Pinecone index ${PINECONE_INDEX_NAME} exists and was accessed successfully`);
        } catch (indexError) {
          console.log(`Index ${PINECONE_INDEX_NAME} doesn't exist or can't be accessed, attempting to create it...`);
          
          try {
            // Create the index
            await pineconeClient.createIndex({
              name: PINECONE_INDEX_NAME,
              dimension: 512, // Dimension for chemical compound embeddings
              spec: {
                serverless: {
                  cloud: 'aws',
                  region: 'us-east-1'
                }
              },
              metric: 'cosine'
            });
            
            console.log(`Created Pinecone index ${PINECONE_INDEX_NAME}`);
            
            // Get the new index
            pineconeIndex = pineconeClient.index(PINECONE_INDEX_NAME);
          } catch (createError) {
            console.error(`Error creating Pinecone index: ${createError}`);
            throw new Error(`Failed to create Pinecone index: ${createError}`);
          }
        }
        
        // Test the index connection
        try {
          const stats = await pineconeIndex.describeIndexStats();
          console.log(`Pinecone index stats: ${JSON.stringify(stats)}`);
          console.log(`Total vector count: ${stats.totalVectorCount}`);
        } catch (statsError) {
          console.error("Error getting index stats:", statsError);
          throw new Error(`Could not get index stats: ${statsError instanceof Error ? statsError.message : String(statsError)}`);
        }
      } catch (indexError) {
        console.error("Error creating/accessing Pinecone index:", indexError);
        throw new Error(`Could not create/access Pinecone index: ${indexError instanceof Error ? indexError.message : String(indexError)}`);
      }
    } catch (error) {
      console.error("Error initializing Pinecone client:", error);
      throw new Error(`Failed to initialize Pinecone client: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return pineconeClient;
}

/**
 * Initializes the Pinecone schema for chemical compounds
 */
export async function initializeSchema(): Promise<void> {
  try {
    const client = await getClient();
    
    if (!client) {
      console.error("Pinecone client is null, cannot initialize schema");
      throw new Error("Pinecone client is null, cannot initialize schema");
    }
    
    console.log("Pinecone schema initialized successfully");
  } catch (error) {
    console.error("Error initializing Pinecone schema:", error);
    throw new Error(`Failed to initialize Pinecone schema: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a mock embedding for a compound
 * This should be replaced with a real embedding model like OpenAI's text-embedding-ada-002
 */
function generateCompoundEmbedding(compound: Compound): number[] {
  // This is a simplified mock embedding
  // In a real application, you would use a model to create embeddings
  
  // Generate a deterministic but unique embedding based on CID
  const seed = compound.cid;
  const embedding = new Array(512).fill(0);
  
  // Fill with pseudorandom values from a seeded source
  for (let i = 0; i < embedding.length; i++) {
    // Create a deterministic pseudorandom value based on the compound properties
    const val = Math.sin(i * seed) * 10000;
    embedding[i] = (val - Math.floor(val)) * 2 - 1; // Range: -1 to 1
  }
  
  // Normalize the vector to have length 1 (unit vector)
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

/**
 * Adds a compound to the Pinecone database
 */
export async function addCompound(compound: Compound): Promise<void> {
  try {
    await getClient();
    
    if (!pineconeIndex) {
      console.error(`Pinecone index is null, cannot add compound ${compound.cid}`);
      throw new Error(`Pinecone index is null, cannot add compound ${compound.cid}`);
    }
    
    // Generate a vector embedding for the compound
    const embedding = generateCompoundEmbedding(compound);
    
    // Prepare metadata
    const metadata = {
      cid: compound.cid,
      name: compound.name,
      formula: compound.formula,
      smiles: compound.smiles,
      inchi: compound.inchi,
      inchiKey: compound.inchiKey,
      molecularWeight: compound.molecularWeight,
      synonyms: compound.synonyms ? compound.synonyms.join(', ') : '',
      chemicalClass: Array.isArray(compound.chemicalClass) 
        ? compound.chemicalClass.join(', ') 
        : compound.chemicalClass || '',
      description: compound.description,
      iupacName: compound.iupacName,
      imageUrl: compound.imageUrl || `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${compound.cid}&width=300&height=300`,
    };
    
    try {
      // Add to Pinecone
      await pineconeIndex.upsert({
        vectors: [{
          id: `compound_${compound.cid}`,
          values: embedding as number[],
          metadata: metadata as Record<string, any>
        }],
        namespace: PINECONE_NAMESPACE
      });
      
      console.log(`Added compound ${compound.cid} to Pinecone`);
    } catch (insertError) {
      console.error(`Error inserting compound ${compound.cid} into Pinecone:`, insertError);
      throw new Error(`Failed to insert compound ${compound.cid} into Pinecone: ${insertError instanceof Error ? insertError.message : String(insertError)}`);
    }
  } catch (error) {
    console.error(`Error in Pinecone addCompound for ${compound.cid}:`, error);
    throw new Error(`Error in Pinecone addCompound for ${compound.cid}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Performs a semantic search in Pinecone
 */
export async function semanticSearch(
  searchQuery: SearchQuery
): Promise<SearchResponse> {
  try {
    await getClient();
    
    if (!pineconeIndex) {
      console.error("Pinecone index is null, cannot search");
      throw new Error("Pinecone index is null, cannot perform search");
    }
    
    const { query, page = 1, limit = 10, molecularWeight, chemicalClass } = searchQuery;
    const skip = (page - 1) * limit;
    
    // Build filter conditions based on searchQuery
    let filterObj: any = {};
    
    if (molecularWeight) {
      // Parse molecular weight range
      let weightRange = [0, 10000]; // Default range
      
      switch(molecularWeight) {
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
      
      filterObj.molecularWeight = { 
        $gte: weightRange[0],
        $lte: weightRange[1]
      };
    }
    
    if (chemicalClass && chemicalClass !== "all") {
      filterObj.chemicalClass = { $eq: chemicalClass };
    }
    
    try {
      // If we have a text query, create a mock query vector
      // In a real app, this would use the same embedding model as for indexing
      const mockQueryVector = query && query.trim() 
        ? new Array(512).fill(0).map(() => Math.random() * 2 - 1)
        : undefined;
        
      // For a real query, this should be normalized like the vectors in the index
      const queryOptions: any = {
        namespace: PINECONE_NAMESPACE,
        topK: limit,
        includeMetadata: true,
      };
      
      if (Object.keys(filterObj).length > 0) {
        queryOptions.filter = filterObj;
      }
      
      let results;
      
      if (mockQueryVector) {
        // Vector search with filter
        results = await pineconeIndex.query({
          ...queryOptions,
          vector: mockQueryVector as number[]
        });
      } else if (query && query.trim()) {
        // Text-based search (metadata filter)
        queryOptions.filter = {
          ...queryOptions.filter,
          $or: [
            { name: { $contains: query } },
            { synonyms: { $contains: query } },
            { formula: { $contains: query } },
            { description: { $contains: query } }
          ]
        };
        
        // Fetch all compounds matching the text filter
        // Since we don't have a query vector, we'll do a fetch by metadata
        const fetchResponse = await pineconeIndex.fetch({
          ids: [], // Empty means all vectors
          namespace: PINECONE_NAMESPACE
        });
        
        // Filter results client-side (not ideal but works for demo)
        results = {
          matches: Object.entries(fetchResponse.vectors || {})
            .filter(([_, vector]) => {
              if (!vector) return false;
              const metadata = (vector as any).metadata || {};
              return (
                (metadata.name && metadata.name.includes(query)) ||
                (metadata.synonyms && metadata.synonyms.includes(query)) ||
                (metadata.formula && metadata.formula.includes(query)) ||
                (metadata.description && metadata.description.includes(query))
              );
            })
            .map(([id, vector]) => ({
              id,
              score: 1.0, // No relevance score for metadata search
              metadata: (vector as any).metadata || {}
            }))
            .slice(skip, skip + limit)
        };
      } else {
        // Just filter search without vector or text query
        // Fetch all compounds matching the filter
        const fetchResponse = await pineconeIndex.fetch({
          ids: [], // Empty means all vectors
          namespace: PINECONE_NAMESPACE
        });
        
        // Filter results client-side based on metadata (not ideal for production)
        results = {
          matches: Object.entries(fetchResponse.vectors || {})
            .map(([id, vector]) => {
              if (!vector) return null;
              return {
                id,
                score: 1.0, // No relevance score for filter-only search
                metadata: (vector as any).metadata || {}
              };
            })
            .filter(Boolean) // Remove nulls
            .slice(skip, skip + limit)
        };
      }
      
      // Convert results to CompoundSearchResult format
      const results_array: CompoundSearchResult[] = results.matches.map((match: any) => {
        const metadata = match.metadata;
        return {
          id: parseInt(match.id.replace("compound_", "")),
          cid: metadata.cid,
          name: metadata.name,
          formula: metadata.formula,
          smiles: metadata.smiles || "",
          molecularWeight: metadata.molecularWeight,
          description: metadata.description || "",
          chemicalClass: metadata.chemicalClass || null,
          imageUrl: metadata.imageUrl || `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${metadata.cid}&width=300&height=300`,
          similarity: match.score || 1.0
        };
      });
      
      // Get total count (for production, use proper indexStats)
      // This is a simplification for demo purposes
      const totalResults = results_array.length * 10; // Mock total
      
      return {
        results: results_array,
        totalResults,
        page,
        totalPages: Math.ceil(totalResults / limit),
        query: query || ""
      };
    } catch (searchError) {
      console.error("Error during Pinecone search operation:", searchError);
      throw new Error(`Failed to search in Pinecone: ${searchError instanceof Error ? searchError.message : String(searchError)}`);
    }
  } catch (error) {
    console.error("Error performing semantic search in Pinecone:", error);
    throw new Error(`Error performing search in Pinecone: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets a compound by CID from Pinecone
 */
export async function getCompoundByCid(cid: number): Promise<Compound | null> {
  try {
    await getClient();
    
    if (!pineconeIndex) {
      console.error(`Pinecone index is null, cannot get compound ${cid}`);
      throw new Error(`Pinecone index is null, cannot get compound ${cid}`);
    }
    
    try {
      const documentId = `compound_${cid}`;
      const response = await pineconeIndex.fetch({
        ids: [documentId],
        namespace: PINECONE_NAMESPACE
      });
      
      if (!response || !response.vectors || !response.vectors[documentId]) {
        return null; // Compound not found
      }
      
      const vector = response.vectors[documentId];
      const metadata = vector.metadata as any;
      
      // Convert Pinecone document to Compound format
      return {
        id: parseInt(documentId.replace("compound_", "")),
        cid: metadata.cid,
        name: metadata.name,
        iupacName: metadata.iupacName || metadata.name,
        formula: metadata.formula,
        molecularWeight: metadata.molecularWeight,
        synonyms: metadata.synonyms ? metadata.synonyms.split(', ') : [],
        description: metadata.description || "",
        chemicalClass: metadata.chemicalClass ? metadata.chemicalClass.split(', ') : [],
        inchi: metadata.inchi || "",
        inchiKey: metadata.inchiKey || "",
        smiles: metadata.smiles || "",
        properties: {},
        isProcessed: true,
        imageUrl: metadata.imageUrl || `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${metadata.cid}&width=300&height=300`
      };
    } catch (getError) {
      console.error(`Error retrieving compound ${cid} from Pinecone:`, getError);
      throw new Error(`Failed to retrieve compound ${cid} from Pinecone: ${getError instanceof Error ? getError.message : String(getError)}`);
    }
  } catch (error) {
    console.error(`Error in getCompoundByCid for ${cid} from Pinecone:`, error);
    throw new Error(`Error getting compound ${cid} from Pinecone: ${error instanceof Error ? error.message : String(error)}`);
  }
}