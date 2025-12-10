const express = require('express');
const https = require("https");
const fs = require("fs");
const path = require("path");
const app = express();
const portHTTPS = 4260;

// debugging: how current directory structure
// console.log("=== Server Startup Debug ===");
// console.log("Current directory (__dirname):", __dirname);
// console.log("Server file location:", __filename);

const PUBLIC_DIR = path.join(__dirname, "public");
const DRAWINGS_DIR = path.join(PUBLIC_DIR, "drawings");
// console.log("Public directory path:", PUBLIC_DIR);
// console.log("Drawings directory path:", DRAWINGS_DIR);
// console.log("Drawings directory exists?", fs.existsSync(DRAWINGS_DIR));

// check what's in the current directory
try {
  console.log("Files in current directory:");
  fs.readdirSync(__dirname).forEach(file => {
    console.log("  -", file);
  });
  
  console.log("Files in public directory (if exists):");
  if (fs.existsSync(PUBLIC_DIR)) {
    fs.readdirSync(PUBLIC_DIR).forEach(file => {
      console.log("  -", file);
    });
  }
} catch (err) {
  console.log("Error reading directory:", err.message);
}

if (!fs.existsSync(DRAWINGS_DIR)) {
  console.log("Creating drawings directory...");
  fs.mkdirSync(DRAWINGS_DIR, { recursive: true });
  console.log("Drawings directory created");
}

// FIXED: Serve public folder with absolute path
app.use(express.static(PUBLIC_DIR));
// FIXED: Serve drawings folder correctly
app.use('/drawings', express.static(DRAWINGS_DIR));

// Add a test endpoint to debug
app.get('/debug', (req, res) => {
  const drawingsExist = fs.existsSync(DRAWINGS_DIR);
  const drawingsFiles = drawingsExist ? fs.readdirSync(DRAWINGS_DIR) : [];
  
  res.json({
    success: true,
    serverDir: __dirname,
    publicDir: PUBLIC_DIR,
    drawingsDir: DRAWINGS_DIR,
    drawingsExists: drawingsExist,
    drawingsCount: drawingsFiles.length,
    sampleFiles: drawingsFiles.slice(0, 5),
    canAccessDrawing: drawingsFiles.length > 0 ? 
      `/drawings/${drawingsFiles[0]}` : 'No files',
    serverTime: new Date().toISOString()
  });
});

// Test if a specific file can be accessed
app.get('/test-file/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(DRAWINGS_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({
      success: false,
      message: `File not found: ${filename}`,
      filepath: filepath,
      exists: false
    });
  }
  
  const stats = fs.statSync(filepath);
  res.json({
    success: true,
    filename: filename,
    filepath: filepath,
    exists: true,
    size: stats.size,
    created: stats.birthtime,
    url: `/drawings/${filename}`
  });
});

// draw-data.json path
const DATA_JSON = path.join(__dirname, "draw-data.json");
console.log("Data JSON path:", DATA_JSON);
let drawData = [];

// load existing metadata if present
try {
  if (fs.existsSync(DATA_JSON)) {
    drawData = JSON.parse(fs.readFileSync(DATA_JSON, "utf8"));
    console.log("Loaded draw-data.json entries:", drawData.length);
  }
} catch (err) {
  console.warn("Could not read draw-data.json, starting empty");
  drawData = [];
}

const options = {
    key: fs.readFileSync("localhost-key.pem"),
    cert: fs.readFileSync("localhost.pem"),
};

