const express = require('express');

// const http = require("http");
const https = require("https");

// to read certificates from the filesystem (fs)
const fs = require("fs");

const app = express(); // the server "app", the server behaviour
// const portHTTP = 3000; // port for http
const portHTTPS = 3001; 
// const portHTTPS = 4260; 

// returning to the client anything that is
// inside the public folder
app.use(express.static('public'));

// creating object of key and certificate for SSL
const options = {
    key: fs.readFileSync("keys-for-local-https/localhost-key.pem"),
    cert: fs.readFileSync("keys-for-local-https/localhost.pem"),
};

let HTTPSserver = https.createServer(options, app);

const { Server } = require('socket.io'); //include library
const io = new Server(HTTPSserver); // start socket.io

// store users, sound levels, and petal data
let users = {};
let soundLevels = {};
let brushes = {}; // { socketId: { x, y, size, hue, shape, lastUpdated } }

function randomShape() {
  const shapes = ['circle', 'triangle', 'square'];
  return shapes[Math.floor(Math.random() * shapes.length)];
}

function randomHue() {
  return Math.floor(Math.random() * 360);
}

io.on('connection', (socket) => {
  console.log('a user connected', socket.id);

  // add new user
  users[socket.id] = true;
  soundLevels[socket.id] = 0;

  // assign initial brush: normalized center position, random shape & hue
  brushes[socket.id] = {
    x: 0.5, 
    y: 0.5, 
    size: 0.05,     // normalized size as fraction of shorter screen dimension
    hue: randomHue(),
    shape: randomShape(),
    lastUpdated: Date.now()
  };

  // send initial assignment (shape + base hue) to the client
  socket.emit('assignBrush', { 
    shape: brushes[socket.id].shape, 
    baseHue: brushes[socket.id].hue 
  });


  // send initial state to everyone
  io.emit("state", {
    users: Object.keys(users).length,
    brushes: brushes
  });

  // receive sound data from each client
  socket.on("soundLevel", (data) => {
    soundLevels[socket.id] = data.volume;

    io.emit("state", {
      users: Object.keys(users).length,
      brushes: brushes
    });
  });

  // receive brush movement / updates from client
  // data: { x: 0..1, y: 0..1, size: 0..1, hue: 0..360 }
  socket.on("brushMove", (data) => {
    if (!brushes[socket.id]) {
      brushes[socket.id] = { x:0.5, y:0.5, size:0.05, hue: randomHue(), shape: randomShape(), lastUpdated: Date.now() };
    }
    brushes[socket.id].x = Math.min(Math.max(data.x, 0), 1);
    brushes[socket.id].y = Math.min(Math.max(data.y, 0), 1);
    brushes[socket.id].size = Math.min(Math.max(data.size, 0.01), 0.5);
    brushes[socket.id].hue = (typeof data.hue === 'number') ? data.hue : brushes[socket.id].hue;
    brushes[socket.id].lastUpdated = Date.now();

    // Broadcast the brushes map to everyone (lightweight)
    io.emit('state', { 
      users: Object.keys(users).length, 
      brushes: brushes 
    });
  });



  // when someone disconnects
  socket.on("disconnect", () => {
    console.log("someone disconnected", socket.id);
    delete users[socket.id];
    delete soundLevels[socket.id];
    delete brushes[socket.id];

    io.emit("state", {
      users: Object.keys(users).length,
      brushes: brushes
    });
  });
});

// creating servers and make it listen at their port:
HTTPSserver.listen(portHTTPS, function (req, res) {
    console.log("HTTPS Server started at port", portHTTPS);
});
