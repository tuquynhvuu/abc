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
let drawings = []; 
let myColor;
let frozenBounds = null; 
let boundsInitialized = false; 

//buttons
let controlButtons = [];
let undoBtn;
let modeBtn; 
let hideBtn; 
let gpsBtn; 
let clearMineBtn; 
let clearAllBtn; 

// rainbow slider
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

// user id
function getOrCreateUserId() {
  let id = localStorage.getItem("chat-user-id");
  if(!id){
    id = "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
    localStorage.setItem("chat-user-id", id);
  }
  return id;
}
const myUserId = getOrCreateUserId();

// socket
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

// drawing
let drawLayer; 
let currentStroke = []; 
let imagesMeta = []; 
let loadedImages = {}; 
let hideAll = false;

function preload() {}

function setup() {
  console.log("🎨 Sketch setup starting...");
  
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");

  drawLayer = createGraphics(windowWidth, windowHeight);
  drawLayer.clear();

  colorMode(HSB, 360, 100, 100, 1);
  myColor = color(0, 100, 100, 0.5); 
  me = new MyPoint();

  // socket events (keep your existing ones)
  function reloadImages(metaList) {
    imagesMeta = metaList || [];
    loadedImages = {};
    imagesMeta.forEach(m => {
      if (!loadedImages[m.file]) loadedImages[m.file] = loadImage("/drawings/" + m.file);
    });
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
    drawings = data.filter(d => d.userId !== myUserId) || []; 
  });
  socket.on("newDrawing", point => { 
    if(point.userId !== myUserId) {
      drawings.push(point);
    }
  });

  // GPS button
  gpsBtn = createButton("Request GPS");
  gpsBtn.position(20, 70);
  gpsBtn.style('z-index','10');
  gpsBtn.style('background-color','#2196F3');
  gpsBtn.style('color','white');
  gpsBtn.style('border-radius','10px');
  gpsBtn.style('padding','8px 10px');
  gpsBtn.style('font-family','monospace');
  gpsBtn.style('font-size','10px');
  gpsBtn.hide(); 
  
  gpsBtn.mousePressed(() => {
    console.log("📍 GPS button clicked in sketch");
    if (typeof requestGPS === 'function') {
      requestGPS();
    }
  });
  controlButtons.push(gpsBtn);

  // Other buttons (keep your existing code for modeBtn, clearMineBtn, etc.)
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

  // ... keep your other button code ...

  socket.emit("joinUser");
  
  // AUTO-REQUEST GPS
  console.log("Auto-requesting GPS in 1 second...");
  setTimeout(() => {
    if (typeof requestGPS === 'function') {
      console.log("🚀 Calling requestGPS()...");
      requestGPS();
    } else {
      console.error("requestGPS not found!");
    }
  }, 1000);
}

function draw() {
  clear();

  hueSliderX = 20;
  hueSliderY = windowHeight - 60; 

  // SIMPLE CHECK: if we have coordinates, create map
  if(!mapInit && currentLatitude !== 0 && currentLongitude !== 0){
    console.log("🗺️ Creating map with location:", currentLatitude, currentLongitude);
    
    mappa_options.lat = currentLatitude;
    mappa_options.lng = currentLongitude;
    mappa_options.subdomains = "1234";

    myMap = mappa.tileMap(mappa_options);
    myMap.overlay(canvas);
    myMap.onChange(updateMapContent);
    mapInit = true;
    
    console.log("✅ Map created");
    
    setTimeout(() => {
      if(drawMode){
        freezeMap();
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

    // ... keep your drawing code ...
    for (let meta of imagesMeta) {
      let img = loadedImages[meta.file];
      if (!img) continue;
      if(hideAll && meta.userId !== myUserId) continue;
      let tl = myMap.latLngToPixel(meta.latMax, meta.lonMin);
      let br = myMap.latLngToPixel(meta.latMin, meta.lonMax);
      image(img, tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

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

// handle new gps position from browser
function handleNewPosition(pos){
  console.log("📍 handleNewPosition called with pos:", pos.coords);
  
  // convert coordinates
  let lonlat = fixForChineseMap(pos);
  currentLongitude = lonlat[0];
  currentLatitude = lonlat[1];
  
  console.log("📍 Updated to:", currentLatitude, currentLongitude);
  
  if(mapInit) updateMapContent();
  socket.emit("updateLocation",{lat:currentLatitude,lng:currentLongitude});
}

function updateMapContent(){
  let myPosOnCanvas = myMap.latLngToPixel(currentLatitude,currentLongitude);
  me.goalX = myPosOnCanvas.x;
  me.goalY = myPosOnCanvas.y;
}

// ... keep the rest of your functions (drawStartScreen, mousePressed, etc.) ...

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