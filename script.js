const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const WORM_RADIUS = 10;
const FOOD_RADIUS = 15;
const OBSTACLE_SIZE = 30;
const KILL_RADIUS = 30;
const GAME_DURATION = 60;
const MIN_SPAWN_TIME = 1000; // 1 sec
const MAX_SPAWN_TIME = 3000; 

const WORM_TYPES = {
    BLACK: {
        color: 'black',
        speedL1: 150,
        speedL2: 200,
        score: 10,
        probability: 0.3
    },
    RED: {
        color: 'red',
        speedL1: 75,
        speedL2: 100,
        score: 5,
        probability: 0.3
    },
    ORANGE: {
        color: 'orange',
        speedL1: 60,
        speedL2: 80,
        score: 3,
        probability: 0.4
    }
};

let canvas, ctx;
let gameLoop;
let score = 0;
let timeRemaining;
let isPaused = false;
let currentLevel = 1;
let worms = [];
let foods = [];
let obstacles = [];
let timerInterval;  //to track timer interval
let highScores = {
    level1: 0,
    level2: 0
};

function loadHighScores() {
    const savedScores = localStorage.getItem('highScores');
    if (savedScores) {
        highScores = JSON.parse(savedScores);
    }
    updateHighScoreDisplay();
}

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
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    canvas.addEventListener('click', (event) => {
        if (isPaused) return;
        console.log('click');
        
        const coords = getCanvasCoordinates(event);
        
        //loop through each worm and check for click collision
        worms.forEach(worm => {
            //distance from click to worm center
            const dx = coords.x - worm.x;
            const dy = coords.y - worm.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            //checking if click is within kill radius
            if (distance <= KILL_RADIUS && !worm.fadeOut) {
                worm.fadeOut = true;
                worm.opacity = 1; //starting opacity is 1
                score += WORM_TYPES[worm.type].score;
                updateScore();
            }
        });
    });

    loadHighScores();
    
    document.querySelectorAll('input[name="level"]').forEach(radio => {
        radio.addEventListener('change', updateHighScoreDisplay);
    });
}

class Worm {
    constructor(x, type) {
        this.x = x;
        this.y = 0;
        this.type = type;
        this.targetFood = null;
        this.fadeOut = false;
        this.opacity = 1;
        this.lastUpdateTime = performance.now();
        this.speed = this.getSpeed();
    }

    getSpeed() {
        return currentLevel === 1 ? WORM_TYPES[this.type].speedL1 : WORM_TYPES[this.type].speedL2;
    }

