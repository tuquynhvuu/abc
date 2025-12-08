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
let drawings = [];
let myColor;
let frozenBounds = null; // bounds of map when first frozen

// ----- button storage -----
let controlButtons = [];
let colorButtons = [];

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

function setup() {
  // create full screen canvas
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");

  // point to represent user
  me = new MyPoint();

  // default color red
  myColor = color(255,0,0);

  // load drawings from localstorage
  let saved = localStorage.getItem("gpsDrawings");
  if(saved) drawings = JSON.parse(saved);

  // ----- socket events -----
  socket.on("allDrawings", data => { 
      drawings = data; 
      localStorage.setItem("gpsDrawings", JSON.stringify(drawings));
  });
  socket.on("newDrawing", point => { 
      drawings.push(point); 
      localStorage.setItem("gpsDrawings", JSON.stringify(drawings));
  });
  socket.on("clearAllDrawings", () => {
      drawings = [];
      localStorage.setItem("gpsDrawings", JSON.stringify(drawings));
  });
  socket.on("clearMyDrawings", userId => {
      drawings = drawings.filter(d => d.userId !== userId);
      localStorage.setItem("gpsDrawings", JSON.stringify(drawings));
  });

  // ----- draw/view mode toggle button -----
  const btn = createButton("switch to view mode");
  btn.position(20,70);
  btn.style('z-index','10');
  btn.style('background-color','#00c3ff');
  btn.style('color','white');
  btn.style('border-radius','10px');
  btn.style('padding','10px 15px');
  btn.mousePressed(()=>{
    drawMode = !drawMode;
    if(drawMode){
      btn.html("switch to view mode");
      if(mapInit) freezeMap();
    } else {
      btn.html("switch to draw mode");
      if(mapInit) unfreezeMap();
    }
  });
  controlButtons.push(btn);

  // ----- clear my drawings button -----
  const clearMineBtn = createButton("clear my drawings");
  clearMineBtn.position(20,120);
  clearMineBtn.style('background-color','#ff4444');
  clearMineBtn.style('color','white');
  clearMineBtn.style('border-radius','10px');
  clearMineBtn.style('padding','10px 15px');
  clearMineBtn.mousePressed(() => {
      drawings = drawings.filter(d => d.userId !== myUserId);
      localStorage.setItem("gpsDrawings", JSON.stringify(drawings));
      socket.emit("clearMyDrawings", myUserId);
  });
  controlButtons.push(clearMineBtn);

  // ----- clear all drawings button -----
  const clearAllBtn = createButton("clear all drawings");
  clearAllBtn.position(20,170);
  clearAllBtn.style('background-color','#aa00ff');
  clearAllBtn.style('color','white');
  clearAllBtn.style('border-radius','10px');
  clearAllBtn.style('padding','10px 15px');
  clearAllBtn.mousePressed(() => {
      drawings = [];
      localStorage.setItem("gpsDrawings", JSON.stringify(drawings));
      socket.emit("clearAllDrawings");
  });
  controlButtons.push(clearAllBtn);

  // ----- show all drawings button -----
  const showAllBtn = createButton("show all drawings");
  showAllBtn.position(20,220);
  showAllBtn.style('background-color','#00ff44');
  showAllBtn.style('color','white');
  showAllBtn.style('border-radius','10px');
  showAllBtn.style('padding','10px 15px');
  showAllBtn.mousePressed(() => {
      drawMode = false; // temporarily view mode
      if(mapInit) unfreezeMap();
  });
  controlButtons.push(showAllBtn);

  // ----- color buttons at bottom -----
  const colors = ["red","blue","green","yellow","purple","orange"];
  colors.forEach((c,i)=>{
    let btn = createButton('');
    btn.size(50,50);
    btn.position(20 + i*60, windowHeight - 70);
    btn.style('background-color', c);
    btn.style('border', '2px solid white');
    btn.style('border-radius','25px'); // circular
    btn.style('z-index','20');
    btn.mousePressed(() => { myColor = color(c); });
    colorButtons.push(btn);
  });
}

function draw() {
  clear();

  // ----- initialize map after gps -----
  if(!mapInit && GPS_GRANTED && currentLongitude != 0){
    console.log("starting map");
    mappa_options.lat = currentLatitude;
    mappa_options.lng = currentLongitude;
    mappa_options.subdomains = "1234";
    myMap = mappa.tileMap(mappa_options);
    myMap.overlay(canvas);
    myMap.onChange(updateMapContent);
    mapInit = true;

    // freeze map coordinates after first load
    setTimeout(() => {
      freezeMap();
      let tl = myMap.pixelToLatLng(0,0);
      let br = myMap.pixelToLatLng(width,height);
      frozenBounds = {latMax: tl.lat, latMin: br.lat, lonMin: tl.lng, lonMax: br.lng};
    },100);
  }

  if(mapInit){
    // update and draw user point
    me.update();
    me.display();

    // draw all stored drawings based on lat/lng
    strokeWeight(3);
    for(let d of drawings){
      stroke(d.color);
      let start = myMap.latLngToPixel(d.lat1,d.lng1);
      let end = myMap.latLngToPixel(d.lat2,d.lng2);
      line(start.x,start.y,end.x,end.y);
    }
  }
}

// ----- draw mode touch drawing -----
function touchMoved(){
  if(mapInit && drawMode && frozenBounds){
    let pos1 = myMap.pixelToLatLng(pmouseX,pmouseY);
    let pos2 = myMap.pixelToLatLng(mouseX,mouseY);

    // keep drawing within frozen bounds
    if(pos2.lat <= frozenBounds.latMax && pos2.lat >= frozenBounds.latMin &&
       pos2.lng >= frozenBounds.lonMin && pos2.lng <= frozenBounds.lonMax){
      let lineSeg = {
        lat1: pos1.lat,
        lng1: pos1.lng,
        lat2: pos2.lat,
        lng2: pos2.lng,
        color: myColor.toString(),
        userId: myUserId
      };
      drawings.push(lineSeg);
      localStorage.setItem("gpsDrawings", JSON.stringify(drawings));
      socket.emit("newDrawing", lineSeg);
    }
  }
  return false;
}

// ----- freeze/unfreeze map -----
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

// ----- handle window resize -----
function windowResized(){
  resizeCanvas(windowWidth, windowHeight);

  // reposition color buttons at bottom
  colorButtons.forEach((btn,i)=>{
    btn.position(20 + i*60, windowHeight - 70);
  });
}

// ----- update user location -----
function handleNewPosition(pos){
  let lonlat = fixForChineseMap(pos);
  currentLongitude = lonlat[0];
  currentLatitude = lonlat[1];
  if(mapInit) updateMapContent();
  socket.emit("updateLocation",{lat:currentLatitude,lng:currentLongitude});
}

// ----- update point position on map -----
function updateMapContent(){
  let myPosOnCanvas = myMap.latLngToPixel(currentLatitude,currentLongitude);
  me.goalX = myPosOnCanvas.x;
  me.goalY = myPosOnCanvas.y;
}

// ----- point class -----
class MyPoint{
  constructor(){
    this.x = 0;
    this.y = 0;
    this.goalX = 0;
    this.goalY = 0;
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
