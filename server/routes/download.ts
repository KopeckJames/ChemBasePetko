import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';

// Download progress file
const PROGRESS_FILE = path.join(process.cwd(), 'data', 'download_progress.json');

// Start background download process
export function startBatchDownload(req: Request, res: Response) {
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Initialize progress file
    const progress = {
      status: 'starting',
      downloadedCount: 0,
      totalCount: 144000,
      lastUpdate: new Date().toISOString(),
      batches: []
    };
    
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
    
    // Spawn the background process
    const scriptPath = path.join(process.cwd(), 'scripts', 'batch-download-compounds.ts');
    const tsxPath = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
    
    console.log(`Starting background download process: ${tsxPath} ${scriptPath}`);
    
    const child = spawn(tsxPath, [scriptPath], {
      detached: true,
      stdio: ['ignore', 
        fs.openSync(path.join(dataDir, 'download_stdout.log'), 'a'),
        fs.openSync(path.join(dataDir, 'download_stderr.log'), 'a')
      ]
    });
    
    // Detach the child process
    child.unref();
    
    // Return success
    res.status(200).json({
      success: true,
      message: 'Background download process started',
      pid: child.pid
    });
  } catch (error: any) {
    console.error('Error starting download process:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start download process',
      error: error.message || String(error)
    });
  }
}

// Get download progress
export function getDownloadProgress(req: Request, res: Response) {
  try {
    if (!fs.existsSync(PROGRESS_FILE)) {
      return res.status(404).json({
        success: false,
        message: 'No download process has been started'
      });
    }
    
    const progressData = fs.readFileSync(PROGRESS_FILE, 'utf8');
    const progress = JSON.parse(progressData);
    
    // Check if process is still running
    const stdoutLogPath = path.join(process.cwd(), 'data', 'download_stdout.log');
    let lastLogs = '';
    
    if (fs.existsSync(stdoutLogPath)) {
      const fileSize = fs.statSync(stdoutLogPath).size;
      // Read last 5KB of logs
      const readSize = Math.min(fileSize, 5 * 1024); 
      const buffer = Buffer.alloc(readSize);
      const fd = fs.openSync(stdoutLogPath, 'r');
      fs.readSync(fd, buffer, 0, readSize, fileSize - readSize);
      fs.closeSync(fd);
      lastLogs = buffer.toString('utf8');
    }
    
    // Return progress and recent logs
    res.status(200).json({
      success: true,
      progress,
      recentLogs: lastLogs
    });
  } catch (error: any) {
    console.error('Error getting download progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get download progress',
      error: error.message || String(error)
    });
  }
}