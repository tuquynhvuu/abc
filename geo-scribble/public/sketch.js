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
let gpsBtn; 
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
  // try to get existing id
  let id = localStorage.getItem("chat-user-id");
  if(!id){
    // create new id with timestamp and random letters
    id = "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
    // save to browser storage
    localStorage.setItem("chat-user-id", id);
  }
  return id;
}

// store user id for this session
const myUserId = getOrCreateUserId();

//
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
// extra layer for current drawing
let drawLayer; 
// store current drawing stroke points ( will be turned into png)
let currentStroke = []; 
// info about saved png images
let imagesMeta = []; 
// loaded png images from server
let loadedImages = {}; 

// hide drawings from other users
let hideAll = false;

function preload() {}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");

  // create extra drawing layer
  drawLayer = createGraphics(windowWidth, windowHeight);
  // clear the layer
  drawLayer.clear();

  colorMode(HSB, 360, 100, 100, 1);
  // starting color w transparency to see map
  myColor = color(0, 100, 100, 0.5); 
  me = new MyPoint();

  // load all images from server 
  function reloadImages(metaList) {
    // store image info
    imagesMeta = metaList || [];
    // clear old images
    loadedImages = {};
    //load each image
    imagesMeta.forEach(m => {
      if (!loadedImages[m.file]) loadedImages[m.file] = loadImage("/drawings/" + m.file);
    });
    // clear current stroke
    currentStroke = [];
  }

  // when server sends all saved images
  socket.on("allImages", reloadImages);

  // when new image is saved by anyone
  socket.on("newImage", (meta) => {
    // add to image list and load it
    imagesMeta.push(meta);
    if (!loadedImages[meta.file]) loadedImages[meta.file] = loadImage("/drawings/" + meta.file);
  });

  // when image is deleted -> remove from everhthing
  socket.on("deleteImage", (filename) => {
    imagesMeta = imagesMeta.filter(m => m.file !== filename);
    delete loadedImages[filename];
    drawings = drawings.filter(d => d.file !== filename);
  });

  // when server sends all drawing lines
  socket.on("allDrawings", data => { 
    // only show other users' drawings, not your own
    drawings = data.filter(d => d.userId !== myUserId) || []; 
  });
  
  // when new drawing line is created
  socket.on("newDrawing", point => { 
    // only add drawings from other users
    if(point.userId !== myUserId) {
      drawings.push(point);
    }
  });

  // button to center on user location (old gps button)
  gpsBtn = createButton("my location");
  gpsBtn.position(20, 70);
  gpsBtn.style('z-index','10');
  gpsBtn.style('background-color','#2196F3');
  gpsBtn.style('color','white');
  gpsBtn.style('border-radius','10px');
  gpsBtn.style('padding','8px 10px');
  gpsBtn.style('font-family','monospace');
  gpsBtn.style('font-size','10px');
  // hide for overlay
  gpsBtn.hide(); 
  gpsBtn.mousePressed(() => {
    // If GPS not granted yet, request it
  if (typeof GPS_GRANTED === 'undefined' || !GPS_GRANTED) {
    if (typeof requestGPS === 'function') {
      requestGPS();
    } else {
      console.error("requestGPS function not found!");
    }
  } else if(mapInit && currentLatitude !== 0 && currentLongitude !== 0){
      myMap.map.setView([currentLatitude, currentLongitude], 16);
      if(drawMode){
        setTimeout(() => {
          freezeMap();
        }, 100);
      }
    }
  });
  controlButtons.push(gpsBtn);

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
      // freeze map for draw mode (default)
      freezeMap();
    } else { 
      // switch to view mode
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
    //precaution
    if(confirm("WARNING: this will delete ALL drawings from EVERYONE, including your own. Are you sure?")) {
      // tell server to clear everything
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
    // tell server to delete last image
    socket.emit("deleteLastImage", myUserId);
  });
  controlButtons.push(undoBtn);

  // tell server you joined
  socket.emit("joinUser");
}

