// game.js - Enhanced with Difficulty, Leaderboard, Sounds, and Levels

// ==================== CONSTANTS ====================
const ROWS = 15;
const COLS = 40;

const CELL_TYPES = {
    EMPTY: ' ',
    HERO: 'H',
    MONSTER: 'm',
    SUPER_MONSTER: 'M',
    BAT: '~',
    ABYSS: '#',
    WALL: '+',
    EXIT: '*'
};

const DIFFICULTY_CONFIG = {
    easy: { monsters: 2, superMonsters: 1, bats: 1, abysses: 15 },
    medium: { monsters: 4, superMonsters: 2, bats: 2, abysses: 30 },
    hard: { monsters: 6, superMonsters: 3, bats: 3, abysses: 50 }
};

// ==================== GAME STATE ====================
let board = [];
let heroPos = { row: 0, col: 0 };
let gameStatus = 'playing';
let moveCount = 0;
let currentDifficulty = 'medium';
let currentLevel = 1;
let soundEnabled = true;

// ==================== SOUND EFFECTS ====================
const sounds = {
    move: createSound(200, 0.05, 'sine'),
    capture: createSound(100, 0.3, 'sawtooth'),
    victory: createSound([523, 659, 784], 0.4, 'sine'),
    fall: createSound([400, 200, 100], 0.3, 'triangle'),
    wallHit: createSound(150, 0.1, 'square'),
    baddieMove: createSound(180, 0.03, 'triangle')
};

function createSound(frequency, duration, type = 'sine') {
    return { frequency, duration, type };
}

function playSound(sound) {
    if (!soundEnabled) return;
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = sound.type;
    
    if (Array.isArray(sound.frequency)) {
        // Play sequence for victory sound
        let time = audioContext.currentTime;
        sound.frequency.forEach((freq, index) => {
            oscillator.frequency.setValueAtTime(freq, time);
            time += sound.duration / sound.frequency.length;
        });
    } else {
        oscillator.frequency.value = sound.frequency;
    }
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + sound.duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + sound.duration);
}

