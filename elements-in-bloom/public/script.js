const prefix = location.pathname.replace(/\/$/, '');
const socket = io({ path: prefix + '/socket.io' });
// const socket = io();

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

// init local player object with role, hue, position, shape
let me = { role: 'life', hue: Math.random()*360, x: 0.5, y: 0.5, shape: 'circle' };

//object to store players
let world = {};
//timestamp of last data sent to server
let lastEmit = 0;

//constants for control
const EMIT_INTERVAL = 60;
const EASE = 0.12;
const MAX_STROKES = 3000;

// object to store rendering info per entity/player
let render = {};
//previous position of local player
let prevPos = { x: me.x, y: me.y };
//array storing strokes
let strokes = [];

// stroke management
function addStroke(s) {
  //timestamp + velocity
  s.ts = Date.now();
  s.vx = s.vx || 0;
  s.vy = s.vy || 0;
  strokes.push(s);
  //limit number of strokes
  if (strokes.length > MAX_STROKES) strokes.splice(0, strokes.length - MAX_STROKES);
}

//interpolate b/w prev and current positions to generate multiple strokes
function interpolateStrokes(prev, curr, steps=5) {
  const dx = curr.x - prev.x;
  const dy = curr.y - prev.y;
  const dv = (curr.volume||0) - (prev.volume||0);
  for (let i=1; i<=steps; i++) {
    const t = i/steps;
    addStroke({
      x: prev.x + dx*t,
      y: prev.y + dy*t,
      size: 0.03 + Math.abs((prev.volume||0)+dv*t)*0.12,
      hue: curr.hue,
      shape: curr.shape
    });
  }
}

// star shape at given coords
function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  let step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
    rot += step;
  }
  ctx.closePath();
  ctx.fill();
}

// audio setup
let audioCtx;
let audioReady = false;

// sound effects for interactions
const audioMap = {
  'life-light': new Audio('str1.wav'),
  'life-wind': new Audio('str2.wav'),
  'light-wind': new Audio('str3.wav'),
  'life-light-wind': new Audio('str4.wav')
};

//user interaction unlocks audio context
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
  // if life player has no shape, assign it randomly
  if (!me.shape && me.role === 'life') me.shape = ['circle','square','star'][Math.floor(Math.random()*3)];
  infoText.textContent = `You are ${me.role.toUpperCase()}`;
});

// state updates from server
socket.on('state', (data) => {
  world = data;
  // init render objects for new entities
  Object.keys(world).forEach(id => {
    if (!render[id]) render[id] = { x: world[id].x, y: world[id].y, hue: world[id].hue, volume: world[id].volume, prevX: world[id].x, prevY: world[id].y };
  });
  Object.keys(world).forEach(id => {
    if (id === socket.id) return;
    const e = world[id];
    if (e.role === 'life') {
      const r = render[id];
      const prev = { x: r.curX || r.x, y: r.curY || r.y, volume: r.volume, shape: e.shape, hue: e.hue };
      interpolateStrokes(prev, e, 4);
      r.curX = e.x;
      r.curY = e.y;
    }
  });
});

// orientation handling
function handleOrientation(e) {
  const beta = e.beta || 0;
  const gamma = e.gamma || 0;
  let nx = Math.max(0, Math.min(1, (gamma + 90) / 180));
  let ny = Math.max(0, Math.min(1, (beta + 180) / 360));

  if(me.role==='life'){
    const currPos = { x: nx, y: ny, volume: 1, shape: me.shape, hue: me.hue };
    interpolateStrokes(prevPos, currPos, 6); 
    prevPos = { ...currPos };
  }

  me.x = nx;
  me.y = ny;
  sendUpdate();
}

// orientation + audio unlock button
function showOrientationButton() {
  const btn = document.createElement('button');
  btn.textContent = 'Enable Motion & Audio';
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

// send update to server
function sendUpdate() {
  const now = Date.now();
  if (now - lastEmit > EMIT_INTERVAL) {
    lastEmit = now;
    socket.emit('update', { x: me.x, y: me.y, hue: me.hue, shape: me.shape });
  }
}

// wind influence on life player
function applyWindToStrokes(e, r) {
  const vx = e.x - (r.prevX || e.x);
  const vy = e.y - (r.prevY || e.y);
  r.prevX = e.x;
  r.prevY = e.y;
  const strength = 0.12 + (e.volume || 0) * 0.18;
  const radius = 0.22;

  for (let s of strokes) {
    const dx = s.x - e.x, dy = s.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < radius) {
      const factor = (1 - dist/radius) * strength;
      s.vx += vx*factor;
      s.vy += vy*factor;
    }
  }
}

// stroke physics
function updateStrokePositions() {
  for (let s of strokes) {
    s.x += s.vx; s.y += s.vy;
    s.vx *= 0.85; s.vy *= 0.85;
    s.x = Math.max(0, Math.min(1, s.x));
    s.y = Math.max(0, Math.min(1, s.y));
  }
}

// interactions and sound
const INTERACTION_RADIUS = 0.05;
let lastInteractionTime = {};
const INTERACTION_COOLDOWN = 300; 

