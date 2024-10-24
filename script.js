const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const WORM_RADIUS = 10;
const FOOD_RADIUS = 15;
const OBSTACLE_SIZE = 30;
const KILL_RADIUS = 30;
const GAME_DURATION = 60;
const MIN_SPAWN_TIME = 1000; // 1 sec
const MAX_SPAWN_TIME = 3000; // 3 secs

let canvas, ctx;
let gameLoop;
let score = 0;
let timeRemaining;
let isPaused = false;
let currentLevel = 1;
let worms = [];
let foods = [];
let obstacles = [];
let highScores = {
    level1: 0,
    level2: 0
};

//loading high scores from localStorage
function loadHighScores() {
    const savedScores = localStorage.getItem('highScores');
    if (savedScores) {
        highScores = JSON.parse(savedScores);
    }
    updateHighScoreDisplay();
}

//saving high scores to localStorage
function saveHighScores() {
    localStorage.setItem('highScores', JSON.stringify(highScores));
}

function updateHighScoreDisplay() {
    const level = document.querySelector('input[name="level"]:checked').value;
    const highScore = level === "1" ? highScores.level1 : highScores.level2;
    document.getElementById('highScore').textContent = `High Score: ${highScore}`;
}

function initializeGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    loadHighScores();
    
    //adding level selection change listener
    document.querySelectorAll('input[name="level"]').forEach(radio => {
        radio.addEventListener('change', updateHighScoreDisplay);
    });
}

class Worm {
    constructor(x) {
        this.x = x;
        this.y = 0;
        this.speed = currentLevel === 1 ? 80 : 100;
        this.targetFood = null;
        this.fadeOut = false;
        this.opacity = 1;
        this.lastUpdateTime = performance.now();
    }

    update(deltaTime) {
        const currentTime = performance.now();
        deltaTime = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;

        if (this.fadeOut) {
            this.opacity -= deltaTime / 500; //fade out over 500ms
            if (this.opacity <= 0) {
                return false; //remove the worm when fully faded
            }
            return true; //keep the worm while fading
        }

        if (!this.targetFood || !foods.includes(this.targetFood)) {
            this.findNearestFood();
        }

        if (this.targetFood) {
            const dx = this.targetFood.x - this.x;
            const dy = this.targetFood.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const moveDistance = this.speed * deltaTime / 1000;
            if (distance > 0) {
                this.x += (dx / distance) * moveDistance;
                this.y += (dy / distance) * moveDistance;
            }

            if (distance < FOOD_RADIUS) {
                this.eatFood();
            }
        }

        this.x = Math.max(0, Math.min(this.x, CANVAS_WIDTH));
        this.y = Math.max(0, Math.min(this.y, CANVAS_HEIGHT));

        return true;
    }

    findNearestFood() {
        let nearestDistance = Infinity;
        let nearestFood = null;

        foods.forEach(food => {
            const dx = food.x - this.x;
            const dy = food.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestFood = food;
            }
        });

