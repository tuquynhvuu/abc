// ----- map and canvas setup -----
let mappa = new Mappa("Leaflet");
let myMap;
let canvas;

// ----- gps and user location -----
let currentLatitude = 0;
let currentLongitude = 0;
let mapInit = false;
let me;

// ----- drawing variables -----
let drawMode = true; // default is draw mode
let drawings = []; // all drawings from all users
let myColor;
let frozenBounds = null; // bounds of map when first frozen

// ----- draw-mode lock variables -----
let boundsInitialized = false; // flag to track if bounds have been set once

// ----- button storage -----
let controlButtons = [];
let undoBtn;
let modeBtn; // Reference to mode button for color changes
let hideBtn; // Reference to hide/show button
let gpsBtn; // Reference to GPS navigation button
let clearMineBtn; // Reference to clear my drawings button

// --- custom rainbow slider ---
let hueSliderX;
let hueSliderY;
let hueSliderWidth = 300;
let hueSliderHeight = 20;
let hueValue = 0;
let draggingSlider = false;
let hueSliderVisible = true;

// ----- start screen overlay -----
let showStartScreen = true;
let titleName = "GEO-SCRIBBLE"; // Project name

// ----- user id logic from localstorage example -----
function getOrCreateUserId() {
  let id = localStorage.getItem("chat-user-id");
  if(!id){
    id = "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
    localStorage.setItem("chat-user-id", id);
  }
  return id;
}
const myUserId = getOrCreateUserId();

// ----- socket.io -----
let socket;
if(location.hostname.toLowerCase().startsWith('browsercircus')){
  socket = io({path: "/YOURPATH-and-PORT/socket.io"});
}else{
  socket = io();
}

// ----- map options (china-friendly normal map) -----
let mappa_options = {
  lat: 0,
  lng: 0,
  zoom: 16,
  style: "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}"
}

// ----- drawing image layer and server-backed images -----
let drawLayer; 
let currentStroke = []; 
let imagesMeta = []; 
let loadedImages = {}; 

// ----- per-user hide/show toggle -----
let hideAll = false;

