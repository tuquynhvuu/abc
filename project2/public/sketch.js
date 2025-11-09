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
let allPlayers = {}; // store everyone for territory checks
let blocks = [];

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
blocks = [
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
    ownedBy: null // tracks which team currently controls it
  },
  {
    name: "apt north of campus",
    corners: [
      { lat: 31.150568, lon: 121.480325 },
      { lat: 31.149600, lon: 121.480743 },
      { lat: 31.149880, lon: 121.482138 },
      { lat: 31.150798, lon: 121.48194 }
    ],
    triggerPoint: { lat: 31.149880, lon: 121.461881 },
    triggerRadius: 0.00025,
    color: null,
    ownedBy: null
  },
  {
    name: "lawn",
    corners: [
      { lat: 31.147814, lon: 121.481033 },
      { lat: 31.147437, lon: 121.481205 },
      { lat: 31.147492, lon: 121.482514 },
      { lat: 31.148273, lon: 121.482288 }
    ],
    triggerPoint: { lat: 31.148016, lon: 121.481623 },
    triggerRadius: 0.00025,
    color: null,
    ownedBy: null
  },
  {
    name: "cstore apts",
    corners: [
      { lat: 31.150697, lon: 121.482095 },
      { lat: 31.149935, lon: 121.482278 },
      { lat: 31.150210, lon: 121.483565 },
      { lat: 31.150913, lon: 121.483286 }
    ],
    triggerPoint: { lat: 31.149935, lon: 121.482278 },
    triggerRadius: 0.00025,
    color: null,
    ownedBy: null
  },
];

// ========== SETUP ==========
function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");
  me = new MyPoint();

  // Initialize all blocks with transparent white
  for (let block of blocks) {
    block.color = color(255, 255, 255, 30);
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

  // RECEIVE PLAYER UPDATES (everyone)
  socket.on("playersUpdate", (players) => {
    allPlayers = players;

    // Only show teammates in UI and on map
    teammates = {};
    for (let id in players) {
      if (players[id].team === teamColor) {
        teammates[id] = players[id];
      }
    }

    updateTeamDisplay();
  });

  // RECEIVE BLOCK UPDATES (shared across all clients)
  socket.on("blockUpdate", (serverBlocks) => {
    for (let i = 0; i < blocks.length; i++) {
      blocks[i].ownedBy = serverBlocks[i].ownedBy;
      blocks[i].color = color(serverBlocks[i].color[0], serverBlocks[i].color[1], serverBlocks[i].color[2], 80);
    }
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

  // Initialize map once GPS is available
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

    // Draw visible teammates
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

    // Update and draw all blocks
    for (let block of blocks) {
      checkBlockTrigger(block);
      drawBlock(block);
    }
  }
}

// ========== DRAW BLOCK ==========
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

// ========== TRIGGER LOGIC ==========
function checkBlockTrigger(block) {
  // Check all players in all teams
  for (let id in allPlayers) {
    const player = allPlayers[id];
    if (player.lat && player.lon) {
      if (isNearTrigger(player.lat, player.lon, block.triggerPoint, block.triggerRadius)) {
        // This player’s team captures the block
        block.ownedBy = player.team;

        let c;
        switch (player.team) {
          case "red": c = [255, 0, 0]; break;
          case "blue": c = [0, 0, 255]; break;
          case "green": c = [0, 255, 0]; break;
          case "yellow": c = [255, 255, 0]; break;
          default: c = [255, 255, 255];
        }

        block.color = color(c[0], c[1], c[2], 80);

        // Sync update with all clients
        socket.emit("blockClaim", { name: block.name, team: player.team, color: c });
      }
    }
  }
}

// ========== DISTANCE CHECK ==========
function isNearTrigger(lat, lon, point, radius) {
  const dLat = lat - point.lat;
  const dLon = lon - point.lon;
  const distance = sqrt(dLat * dLat + dLon * dLon);
  return distance < radius;
}

// ========== MAP/GPS ==========
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

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

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
