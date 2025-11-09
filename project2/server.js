const express = require('express');
const https = require("https");
const fs = require("fs");
const app = express(); // the server "app", the server behaviour
const portHTTPS = 3010; // YOUR port

// returning to the client anything that is inside the public folder
app.use(express.static('public'));

// Creating object of key and certificate for SSL
const options = {
    key: fs.readFileSync("localhost-key.pem"),
    cert: fs.readFileSync("localhost.pem"),
};

let HTTPSserver = https.createServer(options, app)

const { Server } = require('socket.io');
const io = new Server(HTTPSserver);

// Track connected clients
let currentlyConntected = []; // list of socket IDs of connected clients

// TEAMS STRUCTURE (optional for reference)
let teams = {
    red: [],
    blue: [],
    green: [],
    yellow: []
};

// Track all players with their location info
let players = {}; // { socketId: { name, team, lat, lon } }

io.on('connection', (socket) => {

    console.log('A user connected', socket.id);
    currentlyConntected.push(socket.id);
    console.log(currentlyConntected);

    // PLAYER JOIN
    socket.on("playerJoin", (data) => {
        const { name, team } = data;

        // Add to team structure
        if(teams[team]){
            teams[team].push({ id: socket.id, name: name });
        }

        // Add to players with default location
        players[socket.id] = { name: name, team: team, lat: null, lon: null };

        console.log(`${name} joined ${team} team`);
        console.log("Current teams:", teams);

        // Notify all clients of current players
        io.emit("playersUpdate", players);
    });

    // PLAYER LOCATION UPDATE
    socket.on("playerPosition", (data) => {
        if(players[socket.id]){
            players[socket.id].lat = data.lat;
            players[socket.id].lon = data.lon;
            io.emit("playersUpdate", players);
        }
    });

    // DISCONNECT
    socket.on("disconnect", function(){
        console.log("Someone disconnected", socket.id);

        // Remove from connected clients
        let idx = currentlyConntected.indexOf(socket.id);
        if(idx > -1){
            currentlyConntected.splice(idx, 1);
        }

        // Remove from teams
        for(const teamName in teams){
            teams[teamName] = teams[teamName].filter(player => player.id !== socket.id);
        }

        // Remove from players
        delete players[socket.id];

        console.log(currentlyConntected);
        console.log("Updated teams:", teams);

        // Broadcast updated players and teams
        io.emit("playersUpdate", players);
    })
})

// Additional express server endpoints could be made here

// Start HTTPS server
HTTPSserver.listen(portHTTPS, function () {
    console.log("HTTPS Server started at port", portHTTPS);
});
