// client script for Bloom prototype — orientation + mic-driven collaborative painting

const prefix = location.pathname.replace(/\/$/, '');
const socket = io({ path: prefix + '/socket.io' });

let infoText = document.querySelector("#infoText");
let canvas = document.getElementById("bloomCanvas");
let ctx = canvas.getContext("2d");

// full screen canvas
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// local state
let myBrush = { x: 0.5, y: 0.5, size: 0.05, hue: Math.floor(Math.random()*360), shape: 'circle' };
let brushes = {}; // remote + local brush states from server
let lastEmit = 0;
const EMIT_INTERVAL = 50; // ms (throttle updates)

// smoothing targets for rendering (avoid jitter)
let renderState = {}; // keyed by id -> { curX, curY, curSize, curHue }

// microphone -> hue mapping
let latestVolume = 0;
const HUE_RANGE = 60; // how much hue shifts with loudness
const SOUND_MULT = 600; // increase sensitivity

// easing for render smoothing
const EASE = 0.14;

socket.on('connect', () => {
  console.log('connected', socket.id);
  infoText.textContent = 'Connected — move to draw.';
});

// server assigns shape + base hue on connect
socket.on('assignBrush', (data) => {
  if (data.shape) myBrush.shape = data.shape;
  if (typeof data.baseHue === 'number') myBrush.hue = data.baseHue;
  console.log('assigned', myBrush);
});

// receive global state (brushes map)
socket.on('state', (data) => {
  if (data.brushes) {
    brushes = data.brushes;
    // ensure we have renderState entries for each brush
    Object.keys(brushes).forEach(id => {
      if (!renderState[id]) {
        renderState[id] = {
          curX: brushes[id].x || 0.5,
          curY: brushes[id].y || 0.5,
          curSize: brushes[id].size || 0.05,
          curHue: brushes[id].hue || 0
        };
      }
    });
  }
});

// microphone setup (and compute hue shift)
async function startMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function analyze() {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a,b)=>a+b,0)/dataArray.length;
      // stronger sensitivity and baseline
      latestVolume = Math.min(1, avg / SOUND_MULT + 0.02);
      // client-side hue mapped
      const shift = Math.floor(latestVolume * HUE_RANGE);
      const hue = (myBrush.hue + shift) % 360;
      myBrush.currentHue = hue;
      requestAnimationFrame(analyze);
    }
    analyze();
  } catch (err) {
    console.warn('mic denied or error', err);
    infoText.textContent = 'Microphone denied — color will be static.';
  }
}
startMic();

// device orientation -> normalized x,y, size
function handleOrientation(e) {
  const beta = e.beta || 0; // front/back tilt
  const gamma = e.gamma || 0; // left/right tilt

  // Normalize to 0..1
  let nx = (gamma + 90) / 180; // left/right
  let ny = (beta + 180) / 360;  // up/down

  // clamp
  nx = Math.max(0, Math.min(1, nx));
  ny = Math.max(0, Math.min(1, ny));

  // size from absolute gamma (tilt left/right)
  let nsize = 0.03 + (Math.abs(gamma) / 90) * 0.12; // normalized size, tweak as needed

  myBrush.x = nx;
  myBrush.y = ny;
  myBrush.size = nsize;

  // throttle sending moves (avoid flooding)
  const now = Date.now();
  if (now - lastEmit > EMIT_INTERVAL) {
    lastEmit = now;
    socket.emit('brushMove', {
      x: myBrush.x,
      y: myBrush.y,
      size: myBrush.size,
      hue: myBrush.currentHue || myBrush.hue
    });
  }
}

// orientation permission button (iOS friendly)
function showOrientationButton() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {

    const btn = document.createElement('button');
    btn.id = 'requestOrientationButton';
    btn.textContent = 'Enable Device Motion';
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
      DeviceOrientationEvent.requestPermission()
        .then(state => {
          if (state === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
            btn.remove();
          } else {
            alert('Permission needed for motion controls');
          }
        })
        .catch(err => { console.error(err); alert('Permission error'); });
    });
  } else {
    // no permission required (desktop or Android)
    window.addEventListener('deviceorientation', handleOrientation, true);
  }
}
showOrientationButton();

// Drawing loop: render all brushes as persistent strokes (interactive painting)
function drawLoop() {
  // don't clear canvas — leave drawing trails (interactive painting)
  // If you want gentle fade-over-time, uncomment a translucent rect fill below:
  // ctx.fillStyle = 'rgba(0,0,0,0.02)'; ctx.fillRect(0,0,canvas.width,canvas.height);

  Object.keys(brushes).forEach(id => {
    const b = brushes[id];
    if (!b) return;

    // ensure renderState exists
    if (!renderState[id]) {
      renderState[id] = { curX: b.x, curY: b.y, curSize: b.size, curHue: b.hue };
    }

    // ease render values toward networked values
    const rs = renderState[id];
    rs.curX += (b.x - rs.curX) * EASE;
    rs.curY += (b.y - rs.curY) * EASE;
    rs.curSize += (b.size - rs.curSize) * EASE;
    rs.curHue += ((b.hue || 0) - rs.curHue) * EASE;

    // compute pixel values
    const px = rs.curX * canvas.width;
    const py = rs.curY * canvas.height;
    const sizePx = rs.curSize * Math.min(canvas.width, canvas.height);

    // draw shape (persistent)
    ctx.save();
    ctx.translate(px, py);

    const hue = Math.floor(rs.curHue);
    ctx.fillStyle = `hsl(${hue}, 80%, 55%)`;
    ctx.strokeStyle = `hsla(${hue}, 80%, 40%, 0.25)`;
    ctx.lineWidth = Math.max(1, sizePx * 0.08);

    if ((brushes[id].shape || myBrush.shape) === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, sizePx/2, 0, Math.PI*2);
      ctx.fill();
    } else if ((brushes[id].shape || myBrush.shape) === 'triangle') {
      ctx.beginPath();
      const h = sizePx/2;
      ctx.moveTo(0, -h);
      ctx.lineTo(h, h);
      ctx.lineTo(-h, h);
      ctx.closePath();
      ctx.fill();
    } else { // square
      ctx.fillRect(-sizePx/2, -sizePx/2, sizePx, sizePx);
    }
    ctx.restore();
  });

  requestAnimationFrame(drawLoop);
}
drawLoop();
