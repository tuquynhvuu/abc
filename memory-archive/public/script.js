function getOrCreateUserId() {
    // check if we have a userID already in local storage
    // if yes, return it
    // if not, create one and return it
    let id = localStorage.getItem("chat-user-id");
    if (id == undefined){
        id = "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        localStorage.setItem("chat-user-id", id);
        //making id and storing it
    }
    return id;
}
const myUserId = getOrCreateUserId();
console.log('My userId:', myUserId);

let nameInput = document.querySelector("#nameInput");

//check if we have a username already
let myUsername = localStorage.getItem("chat-username");

if(myUsername != undefined){
    console.log("my user name is", myUsername);
    nameInput.value = myUsername;
}else{
    myUsername = "";
}

// start socket
if(location.hostname.toLowerCase().startsWith('browsercircus') || location.hostname.toLowerCase().startsWith('www')){
  socket = io({path: "/YOURPATH-and-PORT/socket.io"});  
}else{
  socket = io();
}

let myInfo = {
    userId: myUserId,
    username: myUsername
}

// "login" to server, sending out identity
socket.emit("identify", myInfo);

//handle username change
nameInput.addEventListener("change", function(){
    console.log("changed name", nameInput.value)
    // locally
    localStorage.setItem("chat-username", nameInput.value);
    // tell server about it
    socket.emit("name-change", {
        newUsername: nameInput.value
    })
})


// ----------------------------
// MEMORY BACKPACK UI HOOKS
// ----------------------------
let formElm = document.querySelector("#chatForm");  
let itemInput = document.querySelector("#newMessage"); 

// create a circular doodle canvas
let doodleCanvas = document.createElement("canvas");
doodleCanvas.width = 150;
doodleCanvas.height = 150;
doodleCanvas.style.borderRadius = "50%";
doodleCanvas.style.background = "rgba(0,0,0,0.85)";
doodleCanvas.style.display = "block";
doodleCanvas.style.margin = "0 auto";
doodleCanvas.style.touchAction = "none";
doodleCanvas.style.border = "2px solid rgba(200,200,200,0.5)"; // semi-transparent grey outline
document.getElementById("doodleWrapper").appendChild(doodleCanvas);

let doodleCtx = doodleCanvas.getContext("2d");
let drawing = false;
let lastX = 0;
let lastY = 0;

// DRAWING FUNCTIONS
function startDrawing(x, y){
    // constrain to circle
    const cx = doodleCanvas.width / 2;
    const cy = doodleCanvas.height / 2;
    const radius = doodleCanvas.width / 2;
    if ((x - cx)*(x - cx) + (y - cy)*(y - cy) > radius*radius) return;

    drawing = true;
    lastX = x;
    lastY = y;
}

function drawLine(x, y){
    if(!drawing) return;

    // constrain to circle
    const cx = doodleCanvas.width / 2;
    const cy = doodleCanvas.height / 2;
    const radius = doodleCanvas.width / 2;
    if ((x - cx)*(x - cx) + (y - cy)*(y - cy) > radius*radius) return;

    doodleCtx.strokeStyle = "white";
    doodleCtx.lineWidth = 2;
    doodleCtx.lineCap = "round";

    doodleCtx.beginPath();
    doodleCtx.moveTo(lastX, lastY);
    doodleCtx.lineTo(x, y);
    doodleCtx.stroke();

    lastX = x;
    lastY = y;
}

function stopDrawing(){
    drawing = false;
}

// MOUSE EVENTS
doodleCanvas.addEventListener("mousedown", e => startDrawing(e.offsetX, e.offsetY));
doodleCanvas.addEventListener("mousemove", e => drawLine(e.offsetX, e.offsetY));
doodleCanvas.addEventListener("mouseup", stopDrawing);
doodleCanvas.addEventListener("mouseout", stopDrawing);

// TOUCH EVENTS (phones)
doodleCanvas.addEventListener("touchstart", e => {
    e.preventDefault();
    if(e.touches.length > 0){
        const touch = e.touches[0];
        const rect = doodleCanvas.getBoundingClientRect();
        startDrawing(touch.clientX - rect.left, touch.clientY - rect.top);
    }
});
doodleCanvas.addEventListener("touchmove", e => {
    e.preventDefault();
    if(e.touches.length > 0){
        const touch = e.touches[0];
        const rect = doodleCanvas.getBoundingClientRect();
        drawLine(touch.clientX - rect.left, touch.clientY - rect.top);
    }
});
doodleCanvas.addEventListener("touchend", stopDrawing);
doodleCanvas.addEventListener("touchcancel", stopDrawing);

// SUBMIT MESSAGE AND DOODLE
formElm.addEventListener("submit", function(e){
    e.preventDefault();
    let newItem = itemInput.value;

    // capture doodle as image
    let doodleData = doodleCanvas.toDataURL();

    socket.emit("message-from-client", {
        message: newItem,
        doodle: doodleData
    });

    itemInput.value = "";
    doodleCtx.clearRect(0, 0, doodleCanvas.width, doodleCanvas.height);
})