function draw() {
  // clear canvas each frame
  clear();

  // fixed pos for hue slider 
  hueSliderX = 20;
  hueSliderY = windowHeight - 60; 

  // if map not ready, but gps granted and location available
  if(!mapInit && typeof GPS_GRANTED !== 'undefined' && GPS_GRANTED && currentLongitude != 0){
    // set map to user location
    mappa_options.lat = currentLatitude;
    mappa_options.lng = currentLongitude;
    mappa_options.subdomains = "1234";

    // create the map
    myMap = mappa.tileMap(mappa_options);

    // overlay canvas on map
    myMap.overlay(canvas);
    // update when map moves
    myMap.onChange(updateMapContent);
    mapInit = true;
    
    // set up drawing area after short delay
    setTimeout(() => {
      if(drawMode){
        // freeze map for drawing
        freezeMap();
        
        // set drawing boundaries once
        if(!boundsInitialized){
          // get top-left corner of screen
          let tl = myMap.pixelToLatLng(0,0);
          // get bottom-right corner of screen
          let br = myMap.pixelToLatLng(width, height);
          // store drawing boundaries
          frozenBounds = {latMax: tl.lat, latMin: br.lat, lonMin: tl.lng, lonMax: br.lng};
          // boundaries are now set
          boundsInitialized = true;
        }
      }
    }, 100);
  }

  // if map is ready
  if(mapInit){
    // update nd draw user marker position
    me.update();
    me.display();

    // draw server pngs 
    for (let meta of imagesMeta) {
      let img = loadedImages[meta.file];
      if (!img) continue;
      // skip if hiding others' drawings
      if(hideAll && meta.userId !== myUserId) continue;
      // convert gps coordinates to screen position
      //top left & bot right mapping
      let tl = myMap.latLngToPixel(meta.latMax, meta.lonMin);
      let br = myMap.latLngToPixel(meta.latMin, meta.lonMax);
      // draw the saved png image
      image(img, tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

    // draw all current strokes from all users on canvas
    strokeWeight(3);
    for(let d of drawings){
      // skip if hiding others' drawings
      if(hideAll && d.userId !== myUserId) continue;
      
      // get color from drawing data
      let col = color(d.color);
      let h = hue(col);
      let s = saturation(col);
      let b = brightness(col);
      stroke(h, s, b, 0.5); 
      
      // convert gps to screen positions
      let start = myMap.latLngToPixel(d.lat1, d.lng1);
      let end = myMap.latLngToPixel(d.lat2, d.lng2);
      // draw the line
      line(start.x, start.y, end.x, end.y);
    }

    // Clear drawLayer and only draw the current users active stroke
    drawLayer.clear();
    if(currentStroke.length > 0){
      // use current color
      drawLayer.stroke(myColor);
      drawLayer.strokeWeight(3);
      drawLayer.noFill();
      // start drawing shape
      drawLayer.beginShape();
      // add each point in current stroke
      for(let p of currentStroke) drawLayer.vertex(p.x, p.y);
      drawLayer.endShape();
    }
    
    // draw the drawLayer on top (only contains current stroke)
    image(drawLayer, 0, 0);
    
    // shw boundary in draw mode if bounds are set
    if (drawMode && frozenBounds) {
      // get corners of boundary
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
  
  // use rgb colors for gradient bc hsb troublesome
  colorMode(RGB, 255);
  
  // gradient bg
  for (let i = 0; i < height; i++) {
    // calculate position in grad
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
  
  // calc responsive des for mobile
  let titleSize = min(48, width / 8);
  let subtitleSize = min(20, width / 20);
  let descSize = min(14, width / 30);
  
  // txt
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
  
  // descrip box
  let boxWidth = min(500, width - 40);
  let boxHeight = min(120, height/4); 
  
  fill(255, 255, 255, 220);
  stroke(0, 0, 0, 150);
  strokeWeight(2);
  rectMode(CENTER);
  rect(width/2, height/2, boxWidth, boxHeight, 15);
  
  // descrip text
  fill(0, 0, 0);
  noStroke();
  textSize(descSize);
  textAlign(CENTER, CENTER);
  text("draw on maps with others in real-time\n" +
       "artwork anchored to gps locations\n" +
       "collaborate and explore", 
       width/2, height/2);
  
  // switch back to hsb for drawing
  colorMode(HSB, 360, 100, 100, 1);
  
  // restore drawing state
  pop();
}

// handle mouse/touch on start screen
function mousePressed() {
  if (showStartScreen) {
    showStartScreen = false;
    for (let btn of controlButtons) {
      btn.show();
    }
  }
}

// draw the rainbow color stroke slider
function drawRainbowSlider() {
  push();
  translate(0, 0);
  noStroke();
  for (let i = 0; i < hueSliderWidth; i++) {
    // calculate hue for pos
    let h = map(i, 0, hueSliderWidth, 0, 360);
    fill(h, 100, 100);
    rect(hueSliderX + i, hueSliderY, 1, hueSliderHeight);
  }
  // slider handle
  stroke(255);
  strokeWeight(2);
  fill(0,0,100);
  // calculate handle position
  let handleX = map(hueValue, 0, 360, hueSliderX, hueSliderX + hueSliderWidth);
  rect(handleX-5, hueSliderY-5, 10, hueSliderHeight+10);
  pop();
}

// handle color slider interaction
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
    // calc hue value from mouse position
    hueValue = map(mx, hueSliderX, hueSliderX + hueSliderWidth, 0, 360);
    // update draw col
    myColor = color(hueValue, 100, 100, 0.5); 
  }
}

// handle drawing when finger/mouse moves
function touchMoved() {
  // no drawing over slider
  if (
    mouseY >= hueSliderY &&
    mouseY <= hueSliderY + hueSliderHeight &&
    mouseX >= hueSliderX &&
    mouseX <= hueSliderX + hueSliderWidth
  ) return false;

  if (mapInit && drawMode && frozenBounds && !showStartScreen) {
    // get gps coordinates from mouse positions
    let pos1 = myMap.pixelToLatLng(pmouseX, pmouseY);
    let pos2 = myMap.pixelToLatLng(mouseX, mouseY);

    // constrain drawing to frozen bounds & check if outside drawing area
    if(pos2.lat > frozenBounds.latMax || pos2.lat < frozenBounds.latMin || 
       pos2.lng < frozenBounds.lonMin || pos2.lng > frozenBounds.lonMax) return false;

    // store current position for visual feedback
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
    
    socket.emit("newDrawing", lineSeg);
  }
  return false;
}

// handle when drawing ends
function touchEnded() {
  // if not ready to save drawing
  if (!mapInit || !drawMode || currentStroke.length === 0 || showStartScreen) return;

  // save current stroke as PNG
  // create filename with user id and timestamp
  let filename = `drawing-${myUserId}-${Date.now()}.png`;
  
  // convert drawing layer to png data
  let dataURL = drawLayer.elt.toDataURL("image/png");

  // info about drawing
  let meta = { 
    // filename
    file: filename, 
    // who 
    userId: myUserId, 
    // when
    timestamp: Date.now(),
    // boundaries
    latMax: frozenBounds.latMax, 
    latMin: frozenBounds.latMin,
    lonMin: frozenBounds.lonMin, 
    lonMax: frozenBounds.lonMax,
    //  size
    width: drawLayer.width, 
    height: drawLayer.height 
  };

  // send png to server for saving
  socket.emit("savePNG", { image: dataURL, meta: meta });

  // clear current stroke
  currentStroke = [];
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
  hueSliderY = windowHeight - 60; 
  undoBtn.position(windowWidth - 60, windowHeight - 65);
  
  // Reposition all buttons on resize
  for (let btn of controlButtons) {
    if (btn === gpsBtn) {
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

// freeze map interactions for draw mode
function freezeMap(){
  if(!mapInit) return;
  // disable all controls
  myMap.map.dragging.disable();
  myMap.map.touchZoom.disable();
  myMap.map.doubleClickZoom.disable();
  myMap.map.scrollWheelZoom.disable();
  myMap.map.boxZoom.disable();
  myMap.map.keyboard.disable();
}

// unfreeze map interactions for view mode
function unfreezeMap(){
  if(!mapInit) return;
  // enable all controls
  myMap.map.dragging.enable();
  myMap.map.touchZoom.enable();
  myMap.map.doubleClickZoom.enable();
  myMap.map.scrollWheelZoom.enable();
  myMap.map.boxZoom.enable();
  myMap.map.keyboard.enable();
}



// update map when location changes
function updateMapContent(){
  // convert gps to screen position
  let myPosOnCanvas = myMap.latLngToPixel(currentLatitude,currentLongitude);
  // update user marker target position
  me.goalX = myPosOnCanvas.x;
  me.goalY = myPosOnCanvas.y;
}

// user location marker class
class MyPoint{
  constructor(){
    this.x = 0; this.y = 0;
    this.goalX = 0; this.goalY = 0;
    this.size = 14;
    this.col = color(170,240,190);
  }
  // smoothly move toward target position
  update(){
    this.x = lerp(this.x,this.goalX,0.2);
    this.y = lerp(this.y,this.goalY,0.2);
  }
  display(){
    push();
    translate(this.x,this.y);
    fill(this.col);
    stroke("black");
    strokeWeight(3);
    let dia = this.size + sin(frameCount*0.1);
    circle(0,0,dia);
    pop();
  }
}