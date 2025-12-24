// Game Configuration
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Load Freddie image
const freddieImg = new Image();
freddieImg.src = 'Freddie.png';

// Game State
const game = {
    state: 'start', // 'start', 'playing', 'gameover'
    wave: 1,
    score: 0,
    lives: 3,
    donuts: 10,
    freddies: [],
    thrownDonuts: [],
    particles: [],
    waveComplete: false,
    waveDelay: 0,
    spawnTimer: 0,
    freddiesToSpawn: 0,
    freddiesSpawned: 0,
    donutRegenTimer: 0,
    texasDonutProgress: 0,
    texasDonutReady: false,
    texasDonutActive: false,
    texasDonutAnimation: 0,
    donutBoxes: [],
    donutBoxSpawnTimer: 0
};

// Texas Donut Configuration
const TEXAS_DONUT_REQUIRED = 15; // Freddies needed to charge

// Freddie Class
class Freddie {
    constructor(wave) {
        this.x = Math.random() * (canvas.width - 60) + 30;
        this.y = -50;
        this.width = 50;
        this.height = 60;
        this.speed = 1 + (wave * 0.3); // Gets faster each wave
        this.health = 1 + Math.floor(wave / 3); // More health every 3 waves
        this.maxHealth = this.health;
        this.angle = 0;
        this.wobble = Math.random() * Math.PI * 2;
        this.satisfied = false;
        this.satisfiedTimer = 0;
        this.hue = Math.random() * 60 - 30; // Color variation
    }

    update() {
        if (this.satisfied) {
            this.satisfiedTimer++;
            this.y += 2;
            this.angle += 0.2;
            this.width *= 0.98;
            this.height *= 0.98;
            return this.satisfiedTimer > 30;
        }

        this.y += this.speed;
        this.wobble += 0.1;
        this.x += Math.sin(this.wobble) * 0.5;

        // Keep in bounds
        this.x = Math.max(this.width / 2, Math.min(canvas.width - this.width / 2, this.x));

        return false; // Not dead
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        const alpha = this.satisfied ? Math.max(0, 1 - this.satisfiedTimer / 30) : 1;
        ctx.globalAlpha = alpha;

        // Draw Freddie's image
        if (freddieImg.complete) {
            // Apply color tint for variety
            if (this.hue !== 0) {
                ctx.filter = `hue-rotate(${this.hue}deg) ${this.satisfied ? 'brightness(1.2)' : 'brightness(0.9) saturate(1.5)'}`;
            } else {
                ctx.filter = this.satisfied ? 'brightness(1.2)' : 'brightness(0.9) saturate(1.5)';
            }
            
            ctx.drawImage(
                freddieImg,
                -this.width / 2,
                -this.height / 2,
                this.width,
                this.height
            );
            
            ctx.filter = 'none';
        }

        // Health bar
        if (!this.satisfied && this.health < this.maxHealth) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(-this.width * 0.4, -this.height * 0.6, this.width * 0.8, 5);
            ctx.fillStyle = '#00FF00';
            ctx.fillRect(-this.width * 0.4, -this.height * 0.6, this.width * 0.8 * (this.health / this.maxHealth), 5);
        }

        ctx.restore();
    }

    hit() {
        this.health--;
        if (this.health <= 0) {
            this.satisfied = true;
            return true; // Fully satisfied
        }
        return false;
    }

    feedTexasDonut() {
        this.satisfied = true;
        this.satisfiedTimer = 0;
    }

    reachedBottom() {
        return this.y > canvas.height + 50;
    }
}

// Donut Class
class Donut {
    constructor(x, y, targetX, targetY) {
        this.x = x;
        this.y = y;
        const angle = Math.atan2(targetY - y, targetX - x);
        const speed = 12;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.radius = 15;
        this.rotation = 0;
        this.rotationSpeed = 0.3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;

        // Remove if off screen
        return this.x < -50 || this.x > canvas.width + 50 || 
               this.y < -50 || this.y > canvas.height + 50;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Donut outer circle
        ctx.fillStyle = '#FFB6C1';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Donut hole
        ctx.fillStyle = '#87CEEB';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Frosting drips
        ctx.fillStyle = '#FF69B4';
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            const x = Math.cos(angle) * this.radius * 0.7;
            const y = Math.sin(angle) * this.radius * 0.7;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    checkCollision(freddie) {
        const dx = this.x - freddie.x;
        const dy = this.y - freddie.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.radius + freddie.width / 2;
    }
}

// Particle Class for effects
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.life = 30;
        this.maxLife = 30;
        this.size = Math.random() * 8 + 4;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.3; // Gravity
        this.life--;
        return this.life <= 0;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Donut Box Class (powerup)
class DonutBox {
    constructor(wave) {
        this.x = Math.random() * (canvas.width - 80) + 40;
        this.y = -60;
        this.width = 50;
        this.height = 50;
        this.speed = 1.5;
        this.wobble = Math.random() * Math.PI * 2;
        this.rotation = 0;
        
        // Health based on wave difficulty
        this.health = Math.max(2, Math.floor(wave / 2) + 1);
        this.maxHealth = this.health;
        
        // Reward based on wave difficulty
        this.donutReward = Math.max(5, 3 + Math.floor(wave / 2) * 2);
    }

