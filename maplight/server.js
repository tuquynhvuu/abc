const fs = require("fs");
const express = require("express");
const https = require("https");
const socketIO = require("socket.io");

const app = express();

// Load local SSL cert and key for HTTPS
const options = {
  key: fs.readFileSync("localhost-key.pem"),
  cert: fs.readFileSync("localhost.pem")
};

// Create HTTPS server
const server = https.createServer(options, app);
const io = socketIO(server);

app.use(express.static("public"));

let territories = {}; // key: "lat_lng", value: team color

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinTeam", (teamColor) => {
    socket.team = teamColor;
    console.log(`${socket.id} joined team ${teamColor}`);
  });

  socket.on("claimTerritory", (coords) => {
    const key = `${coords.lat.toFixed(4)}_${coords.lng.toFixed(4)}`;
    if (!territories[key]) {
      territories[key] = socket.team;
      io.emit("territoryUpdate", { coords, color: socket.team });
      console.log(`Territory claimed at ${key} by ${socket.team}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`✅ HTTPS server running at https://localhost:${PORT}`);
});
