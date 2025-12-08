// map and canvas setup 
let mappa = new Mappa("Leaflet");
let myMap;
let canvas;

// gps and user location 
let currentLatitude = 0;
let currentLongitude = 0;
let mapInit = false;
let me;

// drawing variables 
let drawMode = true; 
// store all drawing lines
let drawings = []; 
// current drawing color
let myColor;
// store map boundaries when drawing starts
let frozenBounds = null; 

// draw-mode lock -> check if boundaries have been set yet
let boundsInitialized = false; 

//buttons
let controlButtons = [];
let undoBtn;
let modeBtn; 
let hideBtn; 
let locBtn;
let clearMineBtn; 
let clearAllBtn; 

// rainbow slider for color stroke picking
let hueSliderX;
let hueSliderY;
let hueSliderWidth = 300;
let hueSliderHeight = 20;
let hueValue = 0;
let draggingSlider = false;
let hueSliderVisible = true;

// start screen overlay 
let showStartScreen = true;
let titleName = "GEO-SCRIBBLE"; 

// create or get user id from browser storage
function getOrCreateUserId() {
  let id = localStorage.getItem("chat-user-id");
  if(!id){
    id = "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
    localStorage.setItem("chat-user-id", id);
  }
  return id;
}

// store user id for this session
const myUserId = getOrCreateUserId();

// connection for real-time updates
let socket;
if (location.hostname.toLowerCase().startsWith('browsercircus') || location.hostname.toLowerCase().startsWith('www')) {
  socket = io({ path: "/tq/port-4260/socket.io" });
} else {
  socket = io();
}

let mappa_options = {
  lat: 0,
  lng: 0,
  zoom: 16,
  style: "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}"
}

// drawing image layer and server-backed images 
let drawLayer; 
let currentStroke = []; 
let imagesMeta = []; 
let loadedImages = {}; 

// hide drawings from other users
let hideAll = false;

function preload() {}

