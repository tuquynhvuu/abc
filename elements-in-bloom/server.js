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
let entities = {};
let allSeeds = [];
let allWindParticles = [];

function randomHue() { return Math.floor(Math.random() * 360); }

function getRole(socket) {
  const query = socket.handshake.query || {};
  if (query.role === 'conductor') {
    return 'conductor';
  }
  return ['light', 'wind', 'life'][Math.floor(Math.random() * 3)];
}

// track recently transformed seeds 
let recentlyTransformed = new Set();

// check for interactions between players and seeds
function checkInteractions() {
  const players = Object.values(entities);
  
  // light players transform seeds into sprouts
  const lightPlayers = players.filter(p => p.role === 'light');
  lightPlayers.forEach(light => {
    for (let i = 0; i < allSeeds.length; i++) {
      const seed = allSeeds[i];
      
      // transform seeds that are in seed state
      if (seed.state === 'seed' && !recentlyTransformed.has(seed.id)) {
        const dist = Math.hypot(seed.x - light.x, seed.y - light.y);
        if (dist < 0.1) {
          // console.log('Light transforming seed to sprout:', seed.id);
          
          // mark as recently transformed
          recentlyTransformed.add(seed.id);
          
          // transform seed to sprout 
          seed.state = 'sprout';
          seed.growthProgress = 0.1; 
          
          // broadcast transformation to conductor
          io.emit('seedTransformed', seed);
          io.emit('interaction', 'life-light');
          
          // remove from recently transformed after 2 seconds
          setTimeout(() => {
            recentlyTransformed.delete(seed.id);
          }, 2000);
          break;
        }
      }
    }
  });

// wind players disperse sprouts (only fully grown ones)
    const windPlayers = players.filter(p => p.role === 'wind');
    windPlayers.forEach(wind => {
      for (let i = allSeeds.length - 1; i >= 0; i--) {
        const seed = allSeeds[i];
        
        // only affect sprouts that are fully grown
        if (seed.state === 'sprout' && seed.growthProgress >= 0.95) {
          // calc middle of sprout
          const sproutMiddleX = seed.x;
          const sproutMiddleY = seed.y - 0.03; 
          
          const dist = Math.hypot(sproutMiddleX - wind.x, sproutMiddleY - wind.y);
          
          if (dist < 0.1) {
            // console.log('WIND EXPLOSION: Dispersing sprout into SMALL, SLOW particles:', seed.id);
            
            // small slow particles
            const newParticles = [];
            const particleCount = 60; 
            
            for (let j = 0; j < particleCount; j++) {
              // leftward bias with gentle spread
              const angle = Math.PI + (Math.random() - 0.5) * 0.4; 
              const speed = 0.005 + Math.random() * 0.01; 
              
              const vx = Math.cos(angle) * speed;
              const vy = Math.sin(angle) * speed * 0.3; 
              
              newParticles.push({
                x: sproutMiddleX, 
                y: sproutMiddleY,
                vx: vx,
                vy: vy,
                life: 3.0 + Math.random() * 2.0,
                maxLife: 3.0 + Math.random() * 2.0,
                hue: seed.hue,
                size: 0.003 + Math.random() * 0.005 
              });
            }
            
            // console.log(`Created ${newParticles.length} small, slow particles`);
            
            // remove sprout and add particles
            const removedSeedId = seed.id;
            allSeeds.splice(i, 1);
            allWindParticles = allWindParticles.concat(newParticles);
            
            // broadcast to conductor
            io.emit('sproutRemoved', removedSeedId);
            io.emit('particlesAdded', newParticles);
            io.emit('interaction', 'life-wind');
            // console.log('Wind explosion complete!');
            break;
          }
        }
      }
    });
    }

