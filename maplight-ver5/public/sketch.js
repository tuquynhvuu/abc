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

{
  name: "west_apt2",
  corners:[
    {lat:31.150210, lon:121.479134}, //top left
    {lat:31.149393, lon:121.479359}, // bottom left
    {lat:31.149678, lon:121.480304}, //bottom right
    {lat:31.150458, lon:121.480035} //top right
  ],
  trigger:{lat:31.149632, lon:121.480116},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},
{
  name: "east2",
  corners:[
    {lat:31.148994, lon:121.482621}, //top left
    {lat:31.148732, lon:121.482605}, // bottom left
    {lat:31.148833, lon:121.483302}, //bottom right
    {lat:31.149099, lon:121.483297} //top right
  ],
  trigger:{lat:31.148865, lon:121.482573},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},
{
  name: "idk",
  corners:[
    {lat:31.153176, lon:121.480658}, //top left
    {lat:31.151753, lon:121.480443}, // bottom left
    {lat:31.152056, lon:121.482760}, //bottom right
    {lat:31.152616, lon:121.482717} //top right
  ],
  trigger:{lat:31.152763, lon:121.481194},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},
{
  name: "idk_second",
  corners:[
    {lat:31.154526, lon:121.481634}, //top left
    {lat:31.153305, lon:121.480840}, // bottom left
    {lat:31.152781, lon:121.482632}, //bottom right
    {lat:31.153901, lon:121.482245} //top right
  ],
  trigger:{lat:31.153764, lon:121.481612},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},
{
  name: "idk_third",
  corners:[
    {lat:31.156243, lon:121.477010}, //top left
    {lat:31.153929, lon:121.476259}, // bottom left
    {lat:31.152974, lon:121.479971}, //bottom right
    {lat:31.155306, lon:121.481022} //top right
  ],
  trigger:{lat:31.153396, lon:121.479756},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},
{
  name: "idk_fourth",
  corners:[
    {lat:31.151826, lon:121.478662}, //top left
    {lat:31.150899, lon:121.478426}, // bottom left
    {lat:31.150826, lon:121.479917}, //bottom right
    {lat:31.151487, lon:121.479917} //top right
  ],
  trigger:{lat:31.151009, lon:121.479774},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},

{
  name: "westwest1",
  corners:[
    {lat:31.148746, lon:121.477589}, //top left
    {lat:31.147474, lon:121.477820}, // bottom left
    {lat:31.147713, lon:121.479402}, //bottom right
    {lat:31.148971, lon:121.479215} //top right
  ],
  trigger:{lat:31.148824, lon:121.478297},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},

{
  name: "westwest2",
  corners:[
    {lat:31.150614, lon:121.478195}, //top left
    {lat:31.149127, lon:121.477632}, // bottom left
    {lat:31.149343, lon:121.479134}, //bottom right
    {lat:31.150417, lon:121.478936} //top right
  ],
  trigger:{lat:31.150541, lon:121.478313},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},

{
  name: "westwest3",
  corners:[
    {lat:31.148489, lon:121.475722}, //top left
    {lat:31.147189, lon:121.476028}, // bottom left
    {lat:31.147414, lon:121.477600}, //bottom right
    {lat:31.148718, lon:121.477321} //top right
  ],
  trigger:{lat:31.148066, lon:121.477428},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},
{
  name: "westwest4",
  corners:[
    {lat:31.151349, lon:121.475358}, //top left
    {lat:31.148769, lon:121.475701}, // bottom left
    {lat:31.149118, lon:121.477428}, //bottom right
    {lat:31.150715, lon:121.478072} //top right
  ],
  trigger:{lat:31.1505781, lon:121.477675},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},

{
  name: "crystal_plaza",
  corners:[
    {lat:31.153699, lon:121.475733}, //top left
    {lat:31.151670, lon:121.475218}, // bottom left
    {lat:31.150871, lon:121.478040}, //bottom right
    {lat:31.152919, lon:121.478844} //top right
  ],
  trigger:{lat:31.152331, lon:121.476956},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},

{
  name: "crystal_bridge",
  corners:[
    {lat:31.152841, lon:121.478957}, //top left
    {lat:31.151886, lon:121.478646}, // bottom left
    {lat:31.151615, lon:121.479864}, //bottom right
    {lat:31.152575, lon:121.479837} //top right
  ],
  trigger:{lat:31.152409, lon:121.479649},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},

{
  name: "easteast1",
  corners:[
    {lat:31.148314, lon:121.482358}, //top left
    {lat:31.148847, lon:121.483410}, // bottom left
    {lat:31.148985, lon:121.484246}, //bottom right
    {lat:31.149695, lon:121.484069} //top right
  ],
  trigger:{lat:31.149535, lon:121.483710},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},

{
  name: "south1",
  corners:[
    {lat:31.146795, lon:121.481269}, //top left
    {lat:31.144940, lon:121.481333}, // bottom left
    {lat:31.145142, lon:121.485292}, //bottom right
    {lat:31.147079, lon:121.484971} //top right
  ],
  trigger:{lat:31.146997, lon:121.484756},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},

