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

const { Server } = require('socket.io');
const io = new Server(HTTPSserver);

// player + team
let currentlyConnected = []; // list of socket IDs

let teams = {
  red: [],
  blue: [],
  green: [],
  yellow: []
};

let players = {}; // { socketId: { name, team, lat, lon } }


let territories = {
  campus: {
    owner: null,
    trigger: { lat: 31.148769, lon: 121.481580}
  },
  apt_north: {
    owner: null,
    trigger: { lat: 31.150045, lon: 121.481865}
  },
  lawn: {
    owner: null,
    trigger: { lat: 31.147768, lon: 121.481848}
  },
  cstore_apts: {
    owner: null,
    trigger: { lat: 31.150224, lon: 121.483034}
  },
  metro:{
    owner:null,
    trigger: {lat:31.151257, lon:121.481865}
  },
  metro_west:{
    owner:null,
    trigger: {lat:31.150917, lon:121.480985}
  },
  campus_east:{
    owner:null,
    trigger:{lat:31.149421, lon:121.482675}
  },
    west_apt:{
    owner:null,
    trigger:{lat:31.148957, lon:121.479987}
  }
};


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

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  currentlyConnected.push(socket.id);

  socket.on("playerJoin", (data) => {
    const { name, team } = data;

    if (teams[team]) {
      teams[team].push({ id: socket.id, name });
    }

    players[socket.id] = { name, team, lat: null, lon: null };

    console.log(`${name} joined team ${team}`);
    console.log("Current players:", Object.keys(players).length);

    io.emit("playersUpdate", players);

    socket.emit("territoriesUpdate", territories);
  });

  socket.on("playerPosition", (data) => {
    if (players[socket.id]) {
      const player = players[socket.id];
      player.lat = data.lat;
      player.lon = data.lon;
      let changed = false;

    for (const [id, block] of Object.entries(territories)) {
      // Use triggerPoint consistently
      const trigger = block.trigger;
      if (!trigger) continue; // skip if block missing trigger point

      const dist = distanceInMeters(
        trigger.lat, trigger.lon,
        data.lat, data.lon
      );

      if (block.cooldownEnd && block.cooldownEnd > Date.now()) {
  continue; // skip, territory is on cooldown
  }

      // if player is close enough to claim
      if (dist < 20) {
        if (block.owner !== player.team) {
          block.owner = player.team;
          block.cooldownEnd = Date.now() + 30_000; // 30 sec cooldown
          console.log(`Territory "${id}" captured by ${player.team.toUpperCase()}`);
          changed = true;

        }
      }
    }


    if (changed) io.emit("territoriesUpdate", territories);
      io.emit("playersUpdate", players);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    currentlyConnected = currentlyConnected.filter(id => id !== socket.id);

    for (const teamName in teams) {
      teams[teamName] = teams[teamName].filter(player => player.id !== socket.id);
    }

    delete players[socket.id];

    io.emit("playersUpdate", players);
  });
});

HTTPSserver.listen(portHTTPS, function () {
  console.log(`HTTPS Server started at port ${portHTTPS}`);
});
