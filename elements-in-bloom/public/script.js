const prefix = location.pathname.replace(/\/$/, '');
const socket = io({ path: prefix + '/socket.io' });

// canvas and context for drawing
let canvas = document.getElementById("bloomCanvas");
let ctx = canvas.getContext("2d");
let infoText = document.getElementById("infoText");

//full window resize
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// init orientation text
const orientationText = document.getElementById('orientationText');
orientationText.textContent = 'lock your phone\'s portrait orientation vertically';
// init local player object
let me = { role: 'life', hue: Math.random()*360, x: 0.5, y: 0.5 };

// object to store other players, for bg only
let world = {};
let lastEmit = 0;
const EMIT_INTERVAL = 60;


// seed planting timer for life users
let lastSeedTime = 0;
const SEED_PLANT_INTERVAL = 5000;

// plant seed for life users only
function plantSeed() {
  const now = Date.now();
  if (now - lastSeedTime >= SEED_PLANT_INTERVAL && me.role === 'life') {
    const newSeed = {
      x: me.x,
      y: me.y,
      hue: me.hue,
      state: 'seed',
      growthProgress: 0,
      plantedAt: now,
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    };
    
    // send to server 
    socket.emit('plantSeed', newSeed);
    lastSeedTime = now;
    console.log('Life user planted seed at:', me.x, me.y);
  }
}


// audio setup
let audioCtx;
let audioReady = false;
const audioMap = {
  'life-light': new Audio('audios/str1.wav'),
  'life-wind': new Audio('audios/str2.wav'),
  'light-wind': new Audio('audios/str3.wav'),
  'life-light-wind': new Audio('audios/str4.wav')
};

function unlockAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    Object.values(audioMap).forEach(a => {
      const src = audioCtx.createMediaElementSource(a);
      src.connect(audioCtx.destination);
    });
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  audioReady = true;
}

// role assignment from server
socket.on('assignRole', (data) => {
  me = { ...me, ...data };
  
  // update main role text
  infoText.textContent = `You are ${me.role.toUpperCase()}`;
  
  // add role-specific instruction
  const roleInstruction = document.getElementById('roleInstruction');
  if (me.role === 'life') {
    roleInstruction.textContent = 'plant some seeds!';
  } else if (me.role === 'light') {
    roleInstruction.textContent = 'grow the seeds!';
  } else if (me.role === 'wind') {
    roleInstruction.textContent = 'blow away the sprouts!';
  }
  
  console.log('Assigned role:', me.role);
});

// player pos updates
socket.on('playerUpdate', (players) => {
  world = players;
});

socket.on('playSound', key => {
  if (!audioReady) return;
  const audio = audioMap[key];
  if(audio){
    audio.currentTime = 0;
    audio.play().catch(err => console.warn("Audio play failed:", err));
  }
});

// orientation handling
function handleOrientation(e) {
  const beta = e.beta || 0;
  const gamma = e.gamma || 0;
  let nx = Math.max(0, Math.min(1, (gamma + 90) / 180));
  let ny = Math.max(0, Math.min(1, (beta + 180) / 360));

  me.x = nx;
  me.y = ny;
  
  if (me.role === 'life') {
    plantSeed();
  }
  
  sendUpdate();
}