    update(deltaTime) {
        if (this.fadeOut) { //fade out and remove if opacity is 0 or below
            this.opacity -= deltaTime / 400;
            if (this.opacity <= 0) {
                return false; //worm should be removed from game
            }
            return true;
        }

        if (!this.targetFood || !foods.includes(this.targetFood)) {
            this.findNearestFood();
        }

        if (this.targetFood) {
            const dx = this.targetFood.x - this.x;
            const dy = this.targetFood.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const moveDistance = this.speed * deltaTime / 1000;

            //collisions with obstacles
            let isBlocked = false;
            obstacles.forEach(obstacle => {
            const obsCenterX = obstacle.x + OBSTACLE_SIZE / 2;
            const obsCenterY = obstacle.y + OBSTACLE_SIZE / 2;

            const distToObstacle = Math.sqrt((this.x - obsCenterX) ** 2 + (this.y - obsCenterY) ** 2);

            //if the worm is close enough to the obstacle, it should avoid it
            if (distToObstacle < OBSTACLE_SIZE / 2 + WORM_RADIUS) {
                isBlocked = true;

                //avoiding by moving perpendicular to it
                const angleToObstacle = Math.atan2(obsCenterY - this.y, obsCenterX - this.x);
                this.x -= Math.cos(angleToObstacle) * moveDistance;
                this.y -= Math.sin(angleToObstacle) * moveDistance;
            }
        });

            if (!isBlocked && distance > 0) {
                //collisions between worms
                worms.forEach(otherWorm => {
                    if (otherWorm !== this && !otherWorm.fadeOut) {
                        const otherWormSpeed = otherWorm.getSpeed();
                        const otherDistance = Math.hypot(otherWorm.x - this.x, otherWorm.y - this.y);

                        //slower worms wait if faster worm wants to pass
                        if (otherWormSpeed > this.speed && otherDistance < WORM_RADIUS * 2) {
                            if (this.x < otherWorm.x) this.x -= moveDistance / 2;
                            else this.x += moveDistance / 2;
                            return;
                        }
                    }
                });
                //updating position
                this.x += (dx / distance) * moveDistance;
                this.y += (dy / distance) * moveDistance;
            }

            if (distance < FOOD_RADIUS) {
                this.eatFood();
            }
        }
        //so that worms remain in canvas 
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

        //drawing worms
        ctx.beginPath();
        ctx.fillStyle = WORM_TYPES[this.type].color;
        ctx.arc(this.x, this.y, WORM_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        //drawing direction indicator (if not fading out)
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
            ctx.strokeStyle = WORM_TYPES[this.type].color;
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

function startGame() {
    //clearing any existing timer
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
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
    
    updateScore();
    updateTime();
    
    startGameLoop();
    startWormSpawner();
    startTimer();
}

function initializeFoods() {
    const type1Count = Math.floor(Math.random() * 6) + 1;
    for (let i = 0; i < type1Count; i++) {
        addFood(1);
    }
    
    const type2Count = Math.floor(Math.random() * 4) + 1;
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
    const obstacleCount = Math.floor(Math.random() * 4) + 1;
    
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
    for (const food of foods) {
        const dx = food.x - x;
        const dy = food.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < size + FOOD_RADIUS) {
            return false;
        }
    }
    
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
            
             //only keep worms that are still visible
            worms = worms.filter(worm => {
                const keepWorm = worm.update(deltaTime);
                if (keepWorm) {
                    worm.draw();
                }
                return keepWorm;
            });
            
            if (foods.length === 0 || timeRemaining <= 0) {
                endGame();
                return;
            }
        }
        
        lastTime = currentTime;
        gameLoop = requestAnimationFrame(update);
    }
    
    gameLoop = requestAnimationFrame(update);
}

function getRandomWormType() {
    const rand = Math.random();
    let total = 0;
    for (const type in WORM_TYPES) {
        total += WORM_TYPES[type].probability;
        if (rand < total) {
            return type;
        }
    }
    return 'ORANGE'; //default type
}

function startWormSpawner() {
    function spawnWorm() {
        if (!isPaused && foods.length > 0 && timeRemaining > 0) {
            const x = Math.random() * (CANVAS_WIDTH - 2 * WORM_RADIUS) + WORM_RADIUS;
            const wormType = getRandomWormType();
            const newWorm = new Worm(x, wormType);
            worms.push(newWorm);
            
            const delay = Math.random() * (MAX_SPAWN_TIME - MIN_SPAWN_TIME) + MIN_SPAWN_TIME;
            setTimeout(spawnWorm, delay);
        }
    }
    
    //init spawn
    setTimeout(spawnWorm, 1000); //after 1 sec
}

function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    timerInterval = setInterval(() => {
        if (!isPaused && timeRemaining > 0) {
            timeRemaining--;
            updateTime();
            if (timeRemaining <= 0) {
                endGame();
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
    pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
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

function endGame() {
    cancelAnimationFrame(gameLoop);
    clearInterval(timerInterval);
    
    let message;
    if (timeRemaining <= 0 && foods.length > 0) {
        message = `YOU WON!\nFinal Score: ${score}`;
    } else {
        message = `GAME OVER!\nFinal Score: ${score}`;
    }

    if (currentLevel === 1 && score > highScores.level1) {
        highScores.level1 = score;
        alert(`New High Score for Level 1! Congratulations!`);
    } else if (currentLevel === 2 && score > highScores.level2) {
        highScores.level2 = score;
        alert(`New High Score for Level 2! Congratulations!`);
    }
    saveHighScores();

    const playAgain = confirm(`${message}\nwanna play again?`);
    if (playAgain) {
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('startScreen').style.display = 'block';
        updateHighScoreDisplay();
    }
}