function preload() {}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");

  drawLayer = createGraphics(windowWidth, windowHeight);
  drawLayer.clear();

  colorMode(HSB, 360, 100, 100, 1);
  myColor = color(0, 100, 100, 0.5); // More transparent for better map visibility

  me = new MyPoint();

  // --- load all images from server ---
  function reloadImages(metaList) {
    imagesMeta = metaList || [];
    loadedImages = {};
    imagesMeta.forEach(m => {
      if (!loadedImages[m.file]) loadedImages[m.file] = loadImage("/drawings/" + m.file);
    });
    drawings = drawings.filter(d => d.userId !== myUserId);
    currentStroke = [];
  }

  socket.on("allImages", reloadImages);

  socket.on("newImage", (meta) => {
    imagesMeta.push(meta);
    if (!loadedImages[meta.file]) loadedImages[meta.file] = loadImage("/drawings/" + meta.file);
  });

  socket.on("deleteImage", (filename) => {
    imagesMeta = imagesMeta.filter(m => m.file !== filename);
    delete loadedImages[filename];
    drawings = drawings.filter(d => d.file !== filename);
  });

  socket.on("allDrawings", data => { 
    drawings = data || []; 
  });
  
  socket.on("newDrawing", point => { 
    drawings.push(point);
  });

  // --- GPS navigation button ---
  gpsBtn = createButton("📍 my location");
  gpsBtn.position(20, 70);
  gpsBtn.style('z-index','10');
  gpsBtn.style('background-color','#2196F3');
  gpsBtn.style('color','white');
  gpsBtn.style('border-radius','10px');
  gpsBtn.style('padding','8px 10px');
  gpsBtn.style('font-family','monospace');
  gpsBtn.style('font-size','10px');
  gpsBtn.hide(); // Hide initially, will show after overlay is dismissed
  gpsBtn.mousePressed(() => {
    if(mapInit && currentLatitude !== 0 && currentLongitude !== 0){
      // Center map on current GPS location
      myMap.map.setView([currentLatitude, currentLongitude], 16);
      // If in draw mode, refreeze the map after moving
      if(drawMode){
        setTimeout(() => {
          freezeMap();
        }, 100);
      }
    }
  });
  controlButtons.push(gpsBtn);

  // --- mode button ---
  modeBtn = createButton("switch to view mode");
  modeBtn.position(20,20);
  modeBtn.style('z-index','10');
  modeBtn.style('background-color','#00c3ff'); // Draw mode color - blue
  modeBtn.style('color','white');
  modeBtn.style('border-radius','10px');
  modeBtn.style('padding','8px 10px');
  modeBtn.style('font-family','monospace');
  modeBtn.style('font-size','10px');
  modeBtn.hide(); // Hide initially
  modeBtn.mousePressed(()=>{
    drawMode = !drawMode;
    if(drawMode){ 
      modeBtn.html("switch to view mode"); 
      modeBtn.style('background-color','#00c3ff'); // Blue for draw mode
      hueSliderVisible = true;
      undoBtn.show();
      freezeMap();
    } else { 
      modeBtn.html("switch to draw mode"); 
      modeBtn.style('background-color','#4CAF50'); // Green for view mode
      hueSliderVisible = false;
      undoBtn.hide();
      unfreezeMap();
    }
  });
  controlButtons.push(modeBtn);

  // --- clear mine button ---
  clearMineBtn = createButton("clear my drawings");
  clearMineBtn.position(windowWidth - 130, 20);
  clearMineBtn.style('background-color','#ff4444');
  clearMineBtn.style('color','white');
  clearMineBtn.style('border-radius','10px');
  clearMineBtn.style('padding','8px 10px');
  clearMineBtn.style('position', 'fixed');
  clearMineBtn.style('font-family','monospace');
  clearMineBtn.style('font-size','10px');
  clearMineBtn.hide(); // Hide initially
  clearMineBtn.mousePressed(() => { 
    socket.emit("clearMyImages", myUserId); 
    drawings = drawings.filter(d => d.userId !== myUserId);
    currentStroke = [];
    drawLayer.clear();
  });
  controlButtons.push(clearMineBtn);

  // --- hide/show toggle ---
  hideBtn = createButton("hide all drawings");
  hideBtn.position(windowWidth - 130, 60);
  hideBtn.style('background-color','#aa00ff'); // Purple for show mode
  hideBtn.style('color','white');
  hideBtn.style('border-radius','10px');
  hideBtn.style('padding','8px 10px');
  hideBtn.style('position', 'fixed');
  hideBtn.style('font-family','monospace');
  hideBtn.style('font-size','10px');
  hideBtn.hide(); // Hide initially
  hideBtn.mousePressed(() => {
      hideAll = !hideAll;
      if(hideAll){
        hideBtn.html("show all drawings");
        hideBtn.style('background-color','#666666'); // Gray for hide mode
      } else {
        hideBtn.html("hide all drawings");
        hideBtn.style('background-color','#aa00ff'); // Purple for show mode
      }
  });
  controlButtons.push(hideBtn);

  // --- undo button ---
  undoBtn = createButton("Undo");
  undoBtn.position(windowWidth - 60, windowHeight - 65);
  undoBtn.style('background-color','#ffaa00');
  undoBtn.style('color','white');
  undoBtn.style('border-radius','10px');
  undoBtn.style('padding','8px 10px');
  undoBtn.style('position', 'fixed');
  undoBtn.style('font-family','monospace');
  undoBtn.style('font-size','10px');
  undoBtn.hide(); // Hide initially
  undoBtn.mousePressed(() => {
    socket.emit("deleteLastImage", myUserId);
  });
  controlButtons.push(undoBtn);

  socket.emit("joinUser");
}

