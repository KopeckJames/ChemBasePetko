import type { Compound, CompoundSearchResult } from "@shared/schema";
import weaviate, { type WeaviateClient } from "weaviate-ts-client";

// Class definition for Weaviate schema
const COMPOUND_CLASS = "Compound";

// Env variables for configuration
const WEAVIATE_URL = process.env.WEAVIATE_URL || "localhost:8080";
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY;
const WEAVIATE_SCHEME = process.env.WEAVIATE_SCHEME || "http";

// Configure Weaviate client
let client: WeaviateClient;

/**
 * Gets the Weaviate client, initializing it if needed
 */
async function getClient(): Promise<WeaviateClient> {
  if (!client) {
    console.log(`Connecting to Weaviate at ${WEAVIATE_SCHEME}://${WEAVIATE_HOST}:${WEAVIATE_PORT}`);
    
    client = weaviate.client({
      scheme: WEAVIATE_SCHEME,
      host: `${WEAVIATE_HOST}:${WEAVIATE_PORT}`,
    });
    
    // Test connection
    try {
      const meta = await client.misc.metaGetter().do();
      console.log(`Connected to Weaviate version ${meta.version}`);
    } catch (error) {
      console.error("Failed to connect to Weaviate:", error);
      throw new Error("Weaviate connection failed. Please ensure Weaviate is running.");
    }
  }
  
  return client;
}

/**
 * Initializes the Weaviate schema for chemical compounds
 */
export async function initializeSchema(): Promise<void> {
  const client = await getClient();
  
  // Check if schema exists
  const schema = await client.schema.getter().do();
  
  // Check if our class exists
  if (schema.classes && schema.classes.find(c => c.class === COMPOUND_CLASS)) {
    console.log(`Schema class ${COMPOUND_CLASS} already exists`);
    return;
  }
  
  // Create schema if it doesn't exist
  console.log(`Creating schema class ${COMPOUND_CLASS}`);
  
  const classObj = {
    class: COMPOUND_CLASS,
    description: "Chemical compound from PubChem",
    properties: [
      {
        name: "cid",
        dataType: ["int"],
        description: "PubChem Compound ID",
      },
      {
        name: "name",
        dataType: ["text"],
        description: "Primary name of the compound",
      },
      {
        name: "iupacName",
        dataType: ["text"],
        description: "IUPAC name of the compound",
      },
      {
        name: "formula",
        dataType: ["text"],
        description: "Chemical formula",
      },
      {
        name: "molecularWeight",
        dataType: ["number"],
        description: "Molecular weight in g/mol",
      },
      {
        name: "synonyms",
        dataType: ["text[]"],
        description: "Alternative names for the compound",
      },
      {
        name: "description",
        dataType: ["text"],
        description: "Textual description of the compound",
      },
      {
        name: "chemicalClass",
        dataType: ["text[]"],
        description: "Chemical classification terms",
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
        description: "URL to compound structure image",
      },
    ],
    vectorizer: "text2vec-openai",
    moduleConfig: {
      "text2vec-openai": {
        model: "ada",
        modelVersion: "002",
        type: "text",
      },
    },
  };
  
  await client.schema.classCreator().withClass(classObj).do();
  console.log(`Created schema class ${COMPOUND_CLASS}`);
}

/**
 * Adds a compound to the Weaviate database
 */
export async function addCompound(compound: Compound): Promise<void> {
  const client = await getClient();
  
  try {
    // Prepare compound object for Weaviate
    const compoundObj = {
      cid: compound.cid,
      name: compound.name,
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
    };
    
    // Create object in Weaviate
    await client.data
      .creator()
      .withClassName(COMPOUND_CLASS)
      .withProperties(compoundObj)
      .do();
      
  } catch (error) {
    console.error(`Error adding compound ${compound.cid} to Weaviate:`, error);
    throw error;
  }
}

/**
 * Performs a semantic search in Weaviate
 */
export async function semanticSearch(
  query: string,
  limit: number = 10,
  offset: number = 0
): Promise<{ results: CompoundSearchResult[], totalResults: number }> {
  try {
    const client = await getClient();
    
    // Get OpenAI embedding for the query if OpenAI client is available
    let nearVector;
    
    if (openai) {
      try {
        const response = await openai?.embeddings.create({
          model: "text-embedding-ada-002",
          input: query,
        });
        
        const embedding = response.data[0].embedding;
        nearVector = { vector: embedding };
      } catch (error) {
        console.error("Error generating OpenAI embedding:", error);
      }
    }
    
    // Prepare Weaviate query
    let weaviateQuery = client.graphql
      .get()
      .withClassName(COMPOUND_CLASS)
      .withFields("cid name iupacName formula molecularWeight chemicalClass description imageUrl _additional { certainty }")
      .withLimit(limit)
      .withOffset(offset);
    
    // Use nearVector if available, otherwise use nearText
    if (nearVector) {
      weaviateQuery = weaviateQuery.withNearVector(nearVector);
    } else {
      weaviateQuery = weaviateQuery.withNearText({ concepts: [query] });
    }
    
    // Execute query
    const result = await weaviateQuery.do();
    
    if (!result.data || !result.data.Get || !result.data.Get[COMPOUND_CLASS]) {
      return { results: [], totalResults: 0 };
    }
    
    // Process results
    const compounds = result.data.Get[COMPOUND_CLASS];
    const totalResults = compounds.length; // This is not accurate but Weaviate doesn't return total count
    
    // Map to CompoundSearchResult type
    const results = compounds.map((item: any) => ({
      cid: item.cid,
      name: item.name,
      iupacName: item.iupacName,
      formula: item.formula,
      molecularWeight: item.molecularWeight,
      chemicalClass: item.chemicalClass,
      description: item.description,
      imageUrl: item.imageUrl || `https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=${item.cid}&width=300&height=300`,
      similarity: item._additional?.certainty ? Math.round(item._additional.certainty * 100) : undefined,
    }));
    
    return { results, totalResults };
    
  } catch (error) {
    console.error("Error performing semantic search:", error);
    throw error;
  }
}

/**
 * Gets a compound by CID from Weaviate
 */
export async function getCompoundByCid(cid: number): Promise<Compound | null> {
  try {
    const client = await getClient();
    
    const result = await client.graphql
      .get()
      .withClassName(COMPOUND_CLASS)
      .withFields("cid name iupacName formula molecularWeight synonyms description chemicalClass inchi inchiKey smiles imageUrl")
      .withWhere({
        path: ["cid"],
        operator: "Equal",
        valueInt: cid,
      })
      .do();
    
    if (!result.data || !result.data.Get || !result.data.Get[COMPOUND_CLASS] || result.data.Get[COMPOUND_CLASS].length === 0) {
      return null;
    }
    
    const compoundData = result.data.Get[COMPOUND_CLASS][0];
    
    return {
      id: 0, // We don't store the internal ID in Weaviate
      cid: compoundData.cid,
      name: compoundData.name,
      iupacName: compoundData.iupacName,
      formula: compoundData.formula,
      molecularWeight: compoundData.molecularWeight,
      synonyms: compoundData.synonyms,
      description: compoundData.description,
      chemicalClass: compoundData.chemicalClass,
      inchi: compoundData.inchi,
      inchiKey: compoundData.inchiKey,
      smiles: compoundData.smiles,
      imageUrl: compoundData.imageUrl,
      properties: {},
      isProcessed: true,
    };
    
  } catch (error) {
    console.error(`Error getting compound with CID ${cid} from Weaviate:`, error);
    throw error;
  }
}