        this.targetFood = nearestFood;
    }

    eatFood() {
        if (this.targetFood) {
            const foodIndex = foods.indexOf(this.targetFood);
            if (foodIndex !== -1) {
                const foodType = foods[foodIndex].type;
                foods.splice(foodIndex, 1);
                score -= foodType === 1 ? 2 : 4;
                updateScore();
            }
        }
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        
        //worm body
        ctx.beginPath();
        ctx.fillStyle = 'black';
        ctx.arc(this.x, this.y, WORM_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        //draw direction indicator if not fading out
        if (!this.fadeOut && this.targetFood) {
            const angle = Math.atan2(
                this.targetFood.y - this.y,
                this.targetFood.x - this.x
            );
            ctx.beginPath();
            ctx.moveTo(
                this.x + Math.cos(angle) * WORM_RADIUS,
                this.y + Math.sin(angle) * WORM_RADIUS
            );
            ctx.lineTo(
                this.x + Math.cos(angle) * (WORM_RADIUS * 2),
                this.y + Math.sin(angle) * (WORM_RADIUS * 2)
            );
            ctx.strokeStyle = 'black';
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

function startGame() {
    currentLevel = parseInt(document.querySelector('input[name="level"]:checked').value);
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    
    score = 0;
    timeRemaining = GAME_DURATION;
    worms = [];
    foods = [];
    obstacles = [];
    isPaused = false;

    setLevel();
    
    initializeFoods();
    
    initializeObstacles();
    
    startGameLoop();
    startWormSpawner();
    startTimer();
    updateScore();
}

function initializeFoods() {
    //type 1 foods(blue)
    const type1Count = Math.floor(Math.random() * 6) + 1; // 1-6 foods
    for (let i = 0; i < type1Count; i++) {
        addFood(1);
    }
    
    //type 2 foods(red)
    const type2Count = Math.floor(Math.random() * 4) + 1; // 1-4 foods
    for (let i = 0; i < type2Count; i++) {
        addFood(2);
    }
}

function addFood(type) {
    let x, y;
    let validPosition = false;
    
    while (!validPosition) {
        x = Math.random() * (CANVAS_WIDTH - FOOD_RADIUS * 2) + FOOD_RADIUS;
        y = (Math.random() * (CANVAS_HEIGHT * 0.8 - FOOD_RADIUS * 2) + FOOD_RADIUS) + (CANVAS_HEIGHT * 0.2);
        validPosition = isValidPosition(x, y);
    }
    
    foods.push({
        x: x,
        y: y,
        type: type
    });
}

function initializeObstacles() {
    const obstacleCount = Math.floor(Math.random() * 4) + 1; // 1-4 obstacles
    
    for (let i = 0; i < obstacleCount; i++) {
        let x, y;
        let validPosition = false;
        
        while (!validPosition) {
            x = Math.random() * (CANVAS_WIDTH - OBSTACLE_SIZE);
            y = Math.random() * (CANVAS_HEIGHT - OBSTACLE_SIZE);
            validPosition = isValidPosition(x, y, OBSTACLE_SIZE);
        }
        
        obstacles.push({ x, y });
    }
}

function isValidPosition(x, y, size = FOOD_RADIUS * 2) {
    //checking distance from other foods
    for (const food of foods) {
        const dx = food.x - x;
        const dy = food.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < size + FOOD_RADIUS) {
            return false;
        }
    }
    
    //checking distance from obstacles
    for (const obstacle of obstacles) {
        const dx = obstacle.x - x;
        const dy = obstacle.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < size + OBSTACLE_SIZE) {
            return false;
        }
    }
    
    return true;
}

function startGameLoop() {
    let lastTime = performance.now();
    
    function update(currentTime) {
        if (!isPaused) {
            const deltaTime = currentTime - lastTime;
            
            ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            
            drawObstacles();
            drawFoods();
            
            worms = worms.filter(worm => {
                const keepWorm = worm.update(deltaTime);
                if (keepWorm) {
                    worm.draw();
                }
                return keepWorm;
            });
            
            if (foods.length === 0 || timeRemaining <= 0) {//game over
                endGame();
                return;
            }
        }
        
        lastTime = currentTime;
        gameLoop = requestAnimationFrame(update);
    }
    
    gameLoop = requestAnimationFrame(update);
}


function startWormSpawner() {
    function spawnWorm() {
        if (!isPaused && foods.length > 0) {
            //spawn worm at random x pos
            const x = Math.random() * (CANVAS_WIDTH - 2 * WORM_RADIUS) + WORM_RADIUS;
            worms.push(new Worm(x));
            
            //scheduling next spawn
            const delay = Math.random() * (MAX_SPAWN_TIME - MIN_SPAWN_TIME) + MIN_SPAWN_TIME;
            setTimeout(spawnWorm, delay);
        }
    }
    
    spawnWorm();
}

function startTimer() {
    const timerInterval = setInterval(() => {
        if (!isPaused) {
            timeRemaining--;
            updateTime();
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
            }
        }
    }, 1000);
}

function drawObstacles() {
    ctx.fillStyle = 'green';
    obstacles.forEach(obstacle => {
        ctx.fillRect(obstacle.x, obstacle.y, OBSTACLE_SIZE, OBSTACLE_SIZE);
    });
}

function drawFoods() {
    foods.forEach(food => {
        ctx.beginPath();
        ctx.fillStyle = food.type === 1 ? 'blue' : 'red';
        ctx.arc(food.x, food.y, FOOD_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    });
}

function togglePause() {
    isPaused = !isPaused;
    const pauseButton = document.getElementById('pauseButton');
    pauseButton.textContent = isPaused ? 'Play' : 'Pause';
}
function setLevel() {
    currentLevel = parseInt(document.querySelector('input[name="level"]:checked').value);
    document.getElementById('levelDisplay').textContent = `Level: ${currentLevel}`;
}
function updateScore() {
    document.getElementById('scoreDisplay').textContent = `Score: ${score}`;
}

function updateTime() {
    document.getElementById('timerDisplay').textContent = `Time: ${timeRemaining}`;
}

function getCanvasCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

//handling clicks
canvas.addEventListener('click', (event) => {
    if (isPaused) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;
    
    let wormsKilled = false;
    
    //spread operator to create a copy of the worms array to safely iterate
    [...worms].forEach(worm => {
        //distance from click to worm center
        const dx = clickX - worm.x;
        const dy = clickY - worm.y;
        const distanceSquared = dx * dx + dy * dy;
        
        if (distanceSquared <= KILL_RADIUS * KILL_RADIUS) {
            worm.fadeOut = true;
            worm.opacity = 1; //ensure opacity starts at 1
            score += 8;
            wormsKilled = true;
        }
    });
    
    if (wormsKilled) {
        updateScore();
    }
});

function endGame() {
    cancelAnimationFrame(gameLoop);
    
    if (currentLevel === 1 && score > highScores.level1) {
        highScores.level1 = score;
    } else if (currentLevel === 2 && score > highScores.level2) {
        highScores.level2 = score;
    }

    saveHighScores();
    
    if (currentLevel === 1 && foods.length != 0) {
        currentLevel = 2;
        startGame();
    } else {
        const playAgain = confirm(`GAME OVER!\nfinal score: ${score}\nwanna play again?`);
        if (playAgain) {
            document.getElementById('gameScreen').style.display = 'none';
            document.getElementById('startScreen').style.display = 'block';
            updateHighScoreDisplay();
            //timeRemaining = GAME_DURATION;
        }
    }
}