    update() {
        this.y += this.speed;
        this.wobble += 0.08;
        this.x += Math.sin(this.wobble) * 0.8;
        this.rotation += 0.05;

        // Keep in bounds
        this.x = Math.max(this.width / 2, Math.min(canvas.width - this.width / 2, this.x));

        // Remove if off screen
        return this.y > canvas.height + 60;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Draw box
        ctx.fillStyle = '#8B4513';
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Draw donut symbol
        ctx.fillStyle = '#FFB6C1';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        // Health bar
        if (this.health < this.maxHealth) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(-this.width * 0.4, this.height * 0.6, this.width * 0.8, 5);
            ctx.fillStyle = '#00FF00';
            ctx.fillRect(-this.width * 0.4, this.height * 0.6, this.width * 0.8 * (this.health / this.maxHealth), 5);
        }

        ctx.restore();

        // Draw floating text showing reward
        ctx.save();
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(`+${this.donutReward}🍩`, this.x, this.y - this.height);
        ctx.fillText(`+${this.donutReward}🍩`, this.x, this.y - this.height);
        ctx.restore();
    }

    hit() {
        this.health--;
        return this.health <= 0;
    }
}

// Create particles
function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        game.particles.push(new Particle(x, y, color));
    }
}

// Calculate donuts needed for a wave
function calculateDonutsNeeded(wave) {
    const freddieCount = 3 + wave * 2;
    const healthPerFreddie = 1 + Math.floor(wave / 3);
    return freddieCount * healthPerFreddie;
}

// Start new wave
function startWave() {
    game.waveComplete = false;
    game.freddiesToSpawn = 3 + game.wave * 2; // More Freddies each wave
    game.freddiesSpawned = 0;
    game.spawnTimer = 0;
    
    // Calculate how many donuts are needed for this wave
    const donutsNeeded = calculateDonutsNeeded(game.wave);
    // Give enough donuts plus 30% extra for misses (minimum 3 extra)
    const donutsToGive = Math.ceil(donutsNeeded * 0.3) + Math.max(3, Math.floor(donutsNeeded * 0.1));
    // Add donuts but don't exceed a reasonable cap (needed + extras)
    const maxDonuts = donutsNeeded + donutsToGive;
    game.donuts = Math.min(game.donuts + donutsToGive, maxDonuts);
    
    // Reset donut box spawn timer for new wave
    game.donutBoxSpawnTimer = 300 + Math.random() * 300; // Spawn between 5-10 seconds
    
    updateUI();
}

// Spawn a Freddie
function spawnFreddie() {
    if (game.freddiesSpawned < game.freddiesToSpawn) {
        game.freddies.push(new Freddie(game.wave));
        game.freddiesSpawned++;
        game.spawnTimer = 60 - game.wave * 2; // Spawn faster each wave
    }
}

