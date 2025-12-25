// Game Configuration
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Mobile responsive canvas sizing
function resizeCanvas() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // Use visual viewport if available (better for mobile)
        const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        canvas.width = window.innerWidth;
        canvas.height = vh;
    } else {
        canvas.width = 1000;
        canvas.height = 700;
    }
}

// Initial resize
resizeCanvas();

// Resize on orientation change and viewport changes
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeCanvas);
}

// Load Freddie image
const freddieImg = new Image();
freddieImg.src = 'Freddie.png';

// Store original aspect ratio once image loads
let freddieAspectRatio = 0.833; // Default aspect ratio (50/60 from original dimensions)
let freddieImageLoaded = false;
freddieImg.onload = function() {
    freddieAspectRatio = freddieImg.width / freddieImg.height;
    freddieImageLoaded = true;
};

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
    texasDonutCount: 0, // Changed to count stockpiled Texas donuts
    texasDonutActive: false,
    texasDonutAnimation: 0,
    donutBoxes: [],
    donutBoxSpawnTimer: 0,
    texasDonutBoxes: [], // New: falling Texas donuts to collect
    texasDonutBoxSpawnTimer: 0,
    texasDonutChunks: [], // Explosion chunks
    texasDonutShockwaves: [], // Shockwave rings
    lifeHearts: [], // Falling life powerups
    lifeHeartSpawnTimer: 0,
    handThrowAnimation: 0, // Hand throwing animation timer (0 = idle)
    handAimX: 0, // X position hand is aiming at
    handAimY: 0 // Y position hand is aiming at
};

// Texas Donut Configuration
const TEXAS_DONUT_REQUIRED = 25; // Freddies needed to charge

// Freddie Class
class Freddie {
    constructor(wave) {
        // Base height, width calculated from aspect ratio
        this.height = 73; // 21% bigger than original (60 * 1.1 * 1.1 ≈ 73)
        
        // Use actual image aspect ratio if loaded, otherwise use calculated ratio
        if (freddieImageLoaded && freddieImg.naturalWidth && freddieImg.naturalHeight) {
            this.width = this.height * (freddieImg.naturalWidth / freddieImg.naturalHeight);
        } else {
            this.width = this.height * freddieAspectRatio; // Use default/calculated ratio
        }
        
        this.x = Math.random() * (canvas.width - this.width) + this.width / 2;
        this.y = -this.height;
        
        // Health: Square root growth (slower, more predictable)
		const maxHealth = 4; // Maximum health cap
        const maxSpeed = 2.1; // Final speed target - adjust this to change difficulty
        const speedGrowthRate = 0.07;

		this.health = Math.min(maxHealth, Math.floor(Math.sqrt(Math.max(0, wave - 1) / 2.1)) + 1);
        this.maxHealth = this.health;
        
        // Speed: Asymptotically approaches maxSpeed, with 20% reduction per health point
        // Speed penalty: 20% per health point (0.8^(health-1))
        // Health 1: 100%, Health 2: 80%, Health 3: 64%, Health 4: 51.2%
        const healthSpeedMultiplier = Math.pow(0.8, this.health - 1);
        
        // Adjust target speed so max health still reaches maxSpeed
        const maxHealthMultiplier = Math.pow(0.8, maxHealth - 1);
        const adjustedMaxSpeed = maxSpeed / maxHealthMultiplier;
        
        // Base speed grows toward adjusted max, then apply health penalty
        const baseSpeed = 1 + (adjustedMaxSpeed - 1) * (1 - Math.exp(-speedGrowthRate * wave));
        this.speed = baseSpeed * healthSpeedMultiplier;
        this.angle = 0;
        this.wobble = Math.random() * Math.PI * 2;
        
        // Movement complexity increases with wave
        this.wobbleSpeed = 0.1 + (wave * 0.005);
        this.wobbleAmplitude = 0.5 + Math.min(2, wave * 0.05);
        
        this.satisfied = false;
        this.satisfiedTimer = 0;
        
        // More color variation in later waves
        this.hue = Math.random() * Math.min(120, 30 + wave * 3) - Math.min(60, 15 + wave * 1.5);
        
        // Occasional smaller Freddies in later waves (harder to hit)
        if (wave > 10 && Math.random() < 0.15) {
            this.width *= 0.85;
            this.height *= 0.85;
        }
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
        this.wobble += this.wobbleSpeed;
        this.x += Math.sin(this.wobble) * this.wobbleAmplitude;

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

// Donut Chunk Class for Texas Donut explosion
class DonutChunk {
    constructor(x, y, angle, speed) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.3;
        this.size = Math.random() * 30 + 20;
        this.life = 60;
        this.maxLife = 60;
        this.type = Math.random() > 0.5 ? 'donut' : 'frosting';
        this.color = this.type === 'donut' ? '#FFB6C1' : '#FF69B4';
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.4; // Gravity
        this.vx *= 0.98; // Air resistance
        this.rotation += this.rotationSpeed;
        this.life--;
        return this.life <= 0;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.type === 'donut') {
            // Donut chunk
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
            
            // Hole
            ctx.fillStyle = 'rgba(135, 206, 235, 0.3)';
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Frosting chunk
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        }

        ctx.restore();
    }
}

