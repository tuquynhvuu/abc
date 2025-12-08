let mappa = new Mappa("Leaflet");
let myMap;
let canvas;

let currentLatitude = 0;
let currentLongitude = 0;
let mapInit = false;
let me;

let drawMode = true; // default
let drawings = [];
let myColor;
let socket;

// Store frozen map bounds
let frozenBounds = null;

// Store color buttons for repositioning on resize
let colorButtons = [];

// Initialize socket.io
if(location.hostname.toLowerCase().startsWith('browsercircus')){
  socket = io({path: "/YOURPATH-and-PORT/socket.io"});
}else{
  socket = io();
}

// Map options (China-friendly normal map)
let mappa_options = {
  lat: 0,
  lng: 0,
  zoom: 16,
  style: "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}"
};

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");

  me = new MyPoint();

  myColor = color(255,0,0); // default color red

  // Load drawings from localStorage
  let saved = localStorage.getItem("gpsDrawings");
  if(saved) drawings = JSON.parse(saved);

  // Socket events
  socket.emit("joinUser");
  socket.on("allDrawings", data => { drawings = data; });
  socket.on("newDrawing", point => { drawings.push(point); localStorage.setItem("gpsDrawings", JSON.stringify(drawings)); });

  // Draw/View toggle button
  const btn = createButton("Switch to View Mode");
  btn.position(20, 70);
  btn.style('z-index', '10');
  btn.style('background-color', '#00c3ff');
  btn.style('color', 'white');
  btn.style('border-radius', '10px');
  btn.style('padding', '10px 15px');
  btn.mousePressed(()=>{
    drawMode = !drawMode;
    if(drawMode){
      btn.html("Switch to View Mode");
      if(mapInit) freezeMap();
    } else {
      btn.html("Switch to Draw Mode");
      if(mapInit) unfreezeMap();
    }
  });

  // Color palette buttons at bottom
  const colors = ["red","blue","green","yellow","purple","orange"];
  colors.forEach((c,i)=>{
    let btn = createButton('');
    btn.size(50,50);
    btn.position(20 + i*60, windowHeight - 70);
    btn.style('background-color', c);
    btn.style('border', '2px solid white');
    btn.style('border-radius', '25px'); // circular
    btn.style('z-index','20');
    btn.mousePressed(() => {
      myColor = color(c);
    });
    colorButtons.push(btn);
  });
}

function draw() {
  clear();

  // Initialize map after GPS
  if(!mapInit && GPS_GRANTED && currentLongitude != 0){
    console.log("starting map");
    mappa_options.lat = currentLatitude;
    mappa_options.lng = currentLongitude;
    mappa_options.subdomains = "1234"; // important for Gaode tiles
    myMap = mappa.tileMap(mappa_options);
    myMap.overlay(canvas);
    myMap.onChange(updateMapContent);
    mapInit = true;

    // Freeze map coordinates
    setTimeout(() => {
      freezeMap();
      let tl = myMap.pixelToLatLng(0,0);
      let br = myMap.pixelToLatLng(width, height);
      frozenBounds = {latMax: tl.lat, latMin: br.lat, lonMin: tl.lng, lonMax: br.lng};
    }, 100);
  }

  if(mapInit){
    me.update();
    me.display();

    // Draw all stored drawings based on lat/lng
    strokeWeight(3);
    for(let d of drawings){
      stroke(d.color);
      let start = myMap.latLngToPixel(d.lat1, d.lng1);
      let end = myMap.latLngToPixel(d.lat2, d.lng2);
      line(start.x, start.y, end.x, end.y);
    }
  }
}

// Draw mode: store lat/lng
function touchMoved() {
  if(mapInit && drawMode && frozenBounds){
    let pos1 = myMap.pixelToLatLng(pmouseX, pmouseY);
    let pos2 = myMap.pixelToLatLng(mouseX, mouseY);

    // Keep drawing within frozen bounds
    if(pos2.lat <= frozenBounds.latMax && pos2.lat >= frozenBounds.latMin &&
       pos2.lng >= frozenBounds.lonMin && pos2.lng <= frozenBounds.lonMax){

      let lineSeg = {
        lat1: pos1.lat,
        lng1: pos1.lng,
        lat2: pos2.lat,
        lng2: pos2.lng,
        color: myColor.toString()
      };

      drawings.push(lineSeg);
      localStorage.setItem("gpsDrawings", JSON.stringify(drawings));
      socket.emit("newDrawing", lineSeg);
    }
  }
  return false;
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

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
  // reposition color buttons
  colorButtons.forEach((btn,i)=>{
    btn.position(20 + i*60, windowHeight - 70);
  });
}

function handleNewPosition(pos){
  let lonlat = fixForChineseMap(pos);
  currentLongitude = lonlat[0];
  currentLatitude = lonlat[1];
  if(mapInit) updateMapContent();
  socket.emit("updateLocation", {lat: currentLatitude, lng: currentLongitude});
}

function updateMapContent(){
  let myPosOnCanvas = myMap.latLngToPixel(currentLatitude, currentLongitude);
  me.goalX = myPosOnCanvas.x;
  me.goalY = myPosOnCanvas.y;
}

class MyPoint{
  constructor(){
    this.x = 0;
    this.y = 0;
    this.goalX = 0;
    this.goalY = 0;
    this.size = 14;
    this.col = color(170, 240, 190);
  }
  update(){
    this.x = lerp(this.x, this.goalX, 0.2);
    this.y = lerp(this.y, this.goalY, 0.2);
  }
  display(){
    push();
    translate(this.x, this.y);
    fill(this.col);
    stroke("pink");
    strokeWeight(3);
    let dia = this.size + sin(frameCount*0.1);
    circle(0, 0, dia);
    pop();
  }
}