// Update game
function update() {
    if (game.state !== 'playing') return;

    // Spawn Freddies
    if (!game.waveComplete) {
        game.spawnTimer--;
        if (game.spawnTimer <= 0) {
            spawnFreddie();
        }

        // Spawn donut boxes occasionally
        game.donutBoxSpawnTimer--;
        if (game.donutBoxSpawnTimer <= 0 && game.donutBoxes.length < 2) {
            game.donutBoxes.push(new DonutBox(game.wave));
            // Next box spawns after a random interval
            game.donutBoxSpawnTimer = 400 + Math.random() * 400; // 6-13 seconds
        }

        // Check if wave is complete
        if (game.freddiesSpawned >= game.freddiesToSpawn && game.freddies.length === 0) {
            game.waveComplete = true;
            game.waveDelay = 120; // 2 second delay
        }
    } else {
        game.waveDelay--;
        if (game.waveDelay <= 0) {
            game.wave++;
            startWave();
        }
    }

    // Update Freddies
    for (let i = game.freddies.length - 1; i >= 0; i--) {
        const freddie = game.freddies[i];
        const shouldRemove = freddie.update();

        if (shouldRemove) {
            game.freddies.splice(i, 1);
            if (freddie.satisfied) {
                game.score += 100 * game.wave;
                createParticles(freddie.x, freddie.y, '#FFD700', 15);
            }
        } else if (!freddie.satisfied && freddie.reachedBottom()) {
            game.freddies.splice(i, 1);
            game.lives--;
            createParticles(freddie.x, canvas.height - 20, '#FF0000', 20);
            
            if (game.lives <= 0) {
                gameOver();
            }
        }
    }

    // Update donut boxes
    for (let i = game.donutBoxes.length - 1; i >= 0; i--) {
        const box = game.donutBoxes[i];
        const offScreen = box.update();

        if (offScreen) {
            game.donutBoxes.splice(i, 1);
        }
    }

    // Update donuts
    for (let i = game.thrownDonuts.length - 1; i >= 0; i--) {
        const donut = game.thrownDonuts[i];
        const offScreen = donut.update();

        if (offScreen) {
            game.thrownDonuts.splice(i, 1);
            continue;
        }

        // Check collision with donut boxes first
        let donutHit = false;
        for (let j = game.donutBoxes.length - 1; j >= 0; j--) {
            const box = game.donutBoxes[j];
            const dx = donut.x - box.x;
            const dy = donut.y - box.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < donut.radius + box.width / 2) {
                const destroyed = box.hit();
                game.thrownDonuts.splice(i, 1);
                donutHit = true;
                createParticles(box.x, box.y, '#FFB6C1', 8);
                game.score += 25;
                
                if (destroyed) {
                    // Box destroyed! Award donuts
                    game.donuts += box.donutReward;
                    game.donutBoxes.splice(j, 1);
                    createParticles(box.x, box.y, '#FFD700', 20);
                    createParticles(box.x, box.y, '#8B4513', 15);
                    game.score += 100;
                }
                break;
            }
        }

        if (donutHit) continue;

        // Check collision with Freddies
        for (let j = game.freddies.length - 1; j >= 0; j--) {
            const freddie = game.freddies[j];
            if (!freddie.satisfied && donut.checkCollision(freddie)) {
                const satisfied = freddie.hit();
                game.thrownDonuts.splice(i, 1);
                createParticles(donut.x, donut.y, '#FFB6C1', 8);
                game.score += 10;
                
                // Add progress to Texas Donut when Freddie is fully satisfied
                if (satisfied && !game.texasDonutReady) {
                    game.texasDonutProgress++;
                    if (game.texasDonutProgress >= TEXAS_DONUT_REQUIRED) {
                        game.texasDonutReady = true;
                        game.texasDonutProgress = TEXAS_DONUT_REQUIRED;
                        createParticles(canvas.width / 2, 100, '#FFD700', 30);
                    }
                }
                break;
            }
        }
    }

    // Update Texas Donut animation
    if (game.texasDonutActive) {
        game.texasDonutAnimation++;
        if (game.texasDonutAnimation > 60) { // Animation lasts 1 second
            game.texasDonutActive = false;
            game.texasDonutAnimation = 0;
        }
    }

    // Update particles
    for (let i = game.particles.length - 1; i >= 0; i--) {
        if (game.particles[i].update()) {
            game.particles.splice(i, 1);
        }
    }

    // Regenerate donuts slowly (but with higher cap based on wave)
    game.donutRegenTimer++;
    const donutCap = calculateDonutsNeeded(game.wave) + Math.ceil(calculateDonutsNeeded(game.wave) * 0.4);
    if (game.donutRegenTimer > 180 && game.donuts < donutCap) { // Every 3 seconds
        game.donuts++;
        game.donutRegenTimer = 0;
    }

    updateUI();
}

