// game.js
import { SoundManager } from './audio.js';
import { Player, Obstacle, Mountains } from './entities.js';

// --- গেম স্টেট ম্যানেজমেন্ট ---
export const GameState = { READY: 'READY', RUNNING: 'RUNNING', OVER: 'OVER' };
let gameState = GameState.READY;

// --- কনফিগারেশন ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const gameOverScreen = document.getElementById('game-over-screen');
const startScreen = document.getElementById('start-screen');
const touchArea = document.getElementById('touch-area');
const startButton = document.getElementById('startButton'); // <--- নতুন বাটন ID সংজ্ঞায়িত

const GROUND_Y = canvas.height - 40;
const INITIAL_SPEED = 300; 
let GAME_SPEED = INITIAL_SPEED;
const MAX_SPEED = 700; 
const DIFFICULTY_INCREMENT = 3; 
const BOOST_SCORE_INTERVAL = 500;
const SPEED_BOOST_AMOUNT = 100; 
const MAX_JUMP_VELOCITY = -550; 
const GROUND_TILE_WIDTH = 50; 

// --- AI কনফিগারেশন ---
const AI_SUCCESS_THRESHOLD = 5; 
const AI_GRAVITY_MODIFIER = 200; 
let lastObstacleHeight = 0;
let lastObstacleSpawnedTime = 0;

// --- গেম অবজেক্ট ---
const soundManager = new SoundManager();
const mountains = new Mountains(canvas, GROUND_Y);
const player = new Player(canvas, GROUND_Y, MAX_JUMP_VELOCITY, soundManager);
let obstacles = [];

let score = 0;
let highScore = 0;
let lastBoostScore = 0;
let frameCount = 0;
let groundX = 0;
let animationFrameId;

// --- ডেল্টা টাইম ভেরিয়েবল ---
let lastTime = 0;
let deltaTime = 0; 
const FPS_MULTIPLIER = 1000; 
let jumpFlashTimer = 0; 

// --- ভিজ্যুয়াল লজিক: রিপিটিং গ্রাউন্ড (drawGround) ---
function drawGround() {
    const FIXED_MOVEMENT = (GAME_SPEED / 1000) * (1000/60); 
    groundX = (groundX - FIXED_MOVEMENT) % GROUND_TILE_WIDTH;
    
    ctx.fillStyle = '#0f0a1c'; 
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    
    ctx.shadowColor = '#00FFFF';
    ctx.shadowBlur = 5;
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2;
    for (let x = groundX; x < canvas.width; x += GROUND_TILE_WIDTH / 2) {
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y);
        ctx.lineTo(x, GROUND_Y + 10);
        ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(canvas.width, GROUND_Y);
    ctx.stroke();
}

// --- AI লজিক: ডায়নামিক ডিফিকাল্টি স্কেলিং ও বুস্ট (dynamicDifficulty) ---
function dynamicDifficulty() {
    if (GAME_SPEED < MAX_SPEED) {
        GAME_SPEED += (DIFFICULTY_INCREMENT / FPS_MULTIPLIER) * deltaTime;
    }

    if (score > lastBoostScore + BOOST_SCORE_INTERVAL) {
        if (GAME_SPEED + SPEED_BOOST_AMOUNT < MAX_SPEED) {
             GAME_SPEED += SPEED_BOOST_AMOUNT;
        } else {
            GAME_SPEED = MAX_SPEED;
        }
        lastBoostScore = score;
    }

    if (player.successfulJumps >= AI_SUCCESS_THRESHOLD) {
        if (player.gravity < player.baseGravity + AI_GRAVITY_MODIFIER * 3) {
            player.gravity += AI_GRAVITY_MODIFIER; 
            player.MAX_JUMP_VELOCITY -= 50; 
            player.successfulJumps = 0;
            console.log("AI Adapted: Difficulty Increased by Modifying Gravity/Jump.");
        }
    }

    let minGap = 80;
    let maxGap = 200;
    const gapFactor = 1 - (GAME_SPEED / MAX_SPEED) * 0.7;
    const currentGap = minGap + (maxGap - minGap) * gapFactor;
    return currentGap;
}

let obstacleSpawnTimer = 0;
function generateObstacles() {
    const spawnGap = dynamicDifficulty();

    if (obstacleSpawnTimer <= 0) {
        let randomHeight = Math.random() * 30 + 30; 
        const currentTime = performance.now();
        
        if (player.isJumping && player.velocityY < 0 && currentTime - lastObstacleSpawnedTime < 500) {
             obstacleSpawnTimer = 200; 
             return; 
        }

        if (lastObstacleHeight > 50 && Math.random() < 0.6) {
            randomHeight = Math.random() * 15 + 20; 
        }

        const newObstacle = new Obstacle(canvas, GROUND_Y, randomHeight);
        obstacles.push(newObstacle);

        lastObstacleHeight = newObstacle.height;
        lastObstacleSpawnedTime = currentTime;
        obstacleSpawnTimer = spawnGap + Math.random() * 50;

    } else {
        obstacleSpawnTimer -= deltaTime; 
    }
}

