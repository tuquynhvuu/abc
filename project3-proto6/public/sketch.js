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
let drawings = []; // realtime small segments for live drawing
let myColor;
let frozenBounds = null; // bounds of map when first frozen

// ----- draw-mode lock variables -----
let lockedCenter = null; // lat/lng of initial viewport
let lockedZoom = null;   // zoom of initial viewport
let lockedBounds = null; // exact bounds in lat/lng for draw mode
let drawModeReady = false; // flag to ensure viewport is fully locked
let justSwitchedToDrawMode = false; // ADD THIS: track when we just switched to draw mode

// ----- button storage -----
let controlButtons = [];
let undoBtn;

// --- custom rainbow slider ---
let hueSliderX = 20;
let hueSliderY;
let hueSliderWidth = 300;
let hueSliderHeight = 20;
let hueValue = 0;
let draggingSlider = false;
let hueSliderVisible = true;

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
  myColor = color(0, 100, 100, 0.75);

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

  socket.on("allDrawings", data => { drawings = data || []; });
  socket.on("newDrawing", point => { drawings.push(point); });

  // --- mode button ---
  const btn = createButton("switch to view mode");
  btn.position(20,20);
  btn.style('z-index','10');
  btn.style('background-color','#00c3ff');
  btn.style('color','white');
  btn.style('border-radius','10px');
  btn.style('padding','10px 15px');
  btn.mousePressed(()=>{
    drawMode = !drawMode;
    if(drawMode){ 
      btn.html("switch to view mode"); 
      hueSliderVisible = true;
      undoBtn.show();
      if(mapInit && lockedCenter && drawModeReady){
        justSwitchedToDrawMode = true; // SET THE FLAG
      }
    } else { 
      btn.html("switch to draw mode"); 
      hueSliderVisible = false;
      undoBtn.hide();
      if(mapInit) unfreezeMap();
    }
  });
  controlButtons.push(btn);

  // --- clear mine button --- (MOVED TO FAR RIGHT)
  const clearMineBtn = createButton("clear my drawings");
  clearMineBtn.position(windowWidth - 200, 20);
  clearMineBtn.style('background-color','#ff4444');
  clearMineBtn.style('color','white');
  clearMineBtn.style('border-radius','10px');
  clearMineBtn.style('padding','10px 15px');
  clearMineBtn.mousePressed(() => { 
    socket.emit("clearMyImages", myUserId); 
    drawings = drawings.filter(d => d.userId !== myUserId);
    currentStroke = [];
  });
  controlButtons.push(clearMineBtn);

  // --- hide/show toggle --- (MOVED TO FAR RIGHT)
  const toggleHideBtn = createButton("hide all drawings");
  toggleHideBtn.position(windowWidth - 200, 60);
  toggleHideBtn.style('background-color','#aa00ff');
  toggleHideBtn.style('color','white');
  toggleHideBtn.style('border-radius','10px');
  toggleHideBtn.style('padding','10px 15px');
  toggleHideBtn.mousePressed(() => {
      hideAll = !hideAll;
      toggleHideBtn.html(hideAll ? "show all drawings" : "hide all drawings");
  });
  controlButtons.push(toggleHideBtn);

  // --- undo button --- (MOVED TO FAR RIGHT)
  undoBtn = createButton("Undo");
  undoBtn.position(windowWidth - 200, 100);
  undoBtn.style('background-color','#ffaa00');
  undoBtn.style('color','white');
  undoBtn.style('border-radius','10px');
  undoBtn.style('padding','10px 15px');
  undoBtn.mousePressed(() => {
    socket.emit("deleteLastImage", myUserId);
  });
  controlButtons.push(undoBtn);

  socket.emit("joinUser");
}

