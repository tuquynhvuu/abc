const express = require('express');
const https = require("https");
const fs = require("fs");
const app = express();
const portHTTPS = 4260;

// Serve static files
app.use(express.static('public'));

// SSL setup
const options = {
  key: fs.readFileSync("localhost-key.pem"),
  cert: fs.readFileSync("localhost.pem"),
};

let HTTPSserver = https.createServer(options, app);

const { Server } = require('socket.io');
const io = new Server(HTTPSserver);

// Track connected clients
let currentlyConnected = [];

// Team data
let teams = {
  red: [],
  blue: [],
  green: [],
  yellow: []
};

// Player data
let players = {}; // { socketId: { name, team, lat, lon } }

// --- TERRITORY SYSTEM ---
// Each block: id -> { corners, owner (team name or null), trigger point }
let territories = {
  block1: {
    owner: null,
    trigger: { lat: 31.14887, lon: 121.4815 }
  },
  // You can add block2, block3, etc. later
};

// Simple helper to compute distance between lat/lon points (in meters)
function distanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // radius of Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

io.on('connection', (socket) => {
  console.log('A user connected', socket.id);
  currentlyConnected.push(socket.id);

  // PLAYER JOIN
  socket.on("playerJoin", (data) => {
    const { name, team } = data;

    if (teams[team]) {
      teams[team].push({ id: socket.id, name });
    }

    players[socket.id] = { name, team, lat: null, lon: null };

    console.log(`${name} joined ${team} team`);
    io.emit("playersUpdate", players);
    io.emit("territoriesUpdate", territories); // Send current territory state
  });

  // PLAYER POSITION UPDATE
  socket.on("playerPosition", (data) => {
    if (players[socket.id]) {
      players[socket.id].lat = data.lat;
      players[socket.id].lon = data.lon;

      // Check territory capture
      for (const [id, block] of Object.entries(territories)) {
        const dist = distanceInMeters(
          block.trigger.lat, block.trigger.lon,
          data.lat, data.lon
        );

        if (dist < 15) { // within 15m radius
          if (block.owner !== players[socket.id].team) {
            block.owner = players[socket.id].team;
            console.log(`Territory ${id} captured by ${block.owner}`);
            io.emit("territoriesUpdate", territories);
          }
        }
      }

      io.emit("playersUpdate", players);
    }
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    console.log("Someone disconnected", socket.id);
    currentlyConnected = currentlyConnected.filter(id => id !== socket.id);

    for (const teamName in teams) {
      teams[teamName] = teams[teamName].filter(player => player.id !== socket.id);
    }

    delete players[socket.id];

    io.emit("playersUpdate", players);
  });
});

// Start HTTPS server
HTTPSserver.listen(portHTTPS, function () {
  console.log("HTTPS Server started at port", portHTTPS);
});