// ---------------------- MAIN DRAW LOOP ----------------------
function draw() {
  clear();

  // Fixed position for hue slider - moved up a bit from bottom edge
  hueSliderX = 20;
  hueSliderY = windowHeight - 60; // Changed from -40 to -60 (20 pixels higher)

  if(!mapInit && typeof GPS_GRANTED !== 'undefined' && GPS_GRANTED && currentLongitude != 0){
    mappa_options.lat = currentLatitude;
    mappa_options.lng = currentLongitude;
    mappa_options.subdomains = "1234";
    myMap = mappa.tileMap(mappa_options);
    myMap.overlay(canvas);
    myMap.onChange(updateMapContent);
    mapInit = true;
    
    // Set up initial bounds and freeze if in draw mode
    setTimeout(() => {
      if(drawMode){
        freezeMap();
        
        // Capture bounds ONCE when map first initializes
        if(!boundsInitialized){
          let tl = myMap.pixelToLatLng(0,0);
          let br = myMap.pixelToLatLng(width, height);
          frozenBounds = {latMax: tl.lat, latMin: br.lat, lonMin: tl.lng, lonMax: br.lng};
          boundsInitialized = true;
        }
      }
    }, 100);
  }

  if(mapInit){
    me.update();
    me.display();

    // Draw server images (PNGs saved from previous sessions)
    for (let meta of imagesMeta) {
      let img = loadedImages[meta.file];
      if (!img) continue;
      if(hideAll && meta.userId !== myUserId) continue;
      let tl = myMap.latLngToPixel(meta.latMax, meta.lonMin);
      let br = myMap.latLngToPixel(meta.latMin, meta.lonMax);
      image(img, tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

    // Draw all current strokes from all users DIRECTLY on canvas
    // Using semi-transparent strokes for better map visibility
    strokeWeight(3);
    for(let d of drawings){
      if(hideAll && d.userId !== myUserId) continue;
      
      // Parse the color string and adjust alpha for transparency
      let col = color(d.color);
      let h = hue(col);
      let s = saturation(col);
      let b = brightness(col);
      stroke(h, s, b, 0.5); // 50% transparency for all strokes
      
      let start = myMap.latLngToPixel(d.lat1, d.lng1);
      let end = myMap.latLngToPixel(d.lat2, d.lng2);
      line(start.x, start.y, end.x, end.y);
    }

    // Clear drawLayer and ONLY draw the current user's active stroke
    // Also make current stroke semi-transparent
    drawLayer.clear();
    if(currentStroke.length > 0){
      drawLayer.stroke(myColor);
      drawLayer.strokeWeight(3);
      drawLayer.noFill();
      drawLayer.beginShape();
      for(let p of currentStroke) drawLayer.vertex(p.x, p.y);
      drawLayer.endShape();
    }
    
    // Draw the drawLayer on top (only contains current stroke)
    image(drawLayer, 0, 0);
    
    // Show white boundary highlight in draw mode if bounds are set
    if (drawMode && frozenBounds) {
      let tl = myMap.latLngToPixel(frozenBounds.latMax, frozenBounds.lonMin);
      let br = myMap.latLngToPixel(frozenBounds.latMin, frozenBounds.lonMax);
      
      // Draw very thin white boundary box at the edge
      push();
      noFill();
      
      // SINGLE THIN WHITE LINE - FIXED COLOR
      stroke(255, 255, 255); // Pure white, no alpha
      strokeWeight(1); // Very thin line
      
      // Draw rectangle at exact edge coordinates
      rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      
      pop();
    }
  }

  // Draw start screen overlay if needed
  if (showStartScreen) {
    drawStartScreen();
  }

  // Draw hue slider
  if(drawMode && hueSliderVisible && !showStartScreen){
    handleHueSlider();
    drawRainbowSlider();
  }
}

// ----------------- start screen overlay -----------------
function drawStartScreen() {
  push();
  
  // FIX: Use RGB color mode for gradient to avoid HSB issues
  colorMode(RGB, 255);
  
  // Blue to green gradient background
  for (let i = 0; i < height; i++) {
    let inter = map(i, 0, height, 0, 1);
    // Blue (30, 100, 200) to Green (50, 200, 150) in RGB
    let r = lerp(30, 50, inter);
    let g = lerp(100, 200, inter);
    let b = lerp(200, 150, inter);
    stroke(r, g, b);
    line(0, i, width, i);
  }
  
  // Subtle grid pattern - smaller spacing for mobile
  stroke(255, 255, 255, 20);
  strokeWeight(1);
  let gridSize = min(40, width / 15); // Responsive grid size
  for (let x = 0; x < width; x += gridSize) {
    line(x, 0, x, height);
  }
  for (let y = 0; y < height; y += gridSize) {
    line(0, y, width, y);
  }
  
  textFont('monospace');
  textAlign(CENTER, CENTER);
  
  // Calculate responsive sizes for mobile
  let titleSize = min(48, width / 8);
  let subtitleSize = min(20, width / 20);
  let descSize = min(14, width / 30);
  // REMOVED: tapSize variable since we're removing the tap anywhere text
  
  // Title with black text and white shadow
  // White shadow
  fill(255, 255, 255, 200);
  noStroke();
  textSize(titleSize);
  text(titleName, width/2 + 2, height/4 + 2);
  
  // Black main title
  fill(0, 0, 0);
  text(titleName, width/2, height/4);
  
  // Subtitle with black text and white shadow
  // White shadow
  fill(255, 255, 255, 200);
  textSize(subtitleSize);
  text("REAL-TIME GPS CANVAS", width/2 + 1, height/4 + titleSize + 10);
  
  // Black subtitle
  fill(0, 0, 0);
  text("REAL-TIME GPS CANVAS", width/2, height/4 + titleSize + 9);
  
  // Description box - shorter height for mobile
  let boxWidth = min(500, width - 40);
  let boxHeight = min(120, height/4); // Shorter box
  
  // White box with black border
  fill(255, 255, 255, 220);
  stroke(0, 0, 0, 150);
  strokeWeight(2);
  rectMode(CENTER);
  rect(width/2, height/2, boxWidth, boxHeight, 15);
  
  // Shorter description text with black color
  fill(0, 0, 0);
  noStroke();
  textSize(descSize);
  textAlign(CENTER, CENTER);
  text("draw on maps with others in real-time\n" +
       "artwork anchored to gps locations\n" +
       "collaborate and explore", 
       width/2, height/2);
  
  // REMOVED: "Tap anywhere to start" text at bottom
  // This section has been deleted
  
  // Switch back to HSB for other drawing
  colorMode(HSB, 360, 100, 100, 1);
  
  pop();
}

// ----------------- mouse pressed for overlay -----------------
function mousePressed() {
  // If start screen is showing and user clicks anywhere, hide it
  if (showStartScreen) {
    showStartScreen = false;
    // Show all control buttons
    for (let btn of controlButtons) {
      btn.show();
    }
  }
}

// ----------------- rainbow slider functions -----------------
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
    myColor = color(hueValue, 100, 100, 0.5); // 50% transparency
  }
}

