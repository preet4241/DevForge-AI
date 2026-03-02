import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });
  const PORT = 3000;

  // Ensure workspace directory exists
  const workspaceDir = path.join(process.cwd(), 'workspace');
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  // Socket.io for Terminal
  io.on('connection', (socket) => {
    console.log('Client connected to terminal socket');
    
    // Determine CWD based on query param
    let cwd = workspaceDir;
    const folderName = socket.handshake.query.folderName as string;
    if (folderName) {
      const safeFolderName = folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const projectPath = path.join(workspaceDir, safeFolderName);
      if (fs.existsSync(projectPath)) {
        cwd = projectPath;
      }
    }
    
    // Use Python to spawn a real PTY. This fixes backspace, line editing, 
    // and mobile keyboard (IME) duplication issues that happen with raw pipes.
    const isWin = os.platform() === 'win32';
    const ptyProcess = isWin 
      ? spawn('cmd.exe', [], {
          cwd: cwd,
          env: { ...process.env, TERM: 'xterm-256color' }
        })
      : spawn('python3', ['-u', '-c', 'import pty; pty.spawn("/bin/bash")'], {
          cwd: cwd,
          env: { ...process.env, TERM: 'xterm-256color' }
        });

    ptyProcess.stdout.on('data', (data) => {
      socket.emit('terminal.incData', data.toString());
    });

    if (ptyProcess.stderr) {
      ptyProcess.stderr.on('data', (data) => {
        socket.emit('terminal.incData', data.toString());
      });
    }

    socket.on('terminal.toTerm', (data) => {
      ptyProcess.stdin.write(data);
    });

    socket.on('disconnect', () => {
      ptyProcess.kill();
    });
  });

  // API routes FIRST
  app.use(express.json({ limit: '50mb' })); // Add JSON body parser with increased limit for files

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/workspace/sync", (req, res) => {
    const { folderName, files } = req.body;
    if (!folderName) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    const safeFolderName = folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!safeFolderName) {
      return res.status(400).json({ error: "Invalid folder name" });
    }

    const projectPath = path.join(workspaceDir, safeFolderName);
    
    try {
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
      }

      // Write files to disk
      if (Array.isArray(files)) {
        for (const file of files) {
          if (file.name && file.content !== undefined) {
            const filePath = path.join(projectPath, file.name);
            const fileDir = path.dirname(filePath);
            
            // Ensure directory exists
            if (!fs.existsSync(fileDir)) {
              fs.mkdirSync(fileDir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, file.content, 'utf8');
          }
        }
      }

      res.json({ status: "success", path: projectPath });
    } catch (error) {
      console.error("Error syncing workspace files:", error);
      res.status(500).json({ error: "Failed to sync files" });
    }
  });

  app.post("/api/workspace/create", (req, res) => {
    const { folderName } = req.body;
    if (!folderName) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    // Sanitize folder name to be safe (only alphanumeric and hyphens)
    const safeFolderName = folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    if (!safeFolderName) {
      return res.status(400).json({ error: "Invalid folder name" });
    }

    const projectPath = path.join(workspaceDir, safeFolderName);
    
    try {
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
      }
      res.json({ status: "success", path: projectPath, folderName: safeFolderName });
    } catch (error) {
      console.error("Error creating workspace folder:", error);
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
