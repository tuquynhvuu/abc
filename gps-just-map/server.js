const express = require('express');
const https = require("https");
// to read certificates from the filesystem (fs)
const fs = require("fs");
const app = express(); // the server "app", the server behaviour
const portHTTPS = 3010; // YOUR port

// returning to the client anything that is
// inside the public folder
app.use(express.static('public'));

// Creating object of key and certificate
// for SSL
const options = {
    key: fs.readFileSync("localhost-key.pem"),
    cert: fs.readFileSync("localhost.pem"),
};

let HTTPSserver = https.createServer(options, app)
const { Server } = require('socket.io'); // include library
const io = new Server(HTTPSserver); // start socket io 

let currentlyConntected = []; //list of socket IDs of copnnected clients

// ---- MAPLIGHT GAME DATA STRUCTURES ----
let teams = {}; // {teamName: {color: "red", points: 0, members: [socket.id,...]}}
let territories = [
  // Example territories: each territory has coords, status, and owner
  {lat: 40.0, lng: -75.0, claimedBy: null, points: 5, name: "Library Corner", foundObject: false},
  {lat: 40.1, lng: -75.05, claimedBy: null, points: 10, name: "Science Quad", foundObject: false},
  // add more territory coordinates as needed
];

// ---- SOCKET.IO CONNECTIONS ----
io.on('connection', (socket) => {

    // we manage the connection inside here
    console.log('a user connected', socket.id);
    currentlyConntected.push(socket.id);
    console.log(currentlyConntected);

    // CLIENT JOINS A TEAM
    socket.on("joinTeam", (teamName) => {
        if(!teams[teamName]){
            teams[teamName] = {color: getRandomColor(), points: 0, members: []};
        }
        teams[teamName].members.push(socket.id);
        socket.teamName = teamName; // save team on socket
        console.log(`${socket.id} joined team ${teamName}`);
        socket.emit("teamJoined", {teamName, color: teams[teamName].color, points: teams[teamName].points});
    });

    // CLIENT SENDS GPS UPDATE
    socket.on("updateLocation", (data) => {
        // data = {lat, lng}
        // Check if near any territory
        territories.forEach((t) => {
            if(!t.claimedBy && distance(t.lat, t.lng, data.lat, data.lng) < 0.0005){ // ~50m radius
                t.claimedBy = socket.teamName;
                teams[socket.teamName].points += t.points;
                console.log(`${t.name} claimed by ${socket.teamName} for ${t.points} points`);
                io.emit("territoryClaimed", t); // broadcast to all clients
            }
        });
    });

    // CLIENT SUBMITS OBJECT
    socket.on("submitObject", (objectData) => {
        // For simplicity, auto-approve first submit
        console.log("Object submitted", objectData);
        socket.emit("objectApproved", objectData); // Could later involve game master logic
    });

    // DISCONNECT
    socket.on("disconnect", function(){
        console.log("someone disconnected", socket.id)
        let idx = currentlyConntected.indexOf(socket.id);
        if(idx > -1){
            currentlyConntected.splice(idx, 1);
            console.log(currentlyConntected);
        }
        // Remove from teams
        if(socket.teamName && teams[socket.teamName]){
            let memberIdx = teams[socket.teamName].members.indexOf(socket.id);
            if(memberIdx > -1) teams[socket.teamName].members.splice(memberIdx, 1);
        }
    })

})

// --- UTILITY FUNCTIONS ---
function getRandomColor(){
    const colors = ["red","blue","green","yellow","purple","orange"];
    return colors[Math.floor(Math.random()*colors.length)];
}

function distance(lat1, lon1, lat2, lon2){
    // simple Euclidean for small distances, not precise but enough for campus scale
    return Math.sqrt((lat1-lat2)**2 + (lon1-lon2)**2);
}

// additional express server endpoints could be made here:

// Creating https server by passing
// options and app object
HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});
