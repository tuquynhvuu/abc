const express = require('express');
const https = require('https');
const fs = require('fs');
const app = express();


const portHTTPS = 4260;

app.use(express.static('public'));

const options = {
  key: fs.readFileSync("keys-for-local-https/localhost-key.pem"),
  cert: fs.readFileSync("keys-for-local-https/localhost.pem"),
};

const HTTPSserver = https.createServer(options, app);

const { Server } = require('socket.io');
const io = new Server(HTTPSserver);

// store all connected players
let entities = {}; // { socketId: { role, hue, shape?, x, y, volume, lastActive } }

// assn random hue
function randomHue() { return Math.floor(Math.random() * 360); }
// assn random role
function randomRole() { return ['light', 'wind', 'life'][Math.floor(Math.random() * 3)]; }
// assn random shape for life roles
function randomShape() { return ['circle', 'square', 'star'][Math.floor(Math.random() * 3)]; }

io.on('connection', (socket) => {
  console.log('user connected:', socket.id);

  const role = randomRole();
  const hue = randomHue();
  const entity = {
    role,
    hue,
    x: 0.5,
    y: 0.5,
    volume: 0,
    lastActive: Date.now()
  };
  // assign shape is role is life
  if (role === 'life') entity.shape = randomShape();

  //save entity in server state
  entities[socket.id] = entity;
  socket.emit('assignRole', entity);

  socket.on('update', (data) => {
    const e = entities[socket.id];
    if (!e) return;
    //update pos
    e.x = (typeof data.x === 'number') ? data.x : e.x;
    e.y = (typeof data.y === 'number') ? data.y : e.y;

    //update volume
    if (typeof data.volume === 'number') e.volume = data.volume;

    //update hue
    if (typeof data.hue === 'number') e.hue = data.hue;

    //update shapes for life roles
    if (typeof data.shape === 'string' && e.role === 'life') e.shape = data.shape;
    e.lastActive = Date.now();
  });

  socket.on('interaction', (key) => {
    io.emit('playSound', key);
  });

  socket.on('disconnect', () => {
    console.log('disconnected:', socket.id);
    delete entities[socket.id];
  });
});

// broadcast state at fixed interval
setInterval(() => {
  io.emit('state', entities);
}, 50);

HTTPSserver.listen(portHTTPS, () => {
  console.log('HTTPS Server running on port', portHTTPS);
});
