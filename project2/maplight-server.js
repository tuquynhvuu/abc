const express = require('express');
const https = require("https");
const fs = require("fs");
const app = express();
const portHTTPS = 4260;

// Serve static files from public/
app.use(express.static('public'));

// SSL setup (for secure HTTPS)
const options = {
  key: fs.readFileSync("localhost-key.pem"),
  cert: fs.readFileSync("localhost.pem"),
};

let HTTPSserver = https.createServer(options, app);

// Socket.io setup
const { Server } = require('socket.io');
const io = new Server(HTTPSserver);

// ========== PLAYER + TEAM TRACKING ==========
let currentlyConnected = []; // list of socket IDs

let teams = {
  red: [],
  blue: [],
  green: [],
  yellow: []
};

let players = {}; // { socketId: { name, team, lat, lon } }

// ========== TERRITORY SYSTEM ==========
// Each block: id -> { owner, trigger: {lat, lon} }
// Add more blocks easily here
let territories = {
  campus: {
    owner: null,
    trigger: { lat: 31.14887, lon: 121.4815 }
  },
  apt_north: {
    owner: null,
    trigger: { lat: 31.149880, lon: 121.481881 }
  },
  lawn: {
    owner: null,
    trigger: { lat: 31.148016, lon: 121.481623 }
  },
  cstore_apts: {
    owner: null,
    trigger: { lat: 31.149935, lon: 121.482278 }
  }
};

// ========== DISTANCE FUNCTION (Haversine Formula) ==========
function distanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ========== SOCKET CONNECTIONS ==========
io.on('connection', (socket) => {
  console.log('🟢 A user connected:', socket.id);
  currentlyConnected.push(socket.id);

  // --- PLAYER JOINS A TEAM ---
  socket.on("playerJoin", (data) => {
    const { name, team } = data;

    // Register team membership
    if (teams[team]) {
      teams[team].push({ id: socket.id, name });
    }

    // Register player in master list
    players[socket.id] = { name, team, lat: null, lon: null };

    console.log(`✅ ${name} joined team ${team}`);
    console.log("Current players:", Object.keys(players).length);

    // Send updated info to everyone
    io.emit("playersUpdate", players);

    // Send territory states to the new player (so they see colors immediately)
    socket.emit("territoriesUpdate", territories);
  });

  // --- PLAYER POSITION UPDATE ---
  socket.on("playerPosition", (data) => {
    if (players[socket.id]) {
      const player = players[socket.id];
      player.lat = data.lat;
      player.lon = data.lon;

      // Check all territories for possible capture
      for (const [id, block] of Object.entries(territories)) {
        const dist = distanceInMeters(
          block.trigger.lat, block.trigger.lon,
          data.lat, data.lon
        );

        // If player is within ~15 meters of the trigger, they capture it
        if (dist < 15) {
          if (block.owner !== player.team) {
            block.owner = player.team;
            console.log(`🏁 Territory "${id}" captured by team ${player.team.toUpperCase()}`);
            io.emit("territoriesUpdate", territories); // update everyone
          }
        }
      }

      // Always broadcast player positions (for teammate visibility)
      io.emit("playersUpdate", players);
    }
  });

  // --- PLAYER DISCONNECTS ---
  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
    currentlyConnected = currentlyConnected.filter(id => id !== socket.id);

    // Remove from teams
    for (const teamName in teams) {
      teams[teamName] = teams[teamName].filter(player => player.id !== socket.id);
    }

    // Remove player record
    delete players[socket.id];

    io.emit("playersUpdate", players);
  });
});

// ========== START SERVER ==========
HTTPSserver.listen(portHTTPS, function () {
  console.log(`🚀 HTTPS Server started at port ${portHTTPS}`);
});
