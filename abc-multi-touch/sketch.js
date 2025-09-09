let smileys = [];
let rotating = false;
let rotationAngle = 0;
let pulsate = false;
let bgColor;
let particles = [];

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("p5-canvas-container");
  bgColor = color(90, 200, 190);
  angleMode(DEGREES);
}

function draw() {
  background(bgColor);

  // rotation mechanism
  if (rotating) {
    rotationAngle += 2;
  }
  
  // smiley icons
  for (let s of smileys) {
    push();
    translate(s.x, s.y);
    
    // rotation enabling
    if (rotating) rotate(rotationAngle);

    // size pulsate
    let currentSize = s.size;
    if (pulsate) currentSize *= 1 + 0.2 * sin(frameCount * 5); 

    fill(s.col);
    noStroke();
    ellipse(0, 0, currentSize);
    fill(0);
    
    // left eye
    ellipse(-currentSize/6, -currentSize/6, currentSize/5, currentSize/5);

    //right eye
    ellipse(currentSize/6, -currentSize/6, currentSize/5, currentSize/5);

    pop();

  }

  // update + draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].show();
    if (particles[i].finished()) {
      particles.splice(i, 1);
    }
  }

  // fill(255);
  // circle(width/2, height/2, 200);

  // fill(34, 57, 187);
  // circle(300, 100, 50);
}

// touch handlers
// P5 touch events: https://p5js.org/reference/#Touch

function touchStarted() {
  let numFingers = touches.length;
  console.log(touches);

  // 1 finger
  if (numFingers === 1) {
    let t = touches[0];
    smileys.push({
      x: t.x,
      y: t.y,
      size: random(50, 120),
      col: color(random(255), random(255), random(255))
    });
  }

  //2 fingers
  if (numFingers === 2) rotating = !rotating;

  //3 fingers
  if (numFingers === 3) {
    for (let s of smileys) s.col = color(random(255), random(255), random(255));
  }

  //4 fingers
  if (numFingers === 4) pulsate = !pulsate;

  // 5 fingers
  if (numFingers === 5) bgColor = color(random(255), random(255), random(255));

  return false;
}

function touchMoved() {
  for (let t of touches) {
    particles.push(new Particle(t.x, t.y));
  }
  return false;
}

function touchEnded() {
}

class Particle {
  constructor(x,y) {
    this.pos = createVector(x,y);
    this.vel = createVector(random(-1,1), random(-1,1));
    this.lifetime = 60;
    this.size = random(5, 15);
    this.col = color(random(255), random(255), random(255), 200);
  }

  update() {
    this.pos.add(this.vel);
    this.lifetime--;
  }

  show() {
    noStroke();
    fill(this.col);
    ellipse(this.pos.x, this.pos.y, this.size);
  }

  finished() {
    return this.lifetime <= 0;
  }
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
}