// play sound
socket.on('playSound', key => {
  if (!audioReady) return;
  const audio = audioMap[key];
  if(audio){
    audio.currentTime = 0;
    audio.play().catch(err => console.warn("Audio play failed:", err));
  }
});

// check  for interactions between players and emit event to server
function checkInteractions() {
  const entities = Object.values(world);
  const now = Date.now();
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const e1 = entities[i], e2 = entities[j];
      const dx = e1.x - e2.x, dy = e1.y - e2.y;
      if (Math.hypot(dx, dy) < INTERACTION_RADIUS) {
        let roles = new Set([e1.role, e2.role]);
        entities.forEach(e3 => {
          if(e3!==e1 && e3!==e2 && Math.hypot(e1.x-e3.x,e1.y-e3.y)<INTERACTION_RADIUS) roles.add(e3.role);
        });
        const key = [...roles].sort().join('-');
        if(!lastInteractionTime[key] || now - lastInteractionTime[key] > INTERACTION_COOLDOWN){
          lastInteractionTime[key] = now;
          socket.emit('interaction', key);
        }
      }
    }
  }
}

// main draw loop
function draw() {
  updateStrokePositions();

  // calc avg hue of light players for bg
  const lightHues = Object.values(world).filter(u=>u.role==='light').map(u => u.hue + (u.volume||0)*60);
  const avgHue = lightHues.length ? lightHues.reduce((a,b)=>a+b,0)/lightHues.length : 200;

  //draaw bg
  ctx.fillStyle = `hsl(${avgHue},30%,8%)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // life strokes
  strokes.forEach(s => {
    const px = s.x*canvas.width, py = s.y*canvas.height, sizePx = s.size*Math.min(canvas.width,canvas.height);
    let enhancedSat = 70;
    Object.values(world).forEach(u => {
      if(u.role==='light'){
        const dist = Math.hypot(s.x-u.x, s.y-u.y);
        if(dist<0.15) enhancedSat = Math.min(100, enhancedSat + 20 + (u.volume||0)*40);
      }
    });
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = `hsl(${Math.floor(s.hue)},${Math.floor(enhancedSat)}%,${Math.floor(40+s.size*50)}%)`;
    ctx.globalAlpha = 0.95;
    if(s.shape==='circle') ctx.beginPath(), ctx.arc(0,0,sizePx/2,0,Math.PI*2), ctx.fill();
    else if(s.shape==='square') ctx.fillRect(-sizePx/2,-sizePx/2,sizePx,sizePx);
    else if(s.shape==='star') drawStar(0,0,5,sizePx/2,sizePx/4);
    ctx.restore();
  });

  // draw entities life light wind
  Object.entries(world).forEach(([id,e]) => {
    if(!render[id]) render[id]={x:e.x,y:e.y,hue:e.hue,volume:e.volume,prevX:e.x,prevY:e.y};
    const r = render[id];
    r.x += (e.x - r.x)*EASE; r.y += (e.y - r.y)*EASE;
    r.hue += ((e.hue||0)-r.hue)*EASE; r.volume += ((e.volume||0)-r.volume)*EASE;

    const px=r.x*canvas.width, py=r.y*canvas.height;

    ctx.save();
    ctx.translate(px, py);

    //wind shape
    if(e.role==='wind'){
      ctx.strokeStyle=`hsla(${Math.floor(r.hue)},70%,60%,${0.35+r.volume*0.4})`;
      ctx.lineWidth=3+r.volume*6;
      ctx.shadowColor=`hsl(${Math.floor(r.hue)},80%,60%)`;
      ctx.shadowBlur=20+r.volume*60;
      const segs=6;
      ctx.beginPath();
      for(let i=0;i<segs;i++){
        const t=i/(segs-1);
        const x=(t-0.5)*80;
        const y=Math.sin(t*Math.PI*2 + Date.now()*0.003 + id.length)*(12+r.volume*25);
        i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      }
      ctx.stroke();
      applyWindToStrokes(e,r);
      //light shape
    } else if(e.role==='light'){
      const rad = 60 + r.volume*240;
      const grad=ctx.createRadialGradient(0,0,0,0,0,rad);
      grad.addColorStop(0,`hsla(${Math.floor(r.hue)},80%,70%,${0.25+r.volume*0.5})`);
      grad.addColorStop(1,'hsla(0,0%,0%,0)');
      ctx.fillStyle=grad;
      ctx.beginPath(); ctx.arc(0,0,rad,0,Math.PI*2); ctx.fill();
    } else if(e.role==='life'){
      //life shapes
      const sat=Math.max(10,60*(r.volume||0.02));
      const lightness=40+(r.volume||0)*30;
      ctx.fillStyle=`hsl(${Math.floor(r.hue)},${Math.floor(sat)}%,${Math.floor(lightness)}%)`;
      ctx.shadowColor=`hsl(${Math.floor(r.hue)},80%,60%)`;
      ctx.shadowBlur = 30 + (r.volume||0)*80;
      ctx.beginPath(); ctx.arc(0,0,12+(r.volume||0)*40,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  });

  // call function if interactions occur and play sounds
  checkInteractions();
  requestAnimationFrame(draw);
}
draw();