const HTTPSserver = https.createServer(options, app);
const { Server } = require('socket.io');
const io = new Server(HTTPSserver, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// handle new client connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // send all existing drawings to new user
    socket.on("joinUser", () => {
      console.log(`User ${socket.id} requested images, sending ${drawData.length} images`);
      socket.emit("allImages", drawData);
    });

    // save a new png from client
    socket.on("savePNG", (payload) => {
      try {
        console.log(`Received PNG from user ${payload.meta?.userId || 'unknown'}`);
        
        const dataURL = payload.image;
        const meta = payload.meta || {};
        let base64 = dataURL.replace(/^data:image\/png;base64,/, "");

        const filename = meta.file || `drawing-${meta.userId || "anon"}-${Date.now()}.png`;
        const filepath = path.join(DRAWINGS_DIR, filename);

        // Verify directory exists
        if (!fs.existsSync(DRAWINGS_DIR)) {
          fs.mkdirSync(DRAWINGS_DIR, { recursive: true });
        }

        fs.writeFileSync(filepath, base64, "base64");
        console.log(`Saved PNG: ${filename} (${base64.length} bytes)`);

        // metadata
        const entry = {
          file: filename,
          userId: meta.userId || "anon",
          timestamp: meta.timestamp || Date.now(),
          latMax: meta.latMax,
          latMin: meta.latMin,
          lonMin: meta.lonMin,
          lonMax: meta.lonMax,
          width: meta.width,
          height: meta.height
        };
        
        drawData.push(entry);

        // save to json file
        fs.writeFileSync(DATA_JSON, JSON.stringify(drawData, null, 2), "utf8");
        console.log(`Updated draw-data.json, now has ${drawData.length} entries`);

        io.emit("newImage", entry);
      } catch (err) {
        console.error("Error saving PNG:", err);
        socket.emit("error", { message: "Failed to save drawing" });
      }
    });

    // undo: delete only the most recent png for a specific user 
    socket.on("deleteLastImage", (userId) => {
      console.log(`Undo requested for user: ${userId}`);
      
      // get all drawings for this user
      const userDrawings = drawData.filter(entry => entry.userId === userId);

      if (userDrawings.length === 0) {
        console.log(`No drawings found for user ${userId} to undo`);
        socket.emit("error", { message: "No drawings to undo" });
        return;
      }

      // find the most recent drawing (highest timestamp)
      let lastDrawing = userDrawings.reduce((prev, curr) => prev.timestamp > curr.timestamp ? prev : curr);

      // remove it from drawdata
      drawData = drawData.filter(entry => entry !== lastDrawing);

      // delete the file
      const filePath = path.join(DRAWINGS_DIR, lastDrawing.file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted file: ${lastDrawing.file}`);
      }

      // save updated drawData
      fs.writeFileSync(DATA_JSON, JSON.stringify(drawData, null, 2), "utf8");

      console.log(`Undo: deleted last drawing for user ${userId}: ${lastDrawing.file}`);

      // tell clients to remove this image
      io.emit("deleteImage", lastDrawing.file);
    });

    // handle live drawing segments (just relay strokes)
    socket.on("newDrawing", (point) => {
      io.emit("newDrawing", point);
    });

    // clear all images
    socket.on("clearAllImages", () => {
      console.log("Clearing ALL images");
      drawData.forEach(entry => {
        const f = path.join(DRAWINGS_DIR, entry.file);
        if (fs.existsSync(f)) {
          fs.unlinkSync(f);
          console.log(`Deleted: ${entry.file}`);
        }
      });
      drawData = [];
      fs.writeFileSync(DATA_JSON, JSON.stringify(drawData, null, 2), "utf8");
      io.emit("allImages", drawData);
      console.log("All images cleared");
    });

    // clear images for a specific user
    socket.on("clearMyImages", (userId) => {
      console.log(`Clearing images for user: ${userId}`);
      drawData = drawData.filter(entry => {
        if (entry.userId === userId) {
          const f = path.join(DRAWINGS_DIR, entry.file);
          if (fs.existsSync(f)) {
            fs.unlinkSync(f);
            console.log(`Deleted user image: ${entry.file}`);
          }
          return false; // remove from array
        }
        return true;
      });
      fs.writeFileSync(DATA_JSON, JSON.stringify(drawData, null, 2), "utf8");
      io.emit("allImages", drawData);
      console.log(`Cleared images for user ${userId}, remaining: ${drawData.length}`);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
});

// FIXED: Bind to all network interfaces
HTTPSserver.listen(portHTTPS, '0.0.0.0', () => {
    console.log(`HTTPS Server started at port ${portHTTPS}`);
    console.log(`Accessible at:`);
    console.log(`- https://localhost:${portHTTPS}`);
    console.log(`- https://127.0.0.1:${portHTTPS}`);
    console.log(`- https://browsercircus.live:${portHTTPS}`);
    console.log(`Public directory: ${PUBLIC_DIR}`);
    console.log(`Drawings directory: ${DRAWINGS_DIR}`);
    console.log(`Drawings count: ${drawData.length}`);
});