io.on('connection', (socket) => {
  console.log('user connected:', socket.id);

  const role = getRole(socket);
  const hue = randomHue();
  const entity = {
    role,
    hue,
    x: 0.5,
    y: 0.5,
    volume: 0,
    lastActive: Date.now()
  };

  entities[socket.id] = entity;
  
  console.log('Assigned role:', role, 'to socket:', socket.id);
  
  socket.emit('assignRole', entity);
  
  // send current global state to conductor
  if (role === 'conductor') {
    // console.log('Sending global state to conductor');
    socket.emit('globalState', { 
      seeds: allSeeds, 
      particles: allWindParticles,
      players: entities 
    });
  }

  socket.on('update', (data) => {
    const e = entities[socket.id];
    if (!e) return;
    e.x = (typeof data.x === 'number') ? data.x : e.x;
    e.y = (typeof data.y === 'number') ? data.y : e.y;
    e.lastActive = Date.now();
  });

  // handle seed planting from life users
  socket.on('plantSeed', (seedData) => {
    console.log('plantSeed received from', socket.id, 'role:', entities[socket.id]?.role);
    
    if (entities[socket.id] && entities[socket.id].role === 'life') {
      const newSeed = {
        ...seedData,
        ownerId: socket.id,
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        state: 'seed',
        growthProgress: 0
      };
      allSeeds.push(newSeed);
      
      // console.log('Seed planted. Total seeds:', allSeeds.length);
      
      // broadcast to conductor
      io.emit('seedAdded', newSeed);
    }
  });

  socket.on('interaction', (key) => {
    io.emit('playSound', key);
  });

  socket.on('disconnect', () => {
    console.log('disconnected:', socket.id);
    delete entities[socket.id];
  });
});

// server manages all growth and particles and interactions
setInterval(() => {
  // track if any seeds grew to broadcast updates
  let growthUpdates = [];
  
// update seed growth - sprouts grow over time
allSeeds.forEach(seed => {
  if (seed.state === 'sprout' && seed.growthProgress < 1) {
    const oldProgress = seed.growthProgress;
    seed.growthProgress = Math.min(1, seed.growthProgress + 0.03);
    
    // log when a sprout becomes wind ready
    if (oldProgress < 0.95 && seed.growthProgress >= 0.95) {
      // console.log(`Sprout ${seed.id} is now WIND-READY!`);
    }
    
    if (Math.floor(seed.growthProgress * 10) !== Math.floor(oldProgress * 10)) {
      growthUpdates.push(seed);
    }
  }
});
  
  // broadcast growth updates to conductor
  if (growthUpdates.length > 0) {
    growthUpdates.forEach(seed => {
      io.emit('seedTransformed', seed);
    });
  }
  
  // Update particles
  for (let i = allWindParticles.length - 1; i >= 0; i--) {
    const p = allWindParticles[i];
    
    // velocity to move particles
    p.x += p.vx;
    p.y += p.vy;
    
    // left force
    p.vx -= 0.0005;
    p.vy += (Math.random() - 0.5) * 0.0003;
    
    p.vx *= 0.998;
    p.vy *= 0.998;
    
    // life decay 
    p.life -= 0.005;
    
    // remove dead particles
    if (p.life <= 0) {
      allWindParticles.splice(i, 1);
    }
  }
    
    // check for interactions between players and seeds
    checkInteractions();
  }, 100);

// broadcast player positions AND particle updates to ALL clients
  setInterval(() => {
    io.emit('playerUpdate', entities);
    
    if (allWindParticles.length > 0) {
      io.emit('particlesUpdated', allWindParticles);
    }
  }, 50);

let lastDebugTime = Date.now();
setInterval(() => {
  if (allWindParticles.length > 0) {
    const now = Date.now();
    if (now - lastDebugTime > 3000) { 
      // console.log(`PARTICLE MOVEMENT DEBUG:`);
      // console.log(`   Total particles: ${allWindParticles.length}`);
      if (allWindParticles.length > 0) {
        const p = allWindParticles[0];
        // console.log(`   Sample particle: x=${p.x.toFixed(3)}, y=${p.y.toFixed(3)}, vx=${p.vx.toFixed(4)}, vy=${p.vy.toFixed(4)}`);
        // console.log(`   Movement: ${(p.vx * 100).toFixed(1)}% leftward per frame`);
      }
      lastDebugTime = now;
    }
  }
}, 100);

HTTPSserver.listen(portHTTPS, () => {
  console.log('HTTPS Server running on port', portHTTPS);
});