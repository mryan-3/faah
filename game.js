const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const dpr = window.devicePixelRatio || 1;

const streakEl = document.getElementById('streak');
const intensityEl = document.getElementById('intensity-label');
const catchCountEl = document.getElementById('catch-count');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const gameContainer = document.getElementById('game-container');

let width, height;
let gameRunning = false;
let whiffStreak = 0;
let catchCount = 0;
let difficultyLevel = 1;

const objects = [];
const particles = [];
const ripples = [];
const particlePool = [];
const fontCache = new Map();

const audio = new Audio('fahhhhhhhhhhhhhh.mp3');
audio.preload = 'auto';
audio.volume = 0.4;

const objectTypes = [
    { emoji: '⚽', baseSize: 48, baseSpeed: 2.2 },
    { emoji: '📦', baseSize: 52, baseSpeed: 1.8 },
    { emoji: '🥪', baseSize: 44, baseSpeed: 2.5 },
    { emoji: '📱', baseSize: 40, baseSpeed: 2.8 },
    { emoji: '🔑', baseSize: 36, baseSpeed: 3.2 },
    { emoji: '💎', baseSize: 32, baseSpeed: 3.6 },
    { emoji: '🎾', baseSize: 42, baseSpeed: 2.4 },
    { emoji: '🍩', baseSize: 46, baseSpeed: 2.3 },
];

function getFont(size) {
    const roundedSize = Math.round(size);
    if (!fontCache.has(roundedSize)) {
        fontCache.set(roundedSize, `${roundedSize}px Arial`);
    }
    return fontCache.get(roundedSize);
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
}

function getDifficultyMultiplier() {
    return 1 + (difficultyLevel - 1) * 0.18;
}

function getSpawnInterval() {
    return Math.max(450, 1000 - (difficultyLevel - 1) * 120);
}

function getParticle() {
    return particlePool.pop() || {};
}

function releaseParticle(p) {
    if (particlePool.length < 300) {
        particlePool.push(p);
    }
}

function createObject() {
    const type = objectTypes[Math.floor(Math.random() * objectTypes.length)];
    const speedMult = getDifficultyMultiplier();
    
    return {
        x: Math.random() * (width - 100) + 50,
        y: -80,
        vy: type.baseSpeed * speedMult,
        ay: 0.05,
        size: type.baseSize * Math.min(1.2, 0.85 + difficultyLevel * 0.02),
        emoji: type.emoji,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.12,
        active: true,
    };
}

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const p = getParticle();
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 3;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - 2;
        p.life = 1;
        p.decay = 0.015 + Math.random() * 0.025;
        p.size = Math.random() * 4 + 2;
        p.color = color;
        particles.push(p);
    }
}

function createRipple(x, y) {
    ripples.push({
        x, y,
        r: 5,
        alpha: 0.6,
    });
}

function playFah() {
    const sound = audio.cloneNode();
    const intensityBonus = Math.min(whiffStreak * 0.04, 0.6);
    sound.volume = Math.min(0.3 + intensityBonus, 1);
    sound.playbackRate = 0.85 + (whiffStreak * 0.02);
    sound.play();

    gameContainer.classList.remove('screen-shake');
    void gameContainer.offsetWidth;
    gameContainer.classList.add('screen-shake');

    const particleCount = 10 + whiffStreak * 3;
    for (let i = 0; i < particleCount; i++) {
        spawnParticles(
            Math.random() * width,
            height + 20,
            '#ff4757',
            1
        );
    }
}

function updateUI() {
    streakEl.textContent = whiffStreak;
    streakEl.classList.remove('pulse');
    void streakEl.offsetWidth;
    streakEl.classList.add('pulse');
    
    if (whiffStreak >= 10) {
        intensityEl.textContent = 'CRITICAL FAILURE';
        intensityEl.style.color = '#ff4757';
    } else if (whiffStreak >= 5) {
        intensityEl.textContent = 'HIGH INTENSITY';
        intensityEl.style.color = '#ffa502';
    } else {
        intensityEl.textContent = `INTENSITY ${difficultyLevel}`;
        intensityEl.style.color = '#747d8c';
    }

    catchCountEl.textContent = catchCount;
}