// ----------------- drawing functions -----------------
function touchMoved() {
  // Skip if interacting with slider
  if (
    mouseY >= hueSliderY &&
    mouseY <= hueSliderY + hueSliderHeight &&
    mouseX >= hueSliderX &&
    mouseX <= hueSliderX + hueSliderWidth
  ) return false;

  if (mapInit && drawMode && frozenBounds && !showStartScreen) {
    // Get map coordinates
    let pos1 = myMap.pixelToLatLng(pmouseX, pmouseY);
    let pos2 = myMap.pixelToLatLng(mouseX, mouseY);

    // Constrain drawing to frozen bounds
    if(pos2.lat > frozenBounds.latMax || pos2.lat < frozenBounds.latMin || 
       pos2.lng < frozenBounds.lonMin || pos2.lng > frozenBounds.lonMax) return false;

    // Store current position for visual feedback
    currentStroke.push({ x: mouseX, y: mouseY });

    // Create drawing segment with semi-transparent color
    let lineSeg = {
      lat1: pos1.lat,
      lng1: pos1.lng,
      lat2: pos2.lat,
      lng2: pos2.lng,
      color: myColor.toString(),
      userId: myUserId
    };
    
    // Add to local array and send to server
    drawings.push(lineSeg);
    socket.emit("newDrawing", lineSeg);
  }
  return false;
}

function touchEnded() {
  if (!mapInit || !drawMode || currentStroke.length === 0 || showStartScreen) return;

  // Save current stroke as PNG
  let filename = `drawing-${myUserId}-${Date.now()}.png`;
  
  // Mark drawings with filename
  for(let d of drawings){
    if(d.userId === myUserId && !d.file){
      d.file = filename;
    }
  }

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

  // Clear current stroke
  currentStroke = [];
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
  hueSliderY = windowHeight - 60; // Updated to match the new position
  undoBtn.position(windowWidth - 70, windowHeight - 40);
  
  // Reposition all buttons on resize
  for (let btn of controlButtons) {
    if (btn === gpsBtn) {
      btn.position(20, 70);
    } else if (btn === modeBtn) {
      btn.position(20, 20);
    } else if (btn === clearMineBtn) {
      btn.position(windowWidth - 140, 20);
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

function handleNewPosition(pos){
  let lonlat = fixForChineseMap(pos);
  currentLongitude = lonlat[0];
  currentLatitude = lonlat[1];
  if(mapInit) updateMapContent();
  socket.emit("updateLocation",{lat:currentLatitude,lng:currentLongitude});
}

function updateMapContent(){
  let myPosOnCanvas = myMap.latLngToPixel(currentLatitude,currentLongitude);
  me.goalX = myPosOnCanvas.x;
  me.goalY = myPosOnCanvas.y;
}

class MyPoint{
  constructor(){
    this.x = 0; this.y = 0;
    this.goalX = 0; this.goalY = 0;
    this.size = 14;
    this.col = color(170,240,190);
  }
  update(){
    this.x = lerp(this.x,this.goalX,0.2);
    this.y = lerp(this.y,this.goalY,0.2);
  }
  display(){
    push();
    translate(this.x,this.y);
    fill(this.col);
    stroke("pink");
    strokeWeight(3);
    let dia = this.size + sin(frameCount*0.1);
    circle(0,0,dia);
    pop();
  }
}