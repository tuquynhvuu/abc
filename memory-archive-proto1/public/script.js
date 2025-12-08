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
  socket = io({path: "/YOURPATH-and-PORT/socket.io"});  // yields '/leon/port-4100/socket.io' or '/socket.io'
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


// ui stuff
let formElm = document.querySelector("#chatForm"); 
let itemInput = document.querySelector("#newMessage"); 

// listen for newly typed messages & send to server
formElm.addEventListener("submit", newItemSubmitted);

function newItemSubmitted(event){
    console.log(event);

    //stop form element from refreshing the page
    event.preventDefault();
    let newItem = itemInput.value;
    console.log(newItem);

    // new backpack item
    socket.emit("message-from-client", {
        message: newItem  
    });

    // clear out input
    itemInput.value = "";
}


//receive new items from server
socket.on("message-from-server", function(data){
    // what to do with the message from server
    console.log("got item", data)
    appendItem(data)
})


// load backpack history
socket.on("chat-history", function(data){
    // deal with chat history
    console.log(data);
    for(let i = 0; i < data.length; i++){
        let itemData = data[i];
        appendItem(itemData);
    }
})


// 3d canvas space set up
const canvas = document.getElementById("spaceCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let planets = []; // all floating memory planets
let zoom = 1;

// random color generator
function randomColor() {
    const colors = ["#ff6f91", "#f9f871", "#6fffe9", "#b28dff", "#ffb87c"];
    return colors[Math.floor(Math.random() * colors.length)];
}

// append items to canvas
function appendItem(data){
    // create a floating planet in 3d space
    let planet = {
        text: data.message,
        sender: data.sender.username,
        x: Math.random() * canvas.width - canvas.width/2,
        y: Math.random() * canvas.height - canvas.height/2,
        z: Math.random() * 500 + 50,
        color: randomColor(),
        userId: data.sender.userId
    };
    planets.push(planet);
}

// planet tooltip
const tooltip = document.createElement("div");
tooltip.style.position = "absolute";
tooltip.style.padding = "6px 10px";
tooltip.style.background = "rgba(0,0,0,0.8)";
tooltip.style.color = "white";
tooltip.style.borderRadius = "6px";
tooltip.style.pointerEvents = "none";
tooltip.style.display = "none";
document.body.appendChild(tooltip);

// handle desktop click
canvas.addEventListener("click", function(e) {
    let clicked = false;
    planets.forEach(p => {
        let scale = 300 / (p.z * zoom);
        let x2d = canvas.width/2 + p.x * scale;
        let y2d = canvas.height/2 + p.y * scale;
        let radius = 20 * scale;

        let dx = e.clientX - x2d;
        let dy = e.clientY - y2d;
        if (dx*dx + dy*dy <= radius*radius) {
            // show tooltip
            tooltip.style.left = (e.clientX + 10) + "px";
            tooltip.style.top = (e.clientY + 10) + "px";
            tooltip.innerHTML = `<strong>${p.sender}</strong>: ${p.text}`;
            tooltip.style.display = "block";
            clicked = true;
        }
    });
    if (!clicked) tooltip.style.display = "none"; // hide if click misses planets
});

// handle mobile tap
canvas.addEventListener("touchstart", (e) => {
    if(e.touches.length === 1){
        let touch = e.touches[0];
        let tapped = false;
        planets.forEach(p => {
            let scale = 300 / (p.z * zoom);
            let x2d = canvas.width/2 + p.x * scale;
            let y2d = canvas.height/2 + p.y * scale;
            let radius = 20 * scale;

            let dx = touch.clientX - x2d;
            let dy = touch.clientY - y2d;
            if (dx*dx + dy*dy <= radius*radius) {
                // show tooltip
                tooltip.style.left = (touch.clientX + 10) + "px";
                tooltip.style.top = (touch.clientY + 10) + "px";
                tooltip.innerHTML = `<strong>${p.sender}</strong>: ${p.text}`;
                tooltip.style.display = "block";
                tapped = true;
            }
        });
        if (!tapped) tooltip.style.display = "none"; // hide if tap misses
    }
});

// anim loop
function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    planets.forEach(p => {
        // simulate 3d perspective
        let scale = 300 / (p.z * zoom);
        let x2d = canvas.width/2 + p.x * scale;
        let y2d = canvas.height/2 + p.y * scale;
        let radius = 20 * scale;

        // draw planet
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(x2d, y2d, radius, 0, Math.PI*2);
        ctx.fill();

        // draw username on planet
        ctx.fillStyle = "white";
        ctx.font = `${12*scale}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText(p.sender, x2d, y2d - radius/2);

        // draw message below username
        ctx.fillStyle = "white";
        ctx.font = `${10*scale}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText(p.text, x2d, y2d + radius/2);

        // slowly move planet forward
        p.z -= 0.5;
        if(p.z < 10) p.z = Math.random()*500 + 300;
    });

    requestAnimationFrame(animate);
}

animate();



// desktop zoom control
window.addEventListener("wheel", e => {
    zoom += e.deltaY * -0.001;
    zoom = Math.max(0.3, Math.min(zoom, 3));
});

// pinch zoom for mobile
let lastTouchDist = null;
let isDragging = false;
let lastTouchX = 0;
let lastTouchY = 0;

canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
        // single finger drag
        isDragging = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        // pinch zoom
        lastTouchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    }
});

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault(); // prevent page scrolling

    if (e.touches.length === 1 && isDragging) {
        let dx = e.touches[0].clientX - lastTouchX;
        let dy = e.touches[0].clientY - lastTouchY;

        // move all planets opposite to finger to simulate camera drag
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
            let delta = (touchDist - lastTouchDist) * 0.005; // sensitivity
            zoom += delta;
            zoom = Math.max(0.3, Math.min(zoom, 3));
        }
        lastTouchDist = touchDist;
    }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) lastTouchDist = null;
    if (e.touches.length === 0) isDragging = false;
});

// resize window
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