function handleInput(x, y) {
    if (!gameRunning) return;

    createRipple(x, y);

    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (!obj.active) continue;

        const dx = x - obj.x;
        const dy = y - obj.y;
        const distSq = dx * dx + dy * dy;
        const hitRadius = obj.size * 0.75 + 30;
        const hitRadiusSq = hitRadius * hitRadius;

        if (distSq < hitRadiusSq) {
            obj.active = false;
            catchCount++;
            
            const newLevel = Math.floor(catchCount / 8) + 1;
            if (newLevel > difficultyLevel) {
                difficultyLevel = newLevel;
            }
            
            whiffStreak = Math.max(0, whiffStreak - 1);
            spawnParticles(obj.x, obj.y, '#2ed573', 15);
            updateUI();
            return;
        }
    }
}

let lastSpawnTime = 0;
let lastFrameTime = 0;

function update(timestamp) {
    const dt = timestamp - lastFrameTime;
    const timeStep = Math.min(dt / 16.67, 3);
    lastFrameTime = timestamp;

    if (timestamp - lastSpawnTime > getSpawnInterval()) {
        objects.push(createObject());
        if (difficultyLevel >= 4 && Math.random() < 0.35) {
            objects.push(createObject());
        }
        lastSpawnTime = timestamp;
    }

    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (obj.active) {
            obj.vy += obj.ay * timeStep;
            obj.y += obj.vy * timeStep;
            obj.rotation += obj.rotationSpeed * timeStep;
            if (obj.y > height + 80) {
                whiffStreak++;
                playFah();
                updateUI();
                obj.active = false;
            }
        }
        if (obj.y > height + 100 || !obj.active) {
            objects.splice(i, 1);
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * timeStep;
        p.y += p.vy * timeStep;
        p.vy += 0.22 * timeStep;
        p.life -= p.decay * timeStep;
        if (p.life <= 0) {
            releaseParticle(particles.splice(i, 1)[0]);
        }
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.r += 4 * timeStep;
        r.alpha -= 0.04 * timeStep;
        if (r.alpha <= 0) {
            ripples.splice(i, 1);
        }
    }
}

function draw() {
    ctx.fillStyle = whiffStreak > 10 ? '#1e1e2e' : '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    if (whiffStreak > 10) {
        ctx.fillStyle = '#ff4757';
        ctx.font = '14px "Space Mono"';
        ctx.fillText('STREAK OF FAILURE', width / 2, height - 60);
    }

    for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        if (!obj.active) continue;
        ctx.save();
        ctx.translate(obj.x, obj.y);
        ctx.rotate(obj.rotation);
        ctx.font = getFont(obj.size);
        ctx.fillText(obj.emoji, 0, 0);
        ctx.restore();
    }

    ctx.save();
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    ctx.save();
    for (let i = 0; i < ripples.length; i++) {
        const r = ripples[i];
        ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

function gameLoop(timestamp) {
    if (!gameRunning) return;
    update(timestamp);
    draw();
    requestAnimationFrame(gameLoop);
}

function startGame() {
    gameRunning = true;
    whiffStreak = 0;
    catchCount = 0;
    difficultyLevel = 1;
    objects.length = 0;
    particles.length = 0;
    ripples.length = 0;
    updateUI();
    startScreen.classList.add('hidden');
    lastFrameTime = performance.now();
    lastSpawnTime = lastFrameTime;
    requestAnimationFrame(gameLoop);
}

resize();
window.addEventListener('resize', resize);
canvas.addEventListener('pointerdown', (e) => {
    handleInput(e.clientX, e.clientY);
});
startBtn.addEventListener('click', startGame);
startBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    startGame();
});
