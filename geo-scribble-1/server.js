const express = require('express');
const https = require("https");
const fs = require("fs");
const path = require("path");
const app = express();
const portHTTPS = 4260;

// DEBUG: Show current directory structure
console.log("=== Server Startup Debug ===");
console.log("Current directory (__dirname):", __dirname);
console.log("Server file location:", __filename);

// ensure drawings folder exists for saving pngs
const DRAWINGS_DIR = path.join(__dirname, "public", "drawings");
console.log("Drawings directory path:", DRAWINGS_DIR);
console.log("Drawings directory exists?", fs.existsSync(DRAWINGS_DIR));

// Check what's in the current directory
try {
  console.log("Files in current directory:");
  fs.readdirSync(__dirname).forEach(file => {
    console.log("  -", file);
  });
  
  console.log("Files in public directory (if exists):");
  if (fs.existsSync(path.join(__dirname, "public"))) {
    fs.readdirSync(path.join(__dirname, "public")).forEach(file => {
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

// serve public folder
app.use(express.static('public'));
// Serve drawings folder
app.use('/drawings', express.static(DRAWINGS_DIR));

// Add a test endpoint to debug
app.get('/debug', (req, res) => {
  const drawingsExist = fs.existsSync(DRAWINGS_DIR);
  const drawingsFiles = drawingsExist ? fs.readdirSync(DRAWINGS_DIR) : [];
  
  res.json({
    success: true,
    serverDir: __dirname,
    drawingsDir: DRAWINGS_DIR,
    drawingsExists: drawingsExist,
    drawingsCount: drawingsFiles.length,
    sampleFiles: drawingsFiles.slice(0, 5),
    canAccessDrawing: drawingsFiles.length > 0 ? 
      `/drawings/${drawingsFiles[0]}` : 'No files'
  });
});

// draw-data.json path
const DATA_JSON = path.join(__dirname, "draw-data.json");
console.log("Data JSON path:", DATA_JSON);
let drawData = [];

// ... rest of your code remains the same ...

// load existing metadata if present
try {
  if (fs.existsSync(DATA_JSON)) {
    drawData = JSON.parse(fs.readFileSync(DATA_JSON, "utf8"));
    console.log("loaded draw-data.json entries:", drawData.length);
  }
} catch (err) {
  console.warn("could not read draw-data.json, starting empty");
  drawData = [];
}

const options = {
    key: fs.readFileSync("localhost-key.pem"),
    cert: fs.readFileSync("localhost.pem"),
};

const HTTPSserver = https.createServer(options, app);
const { Server } = require('socket.io');
const io = new Server(HTTPSserver);

// handle new client connectiosn
io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    // send all existing drawings to new user
    socket.on("joinUser", () => {
      socket.emit("allImages", drawData);
    });

    // save a new png from client
    socket.on("savePNG", (payload) => {
      try {
        const dataURL = payload.image;
        const meta = payload.meta || {};
        let base64 = dataURL.replace(/^data:image\/png;base64,/, "");

        const filename = meta.file || `drawing-${meta.userId || "anon"}-${Date.now()}.png`;
        const filepath = path.join(DRAWINGS_DIR, filename);

        fs.writeFileSync(filepath, base64, "base64");

      // metadat
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

        //save to json file
        fs.writeFileSync(DATA_JSON, JSON.stringify(drawData, null, 2), "utf8");

        io.emit("newImage", entry);
      } catch (err) {
        console.error("error saving png:", err);
      }
    });

    // undo: delete only the most recent png for a specific user 
    socket.on("deleteLastImage", (userId) => {
      // get all drawings for this user
      const userDrawings = drawData.filter(entry => entry.userId === userId);

      if (userDrawings.length === 0) {
        console.log(`No drawings found for user ${userId} to undo`);
        return;
      }

      // find the most recent drawing (highest timestamp)
      let lastDrawing = userDrawings.reduce((prev, curr) => prev.timestamp > curr.timestamp ? prev : curr);

      // remove it from drawdata
      drawData = drawData.filter(entry => entry !== lastDrawing);

      // delete the file
      const filePath = path.join(DRAWINGS_DIR, lastDrawing.file);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

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
      drawData.forEach(entry => {
        const f = path.join(DRAWINGS_DIR, entry.file);
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });
      drawData = [];
      fs.writeFileSync(DATA_JSON, JSON.stringify(drawData, null, 2), "utf8");
      io.emit("allImages", drawData);
    });

    // clear images for a specific user
    socket.on("clearMyImages", (userId) => {
      drawData = drawData.filter(entry => {
        if (entry.userId === userId) {
          const f = path.join(DRAWINGS_DIR, entry.file);
          if (fs.existsSync(f)) fs.unlinkSync(f);
          return false; // remove from array
        }
        return true;
      });
      fs.writeFileSync(DATA_JSON, JSON.stringify(drawData, null, 2), "utf8");
      io.emit("allImages", drawData);
    });

    socket.on("disconnect", () => {
      console.log("user disconnected", socket.id);
    });
});

HTTPSserver.listen(portHTTPS, () => {
    console.log("HTTPS Server started at port", portHTTPS);
});