{
  name: "south2",
  corners:[
    {lat:31.144839, lon:121.481301}, //top left
    {lat:31.143644, lon:121.481612}, // bottom left
    {lat:31.144187, lon:121.4855289}, //bottom right
    {lat:31.144967, lon:121.485325} //top right
  ],
  trigger:{lat:31.144325, lon:121.485410},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},

{
  name: "ne1",
  corners:[
    {lat:31.154746, lon:121.472375}, //top left
    {lat:31.152671, lon:121.471645}, // bottom left
    {lat:31.151744, lon:121.474928}, //bottom right
    {lat:31.153754, lon:121.475325} //top right
  ],
  trigger:{lat:31.152956, lon:121.474767},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},

{
  name: "ne2",
  corners:[
    {lat:31.152588, lon:121.471581}, //top left
    {lat:31.151138, lon:121.470787}, // bottom left
    {lat:31.148842, lon:121.475186}, //bottom right
    {lat:31.151340, lon:121.475014} //top right
  ],
  trigger:{lat:31.151652, lon:121.473255},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},

{
  name: "ne3",
  corners:[
    {lat:31.148365, lon:121.461882}, //top left
    {lat:31.143774, lon:121.461582}, // bottom left
    {lat:31.146675, lon:121.476130}, //bottom right
    {lat:31.155086, lon:121.469821} //top right
  ],
  trigger:{lat:31.153470, lon:121.469693},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
},

{
  name: "campus_east2",
  corners:[
    {lat:31.148482, lon:121.478792}, //top left
    {lat:31.147428, lon:121.482803}, // bottom left
    {lat:31.147759, lon:121.484756}, //bottom right
    {lat:31.148879, lon:121.484316} //top right
  ],
  trigger:{lat:31.148401, lon:121.484316},
  triggerRadius: 0.00018,
  color: null,
  cooldownEnd: 0
}

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

// ========== HELPER TO CONVERT LAT/LON DISTANCE TO PIXELS ==========
function mapDistanceToPixels(distanceLatLon, lat) {
  // Convert lat distance to pixels (approximate)
  let latPixel = myMap.latLngToPixel(lat, 0);
  let latPixelPlus = myMap.latLngToPixel(lat + distanceLatLon, 0);
  return abs(latPixelPlus.y - latPixel.y);
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

  if (!mapInit) return;

  // --- draw all blocks (territories) ---
  for (let block of blocks) {
    drawBlock(block);
    drawTrigger(block);
  }

  // --- draw all players ---
  for (let id in allPlayers) {
    const player = allPlayers[id];
    if (!player.lat || !player.lon) continue;
    let pos = myMap.latLngToPixel(player.lat, player.lon);

    push();
    strokeWeight(player.team === teamColor ? 3 : 1);
    stroke(255);
    fill(player.team);
    let sz = player.team === teamColor ? 20 : 14;
    circle(pos.x, pos.y, sz);

    // Name labels for teammates only
    if (player.team === teamColor) {
      noStroke();
      fill(0);
      textAlign(CENTER);
      textSize(12);
      text(player.name, pos.x, pos.y - 15);
    }
    pop();
  }
}


// ======== TRIGGER VISUALS ========
function drawTrigger(block) {
  if (!mapInit || !myMap) return;

  let triggerPos = myMap.latLngToPixel(block.trigger.lat, block.trigger.lon);
  let radiusPixels = mapDistanceToPixels(block.triggerRadius, block.trigger.lat);

  push();
  noFill();

  // Pulsating glow effect
  // let glow = sin(frameCount * 0.08) * 40 + 120;
  // stroke(0, glow, 0, 150);
  // strokeWeight(2);
  // circle(triggerPos.x, triggerPos.y, radiusPixels * 2);

  // Core glowing dot
  noStroke();
  fill(180, 0, 255, 180);

  circle(triggerPos.x, triggerPos.y, 8 + sin(frameCount * 0.15) * 2);

  pop();
}


// ======== TERRITORY VISUALS ========
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
  if (block.cooldownEnd && block.cooldownEnd > Date.now()) {
  let remaining = (block.cooldownEnd - Date.now()) / 1000;

  // Get position for displaying text
  let triggerPos = myMap.latLngToPixel(block.trigger.lat, block.trigger.lon);

  // Use the team's color for the timer text
  let teamCol = color(block.color || "#ffffff");
  fill(teamCol);
  noStroke();

  // Larger, bold text
  textAlign(CENTER, CENTER);
  textSize(24);
  textStyle(BOLD);

  // Display remaining time (whole seconds)
  text(ceil(remaining) + "s", triggerPos.x, triggerPos.y - 35);
}

  if (block.owner) {
    stroke(red(block.color), green(block.color), blue(block.color), 180);
    strokeWeight(3);
    noFill();
    beginShape();
    for (let p of blockPixels) vertex(p.x, p.y);
    endShape(CLOSE);
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
