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

if (location.hostname.toLowerCase().startsWith('browsercircus') || location.hostname.toLowerCase().startsWith('www')) {
  socket = io({ path: "/tq/port-4260/socket.io" });
} else {
  socket = io();
}

let mappa_options = {
  lat: 0,
  lng: 0,
  zoom: 16,
  style: 'https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}',
};

// ========== BLOCKS SETUP ==========
let blocks = [
  {
    name: "campus",
    corners: [
      { lat: 31.149304, lon: 121.480687 }, // top left
      { lat: 31.148068, lon: 121.480928 }, // bottom left
      { lat: 31.148615, lon: 121.482405 }, // bottom right
      { lat: 31.149570, lon: 121.482198 }  // top right
    ],
    triggerPoint: { lat: 31.14887, lon: 121.4815 },
    triggerRadius: 0.00025,
    color: null, // starts white
  },

   {
    name: "apt north of campus",
    corners: [
      { lat: 31.150568, lon: 121.480325 }, // top left
      { lat: 31.149600, lon: 121.480743 }, // bottom left
      { lat: 31.149880, lon: 121.482138 }, // bottom right
      { lat: 31.150798, lon: 121.48194 }  // top right
    ],
    triggerPoint: { lat: 31.149880, lon: 121.461881 },
    triggerRadius: 0.00025,
    color: null, // starts white
  },

     {
    name: "lawn",
    corners: [
      { lat: 31.147814, lon: 121.481033 }, // top left
      { lat: 31.147437, lon: 121.481205 }, // bottom left
      { lat: 31.147492, lon: 121.482514 }, // bottom right
      { lat: 31.148273, lon: 121.482288 }  // top right
    ],
    triggerPoint: { lat: 31.148016, lon: 121.481623 },
    triggerRadius: 0.00025,
    color: null, // starts white
  },

       {
    name: "cstore apts",
    corners: [
      { lat: 31.150697, lon: 121.482095 }, // top left
      { lat: 31.149935, lon: 121.482278 }, // bottom left
      { lat: 31.150210, lon: 121.483565 }, // bottom right
      { lat: 31.150913, lon: 121.483286 }  // top right
    ],
    triggerPoint: { lat: 31.149935, lon: 121.482278 },
    triggerRadius: 0.00025,
    color: null, // starts white
  },



];

// ========== SETUP ==========
function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");
  me = new MyPoint();

  // set initial block colors
  for (let block of blocks) {
    block.color = color(255, 255, 255, 40); // very transparent white
  }

  // TEAM JOIN LOGIC
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

  // RECEIVE PLAYER UPDATES
  socket.on("playersUpdate", (players) => {
    if (!joinedTeam) return;
    teammates = {};
    for (let id in players) {
      if (players[id].team === teamColor) {
        teammates[id] = players[id];
      }
    }
    updateTeamDisplay();
  });
}

// ========== TEAM DISPLAY ==========
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

// ========== DRAW LOOP ==========
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
    me.update();
    me.display();

    // DRAW TEAMMATES
    for (let id in teammates) {
      const player = teammates[id];
      if (player.lat && player.lon) {
        let pos = myMap.latLngToPixel(player.lat, player.lon);
        fill(player.team);
        stroke("black");
        strokeWeight(2);
        circle(pos.x, pos.y, 20);

        noStroke();
        fill("black");
        textAlign(CENTER);
        text(player.name, pos.x, pos.y - 15);
      }
    }

    // UPDATE AND DRAW BLOCKS
    for (let block of blocks) {
      checkBlockTrigger(block);
      drawBlock(block);
    }
  }
}

// ========== DRAW A SINGLE BLOCK ==========
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
}

// ========== TRIGGER DETECTION PER BLOCK ==========
function checkBlockTrigger(block) {
  let triggered = false;

  if (isNearTrigger(currentLatitude, currentLongitude, block.triggerPoint, block.triggerRadius)) {
    triggered = true;
  }

  for (let id in teammates) {
    const player = teammates[id];
    if (player.lat && player.lon) {
      if (isNearTrigger(player.lat, player.lon, block.triggerPoint, block.triggerRadius)) {
        triggered = true;
      }
    }
  }

  if (triggered) {
    switch (teamColor) {
      case "red": block.color = color(255, 0, 0, 80); break;
      case "blue": block.color = color(0, 0, 255, 80); break;
      case "green": block.color = color(0, 255, 0, 80); break;
      case "yellow": block.color = color(255, 255, 0, 80); break;
    }
  }
}

// ========== DISTANCE HELPER ==========
function isNearTrigger(lat, lon, point, radius) {
  const dLat = lat - point.lat;
  const dLon = lon - point.lon;
  const distance = sqrt(dLat * dLat + dLon * dLon);
  return distance < radius;
}

// ========== MAP / GPS EVENTS ==========
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

function updateMapContent() {
  let myPosOnCanvas = myMap.latLngToPixel(currentLatitude, currentLongitude);
  me.goalX = myPosOnCanvas.x;
  me.goalY = myPosOnCanvas.y;
}

// ========== PLAYER CLASS ==========
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
