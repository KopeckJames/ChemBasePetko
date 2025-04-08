import weaviate, { WeaviateClient } from "weaviate-ts-client";
import { Compound, CompoundSearchResult, SearchQuery, SearchResponse } from "../../shared/schema";

// Define extended sort options including the desc variants
type WeaviateSortOption = "relevance" | "molecular_weight" | "name";
type ExtendedSortOption = WeaviateSortOption | "molecular_weight_desc" | "name_desc";

// Weaviate configuration
const WEAVIATE_URL = process.env.WEAVIATE_URL || "ddssrlksrhlnehtppyxjq.c0.us-west3.gcp.weaviate.cloud";
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY || "IMlD52U4kkABRrXDPGZO7z2hKkF8d1vGsY9H";
const WEAVIATE_SCHEME = process.env.WEAVIATE_SCHEME || "https";
const WEAVIATE_CLASS_NAME = "Compound";

// Initialize Weaviate client
let client: WeaviateClient;

/**
 * Gets the Weaviate client, initializing it if needed
 */
async function getClient(): Promise<WeaviateClient> {
  if (!client) {
    console.log("Initializing Weaviate client...");
    try {
      // Check required environment variables
      if (!WEAVIATE_URL) {
        console.error("Missing WEAVIATE_URL environment variable");
        throw new Error("Missing WEAVIATE_URL environment variable");
      }
      
      if (!WEAVIATE_API_KEY) {
        console.error("Missing WEAVIATE_API_KEY environment variable");
        throw new Error("Missing WEAVIATE_API_KEY environment variable");
      }

      // Create Weaviate client
      client = weaviate.client({
        scheme: WEAVIATE_SCHEME,
        host: WEAVIATE_URL,
        apiKey: new weaviate.ApiKey(WEAVIATE_API_KEY),
      });
      
      // Check if the client is working
      try {
        console.log("Testing Weaviate connection...");
        const meta = await client.misc.metaGetter().do();
        console.log(`Connected to Weaviate ${meta.version}`);
      } catch (error) {
        console.error("Error connecting to Weaviate:", error);
        throw new Error(`Could not connect to Weaviate: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Check if the Compound class exists
      try {
        console.log(`Checking if class ${WEAVIATE_CLASS_NAME} exists...`);
        const schema = await client.schema.getter().do();
        const classExists = schema.classes?.some(c => c.class === WEAVIATE_CLASS_NAME);
        
        if (!classExists) {
          console.log(`Class ${WEAVIATE_CLASS_NAME} doesn't exist, will create it during schema initialization`);
        } else {
          console.log(`Class ${WEAVIATE_CLASS_NAME} exists`);
        }
      } catch (error) {
        console.error("Error checking schema:", error);
        // Just log the error, we'll try to create the class during initializeSchema
      }
    } catch (error) {
      console.error("Error initializing Weaviate client:", error);
      throw new Error(`Failed to initialize Weaviate client: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return client;
}

/**
 * Initializes the Weaviate schema for chemical compounds
 */
export async function initializeSchema(): Promise<void> {
  try {
    const client = await getClient();
    
    // Check if class exists
    const schema = await client.schema.getter().do();
    const classExists = schema.classes?.some(c => c.class === WEAVIATE_CLASS_NAME);
    
    if (!classExists) {
      console.log(`Creating class ${WEAVIATE_CLASS_NAME}...`);
      
      // Define the class schema
      const classObj = {
        class: WEAVIATE_CLASS_NAME,
        description: "Chemical compound from PubChem",
        vectorizer: "none", // We will provide our own vectors
        properties: [
          {
            name: "cid",
            dataType: ["int"],
            description: "PubChem Compound ID",
          },
          {
            name: "name",
            dataType: ["text"],
            description: "Compound name",
          },
          {
            name: "iupacName",
            dataType: ["text"],
            description: "IUPAC name",
          },
          {
            name: "formula",
            dataType: ["text"],
            description: "Chemical formula",
          },
          {
            name: "molecularWeight",
            dataType: ["number"],
            description: "Molecular weight",
          },
          {
            name: "synonyms",
            dataType: ["text[]"],
            description: "Alternative names",
          },
          {
            name: "description",
            dataType: ["text"],
            description: "Compound description",
          },
          {
            name: "chemicalClass",
            dataType: ["text[]"],
            description: "Chemical class",
          },
          {
            name: "inchi",
            dataType: ["text"],
            description: "InChI identifier",
          },
          {
            name: "inchiKey",
            dataType: ["text"],
            description: "InChI key",
          },
          {
            name: "smiles",
            dataType: ["text"],
            description: "SMILES notation",
          },
          {
            name: "imageUrl",
            dataType: ["text"],
            description: "URL to molecule image",
          },
        ],
      };
      
      try {
        await client.schema.classCreator().withClass(classObj).do();
        console.log(`Created class ${WEAVIATE_CLASS_NAME}`);
      } catch (error) {
        console.error(`Error creating class ${WEAVIATE_CLASS_NAME}:`, error);
        throw new Error(`Failed to create class ${WEAVIATE_CLASS_NAME}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.log("Weaviate schema initialized successfully");
  } catch (error) {
    console.error("Error initializing Weaviate schema:", error);
    throw new Error(`Failed to initialize Weaviate schema: ${error instanceof Error ? error.message : String(error)}`);
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
  const embedding = new Array(384).fill(0);
  
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
 * Adds a compound to the Weaviate database
 */
export async function addCompound(compound: Compound): Promise<void> {
  try {
    const client = await getClient();
    
    // Generate a vector embedding for the compound
    const embedding = generateCompoundEmbedding(compound);
    
    try {
      // Add to Weaviate
      await client.data.creator()
        .withClassName(WEAVIATE_CLASS_NAME)
        .withId(compound.cid.toString())
        .withVector(embedding)
        .withProperties({
          cid: compound.cid,
          name: compound.name || "",
          iupacName: compound.iupacName || "",
          formula: compound.formula || "",
          molecularWeight: compound.molecularWeight || 0,
          synonyms: compound.synonyms || [],
          description: compound.description || "",
          chemicalClass: compound.chemicalClass || [],
          inchi: compound.inchi || "",
          inchiKey: compound.inchiKey || "",
          smiles: compound.smiles || "",
          imageUrl: compound.imageUrl || `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${compound.cid}&width=300&height=300`,
        })
        .do();
      
      console.log(`Added compound ${compound.cid} to Weaviate`);
    } catch (insertError) {
      console.error(`Error inserting compound ${compound.cid} into Weaviate:`, insertError);
      throw new Error(`Failed to insert compound ${compound.cid} into Weaviate: ${insertError instanceof Error ? insertError.message : String(insertError)}`);
    }
  } catch (error) {
    console.error(`Error in Weaviate addCompound for ${compound.cid}:`, error);
    throw new Error(`Error in Weaviate addCompound for ${compound.cid}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Performs a semantic search in Weaviate
 */
export async function semanticSearch(
  searchQuery: SearchQuery & { sort?: ExtendedSortOption }
): Promise<SearchResponse> {
  try {
    const client = await getClient();
    
    const { query, page = 1, limit = 10, sort } = searchQuery;
    const skip = (page - 1) * limit;
    
    // Build a nearText search if query is provided
    let queryBuilder = client.graphql
      .get()
      .withClassName(WEAVIATE_CLASS_NAME)
      .withFields('cid name formula molecularWeight smiles description chemicalClass imageUrl _additional { certainty distance }')
      .withLimit(limit)
      .withOffset(skip);
      
    // Add search term if provided
    if (query && query.trim()) {
      queryBuilder = queryBuilder.withNearText({ concepts: [query] });
    }
    
    // Add molecule weight filter if provided
    if (searchQuery.molecularWeight) {
      let whereFilter: any = {};
      
      switch(searchQuery.molecularWeight) {
        case "lt_100":
          whereFilter = {
            path: ["molecularWeight"],
            operator: "LessThan",
            valueNumber: 100
          };
          break;
        case "100-200":
          whereFilter = {
            operator: "And",
            operands: [
              {
                path: ["molecularWeight"],
                operator: "GreaterThanEqual",
                valueNumber: 100
              },
              {
                path: ["molecularWeight"],
                operator: "LessThanEqual",
                valueNumber: 200
              }
            ]
          };
          break;
        case "200-500":
          whereFilter = {
            operator: "And",
            operands: [
              {
                path: ["molecularWeight"],
                operator: "GreaterThan",
                valueNumber: 200
              },
              {
                path: ["molecularWeight"],
                operator: "LessThanEqual",
                valueNumber: 500
              }
            ]
          };
          break;
        case "gt_500":
          whereFilter = {
            path: ["molecularWeight"],
            operator: "GreaterThan",
            valueNumber: 500
          };
          break;
      }
      
      queryBuilder = queryBuilder.withWhere(whereFilter);
    }
    
    // Add chemical class filter if provided
    if (searchQuery.chemicalClass && searchQuery.chemicalClass !== "all") {
      const classFilter = {
        path: ["chemicalClass"],
        operator: "ContainsAny" as const,
        valueText: searchQuery.chemicalClass
      };
      
      // If we already have a molecular weight filter, simply apply this new filter
      // Weaviate automatically combines filters with AND logic when applied sequentially
      queryBuilder = queryBuilder.withWhere(classFilter);
    }
    
    // Execute the query
    const result = await queryBuilder.do();
    
    // Get the results
    const compounds = result.data.Get[WEAVIATE_CLASS_NAME] || [];
    
    // Count total results
    const countQuery = client.graphql
      .aggregate()
      .withClassName(WEAVIATE_CLASS_NAME)
      .withFields('meta { count }');
      
    // Add the same search query and filters to the count query
    if (query && query.trim()) {
      countQuery.withNearText({ concepts: [query] });
    }
    
    // Apply the same filters for molecular weight
    if (searchQuery.molecularWeight) {
      let whereFilter: any = {};
      
      switch(searchQuery.molecularWeight) {
        case "lt_100":
          whereFilter = {
            path: ["molecularWeight"],
            operator: "LessThan",
            valueNumber: 100
          };
          break;
        case "100-200":
          whereFilter = {
            operator: "And",
            operands: [
              {
                path: ["molecularWeight"],
                operator: "GreaterThanEqual",
                valueNumber: 100
              },
              {
                path: ["molecularWeight"],
                operator: "LessThanEqual",
                valueNumber: 200
              }
            ]
          };
          break;
        case "200-500":
          whereFilter = {
            operator: "And",
            operands: [
              {
                path: ["molecularWeight"],
                operator: "GreaterThan",
                valueNumber: 200
              },
              {
                path: ["molecularWeight"],
                operator: "LessThanEqual",
                valueNumber: 500
              }
            ]
          };
          break;
        case "gt_500":
          whereFilter = {
            path: ["molecularWeight"],
            operator: "GreaterThan",
            valueNumber: 500
          };
          break;
      }
      
      countQuery.withWhere(whereFilter);
    }
    
    // Apply the same filter for chemical class
    if (searchQuery.chemicalClass && searchQuery.chemicalClass !== "all") {
      const classFilter = {
        path: ["chemicalClass"],
        operator: "ContainsAny" as const,
        valueText: searchQuery.chemicalClass
      };
      
      countQuery.withWhere(classFilter);
    }
    
    const countResult = await countQuery.do();
    const totalResults = countResult.data.Aggregate[WEAVIATE_CLASS_NAME][0]?.meta?.count || compounds.length;
    
    // Convert to SearchResponse format with proper type handling
    const results: CompoundSearchResult[] = compounds.map((item: any) => {
      const cid = typeof item.cid === 'number' ? item.cid : 0;
      
      return {
        id: parseInt(String(item._additional?.id || "0")),
        cid: cid,
        name: typeof item.name === 'string' ? item.name : "",
        formula: typeof item.formula === 'string' ? item.formula : "",
        smiles: typeof item.smiles === 'string' ? item.smiles : "",
        molecularWeight: typeof item.molecularWeight === 'number' ? item.molecularWeight : 0,
        description: typeof item.description === 'string' ? item.description : "",
        chemicalClass: typeof item.chemicalClass === 'string' ? item.chemicalClass : null,
        imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : 
          `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${cid}&width=300&height=300`,
        similarity: typeof item._additional?.certainty === 'number' ? item._additional.certainty : 1.0
      };
    });
    
    // Sort results if requested
    if (sort) {
      const sortType = sort as string; // Type cast to avoid comparison issues
      
      // Handle all valid sort options
      if (sortType === "molecular_weight") {
        results.sort((a, b) => (a.molecularWeight || 0) - (b.molecularWeight || 0));
      } 
      else if (sortType === "molecular_weight_desc") {
        results.sort((a, b) => (b.molecularWeight || 0) - (a.molecularWeight || 0));
      } 
      else if (sortType === "name") {
        results.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      } 
      else if (sortType === "name_desc") {
        results.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
      }
      // For relevance, results are already sorted by Weaviate
    }
    
    return {
      results,
      totalResults,
      page,
      totalPages: Math.ceil(totalResults / limit),
      query: query || ""
    };
  } catch (error) {
    console.error("Error performing semantic search in Weaviate:", error);
    throw new Error(`Error performing search in Weaviate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets a compound by CID from Weaviate
 */
export async function getCompoundByCid(cid: number): Promise<Compound | null> {
  try {
    const client = await getClient();
    
    // Query Weaviate for the compound
    const result = await client.data
      .getterById()
      .withClassName(WEAVIATE_CLASS_NAME)
      .withId(cid.toString())
      .do();
    
    if (!result || !result.properties) {
      return null;
    }
    
    // Cast properties to appropriate types with defaults
    const props = result.properties as Record<string, any>;
    
    // Convert Weaviate object to Compound with proper type handling
    return {
      id: parseInt(result.id || "0"),
      cid: typeof props.cid === 'number' ? props.cid : 0,
      name: typeof props.name === 'string' ? props.name : "",
      iupacName: typeof props.iupacName === 'string' ? props.iupacName : null,
      formula: typeof props.formula === 'string' ? props.formula : null,
      molecularWeight: typeof props.molecularWeight === 'number' ? props.molecularWeight : null,
      synonyms: Array.isArray(props.synonyms) ? props.synonyms : [],
      description: typeof props.description === 'string' ? props.description : "",
      chemicalClass: Array.isArray(props.chemicalClass) ? props.chemicalClass : [],
      inchi: typeof props.inchi === 'string' ? props.inchi : "",
      inchiKey: typeof props.inchiKey === 'string' ? props.inchiKey : "",
      smiles: typeof props.smiles === 'string' ? props.smiles : "",
      properties: {},
      isProcessed: true,
      imageUrl: typeof props.imageUrl === 'string' ? props.imageUrl : 
        `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${props.cid || 0}&width=300&height=300`
    };
  } catch (error) {
    console.error(`Error retrieving compound ${cid} from Weaviate:`, error);
    throw new Error(`Failed to retrieve compound ${cid} from Weaviate: ${error instanceof Error ? error.message : String(error)}`);
  }
}