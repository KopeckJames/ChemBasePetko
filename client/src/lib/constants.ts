export const APP_NAME = "ChemSearch";
export const APP_DESCRIPTION = "Vector Database for PubChem Compounds";

export const MOLECULAR_WEIGHT_OPTIONS = [
  { value: "", label: "Molecular Weight" },
  { value: "lt_100", label: "< 100" },
  { value: "100-200", label: "100 - 200" },
  { value: "200-500", label: "200 - 500" },
  { value: "gt_500", label: "> 500" },
];

export const CHEMICAL_CLASS_OPTIONS = [
  { value: "", label: "Chemical Class" },
  { value: "aromatic", label: "Aromatic" },
  { value: "aliphatic", label: "Aliphatic" },
  { value: "heterocyclic", label: "Heterocyclic" },
  { value: "organometallic", label: "Organometallic" },
];

export const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "molecular_weight", label: "Molecular Weight" },
  { value: "name", label: "Name (A-Z)" },
];

export const SEARCH_TYPES = [
  { value: "semantic", label: "Semantic" },
  { value: "keyword", label: "Keyword" },
];

export const SAMPLE_QUERIES = [
  "Find compounds similar to aspirin",
  "Show me anti-inflammatory compounds",
  "What compounds contain a benzene ring?",
  "Find analgesic medications",
  "Compounds with molecular weight under 200",
];

export const DEFAULT_IMAGE_URL = "https://pubchem.ncbi.nlm.nih.gov/image/imagefly.cgi?cid=2244&width=300&height=300";
