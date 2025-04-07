import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { searchQuerySchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import path from "path";
import fs from "fs";
import { fetchRandomCompounds } from "./db/downloadPubChem";
import { startBatchDownload, getDownloadProgress } from "./routes/download";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);

  // Check and create data directory if it doesn't exist
  const dataPath = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
    console.log(`Created data directory: ${dataPath}`);
  }

  // Initialize database
  try {
    await storage.initializeDatabase();
  } catch (error) {
    console.error("Error initializing database:", error);
  }

  // API Routes
  // All routes are prefixed with /api

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Get a specific compound by CID
  app.get("/api/compounds/:cid", async (req, res) => {
    try {
      const cid = parseInt(req.params.cid);
      
      if (isNaN(cid)) {
        return res.status(400).json({ error: "Invalid CID" });
      }
      
      const compound = await storage.getCompound(cid);
      
      if (!compound) {
        return res.status(404).json({ error: "Compound not found" });
      }
      
      res.json(compound);
    } catch (error) {
      console.error("Error getting compound:", error);
      res.status(500).json({ error: "Failed to get compound" });
    }
  });

  // Get a list of compounds
  app.get("/api/compounds", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const compounds = await storage.getCompounds(limit, offset);
      res.json(compounds);
    } catch (error) {
      console.error("Error listing compounds:", error);
      res.status(500).json({ error: "Failed to list compounds" });
    }
  });

  // Search compounds
  app.get("/api/search", async (req, res) => {
    try {
      // Parse and validate query parameters with zod
      const searchQuery = searchQuerySchema.parse({
        query: req.query.query as string,
        searchType: req.query.searchType as string || "semantic",
        molecularWeight: req.query.molecularWeight as string || "",
        chemicalClass: req.query.chemicalClass as string || "",
        sort: req.query.sort as string || "relevance",
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
      });
      
      // Perform search
      const results = await storage.searchCompounds(searchQuery);
      res.json(results);
    } catch (error) {
      console.error("Error searching compounds:", error);
      
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      
      res.status(500).json({ error: "Failed to search compounds" });
    }
  });

  // Load data endpoint (for development)
  app.post("/api/load-data", async (req, res) => {
    try {
      const limit = req.body.limit || 1000;
      const count = await storage.loadPubChemData(limit);
      res.json({ message: `Loaded ${count} compounds` });
    } catch (error) {
      console.error("Error loading data:", error);
      res.status(500).json({ error: "Failed to load data" });
    }
  });
  
  // Download new compounds from PubChem (original method - for smaller downloads)
  app.post("/api/download-compounds", async (req, res) => {
    try {
      // Set a default of 1000 compounds but allow customization
      const count = req.body.count || 1000;
      
      // This will be a long-running operation, so we'll start it in the background
      // and immediately return to the client
      res.json({ 
        message: `Started downloading ${count} compounds from PubChem. This is a background process that may take several minutes. Check the server logs for progress.` 
      });
      
      // Start the download process in the background
      (async () => {
        try {
          console.log(`Downloading ${count} compounds from PubChem...`);
          console.log(`Using rate limit of 399 requests per second as requested`);
          
          // Download the compounds
          await fetchRandomCompounds(count);
          
          // Once download is complete, reload the data
          console.log(`Download complete. Reloading database...`);
          await storage.initializeDatabase();
          
          console.log(`Successfully downloaded and loaded ${count} compounds`);
        } catch (downloadError) {
          console.error("Background download process failed:", downloadError);
        }
      })();
    } catch (error) {
      console.error("Error starting download:", error);
      res.status(500).json({ error: "Failed to start download process" });
    }
  });
  
  // Batch download 144,000 compounds (using detached child process)
  app.post("/api/batch-download", startBatchDownload);
  
  // Get status of the batch download process
  app.get("/api/batch-download/status", getDownloadProgress);

  return httpServer;
}