// Make handleNewPosition globally accessible for GPS script - SIMPLIFIED
window.handleNewPosition = function(pos) {
    console.log("📍 GPS position received");
    
    if (pos && pos.coords) {
        // Convert coordinates if function exists
        let lonlat;
        if (typeof fixForChineseMap === 'function') {
            lonlat = fixForChineseMap(pos);
        } else {
            lonlat = [pos.coords.longitude, pos.coords.latitude];
        }
        
        currentLongitude = lonlat[0];
        currentLatitude = lonlat[1];
        
        console.log("📍 Updated location:", currentLatitude, currentLongitude);
        
        // Try to set GPS_GRANTED if it exists
        try {
            if (typeof GPS_GRANTED !== 'undefined') {
                GPS_GRANTED = true;
            }
        } catch(e) {
            // GPS_GRANTED might not be defined yet, that's ok
        }
        
        if(mapInit) {
            updateMapContent();
        }
        
        // Tell server about new location
        if (socket) {
            socket.emit("updateLocation", {lat: currentLatitude, lng: currentLongitude});
        }
    }
};

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");

  // create extra drawing layer
  drawLayer = createGraphics(windowWidth, windowHeight);
  drawLayer.clear();

  colorMode(HSB, 360, 100, 100, 1);
  myColor = color(0, 100, 100, 0.5); 
  me = new MyPoint();

  console.log("🎨 Sketch setup starting...");
  console.log("requestGPS available:", typeof requestGPS !== 'undefined');

  // load all images from server 
  function reloadImages(metaList) {
    imagesMeta = metaList || [];
    loadedImages = {};
    imagesMeta.forEach(m => {
      if (!loadedImages[m.file]) loadedImages[m.file] = loadImage("/drawings/" + m.file);
    });
    currentStroke = [];
  }

  // when server sends all saved images
  socket.on("allImages", reloadImages);

  // when new image is saved by anyone
  socket.on("newImage", (meta) => {
    imagesMeta.push(meta);
    if (!loadedImages[meta.file]) loadedImages[meta.file] = loadImage("/drawings/" + meta.file);
  });

  // when image is deleted -> remove from everything
  socket.on("deleteImage", (filename) => {
    imagesMeta = imagesMeta.filter(m => m.file !== filename);
    delete loadedImages[filename];
    drawings = drawings.filter(d => d.file !== filename);
  });

  // when server sends all drawing lines
  socket.on("allDrawings", data => { 
    drawings = data.filter(d => d.userId !== myUserId) || []; 
  });
  
  // when new drawing line is created
  socket.on("newDrawing", point => { 
    if(point.userId !== myUserId) {
      drawings.push(point);
    }
  });

  // button to center on user location
  locBtn = createButton("Request GPS");
  locBtn.position(20, 70);
  locBtn.style('z-index','10');
  locBtn.style('background-color','#2196F3');
  locBtn.style('color','white');
  locBtn.style('border-radius','10px');
  locBtn.style('padding','8px 10px');
  locBtn.style('font-family','monospace');
  locBtn.style('font-size','10px');
  locBtn.hide(); 
  
  locBtn.mousePressed(() => {
    console.log("📍 Request GPS button clicked");
    if (typeof requestGPS === 'function') {
        console.log("📡 Calling requestGPS()...");
        requestGPS();
    } else {
        console.error("❌ requestGPS function not found!");
        alert("GPS not available. Please refresh the page.");
    }
  });
  controlButtons.push(locBtn);

  // button to switch modes
  modeBtn = createButton("switch to view mode");
  modeBtn.position(20,20);
  modeBtn.style('z-index','10');
  modeBtn.style('background-color','#00c3ff'); 
  modeBtn.style('color','white');
  modeBtn.style('border-radius','10px');
  modeBtn.style('padding','8px 10px');
  modeBtn.style('font-family','monospace');
  modeBtn.style('font-size','10px');
  modeBtn.hide(); 

  modeBtn.mousePressed(()=>{
    drawMode = !drawMode;
    if(drawMode){ 
      modeBtn.html("switch to view mode"); 
      modeBtn.style('background-color','#00c3ff'); 
      hueSliderVisible = true;
      undoBtn.show();
      freezeMap();
    } else { 
      modeBtn.html("switch to draw mode"); 
      modeBtn.style('background-color','#4CAF50'); 
      hueSliderVisible = false;
      undoBtn.hide();
      unfreezeMap();
    }
  });
  controlButtons.push(modeBtn);

  // button to clear only current user's drawings
  clearMineBtn = createButton("clear my drawings");
  clearMineBtn.position(windowWidth - 130, 20);
  clearMineBtn.style('background-color','#ff4444');
  clearMineBtn.style('color','white');
  clearMineBtn.style('border-radius','10px');
  clearMineBtn.style('padding','8px 10px');
  clearMineBtn.style('position', 'fixed');
  clearMineBtn.style('font-family','monospace');
  clearMineBtn.style('font-size','10px');
  clearMineBtn.hide(); 

  clearMineBtn.mousePressed(() => { 
    socket.emit("clearMyImages", myUserId); 
    drawings = drawings.filter(d => d.userId !== myUserId);
    currentStroke = [];
    drawLayer.clear();
  });
  controlButtons.push(clearMineBtn);

  // button to clear EVERYONE's drawings
  clearAllBtn = createButton("clear ALL drawings");
  clearAllBtn.position(windowWidth - 130, 100);
  clearAllBtn.style('background-color','#ff0000');
  clearAllBtn.style('color','white');
  clearAllBtn.style('border-radius','10px');
  clearAllBtn.style('padding','8px 10px');
  clearAllBtn.style('position', 'fixed');
  clearAllBtn.style('font-family','monospace');
  clearAllBtn.style('font-size','10px');
  clearAllBtn.style('font-weight','bold');
  clearAllBtn.hide(); 
  
  clearAllBtn.mousePressed(() => { 
    if(confirm("WARNING: this will delete ALL drawings from EVERYONE, including your own. Are you sure?")) {
      socket.emit("clearAllImages"); 
      drawings = [];
      imagesMeta = [];
      loadedImages = {};
      currentStroke = [];
      drawLayer.clear();
    }
  });
  controlButtons.push(clearAllBtn);

  // button to hide/show drawings
  hideBtn = createButton("hide all drawings");
  hideBtn.position(windowWidth - 130, 60);
  hideBtn.style('background-color','#aa00ff'); 
  hideBtn.style('color','white');
  hideBtn.style('border-radius','10px');
  hideBtn.style('padding','8px 10px');
  hideBtn.style('position', 'fixed');
  hideBtn.style('font-family','monospace');
  hideBtn.style('font-size','10px');
  hideBtn.hide(); 

  hideBtn.mousePressed(() => {
      hideAll = !hideAll;
      if(hideAll){
        hideBtn.html("show all drawings");
        hideBtn.style('background-color','#666666'); 
      } else {
        hideBtn.html("hide all drawings");
        hideBtn.style('background-color','#aa00ff'); 
      }
  });
  controlButtons.push(hideBtn);

  // undo button
  undoBtn = createButton("Undo");
  undoBtn.position(windowWidth - 60, windowHeight - 65);
  undoBtn.style('background-color','#ffaa00');
  undoBtn.style('color','white');
  undoBtn.style('border-radius','10px');
  undoBtn.style('padding','8px 10px');
  undoBtn.style('position', 'fixed');
  undoBtn.style('font-family','monospace');
  undoBtn.style('font-size','10px');
  undoBtn.hide(); 

  undoBtn.mousePressed(() => {
    socket.emit("deleteLastImage", myUserId);
  });
  controlButtons.push(undoBtn);

  // tell server you joined
  socket.emit("joinUser");
  
  // Auto-request GPS after a short delay
  setTimeout(() => {
    console.log("⏱️ Auto-starting GPS in 1 second...");
    if (typeof requestGPS === 'function') {
        console.log("✅ Calling requestGPS()...");
        requestGPS();
    } else {
        console.log("⚠️ requestGPS not available yet, will try again...");
        // Try again in 2 seconds
        setTimeout(() => {
            if (typeof requestGPS === 'function') {
                console.log("🔄 Trying requestGPS() again...");
                requestGPS();
            }
        }, 2000);
    }
  }, 1000);

  console.log("✅ Sketch setup complete");
}