// ---------------------- MAIN DRAW LOOP ----------------------
// ---------------------- MAIN DRAW LOOP ----------------------
function draw() {
  clear();

  // Don't update hueSliderY here - it's calculated in the drawRainbowSlider function
  // using windowHeight directly

  if(!mapInit && typeof GPS_GRANTED !== 'undefined' && GPS_GRANTED && currentLongitude != 0){
    mappa_options.lat = currentLatitude;
    mappa_options.lng = currentLongitude;
    mappa_options.subdomains = "1234";
    myMap = mappa.tileMap(mappa_options);
    myMap.overlay(canvas);
    myMap.onChange(updateMapContent);
    mapInit = true;

    setTimeout(() => {
      lockedCenter = {lat: currentLatitude, lng: currentLongitude};
      lockedZoom = myMap.map.getZoom();
      let tl = myMap.pixelToLatLng(0,0);
      let br = myMap.pixelToLatLng(width,height);
      lockedBounds = {latMax: tl.lat, latMin: br.lat, lonMin: tl.lng, lonMax: br.lng};
      drawModeReady = true;
      if(drawMode) freezeMap();
    },100);
  }

  if(mapInit){
    // ONLY reset map when we just switched to draw mode
    if(drawMode && justSwitchedToDrawMode && lockedCenter && drawModeReady){
      myMap.map.setView([lockedCenter.lat, lockedCenter.lng], lockedZoom, {animate:false});
      freezeMap();
      justSwitchedToDrawMode = false; // RESET THE FLAG
    } else if(!drawMode){
      unfreezeMap();
    }

    me.update();
    me.display();

    // draw server images
    for (let meta of imagesMeta) {
      let img = loadedImages[meta.file];
      if (!img) continue;
      if(hideAll && meta.userId !== myUserId) continue;
      let tl = myMap.latLngToPixel(meta.latMax, meta.lonMin);
      let br = myMap.latLngToPixel(meta.latMin, meta.lonMax);
      image(img, tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

    // draw all strokes to canvas
    strokeWeight(3);
    for(let d of drawings){
      if(hideAll && d.userId !== myUserId) continue;
      stroke(d.color);
      let s = myMap.latLngToPixel(d.lat1,d.lng1);
      let e = myMap.latLngToPixel(d.lat2,d.lng2);
      line(s.x,s.y,e.x,e.y);
    }

    // draw current stroke to drawLayer
    drawLayer.clear();
    drawLayer.strokeWeight(3);
    for(let d of drawings){
      if(hideAll && d.userId !== myUserId) continue;
      drawLayer.stroke(d.color);
      let s = myMap.latLngToPixel(d.lat1,d.lng1);
      let e = myMap.latLngToPixel(d.lat2,d.lng2);
      drawLayer.line(s.x, s.y, e.x, e.y);
    }

    if(currentStroke.length > 0){
      drawLayer.stroke(myColor);
      drawLayer.noFill();
      drawLayer.beginShape();
      for(let p of currentStroke) drawLayer.vertex(p.x, p.y);
      drawLayer.endShape();
    }

    image(drawLayer,0,0);
  }

  if(drawMode && hueSliderVisible){
    handleHueSlider();
    drawRainbowSlider();
  }
}

// ----------------- rainbow slider functions -----------------
// ----------------- rainbow slider functions -----------------
function drawRainbowSlider() {
  push();
  // Draw slider at absolute screen coordinates (not affected by map)
  // Use windowHeight directly to ensure it's at bottom of screen
  let sliderBottomY = windowHeight - 40;
  let sliderLeftX = 20;
  
  noStroke();
  for (let i = 0; i < hueSliderWidth; i++) {
    let h = map(i, 0, hueSliderWidth, 0, 360);
    fill(h, 100, 100);
    rect(sliderLeftX + i, sliderBottomY, 1, hueSliderHeight);
  }
  stroke(255);
  strokeWeight(2);
  fill(0,0,100);
  let handleX = map(hueValue, 0, 360, sliderLeftX, sliderLeftX + hueSliderWidth);
  rect(handleX-5, sliderBottomY-5, 10, hueSliderHeight+10);
  pop();
}

function handleHueSlider() {
  // Calculate slider position using windowHeight, not canvas coordinates
  let sliderBottomY = windowHeight - 40;
  let sliderLeftX = 20;
  
  let overSlider =
    mouseY >= sliderBottomY &&
    mouseY <= sliderBottomY + hueSliderHeight &&
    mouseX >= sliderLeftX &&
    mouseX <= sliderLeftX + hueSliderWidth;

  if (mouseIsPressed && overSlider) draggingSlider = true;
  if (!mouseIsPressed) draggingSlider = false;

  if (draggingSlider) {
    let mx = constrain(mouseX, sliderLeftX, sliderLeftX + hueSliderWidth);
    hueValue = map(mx, sliderLeftX, sliderLeftX + hueSliderWidth, 0, 360);
    myColor = color(hueValue, 100, 100, 0.75);
  }
}

// ----------------- drawing functions -----------------
function touchMoved() {
  if (
    mouseY >= hueSliderY &&
    mouseY <= hueSliderY + hueSliderHeight &&
    mouseX >= hueSliderX &&
    mouseX <= hueSliderX + hueSliderWidth
  ) return false;

  if (mapInit && drawMode) {
    let pos1 = myMap.pixelToLatLng(pmouseX, pmouseY);
    let pos2 = myMap.pixelToLatLng(mouseX, mouseY);

    currentStroke.push({ x: mouseX, y: mouseY });

    let lineSeg = {
      lat1: pos1.lat,
      lng1: pos1.lng,
      lat2: pos2.lat,
      lng2: pos2.lng,
      color: myColor.toString(),
      userId: myUserId
    };
    drawings.push(lineSeg);
    socket.emit("newDrawing", lineSeg);
  }
  return false;
}

function touchEnded() {
  if (!mapInit || !drawMode || currentStroke.length === 0) return;

  let filename = `drawing-${myUserId}-${Date.now()}.png`;

  drawings = drawings.map(d => {
    if (d.userId === myUserId && !d.file) d.file = filename;
    return d;
  });

  let dataURL = drawLayer.elt.toDataURL("image/png");

  let meta = { 
    file: filename, 
    userId: myUserId, 
    timestamp: Date.now(),
    latMax: lockedBounds.latMax, 
    latMin: lockedBounds.latMin,
    lonMin: lockedBounds.lonMin, 
    lonMax: lockedBounds.lonMax,
    width: drawLayer.width, 
    height: drawLayer.height 
  };

  socket.emit("savePNG", { image:dataURL, meta:meta });

  currentStroke = [];
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
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