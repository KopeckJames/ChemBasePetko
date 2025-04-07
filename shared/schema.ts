import { pgTable, text, serial, integer, boolean, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema kept for compatibility
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Chemical compound schema
export const compounds = pgTable("compounds", {
  id: serial("id").primaryKey(),
  cid: integer("cid").notNull().unique(),
  name: text("name").notNull(),
  iupacName: text("iupac_name"),
  formula: text("formula"),
  molecularWeight: real("molecular_weight"),
  synonyms: text("synonyms").array(),
  description: text("description"),
  chemicalClass: text("chemical_class").array(),
  inchi: text("inchi"),
  inchiKey: text("inchi_key"),
  smiles: text("smiles"),
  properties: jsonb("properties"),
  isProcessed: boolean("is_processed").default(false),
  imageUrl: text("image_url"),
});

export const insertCompoundSchema = createInsertSchema(compounds).omit({
  id: true,
  isProcessed: true,
});

// Search query schema
export const searchQuerySchema = z.object({
  query: z.string().min(1, "Query is required"),
  searchType: z.enum(["semantic", "keyword"]).default("semantic"),
  molecularWeight: z.enum(["", "lt_100", "100-200", "200-500", "gt_500"]).optional(),
  chemicalClass: z.enum(["", "aromatic", "aliphatic", "heterocyclic", "organometallic"]).optional(),
  sort: z.enum(["relevance", "molecular_weight", "name"]).default("relevance"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

// Compound search result schema
export const compoundSearchResultSchema = z.object({
  cid: z.number(),
  name: z.string(),
  iupacName: z.string().optional(),
  formula: z.string().optional(),
  molecularWeight: z.number().optional(),
  chemicalClass: z.array(z.string()).optional(),
  description: z.string().optional(),
  similarity: z.number().optional(),
  imageUrl: z.string().optional(),
});

// Search response schema
export const searchResponseSchema = z.object({
  results: z.array(compoundSearchResultSchema),
  totalResults: z.number(),
  page: z.number(),
  totalPages: z.number(),
  query: z.string(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCompound = z.infer<typeof insertCompoundSchema>;
export type Compound = typeof compounds.$inferSelect;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type CompoundSearchResult = z.infer<typeof compoundSearchResultSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
