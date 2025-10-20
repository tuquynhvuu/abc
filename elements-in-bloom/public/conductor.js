// const prefix = location.pathname.replace(/\/$/, '');
// const socket = io({ path: prefix + '/socket.io' });
// const socket = io();

const basePath = location.pathname.split('/').slice(0, -1).join('/');
const socket = io({ path: basePath + '/socket.io' });

// canvas and context for drawing
let canvas = document.getElementById("bloomCanvas");
let ctx = canvas.getContext("2d");
// let infoText = document.getElementById("infoText");

// full window resize
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
//   console.log('Canvas resized to:', canvas.width, 'x', canvas.height);
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// sound effects
let sproutSound = new Audio('audios/sprout.mp3');
let windSound = new Audio('audios/wind.wav');

// sound settings
sproutSound.volume = 0.3;
windSound.volume = 0.6;

// preload sounds 
sproutSound.load();
windSound.load();

// enable audio on first click
document.addEventListener('click', function() {
  // play and immediately pause a sound to unlock audio
  sproutSound.play().then(() => {
    sproutSound.pause();
    sproutSound.currentTime = 0;
    // console.log('Audio enabled - click worked!');
  }).catch(e => console.log('Audio enable failed:', e));
}, { once: true }); 

// console.log('Sound effects loaded');

let allSeeds = [];
let allParticles = [];
let allPlayers = {};

// background variables
let activeSproutsCount = 0;
let backgroundHue = 200; // starting hue 
let backgroundSaturation = 20; // Starting saturation 
let backgroundLightness = 15; // starting lightness

// console.log('Conductor script loaded');

// update sprout count and background vibrancy
function updateSproutCount() {
  activeSproutsCount = allSeeds.filter(s => s.state === 'sprout').length;
  updateBackgroundVibrancy();
}

function updateBackgroundVibrancy() {
  const maxSprouts = 40; 
  
  // calc vibrancy ratio
  const vibrancyRatio = Math.min(activeSproutsCount / maxSprouts, 1);
  
  // shift hue from blue to green/yellow as sprouts grow
  backgroundHue = 200 - (vibrancyRatio * 120);
  
  // increase saturation as sprouts become more active
  backgroundSaturation = 20 + (vibrancyRatio * 40); // 20% to 60%
  
  // increase lightness
  backgroundLightness = 10 + (vibrancyRatio * 10); // 10% to 20%
  
//   console.log(`Background: ${activeSproutsCount} sprouts, Hue: ${backgroundHue}, Sat: ${backgroundSaturation}%`);
}

// role assignment from server
socket.on('assignRole', (data) => {
//   console.log('Conductor role assigned:', data);
//   infoText.textContent = "CONDUCTOR VIEW - Connected to server";
});

// init global state from server
socket.on('globalState', (globalData) => {
//   console.log('Conductor received global state:', globalData);
  allSeeds = globalData.seeds || [];
  allParticles = globalData.particles || [];
  allPlayers = globalData.players || {};
  updateSproutCount(); 
  updateInfoText();
//   infoText.textContent = `CONDUCTOR - Loaded: ${allSeeds.length} seeds, ${allParticles.length} particles, ${Object.keys(allPlayers).length} players`;
});

// player position updates
socket.on('playerUpdate', (players) => {
  allPlayers = players;
  updateInfoText();
});

// seed events
socket.on('seedAdded', (newSeed) => {
//   console.log('CONDUCTOR: Seed added', newSeed);
  allSeeds.push(newSeed);
  updateInfoText();
});

socket.on('seedTransformed', (updatedSeed) => {
//   console.log('CONDUCTOR: Seed transformed', updatedSeed);
  const index = allSeeds.findIndex(s => s.id === updatedSeed.id);
  if (index !== -1) {
    allSeeds[index] = updatedSeed;
  } else {
    // console.log('Seed not found, adding it:', updatedSeed.id);
    allSeeds.push(updatedSeed);
  }
  updateSproutCount(); 
  updateInfoText();

  // play sprout sound when seed transforms to sprout
  if (updatedSeed.state === 'sprout') {
    // console.log('Playing sprout sound');
    sproutSound.currentTime = 0; 
    sproutSound.play().catch(e => console.log('Audio play failed:', e));
  }
});

// debug: check if particle events are being received
socket.on('particlesAdded', (newParticles) => {
//   console.log('CONDUCTOR: Particles added', newParticles.length);
//   console.log('First particle data:', newParticles[0]);
  allParticles = allParticles.concat(newParticles);
  updateInfoText();

  // play wind sound when particles are created 
  if (newParticles.length > 0) {
    // console.log('Playing wind sound for particles');
    windSound.currentTime = 0;
    windSound.play().catch(e => console.log('Audio play failed:', e));
  }
});

socket.on('particlesUpdated', (updatedParticles) => {
  allParticles = updatedParticles;
});