// Draw game
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(0.5, '#98D8E8');
    gradient.addColorStop(1, '#90EE90');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw clouds
    drawClouds();

    // Draw wave complete message
    if (game.waveComplete && game.state === 'playing') {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, canvas.height / 2 - 50, canvas.width, 100);
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Wave ${game.wave} Complete!`, canvas.width / 2, canvas.height / 2);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(`Next wave incoming...`, canvas.width / 2, canvas.height / 2 + 40);
        ctx.restore();
    }

    // Draw particles
    game.particles.forEach(particle => particle.draw());

    // Draw donuts
    game.thrownDonuts.forEach(donut => donut.draw());

    // Draw donut boxes
    game.donutBoxes.forEach(box => box.draw());

    // Draw Freddies
    game.freddies.forEach(freddie => freddie.draw());

    // Draw Texas Donut animation
    if (game.texasDonutActive) {
        drawTexasDonutAnimation();
    }

    // Draw danger zone
    ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
    ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
}

// Draw Texas Donut animation
function drawTexasDonutAnimation() {
    const progress = game.texasDonutAnimation / 60;
    const size = 100 + (progress * 400); // Grows to 500px
    const alpha = 1 - progress;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(progress * Math.PI * 4);

    // Giant donut
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(0.5, '#FF8C00');
    gradient.addColorStop(1, '#FF6347');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Donut hole
    ctx.fillStyle = 'rgba(135, 206, 235, 0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, size / 5, 0, Math.PI * 2);
    ctx.fill();

    // Sprinkles
    ctx.fillStyle = '#FF69B4';
    for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 / 20) * i;
        const distance = size / 3;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// Draw decorative clouds
let cloudOffset = 0;
function drawClouds() {
    cloudOffset += 0.2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    
    for (let i = 0; i < 5; i++) {
        const x = ((cloudOffset + i * 250) % (canvas.width + 200)) - 100;
        const y = 50 + i * 40;
        
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.arc(x + 25, y, 35, 0, Math.PI * 2);
        ctx.arc(x + 50, y, 30, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Activate Texas Donut
function activateTexasDonut() {
    if (!game.texasDonutReady || game.texasDonutActive) return;

    game.texasDonutActive = true;
    game.texasDonutAnimation = 0;
    game.texasDonutReady = false;
    game.texasDonutProgress = 0;

    // Feed all Freddies on screen
    game.freddies.forEach(freddie => {
        if (!freddie.satisfied) {
            freddie.feedTexasDonut();
            game.score += 100 * game.wave;
        }
    });

    // Create massive particle explosion
    createParticles(canvas.width / 2, canvas.height / 2, '#FFD700', 50);
    createParticles(canvas.width / 2, canvas.height / 2, '#FF8C00', 50);
    
    updateUI();
}

// Update UI
function updateUI() {
    document.getElementById('lives').textContent = game.lives;
    document.getElementById('donuts').textContent = game.donuts;
    document.getElementById('wave').textContent = game.wave;
    document.getElementById('score').textContent = game.score;
    
    // Update Texas Donut progress
    const progressBar = document.getElementById('texasProgress');
    const texasButton = document.getElementById('texasButton');
    
    if (progressBar) {
        progressBar.style.width = (game.texasDonutProgress / TEXAS_DONUT_REQUIRED * 100) + '%';
    }
    
    if (texasButton) {
        if (game.texasDonutReady) {
            texasButton.classList.add('ready');
            texasButton.disabled = false;
        } else {
            texasButton.classList.remove('ready');
            texasButton.disabled = true;
        }
        texasButton.textContent = game.texasDonutReady 
            ? '🌟 TEXAS DONUT READY! 🌟' 
            : `Texas Donut: ${game.texasDonutProgress}/${TEXAS_DONUT_REQUIRED}`;
    }
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start game
function startGame() {
    game.state = 'playing';
    game.wave = 1;
    game.score = 0;
    game.lives = 3;
    game.donuts = 10;
    game.freddies = [];
    game.thrownDonuts = [];
    game.particles = [];
    game.donutRegenTimer = 0;
    game.texasDonutProgress = 0;
    game.texasDonutReady = false;
    game.texasDonutActive = false;
    game.texasDonutAnimation = 0;
    game.donutBoxes = [];
    game.donutBoxSpawnTimer = 0;
    
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    
    startWave();
    updateUI();
}

// Game over
function gameOver() {
    game.state = 'gameover';
    document.getElementById('finalScore').textContent = game.score;
    
    let message = '';
    if (game.wave < 3) {
        message = "The Freddies were too hungry! Try feeding them faster!";
    } else if (game.wave < 5) {
        message = "Not bad! You survived " + game.wave + " waves of hungry Freddies!";
    } else if (game.wave < 8) {
        message = "Impressive! You're a donut-throwing master!";
    } else {
        message = "LEGENDARY! You survived " + game.wave + " waves! The Freddies are in awe!";
    }
    
    document.getElementById('gameOverMessage').textContent = message;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

// Mouse click to throw donut
canvas.addEventListener('click', (e) => {
    if (game.state !== 'playing' || game.donuts <= 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    game.thrownDonuts.push(new Donut(canvas.width / 2, canvas.height - 50, x, y));
    game.donuts--;
    updateUI();
});

// Event listeners
document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('restartButton').addEventListener('click', startGame);
document.getElementById('texasButton').addEventListener('click', activateTexasDonut);

// Keyboard shortcut for Texas Donut (Spacebar)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && game.state === 'playing' && game.texasDonutReady) {
        e.preventDefault();
        activateTexasDonut();
    }
});

// Start game loop
gameLoop();

