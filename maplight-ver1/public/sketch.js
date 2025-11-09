let mappa = new Mappa('Leaflet');
let myMap, canvas;
let currentLongitude = 0;
let currentLatitude = 0;
let mapInit = false;
let me;

let playerName = "";
let teamColor = "";
let joinedTeam = false;

let teammates = {}; // { socketId: {name, lat, lon, team} }
let allPlayers = {};

if (location.hostname.toLowerCase().startsWith('browsercircus')) {
  socket = io({ path: "/YOURPATH-and-PORT/socket.io" });
} else {
  socket = io();
}

let mappa_options = {
  lat: 0,
  lng: 0,
  zoom: 16,
  style: 'https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}',
};

let blocks = [
  {
    name: "campus",
    corners: [
      { lat: 31.149304, lon: 121.480687 }, // top left
      { lat: 31.148068, lon: 121.480928 }, // bottom left
      { lat: 31.148615, lon: 121.482405 }, // bottom right
      { lat: 31.149570, lon: 121.482198 }  // top right
    ],
    trigger: { lat: 31.148769, lon: 121.481580 },
    triggerRadius: 0.00018,
    color: null, // starts white
    cooldownEnd: 0
  },

   {
    name: "apt_north",
    corners: [
      { lat: 31.150568, lon: 121.480325 }, // top left
      { lat: 31.149600, lon: 121.480743 }, // bottom left
      { lat: 31.149880, lon: 121.482138 }, // bottom right
      { lat: 31.150798, lon: 121.48194 }  // top right
    ],
    trigger:{ lat: 31.150045, lon: 121.481865},
    triggerRadius: 0.00018,
    color: null, // starts white
        cooldownEnd: 0

  },

     {
    name: "lawn",
    corners: [
      { lat: 31.147814, lon: 121.481033 }, // top left
      { lat: 31.147437, lon: 121.481205 }, // bottom left
      { lat: 31.147492, lon: 121.482514 }, // bottom right
      { lat: 31.148273, lon: 121.482288 }  // top right
    ],
    trigger: { lat: 31.147768, lon: 121.481848},
    triggerRadius: 0.00018,
    color: null, // starts white
        cooldownEnd: 0

  },

       {
    name: "cstore_apts",
    corners: [
      { lat: 31.150697, lon: 121.482095 }, // top left
      { lat: 31.149935, lon: 121.482278 }, // bottom left
      { lat: 31.150210, lon: 121.483565 }, // bottom right
      { lat: 31.150913, lon: 121.483286 }  // top right
    ],
    trigger: { lat: 31.150224, lon: 121.483034},
    triggerRadius: 0.00018,
    color: null, // starts white
        cooldownEnd: 0

  },

{
  name:"metro",
  corners:[
    {lat: 31.151473, lon:121.481548},
    {lat:31.150995, lon:121.481612},
    {lat:31.151096, lon:121.482186},
    {lat:31.151542, lon:121.482101}
  ],
  trigger: {lat:31.151257, lon:121.481865},
  triggerRadius: 0.00018,
  color: null,
      cooldownEnd: 0

},

{
  name:"metro_west",
  corners:[
    {lat: 31.151285, lon:121.480373},
    {lat: 31.150848, lon:121.480470},
    {lat:31.151009, lon:121.481500},
    {lat:31.151436, lon:121.481387}
  ],
  trigger: {lat:31.150917, lon:121.480985},
  triggerRadius: 0.00018,
  color: null,
      cooldownEnd: 0

},

{
  name: "campus_east",
  corners:[
    {lat:31.149441, lon:121.482487},
    {lat:31.149150, lon:121.482492},
    {lat:31.149200, lon:121.483168},
    {lat:31.149503, lon:121.483120}
  ],
  trigger:{lat:31.149421, lon:121.482675},
  triggerRadius: 0.00018,
  color: null,
      cooldownEnd: 0

},

{
  name: "west_apt",
  corners:[
    {lat:31.148897, lon:121.479290}, //top left
    {lat:31.147759, lon:121.479526}, // bottom left
    {lat:31.147924, lon:121.480566}, //bottom right
    {lat:31.149076, lon:121.480246} //top right
  ],
  trigger:{lat:31.148957, lon:121.479987},
  triggerRadius: 0.00018,
  color: null,
      cooldownEnd: 0

},


];

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");
  me = new MyPoint();

  // set initial block colors
  for (let block of blocks) {
    block.color = color(255, 255, 255, 40); // very transparent white
  }

  document.getElementById("joinTeamButton").addEventListener("click", () => {
    const nameInput = document.getElementById("playerName").value.trim();
    const teamInput = document.getElementById("teamSelect").value;

    if (nameInput === "") {
      alert("Please enter your name!");
      return;
    }

    playerName = nameInput;
    teamColor = teamInput;
    joinedTeam = true;

    document.getElementById("team-join-container").style.display = "none";
    socket.emit("playerJoin", { name: playerName, team: teamColor });
  });