// ----------------------------
// RECEIVE NEW ITEMS FROM SERVER
// ----------------------------
socket.on("message-from-server", function(data){
    appendItem(data);
})

socket.on("chat-history", function(data){
    data.forEach(item => appendItem(item));
})


// ----------------------------
// CANVAS 3D SPACE SETUP
// ----------------------------
const canvas = document.getElementById("spaceCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let planets = [];
let zoom = 1;

// ----------------------------
// APPEND ITEMS AS DOODLE PLANETS
// ----------------------------
function appendItem(data){
    let planet = {
        doodle: data.doodle,
        sender: data.sender.username,
        text: data.message,
        x: Math.random() * canvas.width - canvas.width/2,
        y: Math.random() * canvas.height - canvas.height/2,
        z: Math.random() * 500 + 50,
        radius: 30,
        userId: data.sender.userId
    };
    planets.push(planet);
}

// ----------------------------
// PLANET CLICK TOOLTIP
// ----------------------------
const tooltip = document.createElement("div");
tooltip.style.position = "absolute";
tooltip.style.padding = "6px 10px";
tooltip.style.background = "rgba(0,0,0,0.85)";
tooltip.style.color = "white";
tooltip.style.borderRadius = "6px";
tooltip.style.pointerEvents = "none";
tooltip.style.display = "none";
document.body.appendChild(tooltip);

function checkPlanetClick(x, y){
    let clicked = false;
    planets.forEach(p => {
        let scale = 300 / (p.z * zoom);
        let x2d = canvas.width/2 + p.x * scale;
        let y2d = canvas.height/2 + p.y * scale;
        let r = p.radius * scale;

        let dx = x - x2d;
        let dy = y - y2d;
        if(dx*dx + dy*dy <= r*r){
            tooltip.style.left = (x + 10) + "px";
            tooltip.style.top = (y + 10) + "px";
            tooltip.innerHTML = `<img src="${p.doodle}" style="width:80px;height:80px;border-radius:50%;"><br><strong>${p.sender}</strong>: ${p.text}`;
            tooltip.style.display = "block";
            clicked = true;
        }
    });
    if(!clicked) tooltip.style.display = "none";
}

canvas.addEventListener("click", e => checkPlanetClick(e.clientX, e.clientY));
canvas.addEventListener("touchstart", e => {
    if(e.touches.length === 1){
        const touch = e.touches[0];
        checkPlanetClick(touch.clientX, touch.clientY);
    }
});

// ----------------------------
// ANIMATION LOOP
// ----------------------------
function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    planets.forEach(p => {
        let scale = 300 / (p.z * zoom);
        let x2d = canvas.width/2 + p.x * scale;
        let y2d = canvas.height/2 + p.y * scale;
        let radius = p.radius * scale;

        // draw planet circle
        ctx.beginPath();
        ctx.arc(x2d, y2d, radius, 0, Math.PI*2);
        ctx.fillStyle = "#333";
        ctx.fill();

        // draw doodle inside circle
        if(p.doodle){
            let img = new Image();
            img.src = p.doodle;
            ctx.save();
            ctx.beginPath();
            ctx.arc(x2d, y2d, radius, 0, Math.PI*2);
            ctx.clip();
            ctx.drawImage(img, x2d-radius, y2d-radius, radius*2, radius*2);
            ctx.restore();
        }

        p.z -= 0.5;
        if(p.z < 10) p.z = Math.random()*500 + 300;
    });

    requestAnimationFrame(animate);
}
animate();

// ----------------------------
// ZOOM CONTROL (DESKTOP)
window.addEventListener("wheel", e => {
    zoom += e.deltaY * -0.001;
    zoom = Math.max(0.3, Math.min(zoom, 3));
});

// ----------------------------
// TOUCH AND DRAG / PINCH ZOOM FOR MOBILE
let lastTouchDist = null;
let isDragging = false;
let lastTouchX = 0;
let lastTouchY = 0;

canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
        isDragging = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    }
});

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
        let dx = e.touches[0].clientX - lastTouchX;
        let dy = e.touches[0].clientY - lastTouchY;

        planets.forEach(p => {
            p.x += dx / zoom;
            p.y += dy / zoom;
        });

        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        let touchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastTouchDist) {
            zoom += (touchDist - lastTouchDist) * 0.005;
            zoom = Math.max(0.3, Math.min(zoom, 3));
        }
        lastTouchDist = touchDist;
    }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) lastTouchDist = null;
    if (e.touches.length === 0) isDragging = false;
});

// ----------------------------
// RESIZE
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    doodleCanvas.width = 150;
    doodleCanvas.height = 150;
});