socket.on('sproutRemoved', (seedId) => {
//   console.log('CONDUCTOR: Sprout removed', seedId);
  const beforeCount = allSeeds.length;
  allSeeds = allSeeds.filter(s => s.id !== seedId);
  const afterCount = allSeeds.length;
//   console.log(`Sprout removal: ${beforeCount} -> ${afterCount} seeds`);
  updateSproutCount(); 
  updateInfoText();

  // play wind sound when sprout is removed
//   console.log('Playing wind sound');
  windSound.currentTime = 0; 
  windSound.play().catch(e => console.log('Audio play failed:', e));
});

// connection events
socket.on('connect', () => {
//   console.log('Conductor connected to server');
//   infoText.textContent = "CONDUCTOR VIEW - Connected to server";
  const connectionStatus = document.getElementById('connectionStatus');
  connectionStatus.textContent = '● Connected';
  connectionStatus.className = 'connection-status';
});

socket.on('disconnect', () => {
//   console.log('Conductor disconnected from server');
//   infoText.textContent = "CONDUCTOR VIEW - Disconnected from server";
  const connectionStatus = document.getElementById('connectionStatus');
  connectionStatus.textContent = '● Disconnected';
  connectionStatus.className = 'connection-status disconnected';

});

socket.on('connect_error', (error) => {
//   console.error('Conductor connection error:', error);
//   infoText.textContent = "CONDUCTOR VIEW - Connection error";
  const connectionStatus = document.getElementById('connectionStatus');
  connectionStatus.textContent = '● Connection Error';
  connectionStatus.className = 'connection-status disconnected';
});

// debug: check what's being drawn
function debugDrawing() {
  const seedsCount = allSeeds.filter(s => s.state === 'seed').length;
  const sproutsCount = allSeeds.filter(s => s.state === 'sprout').length;
//   console.log(`DRAWING DEBUG - Seeds: ${seedsCount}, Sprouts: ${sproutsCount}, Particles: ${allParticles.length}`);
  
  allSeeds.forEach(seed => {
    if (seed.state === 'sprout') {
    //   console.log(`Sprout ${seed.id}: growth=${seed.growthProgress}, x=${seed.x}, y=${seed.y}`);
    }
  });
}

// helper function: draw a simple leaf
function drawLeaf(ctx, size) {
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 1.5, size, 0, 0, Math.PI * 2);
  ctx.fill();
}

// draw seeds and sprouts on conductor
function drawSeedsAndSprouts() {
  allSeeds.forEach(seed => {
    if (!seed || typeof seed.x !== 'number' || typeof seed.y !== 'number') return;
    
    const px = seed.x * canvas.width;
    const py = seed.y * canvas.height;
    const baseSize = Math.min(canvas.width, canvas.height) * 0.02;
    
    ctx.save();
    ctx.translate(px, py);
    
    if (seed.state === 'seed') {
      const size = baseSize * 1.5;
      const beanWidth = size * 1.2;
      const beanHeight = size * 1.4;
      
      // main bean seed body
      const seedGradient = ctx.createLinearGradient(-beanWidth * 0.5, 0, beanWidth * 0.5, 0);
      seedGradient.addColorStop(0, `hsl(${seed.hue}, 85%, 60%)`);
      seedGradient.addColorStop(0.5, `hsl(${seed.hue}, 90%, 70%)`);
      seedGradient.addColorStop(1, `hsl(${seed.hue}, 85%, 60%)`);
      
      ctx.fillStyle = seedGradient;
      ctx.beginPath();
      ctx.moveTo(0, -beanHeight * 0.5);
      ctx.quadraticCurveTo(beanWidth * 0.6, -beanHeight * 0.3, beanWidth * 0.5, beanHeight * 0.3);
      ctx.quadraticCurveTo(beanWidth * 0.3, beanHeight * 0.6, 0, beanHeight * 0.1);
      ctx.quadraticCurveTo(-beanWidth * 0.3, beanHeight * 0.6, -beanWidth * 0.5, beanHeight * 0.3);
      ctx.quadraticCurveTo(-beanWidth * 0.6, -beanHeight * 0.3, 0, -beanHeight * 0.5);
      ctx.closePath();
      ctx.fill();
      
      // shine
      ctx.strokeStyle = `hsla(${seed.hue}, 100%, 95%, 0.9)`;
      ctx.lineWidth = size * 0.15;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-beanWidth * 0.3, -beanHeight * 0.2);
      ctx.quadraticCurveTo(-beanWidth * 0.4, beanHeight * 0.05, -beanWidth * 0.2, beanHeight * 0.2);
      ctx.stroke();
      
    } else if (seed.state === 'sprout') {
      
      // use seed ID to assn sprout type
      const sproutType = Math.abs(seed.id.split('-').reduce((a, b) => a + b.charCodeAt(0), 0)) % 3;
      
      // draw different sprout types
      if (sproutType === 0) {
        drawSproutType1(ctx, seed, baseSize);
      } else if (sproutType === 1) {
        drawSproutType2(ctx, seed, baseSize);
      } else {
        drawSproutType3(ctx, seed, baseSize);
      }
    }
    ctx.restore();
  });
}

