

// window.addEventListener("deviceorientation", handleOrientation, true); 
// can be deleted later


// canvas setup
const canvas = document.getElementById("paintCanvas");
const ctx = canvas.getContext("2d");

// resize canvas to full screen
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// paint drops
let drops = [];



function handleOrientation(eventData){
    console.log(eventData);

    document.querySelector('#alpha').innerText = "alpha: " + Math.round(eventData.alpha);
    document.querySelector('#beta').innerText = "beta: " + Math.round(eventData.beta);
    document.querySelector('#gamma').innerText = "gamma: " + Math.round(eventData.gamma);

    document.querySelector('h1').style.display = "none";
    document.querySelector('#requestOrientationButton').style.display = "none";

    // document.querySelector('#square').style.transform = "rotate("+eventData.alpha+"deg)";

    // create new paint drops each frame
    // alpha = hue
    // beta = brightness
    let hue = Math.round(eventData.alpha);
    let brightness = Math.max(30, Math.min(70, 50 + eventData.beta / 3));
    let color = `hsl(${hue}, 100%, ${brightness}%)`;

    // target size based on alpha
    let targetSize = (eventData.alpha / 360) * 45 +5;

    drops.push({
        x: canvas.width/2,
        y: canvas.height/2,
        // horizontal velocity flow
        vx: eventData.gamma / 10, 

        // vertical velocity flow / gravity
        vy: eventData.beta / 20,

        // init at target size
        size: targetSize,
        // store target size for smooth transition
        targetSize: targetSize,
        color: color,
        life: 450,

        // gamma controls shape variation
        gamma: eventData.gamma
    });
}

// loop for actual painting 
function draw(){
    
    // fade canvas to visualize paint trails
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw drops
    for (let i = 0; i < drops.length; i++){
        let d = drops[i];
        ctx.beginPath();
        ctx.fillStyle = d.color;

        // drop shape variation: ellipse width changes w/ gamma
        let stretchX = 1 + Math.abs(d.gamma) / 90;
        ctx. ellipse(d.x, d.y, d.size * stretchX, d.size, 0, 0, Math.PI*2);

        ctx.fill();
        // ctx.restore();

        //update drops position
        d.x += d.vx;
        d.y += d.vy;
        d.life--;

        // smooth size transitions
        const smoothing = 0.1;
        
        // shrink size with age
        d.size *= 0.98;


    }

    //remove dead drops after lifespan
    drops = drops.filter(d => d.life > 0);
    requestAnimationFrame(draw);
}

draw();







