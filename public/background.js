const canvas = document.getElementById("backgroundCanvas");
const ctx = canvas.getContext("2d");

// Resize canvas to fill the window
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Particle class
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 8 + 2; // Larger size range
    this.speedX = Math.random() * 2 - 1; // Slower speed for smoother movement
    this.speedY = Math.random() * 2 - 1;
    this.lifespan = 100; // Add lifespan to particles
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.lifespan -= 1; // Decrease lifespan

    // Bounce off edges
    if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
    if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
  }

  draw() {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.5})`; // Adjust particle opacity for better visibility
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }
}

// Create particles
const particles = [];

// Move the static particle to the top-left corner for better visibility
particles.push(new Particle(50, 50)); // Add a particle at (50, 50)

// Mouse interaction
const mouse = {
  x: null,
  y: null,
};

canvas.addEventListener("mousemove", (event) => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;

  // Add particles near the mouse
  for (let i = 0; i < 5; i++) { // Reduced number of particles for better performance
    const offsetX = (Math.random() - 0.5) * 30; // Adjusted spread for better clustering
    const offsetY = (Math.random() - 0.5) * 30;
    particles.push(new Particle(mouse.x + offsetX, mouse.y + offsetY));
  }
});

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles.forEach((particle, index) => {
    particle.update();
    particle.draw();

    // Remove particles when their lifespan ends
    if (particle.lifespan <= 0) {
      particles.splice(index, 1);
    }
  });

  requestAnimationFrame(animate);
}

animate();