function drawSproutType1(ctx, seed, baseSize) {
  const stemHeight = baseSize * 10 * seed.growthProgress;
  const stemWidth = baseSize * 0.5;
  
  // Stem with STRONGER gradient
  const stemGradient = ctx.createLinearGradient(0, 0, 0, -stemHeight);
  stemGradient.addColorStop(0, `hsl(${seed.hue}, 85%, 25%)`);    // Darker base
  stemGradient.addColorStop(0.3, `hsl(${seed.hue}, 80%, 45%)`);  // Stronger transition
  stemGradient.addColorStop(1, `hsl(${seed.hue}, 75%, 65%)`);    // Lighter top
  
  ctx.strokeStyle = stemGradient;
  ctx.lineWidth = stemWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -stemHeight);
  ctx.stroke();
  
  // Draw leaves at different heights
  const leafSizes = [baseSize * 1.8, baseSize * 1.5, baseSize * 1.2];
  const leafPositions = [0.4, 0.7, 0.9];
  
  leafPositions.forEach((position, index) => {
    if (stemHeight * position > baseSize) {
      const leafY = -stemHeight * position;
      const leafSize = leafSizes[index] * seed.growthProgress;
      
      // Left leaf with STRONGER gradient
      const leafGradient = ctx.createLinearGradient(-leafSize, 0, leafSize, 0);
      leafGradient.addColorStop(0, `hsl(${seed.hue}, 90%, 35%)`);   // Darker edges
      leafGradient.addColorStop(0.3, `hsl(${seed.hue}, 95%, 75%)`); // Very bright center
      leafGradient.addColorStop(0.7, `hsl(${seed.hue}, 95%, 75%)`); // Maintain brightness
      leafGradient.addColorStop(1, `hsl(${seed.hue}, 90%, 35%)`);   // Darker edges
      
      ctx.fillStyle = leafGradient;
      ctx.save();
      ctx.translate(-baseSize * 0.6, leafY);
      ctx.rotate(-Math.PI * 0.25);
      drawPointedLeaf(ctx, leafSize);
      ctx.restore();
      
      // Right leaf with same strong gradient
      ctx.save();
      ctx.translate(baseSize * 0.6, leafY);
      ctx.rotate(Math.PI * 0.25);
      drawPointedLeaf(ctx, leafSize);
      ctx.restore();
    }
  });
  
  // Thin petals at top with STRONGER gradients
  if (stemHeight > baseSize * 1.5) {
    const petalCount = 6;
    const petalLength = baseSize * 1.2 * seed.growthProgress;
    const petalWidth = baseSize * 0.3 * seed.growthProgress;
    
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2;
      
      // STRONG petal gradient - very dramatic contrast
      const petalGradient = ctx.createLinearGradient(0, 0, 0, -petalLength);
      petalGradient.addColorStop(0, `hsl(${seed.hue}, 100%, 90%)`);  // Very bright base
      petalGradient.addColorStop(0.5, `hsl(${seed.hue}, 95%, 85%)`); // Still very bright
      petalGradient.addColorStop(1, `hsl(${seed.hue}, 85%, 50%)`);   // Much darker tip
      
      ctx.fillStyle = petalGradient;
      ctx.save();
      ctx.translate(0, -stemHeight);
      ctx.rotate(angle);
      
      // Draw thin petal shape
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(
        petalWidth * 0.3, -petalLength * 0.3,
        petalWidth * 0.5, -petalLength * 0.7,
        0, -petalLength
      );
      ctx.bezierCurveTo(
        -petalWidth * 0.5, -petalLength * 0.7,
        -petalWidth * 0.3, -petalLength * 0.3,
        0, 0
      );
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    }
    
    // Center with STRONG gradient
    const centerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, baseSize * 0.2);
    centerGradient.addColorStop(0, `hsl(${seed.hue}, 95%, 70%)`);  // Bright center
    centerGradient.addColorStop(1, `hsl(${seed.hue}, 75%, 30%)`);  // Dark edge
    
    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.arc(0, -stemHeight, baseSize * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
// sprout type 2: lush bush with layers
function drawSproutType2(ctx, seed, baseSize) {
  const stemHeight = baseSize * 7 * seed.growthProgress;
  const stemWidth = baseSize * 0.5;
  
  // curved stem with gradient
  const stemGradient = ctx.createLinearGradient(0, 0, 0, -stemHeight);
  stemGradient.addColorStop(0, `hsl(${seed.hue}, 80%, 25%)`);
  stemGradient.addColorStop(0.5, `hsl(${seed.hue}, 75%, 40%)`);
  stemGradient.addColorStop(1, `hsl(${seed.hue}, 70%, 55%)`);
  
  ctx.strokeStyle = stemGradient;
  ctx.lineWidth = stemWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(baseSize * 0.3, -stemHeight * 0.5, 0, -stemHeight);
  ctx.stroke();
  
  // layers
  const foliageLayers = [
    { y: 0.4, size: 1.2, count: 4, type: 'heart' },
    { y: 0.7, size: 1.0, count: 5, type: 'round' },
    { y: 0.9, size: 0.8, count: 3, type: 'pointed' }
  ];
  
  foliageLayers.forEach(layer => {
    const layerY = -stemHeight * layer.y;
    
    for (let i = 0; i < layer.count; i++) {
      const angle = (i / layer.count) * Math.PI * 2;
      const distance = baseSize * (0.7 + Math.random() * 0.3);
      const leafSize = baseSize * layer.size * seed.growthProgress;
      
      ctx.save();
      ctx.translate(
        Math.cos(angle) * distance, 
        layerY
      );
      ctx.rotate(angle);
      
      if (layer.type === 'heart') {
        drawGradientHeartLeaf(ctx, leafSize, seed.hue);
      } else if (layer.type === 'round') {
        drawRoundLeaf(ctx, leafSize, seed.hue);
      } else {
        drawPointedLeaf(ctx, leafSize, seed.hue);
      }
      ctx.restore();
    }
  });
  
  // berry cluster
  if (stemHeight > baseSize * 0.8) {
    const topY = -stemHeight;
    
    // central berry cluster
    const berryCount = 7;
    for (let i = 0; i < berryCount; i++) {
      const angle = (i / berryCount) * Math.PI * 2;
      const distance = baseSize * 0.35;
      const berrySize = baseSize * 0.2;
      
      const berryGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, berrySize);
      berryGradient.addColorStop(0, `hsl(${seed.hue}, 95%, 75%)`);
      berryGradient.addColorStop(0.7, `hsl(${seed.hue}, 85%, 55%)`);
      berryGradient.addColorStop(1, `hsl(${seed.hue}, 75%, 35%)`);
      
      ctx.fillStyle = berryGradient;
      ctx.beginPath();
      ctx.arc(
        Math.cos(angle) * distance, 
        topY + Math.sin(angle) * distance * 0.5, 
        berrySize, 
        0, 
        Math.PI * 2
      );
      ctx.fill();
    }
    
    // single center berry
    ctx.fillStyle = `hsl(${seed.hue}, 90%, 65%)`;
    ctx.beginPath();
    ctx.arc(0, topY, baseSize * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

// leaf type helper functions
function drawRoundLeaf(ctx, size, hue) {
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
  gradient.addColorStop(0, `hsl(${hue}, 90%, 65%)`);
  gradient.addColorStop(1, `hsl(${hue}, 80%, 45%)`);
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fill();
}

function drawPointedLeaf(ctx, size, hue) {
  const gradient = ctx.createLinearGradient(-size, 0, size, 0);
  gradient.addColorStop(0, `hsl(${hue}, 85%, 50%)`);
  gradient.addColorStop(0.5, `hsl(${hue}, 95%, 70%)`);
  gradient.addColorStop(1, `hsl(${hue}, 85%, 50%)`);
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.8);
  ctx.lineTo(size * 0.6, 0);
  ctx.lineTo(0, size * 0.8);
  ctx.lineTo(-size * 0.6, 0);
  ctx.closePath();
  ctx.fill();
}

function drawPetalShape(ctx, size) {
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.2);
  ctx.quadraticCurveTo(size * 0.6, -size * 0.1, size * 0.4, size * 0.4);
  ctx.quadraticCurveTo(0, size * 0.6, -size * 0.4, size * 0.4);
  ctx.quadraticCurveTo(-size * 0.6, -size * 0.1, 0, -size * 0.2);
  ctx.closePath();
  ctx.fill();
}


// sprout type 3: vines
function drawSproutType3(ctx, seed, baseSize) {
  const stemHeight = baseSize * 7 * seed.growthProgress; // Even shorter
  const stemWidth = baseSize * 0.35;
  
  // Organic curvy stem with gradient
  const stemGradient = ctx.createLinearGradient(0, 0, 0, -stemHeight);
  stemGradient.addColorStop(0, `hsl(${seed.hue}, 75%, 35%)`);
  stemGradient.addColorStop(0.7, `hsl(${seed.hue}, 80%, 50%)`);
  stemGradient.addColorStop(1, `hsl(${seed.hue}, 85%, 60%)`);
  
  ctx.strokeStyle = stemGradient;
  ctx.lineWidth = stemWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  
  // More pronounced organic curves
  const curvePoints = [0.2, 0.4, 0.6, 0.8, 1.0];
  curvePoints.forEach(progress => {
    const y = -stemHeight * progress;
    const curve = Math.sin(progress * Math.PI * 2) * baseSize * 0.4;
    ctx.lineTo(curve, y);
  });
  ctx.stroke();
  
  // Elegant spiral tendrils
  const tendrilCount = 2; // Fewer but more prominent
  for (let i = 0; i < tendrilCount; i++) {
    const startY = -stemHeight * (0.4 + i * 0.3);
    const tendrilLength = baseSize * 2.5 * seed.growthProgress;
    
    const tendrilGradient = ctx.createLinearGradient(0, startY, 0, startY - tendrilLength);
    tendrilGradient.addColorStop(0, `hsla(${seed.hue}, 80%, 60%, 0.9)`);
    tendrilGradient.addColorStop(1, `hsla(${seed.hue}, 80%, 60%, 0.3)`);
    
    ctx.strokeStyle = tendrilGradient;
    ctx.lineWidth = baseSize * 0.1;
    ctx.lineCap = 'round';
    
    // Left tendril
    ctx.beginPath();
    ctx.moveTo(-baseSize * 0.2, startY);
    for (let t = 0; t <= 1; t += 0.02) {
      const angle = t * Math.PI * 4;
      const radius = baseSize * 0.3 * (1 - t * 0.5);
      const x = -baseSize * 0.2 + Math.cos(angle) * radius;
      const y = startY - tendrilLength * t;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Right tendril
    ctx.beginPath();
    ctx.moveTo(baseSize * 0.2, startY);
    for (let t = 0; t <= 1; t += 0.02) {
      const angle = t * Math.PI * 4 + Math.PI;
      const radius = baseSize * 0.3 * (1 - t * 0.5);
      const x = baseSize * 0.2 + Math.cos(angle) * radius;
      const y = startY - tendrilLength * t;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  
  // Heart-shaped leaves with gradients
  const leafCount = 3; // Fewer leaves for cleaner look
  const leafPositions = [
    { y: 0.3, size: 0.9, angle: -0.4 },
    { y: 0.6, size: 0.8, angle: 0.3 },
    { y: 0.9, size: 0.7, angle: -0.2 }
  ];
  
  leafPositions.forEach((pos, index) => {
    const leafY = -stemHeight * pos.y;
    const leafSize = baseSize * pos.size * seed.growthProgress;
    
    const leafGradient = ctx.createLinearGradient(-leafSize, 0, leafSize, 0);
    leafGradient.addColorStop(0, `hsl(${seed.hue}, 85%, 45%)`);
    leafGradient.addColorStop(0.5, `hsl(${seed.hue}, 95%, 70%)`);
    leafGradient.addColorStop(1, `hsl(${seed.hue}, 85%, 45%)`);
    
    ctx.fillStyle = leafGradient;
    ctx.save();
    ctx.translate(baseSize * 0.6, leafY);
    ctx.rotate(pos.angle);
    drawHeartLeaf(ctx, leafSize, seed.hue);
    ctx.restore();
    
    // Mirror leaf on other side
    ctx.save();
    ctx.translate(-baseSize * 0.6, leafY);
    ctx.rotate(-pos.angle);
    drawHeartLeaf(ctx, leafSize, seed.hue);
    ctx.restore();
  });
  
  // Delicate top cluster
  if (stemHeight > baseSize * 0.8) {
    const topGradient = ctx.createRadialGradient(0, -stemHeight, 0, 0, -stemHeight, baseSize * 0.6);
    topGradient.addColorStop(0, `hsl(${seed.hue + 20}, 90%, 75%)`);
    topGradient.addColorStop(1, `hsl(${seed.hue + 20}, 80%, 55%)`);
    
    ctx.fillStyle = topGradient;
    ctx.beginPath();
    ctx.arc(0, -stemHeight, baseSize * 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    // Tiny center dot
    ctx.fillStyle = `hsl(${seed.hue}, 70%, 35%)`;
    ctx.beginPath();
    ctx.arc(0, -stemHeight, baseSize * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

// heart leaf helper function
function drawHeartLeaf(ctx, size, hue) {
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.3);
  ctx.bezierCurveTo(
    size * 0.8, -size * 0.5,
    size * 0.8, size * 0.2,
    0, size * 0.5
  );
  ctx.bezierCurveTo(
    -size * 0.8, size * 0.2,
    -size * 0.8, -size * 0.5,
    0, -size * 0.3
  );
  ctx.closePath();
  ctx.fill();
}

// helper function for pointed leaves
function drawPointedLeaf(ctx, size) {
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 1.5, size, 0, 0, Math.PI * 2);
  ctx.fill();
}

// helper function for gradient heart leaves
function drawGradientHeartLeaf(ctx, size, hue) {
  const gradient = ctx.createLinearGradient(-size, 0, size, 0);
  gradient.addColorStop(0, `hsl(${hue}, 85%, 50%)`);
  gradient.addColorStop(0.5, `hsl(${hue}, 95%, 70%)`);
  gradient.addColorStop(1, `hsl(${hue}, 85%, 50%)`);
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.4);
  ctx.bezierCurveTo(size, -size * 0.4, size, size * 0.4, 0, size * 0.8);
  ctx.bezierCurveTo(-size, size * 0.4, -size, -size * 0.4, 0, -size * 0.4);
  ctx.fill();
}

// draw wind particles  
function drawWindParticles() {
  let particlesDrawn = 0;
  
  allParticles.forEach((p, index) => {
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return;
    
    const px = p.x * canvas.width;
    const py = p.y * canvas.height;
    const baseSize = Math.min(canvas.width, canvas.height);
    const particleSize = (p.size || 0.015) * baseSize;
    
    // calc fade effect based on life
    const lifeRatio = p.life / p.maxLife;
    const alpha = lifeRatio * 0.9;
    
    // skip particles that are completely faded or far off screen
    if (alpha <= 0.05 || px < -100 || px > canvas.width + 100 || py < -100 || py > canvas.height + 100) {
      return;
    }
    
    ctx.save();
    ctx.translate(px, py);
    
    // particle trail effect for faster-moving particles
    if (lifeRatio > 0.6 && (Math.abs(p.vx) > 0.01 || Math.abs(p.vy) > 0.01)) {
      const trailLength = particleSize * 6;
      const gradient = ctx.createLinearGradient(-trailLength, 0, 0, 0);
      gradient.addColorStop(0, `hsla(${p.hue}, 100%, 80%, 0)`);
      gradient.addColorStop(0.5, `hsla(${p.hue}, 100%, 85%, ${alpha * 0.2})`);
      gradient.addColorStop(1, `hsla(${p.hue}, 100%, 90%, ${alpha * 0.4})`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(-trailLength, -particleSize * 0.3, trailLength, particleSize * 0.6);
    }
    
    // main particle with sparkle effect
    const sparkle = Math.sin(Date.now() * 0.03 + index * 10) * 0.2 + 0.8;
    
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particleSize * 3);
    gradient.addColorStop(0, `hsla(${p.hue}, 100%, 95%, ${alpha})`);
    gradient.addColorStop(0.6, `hsla(${p.hue}, 95%, 80%, ${alpha * 0.7})`);
    gradient.addColorStop(1, `hsla(${p.hue}, 90%, 70%, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, particleSize * 3 * sparkle, 0, Math.PI * 2);
    ctx.fill();
    
    // draw core
    ctx.fillStyle = `hsla(${p.hue}, 100%, 98%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, particleSize, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    particlesDrawn++;
  });
  
  // debug: log when particles are actively animating
  if (allParticles.length > 0 && Math.random() < 0.05) {
    // console.log(`Animating ${particlesDrawn} particles`);
  }
}

// draw players
function drawPlayers() {
  Object.entries(allPlayers).forEach(([id, player]) => {
    const px = player.x * canvas.width;
    const py = player.y * canvas.height;

    ctx.save();
    ctx.translate(px, py);

    // draw life players
    if (player.role === 'life') {
 
        const size = Math.min(canvas.width, canvas.height) * 0.03;
        const time = Date.now() * 0.003;
        
        const pulse = Math.sin(time) * 0.1 + 0.95;
        const beanWidth = size * 1.2 * pulse;
        const beanHeight = size * 1.4 * pulse;
        
        // main bean body
        ctx.fillStyle = `hsl(${player.hue}, 75%, 55%)`;
        ctx.beginPath();
        
        ctx.moveTo(0, -beanHeight * 0.5);
        
        ctx.quadraticCurveTo(
            beanWidth * 0.6, -beanHeight * 0.3, 
            beanWidth * 0.5, beanHeight * 0.3
        );
        ctx.quadraticCurveTo(
            beanWidth * 0.3, beanHeight * 0.6,
            0, beanHeight * 0.1
        );
  
        ctx.quadraticCurveTo(
            -beanWidth * 0.3, beanHeight * 0.6,
            -beanWidth * 0.5, beanHeight * 0.3
        );
        ctx.quadraticCurveTo(
            -beanWidth * 0.6, -beanHeight * 0.3,  
            0, -beanHeight * 0.5
        );
        
        ctx.closePath();
        ctx.fill();
  
        ctx.strokeStyle = `hsla(${player.hue}, 100%, 95%, 0.9)`;
        ctx.lineWidth = size * 0.15; 
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(-beanWidth * 0.3, -beanHeight * 0.2);
        ctx.quadraticCurveTo(
            -beanWidth * 0.4, beanHeight * 0.05,
            -beanWidth * 0.2, beanHeight * 0.2
        );
        ctx.stroke();

    // draw light players
    } else if (player.role === 'light') {
        const baseSize = Math.min(canvas.width, canvas.height) * 0.03;
        const time = Date.now() * 0.003;
        
        // pulse 
        const pulse = Math.sin(time) * 0.2 + 0.9;
        const coreSize = baseSize * 0.6 * pulse; 
        
        // outer glow that pulses with the core
        const outerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, baseSize * 2.8 * pulse);
        outerGradient.addColorStop(0, `hsla(${player.hue}, 100%, 85%, ${0.4 * pulse})`);
        outerGradient.addColorStop(0.6, `hsla(${player.hue}, 90%, 75%, ${0.2 * pulse})`);
        outerGradient.addColorStop(1, `hsla(${player.hue}, 80%, 65%, 0)`);
        
        ctx.fillStyle = outerGradient;
        ctx.beginPath();
        ctx.arc(0, 0, baseSize * 2.8 * pulse, 0, Math.PI * 2);
        ctx.fill();
        
        // sunbeams
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const rayLength = baseSize * (2.0 + Math.sin(time * 2 + i) * 0.3) * pulse;
            
            const baseWidth = baseSize * 0.4 * pulse; 
            const tipWidth = baseSize * 0.05 * pulse;  
            
            const angle1 = angle - Math.atan2(baseWidth / 2, baseSize * 0.4);
            const angle2 = angle + Math.atan2(baseWidth / 2, baseSize * 0.4);
            const angle3 = angle - Math.atan2(tipWidth / 2, rayLength);
            const angle4 = angle + Math.atan2(tipWidth / 2, rayLength);
            
            const basePoint1 = {
            x: Math.cos(angle1) * baseSize * 0.6, 
            y: Math.sin(angle1) * baseSize * 0.6
            };
            const basePoint2 = {
            x: Math.cos(angle2) * baseSize * 0.6,
            y: Math.sin(angle2) * baseSize * 0.6
            };
            
            const tipPoint1 = {
            x: Math.cos(angle3) * rayLength,
            y: Math.sin(angle3) * rayLength
            };
            const tipPoint2 = {
            x: Math.cos(angle4) * rayLength,
            y: Math.sin(angle4) * rayLength
            };
            
            ctx.fillStyle = `hsla(${player.hue}, 100%, 90%, ${0.3 * pulse})`;
            ctx.beginPath();
            ctx.moveTo(basePoint1.x, basePoint1.y);
            ctx.lineTo(basePoint2.x, basePoint2.y);
            ctx.lineTo(tipPoint2.x, tipPoint2.y);
            ctx.lineTo(tipPoint1.x, tipPoint1.y);
            ctx.closePath();
            ctx.fill();
        }
        
        // inner core that pulses 
        const innerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, baseSize * 1.0 * pulse);
        innerGradient.addColorStop(0, `hsla(${player.hue}, 100%, 98%, ${0.9 * pulse})`);
        innerGradient.addColorStop(1, `hsla(${player.hue}, 100%, 85%, ${0.4 * pulse})`);
        
        ctx.fillStyle = innerGradient;
        ctx.beginPath();
        ctx.arc(0, 0, baseSize * 1.0 * pulse, 0, Math.PI * 2);
        ctx.fill();
  
        // center that pulses 
        ctx.fillStyle = `hsl(${player.hue}, 100%, ${95 * pulse}%)`;
        ctx.beginPath();
        ctx.arc(0, 0, coreSize, 0, Math.PI * 2);
        ctx.fill();
      
    // draw wind players
    } else if (player.role === 'wind') {
        const length = Math.min(canvas.width, canvas.height) * 0.10; 
        const time = Date.now() * 0.004; // anim speed
        
        // swirling particles
        for (let i = 0; i < 8; i++) { 
            const angle = (i / 8) * Math.PI * 2 + time * 0.5; // rotation
            const radius = length * 0.4 + Math.sin(time * 0.3 + i) * length * 0.1; 
            const particleSize = length * 0.015; 
            
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            ctx.fillStyle = `hsla(${player.hue}, 70%, 75%, ${0.2 + Math.sin(time * 0.5 + i) * 0.15})`; 
            ctx.beginPath();
            ctx.arc(x, y, particleSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        //  wind streams 
        const amplitude = length * 0.15; //  amplitude 
        ctx.strokeStyle = `hsla(${player.hue}, 75%, 70%, 0.7)`;
        ctx.lineWidth = length * 0.01; 
        ctx.lineCap = 'round';
        
        // 3 wind streams 
        const streamOffsets = [-amplitude * 1.8, 0, amplitude * 1.5];
        const streamLengths = [0.95, 1.25, 0.95]; 

        for (let stream = 0; stream < 3; stream++) {
        ctx.beginPath();
        const offsetY = streamOffsets[stream];
        const streamLength = length * streamLengths[stream]; 
        
        for (let i = -8; i <= 8; i++) {
            const progress = (i + 8) / 16;
            const x = progress * streamLength * 1.1 - streamLength * 0.55; 
            
            //  wave motion
            const wave = Math.sin(i * 0.5 + time * 1.5 + stream * 1.2) * amplitude;
            const y = offsetY + wave * (1 - progress * 0.4); 
            
            if (i === -8) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        }
        
        }
            ctx.restore();
        });
}

// update info text with stats
// function updateInfoText() {
//   const lifeCount = Object.values(allPlayers).filter(p => p.role === 'life').length;
//   const lightCount = Object.values(allPlayers).filter(p => p.role === 'light').length;
//   const windCount = Object.values(allPlayers).filter(p => p.role === 'wind').length;
//   const seedCount = allSeeds.filter(s => s.state === 'seed').length;
//   const sproutCount = allSeeds.filter(s => s.state === 'sprout').length;
//   const particleCount = allParticles.length;
  
//   infoText.textContent = `CONDUCTOR - Life: ${lifeCount} | Light: ${lightCount} | Wind: ${windCount} | Seeds: ${seedCount} | Sprouts: ${sproutCount} | Particles: ${particleCount}`;
// }
function updateInfoText() {
  const lifeCount = Object.values(allPlayers).filter(p => p.role === 'life').length;
  const lightCount = Object.values(allPlayers).filter(p => p.role === 'light').length;
  const windCount = Object.values(allPlayers).filter(p => p.role === 'wind').length;
  const seedCount = allSeeds.filter(s => s.state === 'seed').length;
  const sproutCount = allSeeds.filter(s => s.state === 'sprout').length;
  const particleCount = allParticles.length;
  
  // Update the individual stat elements
  document.getElementById('lifeCount').textContent = lifeCount;
  document.getElementById('lightCount').textContent = lightCount;
  document.getElementById('windCount').textContent = windCount;
  document.getElementById('seedCount').textContent = seedCount;
  document.getElementById('sproutCount').textContent = sproutCount;
  document.getElementById('particleCount').textContent = particleCount;
  
  // Update connection status
  const connectionStatus = document.getElementById('connectionStatus');
  connectionStatus.textContent = '● Connected';
  connectionStatus.className = 'connection-status';
}



function drawBackground() {
  const time = Date.now() * 0.0001;
  
  // calc how vibrant the background should be based on sprout count
  const maxSprouts = 20;
  const vibrancyRatio = Math.min(activeSproutsCount / maxSprouts, 1);
  
  const darkBlue = {
    h: 220, 
    s: 80,  
    l: 10   
  };
  
  const lightBlue = {
    h: 200, 
    s: 70,  
    l: 70  
  };
  
  // interpolate between dark and light blue based on sprout count
  const currentHue = darkBlue.h + (lightBlue.h - darkBlue.h) * vibrancyRatio;
  const currentSaturation = darkBlue.s + (lightBlue.s - darkBlue.s) * vibrancyRatio;
  const currentLightness = darkBlue.l + (lightBlue.l - darkBlue.l) * vibrancyRatio;
  
  // gradient from current color to slightly lighter/darker version
  const gradient = ctx.createLinearGradient(
    0, 0,
    0, canvas.height
  );
  
  // top color 
  const topColor = `hsl(${currentHue}, ${currentSaturation}%, ${Math.max(5, currentLightness - 5)}%)`;
  // bottom color
  const bottomColor = `hsl(${currentHue}, ${currentSaturation}%, ${Math.min(85, currentLightness + 5)}%)`;
  
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // stars fade out as background gets lighter
  const starAlpha = 0.1 - (vibrancyRatio * 0.09); 
  if (starAlpha > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha})`;
    const starCount = 30 - (vibrancyRatio * 20); 
    
    for (let i = 0; i < starCount; i++) {
      const x = (Math.sin(i * 7.3) * 0.5 + 0.5) * canvas.width;
      const y = (Math.cos(i * 5.7) * 0.5 + 0.5) * canvas.height;
      const size = Math.sin(time * 10 + i) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  //  subtle glow effect when many sprouts are active 
  if (activeSproutsCount > 5 && vibrancyRatio < 0.7) {
    const glowIntensity = Math.min((activeSproutsCount - 5) / 15, 0.4);
    
    // subtle radial glow in the center (blue tones)
    const glowGradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.4
    );
    glowGradient.addColorStop(0, `hsla(200, 60%, 80%, ${glowIntensity * 0.15})`);
    glowGradient.addColorStop(1, `hsla(200, 40%, 60%, 0)`);
    
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  // debug log to see the color changes
  if (Math.random() < 0.01) {
    // console.log(`Background: ${activeSproutsCount} sprouts → HSL(${Math.round(currentHue)}, ${Math.round(currentSaturation)}%, ${Math.round(currentLightness)}%)`);
  }
}

// update draw function for bg
function draw() {
  updateSproutCount();
  
  // check particle state occasionally
  if (Math.random() < 0.02 && allParticles.length > 0) {
    const firstParticle = allParticles[0];
    console.log('PARTICLE DEBUG:', {
      count: allParticles.length,
      firstParticle: {
        x: firstParticle.x,
        y: firstParticle.y,
        life: firstParticle.life,
        maxLife: firstParticle.maxLife,
        size: firstParticle.size
      }
    });
  }
  
  drawBackground();

  drawSeedsAndSprouts();
  drawWindParticles();
  drawPlayers();
  
  updateInfoText();

  requestAnimationFrame(draw);
}

// console.log('Starting conductor animation loop');
setInterval(debugDrawing, 8000); // debug every 8 seconds
draw();