// Shockwave Class for Texas Donut explosion
class Shockwave {
    constructor(x, y, delay = 0) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = 600;
        this.life = 40;
        this.maxLife = 40;
        this.delay = delay;
    }

    update() {
        if (this.delay > 0) {
            this.delay--;
            return false;
        }
        
        this.radius += 20;
        this.life--;
        return this.life <= 0 || this.radius > this.maxRadius;
    }

    draw() {
        if (this.delay > 0) return;
        
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife * 0.6;
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.strokeStyle = '#FF8C00';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

// Life Heart Class (powerup)
class LifeHeart {
    constructor() {
        this.x = Math.random() * (canvas.width - 80) + 40;
        this.y = -60;
        this.width = 40;
        this.height = 40;
        this.speed = 1.2;
        this.wobble = Math.random() * Math.PI * 2;
        this.pulse = 0;
        this.health = 1;
    }

    update() {
        this.y += this.speed;
        this.wobble += 0.1;
        this.x += Math.sin(this.wobble) * 0.6;
        this.pulse += 0.15;

        // Keep in bounds
        this.x = Math.max(this.width / 2, Math.min(canvas.width - this.width / 2, this.x));

        // Remove if off screen
        return this.y > canvas.height + 60;
    }

    draw() {
        ctx.save();
        
        // Pulsing scale
        const scale = 1 + Math.sin(this.pulse) * 0.15;
        
        // Glow effect
        const glowGradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.width * 1.5);
        glowGradient.addColorStop(0, 'rgba(255, 105, 180, 0.4)');
        glowGradient.addColorStop(0.5, 'rgba(255, 105, 180, 0.2)');
        glowGradient.addColorStop(1, 'rgba(255, 105, 180, 0)');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Draw heart emoji (matching the UI)
        ctx.font = `${48 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Shadow for depth
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        ctx.fillText('❤️', this.x, this.y);
        
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.restore();

        // Draw floating text
        ctx.save();
        ctx.fillStyle = '#FF1744';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 3;
        ctx.strokeText('+1 Life', this.x, this.y - this.height - 5);
        ctx.fillText('+1 Life', this.x, this.y - this.height - 5);
        ctx.restore();
    }

    hit() {
        this.health--;
        return this.health <= 0;
    }
}

// Donut Box Class (powerup)
class DonutBox {
    constructor(wave, isTexasDonut = false) {
        this.x = Math.random() * (canvas.width - 80) + 40;
        this.y = -60;
        this.speed = 1.5;
        this.wobble = Math.random() * Math.PI * 2;
        this.rotation = 0;
        this.isTexasDonut = isTexasDonut;
        
        if (isTexasDonut) {
            // Texas donut - appears as a big falling donut
            this.width = 70;
            this.height = 70;
            this.health = 1; // Always 1 hit
            this.maxHealth = 1;
            this.donutReward = 0; // Doesn't give regular donuts
        } else {
            // Regular box with donuts inside
            this.width = 50;
            this.height = 50;
            this.health = 1; // Always 1 hit
            this.maxHealth = 1;
            
            // Reward based on wave difficulty (minimum 6 donuts to match the 6 donuts shown)
            this.donutReward = Math.max(6, 4 + Math.floor(wave / 2) * 2);
        }
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

        if (this.isTexasDonut) {
            // Draw giant Texas donut (not in a box)
            const radius = this.width / 2;
            
            // Outer glow
            const glowGradient = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius * 1.3);
            glowGradient.addColorStop(0, 'rgba(255, 215, 0, 0)');
            glowGradient.addColorStop(0.7, 'rgba(255, 215, 0, 0.3)');
            glowGradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 1.3, 0, Math.PI * 2);
            ctx.fill();
            
            // Donut body
            ctx.fillStyle = '#FFB6C1';
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Donut hole
            ctx.fillStyle = '#87CEEB';
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.35, 0, Math.PI * 2);
            ctx.fill();
            
            // Frosting (golden for Texas)
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.85, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner hole again
            ctx.fillStyle = '#87CEEB';
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.35, 0, Math.PI * 2);
            ctx.fill();
            
            // Sprinkles (colorful)
            const sprinkleColors = ['#FF69B4', '#FF8C00', '#FF6347', '#FFD700'];
            for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 2 / 12) * i;
                const distance = radius * 0.6;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                ctx.fillStyle = sprinkleColors[i % sprinkleColors.length];
                ctx.fillRect(x - 2, y - 4, 4, 8);
            }
            
            // Texas star in the center
            ctx.fillStyle = '#FF6347';
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                const r = i % 2 === 0 ? 8 : 4;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
        } else {
            // Draw box
            ctx.fillStyle = '#8B4513';
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 3;
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

            // Draw 6 little donuts inside the box (2 rows of 3)
            const donutSize = 6;
            const spacing = 13;
            const positions = [
                [-spacing, -spacing], [0, -spacing], [spacing, -spacing],
                [-spacing, spacing], [0, spacing], [spacing, spacing]
            ];
            
            positions.forEach(([dx, dy]) => {
                // Mini donut
                ctx.fillStyle = '#FFB6C1';
                ctx.beginPath();
                ctx.arc(dx, dy, donutSize, 0, Math.PI * 2);
                ctx.fill();
                
                // Mini hole
                ctx.fillStyle = '#8B4513';
                ctx.beginPath();
                ctx.arc(dx, dy, donutSize * 0.35, 0, Math.PI * 2);
                ctx.fill();
                
                // Mini frosting
                ctx.fillStyle = '#FF69B4';
                ctx.beginPath();
                ctx.arc(dx, dy - donutSize * 0.3, donutSize * 0.4, 0, Math.PI * 2);
                ctx.fill();
            });

            // Health bar
            if (this.health < this.maxHealth) {
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#FF0000';
                ctx.fillRect(-this.width * 0.4, this.height * 0.6, this.width * 0.8, 5);
                ctx.fillStyle = '#00FF00';
                ctx.fillRect(-this.width * 0.4, this.height * 0.6, this.width * 0.8 * (this.health / this.maxHealth), 5);
            }
        }

        ctx.restore();

        // Draw floating text showing reward
        if (!this.isTexasDonut) {
            ctx.save();
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeText(`+${this.donutReward}🍩`, this.x, this.y - this.height);
            ctx.fillText(`+${this.donutReward}🍩`, this.x, this.y - this.height);
            ctx.restore();
        } else {
            ctx.save();
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeText('🌟 TEXAS 🌟', this.x, this.y - this.height);
            ctx.fillText('🌟 TEXAS 🌟', this.x, this.y - this.height);
            ctx.restore();
        }
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
    // Use the same formulas as the actual game
    const freddieCount = Math.floor(5 + 3 * Math.log(wave + 1) * wave / 2);
    const healthPerFreddie = Math.min(4, Math.floor(Math.sqrt(Math.max(0, wave - 1) / 2.1)) + 1);
    return freddieCount * healthPerFreddie;
}

// Start new wave
function startWave() {
    game.waveComplete = false;
    // Freddie count: Logarithmic growth (increases but slows down)
    game.freddiesToSpawn = Math.floor(5 + 3 * Math.log(game.wave + 1) * game.wave / 2);
    game.freddiesSpawned = 0;
    game.spawnTimer = 0;
    
    // Calculate how many donuts are needed for this wave
    const donutsNeeded = calculateDonutsNeeded(game.wave);
    // Give FULL amount needed PLUS 20% extra for misses
    const extraPercent = 0.2;
    const extraDonuts = Math.ceil(donutsNeeded * extraPercent);
    const donutsToGive = donutsNeeded + extraDonuts; // Full amount + 20% extra
    // Set donuts to the amount needed (don't add to existing, replace)
    game.donuts = donutsToGive;
    
    // Reset donut box spawn timer for new wave - less frequent and more random
    game.donutBoxSpawnTimer = 600 + Math.random() * 900; // Spawn between 10-25 seconds
    
    // Don't reset Texas donut box timer on wave start - let it continue across waves
    // This makes them appear roughly once every 2-3 waves
    
    // Don't reset life heart timer - let it continue across waves for rare spawns
    
    updateUI();
}

// Spawn a Freddie
function spawnFreddie() {
    if (game.freddiesSpawned < game.freddiesToSpawn) {
        game.freddies.push(new Freddie(game.wave));
        game.freddiesSpawned++;
        
        // Spawn rate: Asymptotically approaches 30 frames (0.5 sec)
        const minRate = 30;
        const maxRate = 65;
        game.spawnTimer = Math.floor(minRate + (maxRate - minRate) * Math.exp(-0.08 * game.wave));
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

        // Spawn donut boxes occasionally - less frequent and more random
        game.donutBoxSpawnTimer--;
        if (game.donutBoxSpawnTimer <= 0 && game.donutBoxes.length < 1) {
            game.donutBoxes.push(new DonutBox(game.wave, false));
            // Next box spawns after a longer random interval
            game.donutBoxSpawnTimer = 800 + Math.random() * 1200; // 13-33 seconds
        }

        // Spawn Texas donut boxes - much rarer, slight increase at higher waves
        game.texasDonutBoxSpawnTimer--;
        if (game.texasDonutBoxSpawnTimer <= 0 && game.texasDonutBoxes.length < 1) {
            game.texasDonutBoxes.push(new DonutBox(game.wave, true));
            // Much rarer spawns, slower frequency increase at higher waves
            const baseInterval = 4800; // Doubled from 2400
            const waveBonus = Math.max(0.7, 1 - (game.wave * 0.01)); // Slower increase (was 0.015)
            game.texasDonutBoxSpawnTimer = Math.floor(baseInterval * waveBonus + Math.random() * 3600);
        }

        // Spawn life hearts - more frequent at higher waves
        game.lifeHeartSpawnTimer--;
        if (game.lifeHeartSpawnTimer <= 0 && game.lifeHearts.length < 1) {
            game.lifeHearts.push(new LifeHeart());
            // More frequent at higher waves to compensate for difficulty
            const baseInterval = 1800;
            const waveBonus = Math.max(0.4, 1 - (game.wave * 0.02)); // Gets more frequent
            game.lifeHeartSpawnTimer = Math.floor(baseInterval * waveBonus + Math.random() * 1200);
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

    // Update Texas donut boxes
    for (let i = game.texasDonutBoxes.length - 1; i >= 0; i--) {
        const box = game.texasDonutBoxes[i];
        const offScreen = box.update();

        if (offScreen) {
            game.texasDonutBoxes.splice(i, 1);
        }
    }

    // Update life hearts
    for (let i = game.lifeHearts.length - 1; i >= 0; i--) {
        const heart = game.lifeHearts[i];
        const offScreen = heart.update();

        if (offScreen) {
            game.lifeHearts.splice(i, 1);
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

        // Check collision with regular donut boxes first
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

        // Check collision with Texas donut boxes
        for (let j = game.texasDonutBoxes.length - 1; j >= 0; j--) {
            const box = game.texasDonutBoxes[j];
            const dx = donut.x - box.x;
            const dy = donut.y - box.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < donut.radius + box.width / 2) {
                // Texas box collected! Award a Texas donut
                game.texasDonutCount++;
                game.texasDonutBoxes.splice(j, 1);
                game.thrownDonuts.splice(i, 1);
                donutHit = true;
                createParticles(box.x, box.y, '#FFD700', 30);
                createParticles(box.x, box.y, '#FF8C00', 20);
                game.score += 500;
                break;
            }
        }

        if (donutHit) continue;

        // Check collision with life hearts
        for (let j = game.lifeHearts.length - 1; j >= 0; j--) {
            const heart = game.lifeHearts[j];
            const dx = donut.x - heart.x;
            const dy = donut.y - heart.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < donut.radius + heart.width / 2) {
                // Life heart collected! Award a life
                game.lives++;
                game.lifeHearts.splice(j, 1);
                game.thrownDonuts.splice(i, 1);
                donutHit = true;
                createParticles(heart.x, heart.y, '#FF1744', 30);
                createParticles(heart.x, heart.y, '#FF69B4', 20);
                createParticles(heart.x, heart.y, '#FFF', 15);
                game.score += 1000;
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
                if (satisfied) {
                    game.texasDonutProgress++;
                    if (game.texasDonutProgress >= TEXAS_DONUT_REQUIRED) {
                        game.texasDonutCount++; // Award a Texas donut!
                        game.texasDonutProgress = 0; // Reset progress for next one
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
        if (game.texasDonutAnimation > 90) { // Animation lasts 1.5 seconds
            game.texasDonutActive = false;
            game.texasDonutAnimation = 0;
        }
    }

    // Update Texas Donut chunks
    for (let i = game.texasDonutChunks.length - 1; i >= 0; i--) {
        if (game.texasDonutChunks[i].update()) {
            game.texasDonutChunks.splice(i, 1);
        }
    }

    // Update Texas Donut shockwaves
    for (let i = game.texasDonutShockwaves.length - 1; i >= 0; i--) {
        if (game.texasDonutShockwaves[i].update()) {
            game.texasDonutShockwaves.splice(i, 1);
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
    // Faster regeneration on mobile (every 2 seconds vs 3 seconds on desktop)
    const isMobile = canvas.width <= 768;
    const regenInterval = isMobile ? 120 : 180; // 2 seconds on mobile, 3 seconds on desktop
    if (game.donutRegenTimer > regenInterval && game.donuts < donutCap) {
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
        
        // Responsive font size based on canvas width
        const isMobile = canvas.width <= 768;
        const titleSize = isMobile ? Math.min(32, canvas.width * 0.08) : 48;
        const subtitleSize = isMobile ? Math.min(18, canvas.width * 0.045) : 24;
        
        ctx.font = `bold ${titleSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`Wave ${game.wave} Complete!`, canvas.width / 2, canvas.height / 2);
        ctx.fillStyle = '#FFF';
        ctx.font = `bold ${subtitleSize}px Arial`;
        ctx.fillText(`Next wave incoming...`, canvas.width / 2, canvas.height / 2 + 40);
        ctx.restore();
    }

    // Draw particles
    game.particles.forEach(particle => particle.draw());

    // Draw donuts
    game.thrownDonuts.forEach(donut => donut.draw());

    // Draw donut boxes
    game.donutBoxes.forEach(box => box.draw());
    
    // Draw Texas donut boxes
    game.texasDonutBoxes.forEach(box => box.draw());

    // Draw life hearts
    game.lifeHearts.forEach(heart => heart.draw());

    // Draw Freddies
    game.freddies.forEach(freddie => freddie.draw());

    // Draw Texas Donut shockwaves (behind explosion)
    game.texasDonutShockwaves.forEach(shockwave => shockwave.draw());

    // Draw Texas Donut animation
    if (game.texasDonutActive) {
        drawTexasDonutAnimation();
    }

    // Draw Texas Donut chunks (on top)
    game.texasDonutChunks.forEach(chunk => chunk.draw());

    // Draw danger zone
    ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
    ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
    
    // Draw hand at bottom center
    if (game.state === 'playing') {
        drawHand();
    }
}