// ==================== LEADERBOARD SYSTEM ====================
function getLeaderboard(difficulty) {
    const key = `leaderboard_${difficulty}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

function saveToLeaderboard(name, moves, level, difficulty) {
    const leaderboard = getLeaderboard(difficulty);
    leaderboard.push({
        name: name || 'Anonymous',
        moves,
        level,
        date: new Date().toISOString()
    });
    
    // Sort by moves (ascending) and keep top 10
    leaderboard.sort((a, b) => a.moves - b.moves);
    const topScores = leaderboard.slice(0, 10);
    
    localStorage.setItem(`leaderboard_${difficulty}`, JSON.stringify(topScores));
    displayLeaderboard(difficulty);
}

function displayLeaderboard(difficulty) {
    const leaderboard = getLeaderboard(difficulty);
    const content = document.getElementById('leaderboardContent');
    
    if (leaderboard.length === 0) {
        content.innerHTML = '<div class="no-scores">No scores yet. Be the first! 🏆</div>';
        return;
    }
    
    content.innerHTML = leaderboard.map((score, index) => `
        <div class="leaderboard-item ${index === 0 ? 'top-score' : ''}">
            <span class="leaderboard-rank">${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}</span>
            <span class="leaderboard-name">${score.name}</span>
            <span class="leaderboard-score">${score.moves} moves</span>
            <span class="leaderboard-level">Level ${score.level}</span>
        </div>
    `).join('');
}

// ==================== DOM ELEMENTS ====================
const welcomeScreen = document.getElementById('welcomeScreen');
const difficultyScreen = document.getElementById('difficultyScreen');
const gameScreen = document.getElementById('gameScreen');
const victoryModal = document.getElementById('victoryModal');

const startGameBtn = document.getElementById('startGameBtn');
const backToWelcomeBtn = document.getElementById('backToWelcomeBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const selectDifficultyBtns = document.querySelectorAll('.select-difficulty-btn');

const gameBoard = document.getElementById('gameBoard');
const messageBox = document.getElementById('messageBox');
const messageText = document.getElementById('messageText');
const moveCountDisplay = document.getElementById('moveCount');
const newGameBtn = document.getElementById('newGameBtn');
const newLevelBtn = document.getElementById('newLevelBtn');
const soundToggle = document.getElementById('soundToggle');

const currentLevelDisplay = document.getElementById('currentLevel');
const currentDifficultyDisplay = document.getElementById('currentDifficulty');

const nextLevelModalBtn = document.getElementById('nextLevelModalBtn');
const saveScoreBtn = document.getElementById('saveScoreBtn');
const closeVictoryBtn = document.getElementById('closeVictoryBtn');
const playerNameInput = document.getElementById('playerNameInput');

// ==================== SCREEN NAVIGATION ====================
function showWelcomeScreen() {
    welcomeScreen.style.display = 'flex';
    difficultyScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    victoryModal.classList.add('hidden');
}

function showDifficultyScreen() {
    welcomeScreen.style.display = 'none';
    difficultyScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    displayLeaderboard('easy');
}

function showGameScreen() {
    welcomeScreen.style.display = 'none';
    difficultyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    initializeGame();
}

function showVictoryModal() {
    document.getElementById('finalMoves').textContent = moveCount;
    document.getElementById('victoryLevel').textContent = currentLevel;
    document.getElementById('victoryDifficulty').textContent = currentDifficulty.toUpperCase();
    victoryModal.classList.remove('hidden');
    playerNameInput.value = '';
    playSound(sounds.victory);
}

// ==================== INITIALIZE GAME ====================
function initializeGame() {
    board = Array(ROWS).fill(null).map(() => 
        Array(COLS).fill(CELL_TYPES.EMPTY)
    );

    const config = DIFFICULTY_CONFIG[currentDifficulty];
    
    // Increase difficulty slightly with each level
    const levelMultiplier = 1 + (currentLevel - 1) * 0.1;
    const adjustedMonsters = Math.floor(config.monsters * levelMultiplier);
    const adjustedSuperMonsters = Math.floor(config.superMonsters * levelMultiplier);
    const adjustedBats = Math.floor(config.bats * levelMultiplier);
    const adjustedAbysses = Math.floor(config.abysses * levelMultiplier);

    // Place Hero
    const heroRow = Math.floor(Math.random() * ROWS);
    const heroCol = Math.floor(Math.random() * 3);
    board[heroRow][heroCol] = CELL_TYPES.HERO;
    heroPos = { row: heroRow, col: heroCol };

    // Place Exit
    const exitRow = Math.floor(Math.random() * ROWS);
    const exitCol = COLS - 1 - Math.floor(Math.random() * 3);
    board[exitRow][exitCol] = CELL_TYPES.EXIT;

    // Place walls
    const midSection = COLS - 6;
    
    let wallCol1 = 3 + Math.floor(Math.random() * midSection);
    for (let r = 0; r < Math.floor(ROWS / 2); r++) {
        if (board[r][wallCol1] === CELL_TYPES.EMPTY) {
            board[r][wallCol1] = CELL_TYPES.WALL;
        }
    }

    let wallCol2 = 3 + Math.floor(Math.random() * midSection);
    while (Math.abs(wallCol2 - wallCol1) < 2) {
        wallCol2 = 3 + Math.floor(Math.random() * midSection);
    }
    for (let r = ROWS - 1; r > Math.floor(ROWS / 2); r--) {
        if (board[r][wallCol2] === CELL_TYPES.EMPTY) {
            board[r][wallCol2] = CELL_TYPES.WALL;
        }
    }

    let wallCol3 = 3 + Math.floor(Math.random() * midSection);
    while (Math.abs(wallCol3 - wallCol1) < 2 || Math.abs(wallCol3 - wallCol2) < 2) {
        wallCol3 = 3 + Math.floor(Math.random() * midSection);
    }
    for (let r = Math.floor(ROWS / 4); r < Math.floor(3 * ROWS / 4); r++) {
        if (board[r][wallCol3] === CELL_TYPES.EMPTY) {
            board[r][wallCol3] = CELL_TYPES.WALL;
        }
    }

    // Place entities
    placeEntities(CELL_TYPES.MONSTER, adjustedMonsters, midSection);
    placeEntities(CELL_TYPES.SUPER_MONSTER, adjustedSuperMonsters, midSection);
    placeEntities(CELL_TYPES.BAT, adjustedBats, midSection);
    placeEntities(CELL_TYPES.ABYSS, adjustedAbysses, midSection);

    // Reset game state
    gameStatus = 'playing';
    moveCount = 0;
    updateDisplay();
    showMessage('Navigate to the exit! Good luck! 🎯', 'info');
    renderBoard();
    
    newLevelBtn.classList.add('hidden');
}

function placeEntities(type, count, midSection) {
    for (let i = 0; i < count; i++) {
        let r, c;
        do {
            r = Math.floor(Math.random() * ROWS);
            c = 3 + Math.floor(Math.random() * midSection);
        } while (board[r][c] !== CELL_TYPES.EMPTY);
        board[r][c] = type;
    }
}

function updateDisplay() {
    moveCountDisplay.textContent = moveCount;
    currentLevelDisplay.textContent = currentLevel;
    currentDifficultyDisplay.textContent = currentDifficulty.toUpperCase();
}

// ==================== RENDER BOARD ====================
function renderBoard() {
    gameBoard.innerHTML = '';
    gameBoard.style.gridTemplateColumns = `repeat(${COLS}, 14px)`;
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            
            switch(board[r][c]) {
                case CELL_TYPES.HERO:
                    cell.classList.add('hero');
                    break;
                case CELL_TYPES.MONSTER:
                    cell.classList.add('monster');
                    break;
                case CELL_TYPES.SUPER_MONSTER:
                    cell.classList.add('super-monster');
                    break;
                case CELL_TYPES.BAT:
                    cell.classList.add('bat');
                    break;
                case CELL_TYPES.ABYSS:
                    cell.classList.add('abyss');
                    break;
                case CELL_TYPES.WALL:
                    cell.classList.add('wall');
                    break;
                case CELL_TYPES.EXIT:
                    cell.classList.add('exit');
                    break;
                default:
                    cell.classList.add('empty');
            }
            
            gameBoard.appendChild(cell);
        }
    }
}

// ==================== MOVE HERO ====================
function moveHero(deltaRow, deltaCol) {
    if (gameStatus !== 'playing') return;

    const newRow = heroPos.row + deltaRow;
    const newCol = heroPos.col + deltaCol;

    if (newRow < 0 || newRow >= ROWS || newCol < 0 || newCol >= COLS) {
        showMessage('Cannot move out of bounds!', 'danger');
        playSound(sounds.wallHit);
        return;
    }

    const targetCell = board[newRow][newCol];

    if (targetCell === CELL_TYPES.WALL) {
        showMessage('Cannot move through wall!', 'danger');
        playSound(sounds.wallHit);
        return;
    }

    if (targetCell === CELL_TYPES.EXIT) {
        board[heroPos.row][heroPos.col] = CELL_TYPES.EMPTY;
        gameStatus = 'won';
        showMessage('🎉 Level Complete!', 'success');
        renderBoard();
        newLevelBtn.classList.remove('hidden');
        showVictoryModal();
        return;
    }

    if (targetCell === CELL_TYPES.ABYSS) {
        board[heroPos.row][heroPos.col] = CELL_TYPES.EMPTY;
        gameStatus = 'lost';
        showMessage('💀 You fell into the abyss!', 'danger');
        playSound(sounds.fall);
        renderBoard();
        return;
    }

    if (targetCell === CELL_TYPES.MONSTER || 
        targetCell === CELL_TYPES.SUPER_MONSTER || 
        targetCell === CELL_TYPES.BAT) {
        board[heroPos.row][heroPos.col] = CELL_TYPES.EMPTY;
        gameStatus = 'lost';
        showMessage('💀 Caught by a baddie!', 'danger');
        playSound(sounds.capture);
        renderBoard();
        return;
    }

    // Move successful
    board[heroPos.row][heroPos.col] = CELL_TYPES.EMPTY;
    board[newRow][newCol] = CELL_TYPES.HERO;
    heroPos = { row: newRow, col: newCol };
    
    moveCount++;
    updateDisplay();
    playSound(sounds.move);
    
    moveBaddies();
    renderBoard();
}

// ==================== MOVE BADDIES ====================
function moveBaddies() {
    const moved = new Set();
    const baddiePositions = [];

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            if (cell === CELL_TYPES.MONSTER || 
                cell === CELL_TYPES.SUPER_MONSTER || 
                cell === CELL_TYPES.BAT) {
                baddiePositions.push({ row: r, col: c, type: cell });
            }
        }
    }

    for (const baddie of baddiePositions) {
        const key = `${baddie.row},${baddie.col}`;
        if (moved.has(key)) continue;

        const power = baddie.type === CELL_TYPES.SUPER_MONSTER ? 2 : 1;
        const isBat = baddie.type === CELL_TYPES.BAT;

        let deltaRow = 0;
        let deltaCol = 0;

        if (isBat) {
            deltaRow = Math.floor(Math.random() * 3) - 1;
            deltaCol = Math.floor(Math.random() * 3) - 1;
        } else {
            if (heroPos.row < baddie.row) deltaRow = -1;
            else if (heroPos.row > baddie.row) deltaRow = 1;

            if (heroPos.col < baddie.col) deltaCol = -1;
            else if (heroPos.col > baddie.col) deltaCol = 1;
        }

        let newR = baddie.row + (deltaRow * power);
        let newC = baddie.col + (deltaCol * power);

        newR = Math.max(0, Math.min(ROWS - 1, newR));
        newC = Math.max(0, Math.min(COLS - 1, newC));

        const target = board[newR][newC];

        if (target === CELL_TYPES.WALL || target === CELL_TYPES.EXIT) {
            continue;
        } else if (target === CELL_TYPES.ABYSS) {
            board[baddie.row][baddie.col] = CELL_TYPES.EMPTY;
            moved.add(key);
            playSound(sounds.baddieMove);
        } else if (target === CELL_TYPES.HERO) {
            board[newR][newC] = baddie.type;
            board[baddie.row][baddie.col] = CELL_TYPES.EMPTY;
            gameStatus = 'lost';
            showMessage('💀 Baddie caught you!', 'danger');
            playSound(sounds.capture);
            moved.add(`${newR},${newC}`);
        } else if (target === CELL_TYPES.MONSTER || 
                   target === CELL_TYPES.SUPER_MONSTER || 
                   target === CELL_TYPES.BAT) {
            continue;
        } else {
            board[newR][newC] = baddie.type;
            board[baddie.row][baddie.col] = CELL_TYPES.EMPTY;
            moved.add(`${newR},${newC}`);
        }
    }
}

// ==================== UI UPDATES ====================
function showMessage(msg, type) {
    messageText.textContent = msg;
    messageBox.className = 'message-box ' + type;
    messageBox.classList.remove('hidden');
}

function updateMoveCount() {
    moveCountDisplay.textContent = moveCount;
}

// ==================== EVENT LISTENERS ====================
startGameBtn.addEventListener('click', showDifficultyScreen);
backToWelcomeBtn.addEventListener('click', showWelcomeScreen);
backToMenuBtn.addEventListener('click', () => {
    showDifficultyScreen();
    currentLevel = 1;
});

selectDifficultyBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        currentDifficulty = e.target.dataset.difficulty;
        currentLevel = 1;
        showGameScreen();
    });
});

newGameBtn.addEventListener('click', () => {
    initializeGame();
});

newLevelBtn.addEventListener('click', () => {
    currentLevel++;
    initializeGame();
    victoryModal.classList.add('hidden');
});

nextLevelModalBtn.addEventListener('click', () => {
    currentLevel++;
    initializeGame();
    victoryModal.classList.add('hidden');
});

saveScoreBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    saveToLeaderboard(name, moveCount, currentLevel, currentDifficulty);
    showMessage('Score saved to leaderboard! 🎉', 'success');
    setTimeout(() => {
        victoryModal.classList.add('hidden');
        showDifficultyScreen();
    }, 1500);
});

closeVictoryBtn.addEventListener('click', () => {
    victoryModal.classList.add('hidden');
    showDifficultyScreen();
    currentLevel = 1;
});

soundToggle.addEventListener('change', (e) => {
    soundEnabled = e.target.checked;
});

// Leaderboard tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        displayLeaderboard(e.target.dataset.difficulty);
    });
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (gameStatus !== 'playing') return;

    switch(e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
            e.preventDefault();
            moveHero(-1, 0);
            break;
        case 's':
        case 'arrowdown':
            e.preventDefault();
            moveHero(1, 0);
            break;
        case 'a':
        case 'arrowleft':
            e.preventDefault();
            moveHero(0, -1);
            break;
        case 'd':
        case 'arrowright':
            e.preventDefault();
            moveHero(0, 1);
            break;
        case 'q':
            e.preventDefault();
            moveHero(-1, -1);
            break;
        case 'e':
            e.preventDefault();
            moveHero(-1, 1);
            break;
        case 'z':
            e.preventDefault();
            moveHero(1, -1);
            break;
        case 'c':
            e.preventDefault();
            moveHero(1, 1);
            break;
    }
});

// ==================== INITIALIZE APP ====================
showWelcomeScreen();