// orientation + audio unlock button
function showOrientationButton() {
  const btn = document.createElement('button');
  btn.textContent = 'Enable Motion & Audio';
  btn.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 15px 30px;
    font-size: 18px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    z-index: 1000;
  `;
  document.body.appendChild(btn);
  btn.addEventListener('click', () => {
    DeviceOrientationEvent.requestPermission?.().then(res => {
      if (res === 'granted') {
        window.addEventListener('deviceorientation', handleOrientation, true);
        unlockAudio();
        btn.remove();
      }
    }).catch(() => {
      window.addEventListener('deviceorientation', handleOrientation, true);
      unlockAudio();
      btn.remove();
    });
  });
}

showOrientationButton();

function sendUpdate() {
  const now = Date.now();
  if (now - lastEmit > EMIT_INTERVAL) {
    lastEmit = now;
    socket.emit('update', { x: me.x, y: me.y, hue: me.hue });
  }
}

// draw user's own element based on role
// users only see themselves
function drawOwnElement() {
  const px = me.x * canvas.width;
  const py = me.y * canvas.height;
  
  ctx.save();
  ctx.translate(px, py);
  
  if (me.role === 'life') {
    // draw life 
    const size = Math.min(canvas.width, canvas.height) * 0.03;
    const time = Date.now() * 0.003;
    
    const pulse = Math.sin(time) * 0.1 + 0.95;
    const beanWidth = size * 1.2 * pulse;
    const beanHeight = size * 1.4 * pulse;
    
    ctx.fillStyle = `hsl(${me.hue}, 75%, 55%)`;
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
    
    ctx.strokeStyle = `hsla(${me.hue}, 100%, 95%, 0.9)`;
    ctx.lineWidth = size * 0.15; 
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(-beanWidth * 0.3, -beanHeight * 0.2);
    ctx.quadraticCurveTo(
      -beanWidth * 0.4, beanHeight * 0.05,
      -beanWidth * 0.2, beanHeight * 0.2
    );
    ctx.stroke();

  } else if (me.role === 'light') {
    // draw light 
    const baseSize = Math.min(canvas.width, canvas.height) * 0.03;
    const time = Date.now() * 0.003;
    
    const pulse = Math.sin(time) * 0.2 + 0.9;
    const coreSize = baseSize * 0.6 * pulse; 
    
    const outerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, baseSize * 2.8 * pulse);
    outerGradient.addColorStop(0, `hsla(${me.hue}, 100%, 85%, ${0.4 * pulse})`);
    outerGradient.addColorStop(0.6, `hsla(${me.hue}, 90%, 75%, ${0.2 * pulse})`);
    outerGradient.addColorStop(1, `hsla(${me.hue}, 80%, 65%, 0)`);
    
    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, baseSize * 2.8 * pulse, 0, Math.PI * 2);
    ctx.fill();
    
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
      
      ctx.fillStyle = `hsla(${me.hue}, 100%, 90%, ${0.3 * pulse})`;
      ctx.beginPath();
      ctx.moveTo(basePoint1.x, basePoint1.y);
      ctx.lineTo(basePoint2.x, basePoint2.y);
      ctx.lineTo(tipPoint2.x, tipPoint2.y);
      ctx.lineTo(tipPoint1.x, tipPoint1.y);
      ctx.closePath();
      ctx.fill();
    }
    
    const innerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, baseSize * 1.0 * pulse);
    innerGradient.addColorStop(0, `hsla(${me.hue}, 100%, 98%, ${0.9 * pulse})`);
    innerGradient.addColorStop(1, `hsla(${me.hue}, 100%, 85%, ${0.4 * pulse})`);
    
    ctx.fillStyle = innerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, baseSize * 1.0 * pulse, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = `hsl(${me.hue}, 100%, ${95 * pulse}%)`;
    ctx.beginPath();
    ctx.arc(0, 0, coreSize, 0, Math.PI * 2);
    ctx.fill();
        
  } else if (me.role === 'wind') {
    // draw wind 
    const length = Math.min(canvas.width, canvas.height) * 0.10; 
    const time = Date.now() * 0.004; 
    
    for (let i = 0; i < 8; i++) { 
      const angle = (i / 8) * Math.PI * 2 + time * 0.5;
      const radius = length * 0.4 + Math.sin(time * 0.3 + i) * length * 0.1; 
      const particleSize = length * 0.015; 
      
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      ctx.fillStyle = `hsla(${me.hue}, 70%, 75%, ${0.2 + Math.sin(time * 0.5 + i) * 0.15})`; 
      ctx.beginPath();
      ctx.arc(x, y, particleSize, 0, Math.PI * 2);
      ctx.fill();
    }
    
    const amplitude = length * 0.15; 
    ctx.strokeStyle = `hsla(${me.hue}, 75%, 70%, 0.7)`; 
    ctx.lineWidth = length * 0.01; 
    ctx.lineCap = 'round';
    
    const streamOffsets = [-amplitude * 1.8, 0, amplitude * 1.5];
    const streamLengths = [0.95, 1.25, 0.95]; 

    for (let stream = 0; stream < 3; stream++) {
      ctx.beginPath();
      const offsetY = streamOffsets[stream];
      const streamLength = length * streamLengths[stream]; 
      
      for (let i = -8; i <= 8; i++) {
        const progress = (i + 8) / 16;
        const x = progress * streamLength * 1.1 - streamLength * 0.55; 
        
        const wave = Math.sin(i * 0.5 + time * 1.5 + stream * 1.2) * amplitude;
        const y = offsetY + wave * (1 - progress * 0.4); 
        
        if (i === -8) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  
  ctx.restore();
}

// main draw loop - only draw user's own elem
function draw() {
  // gradient bg
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#0a0a2a');
  gradient.addColorStop(0.5, '#1a1a3a');
  gradient.addColorStop(1, '#0a1a2a');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawOwnElement();

  requestAnimationFrame(draw);
}
draw();