// Helper function to draw rounded rectangle (for browser compatibility)
function drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// Draw hand throwing donuts
function drawHand() {
    const handX = canvas.width / 2;
    const handY = canvas.height - 25;
    
    // Update animation
    if (game.handThrowAnimation > 0) {
        game.handThrowAnimation--;
    }
    
    const isThrowing = game.handThrowAnimation > 0;
    
    // Calculate rotation angle to point at aim target
    let handRotation = 0;
    if (game.handAimX !== 0 || game.handAimY !== 0) {
        const dx = game.handAimX - handX;
        const dy = game.handAimY - handY;
        handRotation = Math.atan2(dy, dx) + Math.PI / 2; // +90° because hand points up by default
    }
    
    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(handRotation);
    
    const handSize = 40;
    
    if (isThrowing) {
        // OPEN PALM (throwing)
        
        // Wrist
        ctx.fillStyle = '#FDBF96';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        drawRoundRect(ctx, -handSize * 0.25, handSize * 0.4, handSize * 0.5, handSize * 0.3, 5);
        ctx.fill();
        ctx.stroke();
        
        // Palm
        ctx.fillStyle = '#FDBF96';
        ctx.beginPath();
        ctx.ellipse(0, 0, handSize * 0.5, handSize * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Thumb (left side, spread out)
        ctx.fillStyle = '#FDBF96';
        ctx.beginPath();
        ctx.ellipse(-handSize * 0.6, handSize * 0.1, handSize * 0.2, handSize * 0.45, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Four fingers (spread out)
        const fingers = [
            { x: -handSize * 0.35, y: -handSize * 0.7, rotation: -0.3 },
            { x: -handSize * 0.12, y: -handSize * 0.85, rotation: -0.1 },
            { x: handSize * 0.12, y: -handSize * 0.85, rotation: 0.1 },
            { x: handSize * 0.35, y: -handSize * 0.7, rotation: 0.3 }
        ];
        
        fingers.forEach(finger => {
            ctx.save();
            ctx.translate(finger.x, finger.y);
            ctx.rotate(finger.rotation);
            
            ctx.fillStyle = '#FDBF96';
            ctx.beginPath();
            ctx.ellipse(0, 0, handSize * 0.15, handSize * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Finger lines
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-handSize * 0.08, -handSize * 0.1);
            ctx.lineTo(handSize * 0.08, -handSize * 0.1);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-handSize * 0.08, handSize * 0.05);
            ctx.lineTo(handSize * 0.08, handSize * 0.05);
            ctx.stroke();
            
            ctx.restore();
        });
        
        // Palm lines
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-handSize * 0.2, handSize * 0.1);
        ctx.quadraticCurveTo(0, handSize * 0.2, handSize * 0.2, handSize * 0.1);
        ctx.stroke();
        
    } else {
        // CLOSED FIST (holding donut)
        
        // Wrist
        ctx.fillStyle = '#FDBF96';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        drawRoundRect(ctx, -handSize * 0.25, handSize * 0.3, handSize * 0.5, handSize * 0.3, 5);
        ctx.fill();
        ctx.stroke();
        
        // Donut in hand (partially visible)
        ctx.fillStyle = '#FFB6C1';
        ctx.beginPath();
        ctx.arc(0, -handSize * 0.1, handSize * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Donut hole
        ctx.fillStyle = '#87CEEB';
        ctx.beginPath();
        ctx.arc(0, -handSize * 0.1, handSize * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Frosting on donut
        ctx.fillStyle = '#FF69B4';
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI * 2 / 4) * i;
            const x = Math.cos(angle) * handSize * 0.18;
            const y = -handSize * 0.1 + Math.sin(angle) * handSize * 0.18;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Palm/Fist
        ctx.fillStyle = '#FDBF96';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, handSize * 0.05, handSize * 0.45, handSize * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Thumb (wrapped around)
        ctx.fillStyle = '#FDBF96';
        ctx.beginPath();
        ctx.ellipse(-handSize * 0.45, 0, handSize * 0.18, handSize * 0.3, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Four curled fingers
        for (let i = 0; i < 4; i++) {
            const fingerX = -handSize * 0.3 + (i * handSize * 0.2);
            const fingerY = -handSize * 0.25;
            
            ctx.fillStyle = '#FDBF96';
            ctx.beginPath();
            ctx.ellipse(fingerX, fingerY, handSize * 0.12, handSize * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Knuckle line
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(fingerX - handSize * 0.08, fingerY);
            ctx.lineTo(fingerX + handSize * 0.08, fingerY);
            ctx.stroke();
        }
    }
    
    ctx.restore();
}

// Draw Texas Donut animation
function drawTexasDonutAnimation() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Phase 1: Donut grows (0-20 frames)
    if (game.texasDonutAnimation <= 20) {
        const progress = game.texasDonutAnimation / 20;
        const size = 50 + (progress * 200); // Grows to 250px
        const pulseSize = size + Math.sin(progress * Math.PI * 4) * 20;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(progress * Math.PI * 2);

        // Giant donut with glow
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, pulseSize);
        gradient.addColorStop(0, '#FFD700');
        gradient.addColorStop(0.4, '#FF8C00');
        gradient.addColorStop(0.7, '#FF6347');
        gradient.addColorStop(1, 'rgba(255, 99, 71, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
        ctx.fill();

        // Donut body
        ctx.fillStyle = '#FFB6C1';
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();

        // Donut hole
        ctx.fillStyle = '#87CEEB';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // Frosting
        ctx.fillStyle = '#FF69B4';
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i;
            const distance = size * 0.7;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.fill();
        }

        // Sprinkles
        ctx.fillStyle = '#FFD700';
        for (let i = 0; i < 24; i++) {
            const angle = (Math.PI * 2 / 24) * i + progress;
            const distance = size * 0.6;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            ctx.fillRect(x - 3, y - 8, 6, 16);
        }

        ctx.restore();
    }
    // Phase 2: Flash and explosion (21-30 frames)
    else if (game.texasDonutAnimation <= 30) {
        const flashProgress = (game.texasDonutAnimation - 20) / 10;
        const flashAlpha = 1 - flashProgress;
        
        // White flash
        ctx.save();
        ctx.globalAlpha = flashAlpha * 0.8;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 300, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Explosion burst
        ctx.save();
        ctx.globalAlpha = flashAlpha;
        const burstGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 400);
        burstGradient.addColorStop(0, '#FFD700');
        burstGradient.addColorStop(0.5, '#FF8C00');
        burstGradient.addColorStop(1, 'rgba(255, 99, 71, 0)');
        ctx.fillStyle = burstGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 400 * flashProgress, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    // Phase 3: Chunks flying (handled by DonutChunk class)
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
    if (game.texasDonutCount <= 0 || game.texasDonutActive) return;

    game.texasDonutActive = true;
    game.texasDonutAnimation = 0;
    game.texasDonutCount--; // Use one Texas donut from stockpile

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Create explosion chunks after a delay
    setTimeout(() => {
        // Create donut chunks flying in all directions
        const chunkCount = 30;
        for (let i = 0; i < chunkCount; i++) {
            const angle = (Math.PI * 2 / chunkCount) * i + Math.random() * 0.3;
            const speed = 8 + Math.random() * 12;
            game.texasDonutChunks.push(new DonutChunk(centerX, centerY, angle, speed));
        }

        // Create shockwave rings
        game.texasDonutShockwaves.push(new Shockwave(centerX, centerY, 0));
        game.texasDonutShockwaves.push(new Shockwave(centerX, centerY, 5));
        game.texasDonutShockwaves.push(new Shockwave(centerX, centerY, 10));

        // Create massive particle explosion
        createParticles(centerX, centerY, '#FFD700', 80);
        createParticles(centerX, centerY, '#FF8C00', 60);
        createParticles(centerX, centerY, '#FFB6C1', 60);
        createParticles(centerX, centerY, '#FF69B4', 40);
    }, 350); // Delay to sync with animation

    // Feed all Freddies on screen
    game.freddies.forEach(freddie => {
        if (!freddie.satisfied) {
            freddie.feedTexasDonut();
            game.score += 100 * game.wave;
        }
    });
    
    updateUI();
}

// Update UI
function updateUI() {
    document.getElementById('lives').textContent = game.lives;
    document.getElementById('donuts').textContent = game.donuts;
    document.getElementById('wave').textContent = game.wave;
    document.getElementById('score').textContent = game.score;
    
    // Update Texas Donut count and progress
    const texasButton = document.getElementById('texasButton');
    const progressBar = document.getElementById('texasProgress');
    
    if (progressBar) {
        progressBar.style.width = (game.texasDonutProgress / TEXAS_DONUT_REQUIRED * 100) + '%';
    }
    
    if (texasButton) {
        if (game.texasDonutCount > 0) {
            texasButton.classList.add('ready');
            texasButton.disabled = false;
            texasButton.textContent = game.texasDonutCount === 1 
                ? '🌟 TEXAS DONUT (1) 🌟' 
                : `🌟 TEXAS DONUTS (${game.texasDonutCount}) 🌟`;
        } else {
            texasButton.classList.remove('ready');
            texasButton.disabled = true;
            texasButton.textContent = `Texas: ${game.texasDonutProgress}/${TEXAS_DONUT_REQUIRED}`;
        }
    }
}

// Game loop with frame rate independence
let lastFrameTime = performance.now();
const targetFPS = 60;
const targetFrameTime = 1000 / targetFPS;

function gameLoop(currentTime) {
    const deltaTime = currentTime - lastFrameTime;
    
    // Only update if enough time has passed (cap at 60 FPS)
    if (deltaTime >= targetFrameTime) {
        update();
        draw();
        lastFrameTime = currentTime - (deltaTime % targetFrameTime);
    }
    
    requestAnimationFrame(gameLoop);
}

// Start game
function startGame() {
    game.state = 'playing';
    game.wave = 1;
    game.score = 0;
    game.lives = 3;
    // More starting donuts on mobile for easier aiming
    const isMobile = canvas.width <= 768;
    game.donuts = isMobile ? 15 : 10;
    game.freddies = [];
    game.thrownDonuts = [];
    game.particles = [];
    game.donutRegenTimer = 0;
    game.texasDonutProgress = 0;
    game.texasDonutCount = 0;
    game.texasDonutActive = false;
    game.texasDonutAnimation = 0;
    game.donutBoxes = [];
    game.donutBoxSpawnTimer = 0;
    game.texasDonutBoxes = [];
    game.texasDonutBoxSpawnTimer = 3600 + Math.random() * 3600; // First one appears 60-120 seconds into game
    game.texasDonutChunks = [];
    game.texasDonutShockwaves = [];
    game.lifeHearts = [];
    game.lifeHeartSpawnTimer = 1200 + Math.random() * 1800; // First one appears 20-50 seconds into game
    
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

// Mouse click AND touch support to throw donut
function handleThrow(e) {
    if (game.state !== 'playing' || game.donuts <= 0) return;

    e.preventDefault(); // Prevent default touch behavior

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    // Handle both mouse and touch events
    if (e.type === 'touchstart' || e.type === 'touchend') {
        const touch = e.changedTouches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    // Get position relative to canvas
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Scale coordinates to match canvas internal dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;

    game.thrownDonuts.push(new Donut(canvas.width / 2, canvas.height - 50, canvasX, canvasY));
    game.donuts--;
    game.handThrowAnimation = 10; // Start throw animation (10 frames = open palm)
    game.handAimX = canvasX; // Store aim position
    game.handAimY = canvasY;
    updateUI();
}

// Track mouse movement for hand aiming (desktop only)
canvas.addEventListener('mousemove', (e) => {
    if (game.state !== 'playing') return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Scale coordinates to match canvas internal dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    game.handAimX = x * scaleX;
    game.handAimY = y * scaleY;
});

// Add both mouse and touch listeners
canvas.addEventListener('click', handleThrow);
canvas.addEventListener('touchend', handleThrow); // Changed from touchstart to touchend for better accuracy

// Prevent default touch behaviors on canvas
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
canvas.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });

// Event listeners
document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('startButton').addEventListener('touchstart', (e) => {
    e.preventDefault();
    startGame();
});

document.getElementById('restartButton').addEventListener('click', startGame);
document.getElementById('restartButton').addEventListener('touchstart', (e) => {
    e.preventDefault();
    startGame();
});

document.getElementById('texasButton').addEventListener('click', activateTexasDonut);
document.getElementById('texasButton').addEventListener('touchstart', (e) => {
    e.preventDefault();
    activateTexasDonut();
});

// Keyboard shortcut for Texas Donut (Spacebar)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && game.state === 'playing' && game.texasDonutCount > 0) {
        e.preventDefault();
        activateTexasDonut();
    }
});

// Start game loop
gameLoop();