// --- AI ট্র্যাকিং: সফল জাম্প গণনা (trackPlayerSuccess) ---
function trackPlayerSuccess() {
    const playerBaseY = player.GROUND_Y - player.height;
    
    if (player.y < playerBaseY && player.velocityY > 0) {
        const nearestObstacle = obstacles[0];
        
        if (nearestObstacle && nearestObstacle.x + nearestObstacle.width < player.x) {
            if (!nearestObstacle.passed) { 
                player.successfulJumps++; 
                nearestObstacle.passed = true;
                console.log(`Success! Total successful jumps: ${player.successfulJumps}`);
            }
        }
    }
}

// --- কলিশন ডিটেকশন (checkCollision) ---
function checkCollision() {
    const playerHitbox = player.getHitbox();
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        
        if (
            playerHitbox.x < obs.x + obs.width &&
            playerHitbox.x + playerHitbox.width > obs.x &&
            playerHitbox.y < obs.y + obs.height &&
            playerHitbox.y + playerHitbox.height > obs.y
        ) {
            endGame();
            return true;
        }
    }
    return false;
}

// --- গেম স্টেট ম্যানেজমেন্ট (startGame, endGame, resetGame) ---
function resetGame() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('runnerHighScore', highScore);
    }
    score = 0;
    GAME_SPEED = INITIAL_SPEED;
    lastBoostScore = 0;
    obstacles = [];
    player.reset(); 
    frameCount = 0;
    highScore = localStorage.getItem('runnerHighScore') || 0;
}

export function startGame() {
    if (gameState === GameState.RUNNING) return;
    gameState = GameState.RUNNING;
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    resetGame();
    lastTime = performance.now(); 
    gameLoop(lastTime);
}

function endGame() {
    if (gameState === GameState.OVER) return;
    gameState = GameState.OVER;
    cancelAnimationFrame(animationFrameId);
    
    document.getElementById('final-score').innerHTML = 
        `Final Score: <span style="color:#FF00FF">${score.toString().padStart(6, '0')}</span><br>
         High Score: ${highScore.toString().padStart(6, '0')}`;
    gameOverScreen.classList.add('active');
    soundManager.playGameOver();
}

// --- প্রধান গেম লুপ (gameLoop) ---
function gameLoop(currentTime) {
    deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    const dt = deltaTime / FPS_MULTIPLIER; 

    if (gameState !== GameState.RUNNING) {
        if (jumpFlashTimer > 0) jumpFlashTimer -= dt;
        return;
    }

    // A. আপডেট
    player.update(dt); 
    generateObstacles();
    obstacles.forEach(obs => obs.update(GAME_SPEED));
    obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
    checkCollision();
    trackPlayerSuccess();

    // B. ড্র
    ctx.fillStyle = '#0f0a1c'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    mountains.draw(GAME_SPEED);
    drawGround();
    player.draw(frameCount, gameState);
    obstacles.forEach(obs => obs.draw());

    // C. UX/UI ফিডব্যাক
    if (jumpFlashTimer > 0) {
        ctx.fillStyle = `rgba(0, 255, 255, ${jumpFlashTimer * 0.5})`; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        jumpFlashTimer -= dt * 2; 
    }

    // D. স্কোরিং
    frameCount++;
    score += Math.floor(GAME_SPEED * dt); 
    
    let scoreText = score.toString().padStart(6, '0');
    if (score > highScore && score > 0) {
        scoreText = `<span style="color:#FFD700; text-shadow: 0 0 5px #FFD700;">${scoreText}</span>`;
    }
    scoreDisplay.innerHTML = 'SCORE: ' + scoreText;

    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- ইনপুট হ্যান্ডলিং ---
function handleJumpInput(event) {
    if (event.type === 'touchstart') { event.preventDefault(); }
    
    if (gameState === GameState.READY) {
        startGame();
    } else if (gameState === GameState.RUNNING) {
        player.jump();
        jumpFlashTimer = 1; 
    }
}

document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'ArrowUp') {
        handleJumpInput(event);
    }
    if (gameState === GameState.OVER && (event.code === 'Enter' || event.code === 'KeyR')) {
         location.reload(); 
    }
});

touchArea.addEventListener('mousedown', handleJumpInput); 
touchArea.addEventListener('touchstart', handleJumpInput); 

// startButton কে ইভেন্ট লিসেনার দিয়ে হ্যান্ডেল করা হচ্ছে
startButton.addEventListener('click', handleJumpInput); // <--- ফিক্সড লাইন

window.game = { startGame, player, gameState: GameState };

window.onload = () => {
    highScore = localStorage.getItem('runnerHighScore') || 0;
    document.getElementById('final-score').innerHTML = `High Score: ${highScore.toString().padStart(6, '0')}`;
};