socket.on("playersUpdate", (players) => {
  allPlayers = players; // everyone for map display

  if (joinedTeam) {
    teammates = {};
    for (let id in players) {
      if (players[id].team === teamColor) {
        teammates[id] = players[id];
      }
    }
    updateTeamDisplay();
  }
});

}

function updateTeamDisplay() {
  if (!joinedTeam) return;

  const teamDisplay = document.getElementById("team-display");
  teamDisplay.style.display = "flex";
  teamDisplay.style.backgroundColor = teamColor;

  const nameSpan = document.getElementById("my-team-name");
  const membersSpan = document.getElementById("team-members");

  let names = [];
  for (let id in teammates) names.push(teammates[id].name);

  nameSpan.innerText = `Team ${capitalize(teamColor)}: `;
  membersSpan.innerText = names.join(", ");
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function draw() {
  clear();

  if (!mapInit && GPS_GRANTED && currentLongitude != 0) {
    mappa_options.lat = currentLatitude;
    mappa_options.lng = currentLongitude;

    myMap = mappa.tileMap(mappa_options);
    myMap.overlay(canvas);
    myMap.onChange(updateMapContent);
    mapInit = true;
  }

  if (mapInit) {
    // me.update();
    // me.display();

for (let id in allPlayers) {
  const player = allPlayers[id];
  if (player.lat && player.lon) {
    let pos = myMap.latLngToPixel(player.lat, player.lon);
    fill(player.team);
    stroke("black");
    strokeWeight(2);
    circle(pos.x, pos.y, 20);

    // Show name only if teammate
    if (teammates[id]) {
      noStroke();
      fill("black");
      textAlign(CENTER);
      text(player.name, pos.x, pos.y - 15);
    }
  }
}


    for (let block of blocks) {
      checkBlockTrigger(block);
      drawBlock(block);
      drawTrigger(block); // visualize trigger point & radius
    }
  }


}

function drawTrigger(block){
  if (!mapInit || !myMap) return;
 // Convert trigger lat/lon to pixel coordinates
  let triggerPos = myMap.latLngToPixel(block.trigger.lat, block.trigger.lon);

  push();
  noFill();
  stroke(0, 255, 0, 150); // green for radius
  strokeWeight(2);

  // Convert trigger radius (lat/lon degrees) to pixels
  let radiusPixels = mapDistanceToPixels(block.triggerRadius, block.trigger.lat);
  circle(triggerPos.x, triggerPos.y, radiusPixels * 2); // diameter = radius * 2

  // Draw trigger point itself
  fill(0, 255, 0);
  noStroke();
  circle(triggerPos.x, triggerPos.y, 8);
  pop();

}

// ========== HELPER TO CONVERT LAT/LON DISTANCE TO PIXELS ==========
function mapDistanceToPixels(distanceLatLon, lat) {
  // Convert lat distance to pixels (approximate)
  let latPixel = myMap.latLngToPixel(lat, 0);
  let latPixelPlus = myMap.latLngToPixel(lat + distanceLatLon, 0);
  return abs(latPixelPlus.y - latPixel.y);
}

function drawBlock(block) {
  if (!mapInit || !myMap) return;

  let blockPixels = block.corners.map(corner =>
    myMap.latLngToPixel(corner.lat, corner.lon)
  );

  push();
  fill(block.color);
  stroke(block.color);
  strokeWeight(2);
  beginShape();
  for (let p of blockPixels) vertex(p.x, p.y);
  endShape(CLOSE);
  pop();

  let remaining = Math.max(0, (block.cooldownEnd - Date.now()) / 1000);
  let triggerPos = myMap.latLngToPixel(block.trigger.lat, block.trigger.lon);

if (remaining > 0) {
  fill(0);
  textAlign(CENTER, CENTER);
  text(remaining.toFixed(0), triggerPos.x, triggerPos.y - 25);
}

}

function checkBlockTrigger(block) {
  let triggered = false;

  if (isNearTrigger(currentLatitude, currentLongitude, block.trigger, block.triggerRadius)) {
    triggered = true;
  }

  for (let id in teammates) {
    const player = teammates[id];
    if (player.lat && player.lon) {
      if (isNearTrigger(player.lat, player.lon, block.trigger, block.triggerRadius)) {
        triggered = true;
      }
    }
  }


}

function isNearTrigger(lat, lon, point, radius) {
  const dLat = lat - point.lat;
  const dLon = lon - point.lon;
  const distance = sqrt(dLat * dLat + dLon * dLon);
  return distance < radius;
}

function touchStarted() {
  if (mapInit) {
    let pos = myMap.pixelToLatLng(touches[0].x, touches[0].y);
    console.log("TOUCHED", pos);
  } else {
    console.log("TOUCHED", touches);
  }
}

function touchMoved() { }
function touchEnded() { }

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

function handleNewPosition(pos) {
  let lonlat = fixForChineseMap(pos);
  currentLongitude = lonlat[0];
  currentLatitude = lonlat[1];

  if (mapInit) updateMapContent();

  if (joinedTeam) {
    socket.emit("playerPosition", { lat: currentLatitude, lon: currentLongitude });
  }
}

// Receive updates from the server when any team captures a territory
socket.on("territoriesUpdate", (updatedTerritories) => {
  for (let i = 0; i < blocks.length; i++) {
    const updated = updatedTerritories[blocks[i].name];
    if (updated && updated.owner) {
      switch (updated.owner) {
        case "red": blocks[i].color = color(255, 0, 0, 80); break;
        case "blue": blocks[i].color = color(0, 0, 255, 80); break;
        case "green": blocks[i].color = color(0, 255, 0, 80); break;
        case "yellow": blocks[i].color = color(255, 255, 0, 80); break;
        default: blocks[i].color = color(255, 255, 255, 40); break; // default transparent white
      }
      blocks[i].cooldownEnd = updated.cooldownEnd || 0;
    }
  }
});

function updateMapContent() {
  let myPosOnCanvas = myMap.latLngToPixel(currentLatitude, currentLongitude);
  me.goalX = myPosOnCanvas.x;
  me.goalY = myPosOnCanvas.y;
}

class MyPoint {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.goalX = 0;
    this.goalY = 0;
    this.size = 14;
    this.col = color(170, 240, 190);
  }

  update() {
    this.x = lerp(this.x, this.goalX, 0.2);
    this.y = lerp(this.y, this.goalY, 0.2);
  }

  display() {
    push();
    translate(this.x, this.y);
    fill(this.col);
    stroke("pink");
    strokeWeight(3);
    let dia = this.size + sin(frameCount * 0.1);
    circle(0, 0, dia);
    pop();
  }
}
