const socket = io("https://localhost:3000", { secure: true });

let map, userMarker, userTeam = null, firstFix = false;

// Default view centered on Shanghai Pudong Qiantan
map = L.map('map').setView([31.1543, 121.5038], 17);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

function joinTeam(color) {
  userTeam = color;
  socket.emit("joinTeam", color);
  updateStatus(`Joined team ${color.toUpperCase()}. Waiting for GPS...`);

  if (!GPS_GRANTED) {
    requestGPS();
  }
}

// Called when GPS updates (from requestGPS.js)
function handleNewPosition(pos) {
  let [lng, lat] = fixForChineseMap(pos);
  const coords = { lat, lng };

  if (!firstFix) {
    map.setView([lat, lng], 18);
    firstFix = true;
    updateStatus("GPS connected. You are live!");
  }

  if (!userMarker) {
    userMarker = L.circleMarker([lat, lng], {
      radius: 8,
      color: userTeam
    }).addTo(map);
  } else {
    userMarker.setLatLng([lat, lng]);
  }

  socket.emit("claimTerritory", coords);
}

socket.on("territoryUpdate", ({ coords, color }) => {
  L.circle([coords.lat, coords.lng], {
    radius: 5,
    color,
    fillColor: color,
    fillOpacity: 0.5
  }).addTo(map);
});

function updateStatus(text) {
  document.getElementById("status").innerText = text;
}