function draw() {
  clear();

  // Debug GPS status periodically
  if (frameCount % 180 === 0) {
    console.log("📍 GPS Status - Lat:", currentLatitude, 
               "Lon:", currentLongitude, "MapInit:", mapInit);
  }

  // fixed pos for hue slider 
  hueSliderX = 20;
  hueSliderY = windowHeight - 60; 

  // SIMPLE CHECK: If we have coordinates and no map, create map
  if(!mapInit && currentLatitude !== 0 && currentLongitude !== 0){
    console.log("🗺️ Creating map with location:", currentLatitude, currentLongitude);
    
    mappa_options.lat = currentLatitude;
    mappa_options.lng = currentLongitude;
    mappa_options.subdomains = "1234";

    myMap = mappa.tileMap(mappa_options);
    myMap.overlay(canvas);
    myMap.onChange(updateMapContent);
    mapInit = true;
    
    console.log("✅ Map created successfully");
    
    setTimeout(() => {
      if(drawMode){
        freezeMap();
        
        if(!boundsInitialized){
          let tl = myMap.pixelToLatLng(0,0);
          let br = myMap.pixelToLatLng(width, height);
          frozenBounds = {latMax: tl.lat, latMin: br.lat, lonMin: tl.lng, lonMax: br.lng};
          boundsInitialized = true;
          console.log("📐 Drawing boundaries set");
        }
      }
    }, 100);
  }

  // if map is ready
  if(mapInit){
    me.update();
    me.display();

    // draw server pngs 
    for (let meta of imagesMeta) {
      let img = loadedImages[meta.file];
      if (!img) continue;
      if(hideAll && meta.userId !== myUserId) continue;
      
      let tl = myMap.latLngToPixel(meta.latMax, meta.lonMin);
      let br = myMap.latLngToPixel(meta.latMin, meta.lonMax);
      image(img, tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

    // draw all current strokes from all users
    strokeWeight(3);
    for(let d of drawings){
      if(hideAll && d.userId !== myUserId) continue;
      
      let col = color(d.color);
      let h = hue(col);
      let s = saturation(col);
      let b = brightness(col);
      stroke(h, s, b, 0.5); 
      
      let start = myMap.latLngToPixel(d.lat1, d.lng1);
      let end = myMap.latLngToPixel(d.lat2, d.lng2);
      line(start.x, start.y, end.x, end.y);
    }

    // Draw current stroke
    drawLayer.clear();
    if(currentStroke.length > 0){
      drawLayer.stroke(myColor);
      drawLayer.strokeWeight(3);
      drawLayer.noFill();
      drawLayer.beginShape();
      for(let p of currentStroke) drawLayer.vertex(p.x, p.y);
      drawLayer.endShape();
    }
    
    image(drawLayer, 0, 0);
    
    // Show boundary in draw mode
    if (drawMode && frozenBounds) {
      let tl = myMap.latLngToPixel(frozenBounds.latMax, frozenBounds.lonMin);
      let br = myMap.latLngToPixel(frozenBounds.latMin, frozenBounds.lonMax);
      
      push();
      noFill();
      stroke(255, 255, 255); 
      strokeWeight(1); 
      rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      pop();
    }
  }

  if (showStartScreen) {
    drawStartScreen();
  }

  if(drawMode && hueSliderVisible && !showStartScreen){
    handleHueSlider();
    drawRainbowSlider();
  }
}

// start screen overlay 
function drawStartScreen() {
  push();
  
  colorMode(RGB, 255);
  
  // gradient bg
  for (let i = 0; i < height; i++) {
    let inter = map(i, 0, height, 0, 1);
    let r = lerp(30, 50, inter);
    let g = lerp(100, 200, inter);
    let b = lerp(200, 150, inter);
    stroke(r, g, b);
    line(0, i, width, i);
  }
  
  // grid pattern
  stroke(255, 255, 255, 20);
  strokeWeight(1);
  let gridSize = min(40, width / 15); 
  for (let x = 0; x < width; x += gridSize) {
    line(x, 0, x, height);
  }
  for (let y = 0; y < height; y += gridSize) {
    line(0, y, width, y);
  }
  
  textFont('monospace');
  textAlign(CENTER, CENTER);
  
  let titleSize = min(48, width / 8);
  let subtitleSize = min(20, width / 20);
  let descSize = min(14, width / 30);
  
  // text
  fill(255, 255, 255, 200);
  noStroke();
  textSize(titleSize);
  text(titleName, width/2 + 2, height/4 + 2);
  
  fill(0, 0, 0);
  text(titleName, width/2, height/4);
  
  fill(255, 255, 255, 200);
  textSize(subtitleSize);
  text("REAL-TIME GPS CANVAS", width/2 + 1, height/4 + titleSize + 10);
  
  fill(0, 0, 0);
  text("REAL-TIME GPS CANVAS", width/2, height/4 + titleSize + 9);
  
  // description box
  let boxWidth = min(500, width - 40);
  let boxHeight = min(120, height/4); 
  
  fill(255, 255, 255, 220);
  stroke(0, 0, 0, 150);
  strokeWeight(2);
  rectMode(CENTER);
  rect(width/2, height/2, boxWidth, boxHeight, 15);
  
  // description text
  fill(0, 0, 0);
  noStroke();
  textSize(descSize);
  textAlign(CENTER, CENTER);
  text("draw on maps with others in real-time\n" +
       "artwork anchored to gps locations\n" +
       "collaborate and explore", 
       width/2, height/2);
  
  colorMode(HSB, 360, 100, 100, 1);
  
  pop();
}

function mousePressed() {
  if (showStartScreen) {
    showStartScreen = false;
    for (let btn of controlButtons) {
      btn.show();
    }
    console.log("🎮 Start screen closed");
  }
}

function drawRainbowSlider() {
  push();
  translate(0, 0);
  noStroke();
  for (let i = 0; i < hueSliderWidth; i++) {
    let h = map(i, 0, hueSliderWidth, 0, 360);
    fill(h, 100, 100);
    rect(hueSliderX + i, hueSliderY, 1, hueSliderHeight);
  }
  stroke(255);
  strokeWeight(2);
  fill(0,0,100);
  let handleX = map(hueValue, 0, 360, hueSliderX, hueSliderX + hueSliderWidth);
  rect(handleX-5, hueSliderY-5, 10, hueSliderHeight+10);
  pop();
}

function handleHueSlider() {
  let overSlider =
    mouseY >= hueSliderY &&
    mouseY <= hueSliderY + hueSliderHeight &&
    mouseX >= hueSliderX &&
    mouseX <= hueSliderX + hueSliderWidth;

  if (mouseIsPressed && overSlider) draggingSlider = true;
  if (!mouseIsPressed) draggingSlider = false;

  if (draggingSlider) {
    let mx = constrain(mouseX, hueSliderX, hueSliderX + hueSliderWidth);
    hueValue = map(mx, hueSliderX, hueSliderX + hueSliderWidth, 0, 360);
    myColor = color(hueValue, 100, 100, 0.5); 
  }
}

function touchMoved() {
  if (
    mouseY >= hueSliderY &&
    mouseY <= hueSliderY + hueSliderHeight &&
    mouseX >= hueSliderX &&
    mouseX <= hueSliderX + hueSliderWidth
  ) return false;

  if (mapInit && drawMode && frozenBounds && !showStartScreen) {
    let pos1 = myMap.pixelToLatLng(pmouseX, pmouseY);
    let pos2 = myMap.pixelToLatLng(mouseX, mouseY);

    if(pos2.lat > frozenBounds.latMax || pos2.lat < frozenBounds.latMin || 
       pos2.lng < frozenBounds.lonMin || pos2.lng > frozenBounds.lonMax) return false;

    currentStroke.push({ x: mouseX, y: mouseY });

    let lineSeg = {
      lat1: pos1.lat,
      lng1: pos1.lng,
      lat2: pos2.lat,
      lng2: pos2.lng,
      color: myColor.toString(),
      userId: myUserId
    };
    
    socket.emit("newDrawing", lineSeg);
  }
  return false;
}

function touchEnded() {
  if (!mapInit || !drawMode || currentStroke.length === 0 || showStartScreen) return;

  let filename = `drawing-${myUserId}-${Date.now()}.png`;
  let dataURL = drawLayer.elt.toDataURL("image/png");

  let meta = { 
    file: filename, 
    userId: myUserId, 
    timestamp: Date.now(),
    latMax: frozenBounds.latMax, 
    latMin: frozenBounds.latMin,
    lonMin: frozenBounds.lonMin, 
    lonMax: frozenBounds.lonMax,
    width: drawLayer.width, 
    height: drawLayer.height 
  };

  socket.emit("savePNG", { image: dataURL, meta: meta });
  currentStroke = [];
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
  hueSliderY = windowHeight - 60; 
  undoBtn.position(windowWidth - 60, windowHeight - 65);
  
  for (let btn of controlButtons) {
    if (btn === locBtn) {
      btn.position(20, 70);
    } else if (btn === modeBtn) {
      btn.position(20, 20);
    } else if (btn === clearMineBtn) {
      btn.position(windowWidth - 130, 20);
    } else if (btn === clearAllBtn) {
      btn.position(windowWidth - 130, 100);
    } else if (btn === hideBtn) {
      btn.position(windowWidth - 130, 60);
    }
  }
}

function freezeMap(){
  if(!mapInit) return;
  myMap.map.dragging.disable();
  myMap.map.touchZoom.disable();
  myMap.map.doubleClickZoom.disable();
  myMap.map.scrollWheelZoom.disable();
  myMap.map.boxZoom.disable();
  myMap.map.keyboard.disable();
}

function unfreezeMap(){
  if(!mapInit) return;
  myMap.map.dragging.enable();
  myMap.map.touchZoom.enable();
  myMap.map.doubleClickZoom.enable();
  myMap.map.scrollWheelZoom.enable();
  myMap.map.boxZoom.enable();
  myMap.map.keyboard.enable();
}

function updateMapContent(){
  if (currentLatitude !== 0 && currentLongitude !== 0) {
    let myPosOnCanvas = myMap.latLngToPixel(currentLatitude, currentLongitude);
    me.goalX = myPosOnCanvas.x;
    me.goalY = myPosOnCanvas.y;
    
    if (socket) {
      socket.emit("updateLocation", {lat: currentLatitude, lng: currentLongitude});
    }
  }
}

class MyPoint{
  constructor(){
    this.x = 0; this.y = 0;
    this.goalX = 0; this.goalY = 0;
    this.size = 14;
    this.col = color(170,240,190);
  }
  
  update(){
    this.x = lerp(this.x, this.goalX, 0.2);
    this.y = lerp(this.y, this.goalY, 0.2);
  }
  
  display(){
    push();
    translate(this.x, this.y);
    fill(this.col);
    stroke("black");
    strokeWeight(3);
    let dia = this.size + sin(frameCount * 0.1);
    circle(0, 0, dia);
    pop();
  }
}