// MathRush - Core Game Script

// --- 1. GLOBALS & STATE ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Virtual Resolution
const V_WIDTH = 600;
const V_HEIGHT = 800;

// Game State Object
const gameState = {
  activeScreen: 'landing',
  score: 0,
  accuracy: 100,
  correctCount: 0,
  totalAnswered: 0,
  currentLevel: 1,
  unlockedLevel: 1, // Progresses in session
  selectedStartLevel: 1,
  lives: 3,
  gameTime: 0,
  isPaused: false,
  
  // Stats for End Screen
  fastestResponseTime: null, // in seconds
  fastAnswerBonusesEarned: 0,
  levelCompletions: 0,
  
  // Gameplay variables
  playerSpeedFactor: 1.0,
  speedPenaltyTimer: 0,
  speedBoostTimer: 0,
  invincibilityTimer: 0,
  screenShakeTime: 0,
  streak: 0,
  
  // Question tracking
  questionActive: false,
  questionTimer: 0,
  questionTimerMax: 12, // seconds (changes per level)
  questionStartTime: 0,
  currentQuestion: null,
  questionSpawnTimer: 0,
  levelQuestionsAnswered: 0, // correctly answered in current level
  questionResultFeedback: null, // { correct: bool, index: number, showUntil: number }
  
  // Pools to prevent duplicate questions within a level playthrough
  questionPools: {
    1: [],
    2: [],
    3: []
  }
};

// Player Entity
const player = {
  lane: 1, // 0 = Left, 1 = Middle, 2 = Right
  x: 300,  // X position (starts centered)
  y: 450,  // Fixed base Y (positioned mid-canvas to leave space for bottom panel)
  targetX: 300,
  jumpY: 0,
  jumpVelocity: 0,
  isJumping: false,
  gravity: 1400,
  width: 44,
  height: 52,
  runCycle: 0
};

// Lane X coordinates (Center of lanes)
const laneXs = [100, 300, 500];

// Game Objects
let obstacles = [];
let coins = [];
let floatingTexts = [];
let environmentParticles = [];
let laneLinesY = 0; // For scrolling effect

// Timers
let obstacleSpawnTimer = 0;
let coinSpawnTimer = 0;

// Shuffling Helper
function shuffleArray(arr) {
  const newArr = [...arr];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

// Shuffled Question Manager
function getNextQuestion(level) {
  if (!gameState.questionPools[level] || gameState.questionPools[level].length === 0) {
    // Re-fill pool with a shuffled copy of original questions
    const levelQuestions = window.MathRushQuestions[level];
    gameState.questionPools[level] = shuffleArray(levelQuestions);
  }
  // Pop an original question object from the pool
  const orig = gameState.questionPools[level].pop();

  // Create a shallow copy and shuffle the options so the correct answer
  // isn't always in the same position. Update the correct index to match
  // the shuffled options.
  if (!orig || !Array.isArray(orig.options)) return orig;

  const optionsOrig = [...orig.options];
  const indices = optionsOrig.map((_, i) => i);
  const shuffledIndices = shuffleArray(indices);
  const shuffledOptions = shuffledIndices.map(i => optionsOrig[i]);

  // Find where the original correct option ended up
  const newCorrectIndex = shuffledIndices.indexOf(orig.correct);

  const q = Object.assign({}, orig, {
    options: shuffledOptions,
    correct: newCorrectIndex
  });

  return q;
}

// Reset Pools
function resetQuestionPools() {
  gameState.questionPools[1] = [];
  gameState.questionPools[2] = [];
  gameState.questionPools[3] = [];
}


// --- 2. AUDIO SYNTHESIZER ENGINE (Web Audio API) ---
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
  if (audioCtx) return;
  // Initialize context on user interaction
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();
}

function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  const btn = document.getElementById('btn-toggle-sound');
  if (btn) {
    btn.textContent = enabled ? '🔊' : '🔈';
    btn.title = enabled ? 'Sound on' : 'Sound off';
  }
}

function toggleSound() {
  setSoundEnabled(!soundEnabled);
  if (soundEnabled) {
    initAudio();
  }
}

function playSynthSound(freqs, durations, type = 'sine', slideTo = null) {
  if (!soundEnabled || !audioCtx) return;
  
  // Resume context if suspended (browser security autoplays)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  let time = audioCtx.currentTime;
  
  freqs.forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    
    if (slideTo && idx === 0 && freqs.length === 1) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, time + durations[idx]);
    }
    
    gainNode.gain.setValueAtTime(0.12, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + durations[idx]);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start(time);
    osc.stop(time + durations[idx]);
    
    time += durations[idx] * 0.85; // overlap notes slightly
  });
}

// Sound Triggers
function playCorrectSound() {
  playSynthSound([523.25, 659.25, 783.99], [0.08, 0.08, 0.15], 'triangle');
}

function playWrongSound() {
  playSynthSound([220], [0.35], 'sawtooth', 90);
}

function playJumpSound() {
  playSynthSound([180], [0.15], 'sine', 500);
}

function playCoinSound() {
  playSynthSound([987.77, 1318.51], [0.06, 0.12], 'sine');
}

function playLevelUpSound() {
  playSynthSound([261.63, 329.63, 392.00, 523.25, 659.25], [0.06, 0.06, 0.06, 0.06, 0.22], 'sine');
}

function playGameOverSound() {
  playSynthSound([392.00, 349.23, 311.13, 220], [0.12, 0.12, 0.12, 0.4], 'sawtooth');
}


// --- 3. CANVAS LAYOUT & RESOLUTION SCALING ---
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  
  // Match CSS display size to parent container
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  
  // Internal buffer resolution for crisp rendering on high DPI displays
  canvas.width = V_WIDTH * dpr;
  canvas.height = V_HEIGHT * dpr;
  
  // Reset transform before scaling so repeated calls don't compound
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Handle resize events
window.addEventListener('resize', resizeCanvas);
// Run once on load
resizeCanvas();

// Fullscreen / Minimize Helpers
const gameContainer = document.getElementById('game-container');

function isFullscreenActive() {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
}

function updateFullscreenButton() {
  const btn = document.getElementById('btn-toggle-fullscreen');
  if (!btn) return;
  if (isFullscreenActive()) {
    btn.innerText = '⤡';
    btn.title = 'Exit fullscreen';
  } else {
    btn.innerText = '⤢';
    btn.title = 'Enter fullscreen';
  }
}

async function enterFullscreen() {
  if (!gameContainer) return;
  if (gameContainer.classList.contains('compact-mode')) {
    gameContainer.classList.remove('compact-mode');
  }
  if (gameContainer.requestFullscreen) {
    await gameContainer.requestFullscreen();
  } else if (gameContainer.webkitRequestFullscreen) {
    await gameContainer.webkitRequestFullscreen();
  } else if (gameContainer.mozRequestFullScreen) {
    await gameContainer.mozRequestFullScreen();
  } else if (gameContainer.msRequestFullscreen) {
    await gameContainer.msRequestFullscreen();
  }
}

async function exitFullscreen() {
  if (document.exitFullscreen) {
    await document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    await document.webkitExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    await document.mozCancelFullScreen();
  } else if (document.msExitFullscreen) {
    await document.msExitFullscreen();
  }
}

function toggleFullscreen() {
  if (isFullscreenActive()) {
    exitFullscreen();
  } else {
    enterFullscreen();
  }
}

function toggleCompactMode() {
  const btn = document.getElementById('btn-minimize-screen');
  if (!gameContainer) return;

  if (isFullscreenActive()) {
    exitFullscreen();
  }

  if (gameContainer.classList.contains('compact-mode')) {
    gameContainer.classList.remove('compact-mode');
    if (btn) {
      btn.innerText = '🗕';
      btn.title = 'Minimize screen';
    }
  } else {
    gameContainer.classList.add('compact-mode');
    if (btn) {
      btn.innerText = '🗖';
      btn.title = 'Restore screen';
    }
  }
  resizeCanvas();
}

// Update fullscreen label when browser state changes
document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
document.addEventListener('mozfullscreenchange', updateFullscreenButton);
document.addEventListener('MSFullscreenChange', updateFullscreenButton);

// --- 4. INPUT HANDLING ---
const keysPressed = {};

window.addEventListener('keydown', (e) => {
  keysPressed[e.key] = true;
  
  // Only process gameplay inputs when playing
  if (gameState.activeScreen === 'gameplay' && !gameState.isPaused) {
    // Switch Lane Left
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (player.lane > 0) {
        player.lane--;
        player.targetX = laneXs[player.lane];
        initAudio(); // triggers sound activation
      }
    }
    // Switch Lane Right
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (player.lane < 2) {
        player.lane++;
        player.targetX = laneXs[player.lane];
        initAudio();
      }
    }
    // Jump Action
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!player.isJumping) {
        player.isJumping = true;
        player.jumpVelocity = 580; // pixel speed up
        playJumpSound();
      }
    }
    // Option Selection 1 / 2 / 3
    else if (gameState.questionActive && (e.key === '1' || e.key === '2' || e.key === '3')) {
      const idx = parseInt(e.key) - 1;
      submitAnswer(idx);
    }
    // Pause trigger via Escape key
    else if (e.key === 'Escape') {
      e.preventDefault();
      pauseGame();
    }
  }
  
  // If paused, Escape resumes
  else if (gameState.activeScreen === 'gameplay' && gameState.isPaused && e.key === 'Escape') {
    e.preventDefault();
    resumeGame();
  }

  // Global system shortcuts
  const activeTag = document.activeElement && document.activeElement.tagName;
  if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) {
    if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
    }
    if (e.key === 'm' || e.key === 'M') {
      toggleCompactMode();
    }
  }
});

window.addEventListener('keyup', (e) => {
  keysPressed[e.key] = false;
});


// --- 5. GAME SCREEN TRANSITION MANAGER ---
function showScreen(screenId) {
  // Hide all screens
  const screens = document.querySelectorAll('.game-screen');
  screens.forEach(s => s.classList.remove('active'));
  
  // Show target screen
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }
  
  gameState.activeScreen = screenId.replace('screen-', '');
  
  // Pause context checks
  if (gameState.activeScreen !== 'gameplay') {
    gameState.isPaused = false;
    document.getElementById('screen-pause-overlay').classList.add('hidden');
  }
}


// --- 6. LEADERBOARD SYSTEM ---
function getLeaderboard() {
  const stored = localStorage.getItem('mathrush_leaderboard');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch(e) {
      return [];
    }
  }
  // Default values to look alive initially
  const defaults = [
    { name: "Einstein", score: 620, accuracy: 100 },
    { name: "Pythagoras", score: 480, accuracy: 90 },
    { name: "Newton", score: 320, accuracy: 80 }
  ];
  localStorage.setItem('mathrush_leaderboard', JSON.stringify(defaults));
  return defaults;
}

function saveLeaderboardScore(name, score, accuracy) {
  const leaderboard = getLeaderboard();
  leaderboard.push({ name, score, accuracy });
  // Sort high to low
  leaderboard.sort((a, b) => b.score - a.score);
  // Keep top 10
  const topTen = leaderboard.slice(0, 10);
  localStorage.setItem('mathrush_leaderboard', JSON.stringify(topTen));
}

function renderLeaderboardView() {
  const leaderboard = getLeaderboard();
  const listEl = document.getElementById('leaderboard-list');
  listEl.innerHTML = '';
  
  leaderboard.forEach((entry, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rank">${idx + 1}</td>
      <td>${escapeHTML(entry.name)}</td>
      <td class="text-green">${entry.score} pts</td>
      <td class="text-yellow">${entry.accuracy}%</td>
    `;
    listEl.appendChild(tr);
  });
}

function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}


// --- 7. QUESTION POPUP MANAGEMENT ---
function triggerQuestion() {
  if (gameState.questionActive) return;
  
  // Get new question from pool
  const q = getNextQuestion(gameState.currentLevel);
  if (!q) return;
  
  gameState.currentQuestion = q;
  gameState.questionActive = true;
  gameState.questionStartTime = Date.now();
  
  // Adjust timer max based on level (faster speeds for higher levels)
  if (gameState.currentLevel === 1) gameState.questionTimerMax = 12;
  else if (gameState.currentLevel === 2) gameState.questionTimerMax = 9;
  else if (gameState.currentLevel === 3) gameState.questionTimerMax = 6;
  
  gameState.questionTimer = gameState.questionTimerMax;
  
  // Fill text in HTML
  document.getElementById('question-text').innerText = q.text;
  document.getElementById('opt-a-text').innerText = q.options[0];
  document.getElementById('opt-b-text').innerText = q.options[1];
  document.getElementById('opt-c-text').innerText = q.options[2];
  
  // Remove formatting states on option buttons
  const optBtns = document.querySelectorAll('.opt-btn');
  optBtns.forEach(btn => {
    btn.classList.remove('opt-correct', 'opt-wrong');
    btn.disabled = false;
  });
  
  // Reveal Question Panel
  document.getElementById('question-panel').classList.remove('hidden');
}

function submitAnswer(selectedIndex) {
  if (!gameState.questionActive || gameState.questionResultFeedback) return;
  
  const q = gameState.currentQuestion;
  const isCorrect = (selectedIndex === q.correct);
  const timeTaken = (Date.now() - gameState.questionStartTime) / 1000;
  
  // Disable option buttons
  const optBtns = document.querySelectorAll('.opt-btn');
  optBtns.forEach(btn => btn.disabled = true);
  
  // Update UI options color
  if (selectedIndex !== -1) {
    const selectedBtn = optBtns[selectedIndex];
    if (isCorrect) {
      selectedBtn.classList.add('opt-correct');
    } else {
      selectedBtn.classList.add('opt-wrong');
    }
  }
  
  // Always highlight correct answer in green if wrong/timed out
  if (!isCorrect) {
    optBtns[q.correct].classList.add('opt-correct');
  }
  
  gameState.totalAnswered++;
  
  if (isCorrect) {
    gameState.correctCount++;
    gameState.streak++;
    
    // Points logic
    let earned = 10;
    if (gameState.currentLevel === 3) earned = 20; // Level 3 award +20 points
    
    // Fast-answer bonus (under 3 seconds)
    let isFast = false;
    if (timeTaken <= 3.0) {
      isFast = true;
      earned += 5;
      gameState.fastAnswerBonusesEarned++;
      // Show floating text popup above player
      spawnFloatingText(`+${earned} FAST!`, player.x, player.y - 70, '#39ff14');
    } else {
      spawnFloatingText(`+${earned}`, player.x, player.y - 50, '#00f0ff');
    }
    
    gameState.score += earned;
    gameState.levelQuestionsAnswered++;
    playCorrectSound();
    
    // Streak feedback
    if (gameState.streak >= 3) {
      document.getElementById('streak-count').innerText = gameState.streak;
      document.getElementById('streak-indicator').classList.remove('hidden');
    }
    
    // Trigger Speed Boost
    gameState.speedBoostTimer = 2.0;
    gameState.speedPenaltyTimer = 0; // Cancel slows
    
    // Update fastest response time
    if (gameState.fastestResponseTime === null || timeTaken < gameState.fastestResponseTime) {
      gameState.fastestResponseTime = timeTaken;
    }
  } else {
    // Wrong answer / Time out
    gameState.streak = 0;
    document.getElementById('streak-indicator').classList.add('hidden');
    
    gameState.lives--;
    updateHUDLives();
    playWrongSound();
    
    // Speed penalty
    gameState.speedPenaltyTimer = 2.5;
    gameState.speedBoostTimer = 0;
    gameState.screenShakeTime = 0.4; // Shake screen
    
    spawnFloatingText("WRONG!", player.x, player.y - 50, '#ff007f');
    
    if (gameState.lives <= 0) {
      // Delay game over slightly so user sees correction
      setTimeout(() => {
        gameOver();
      }, 900);
    }
  }
  
  // Calculate accuracy %
  gameState.accuracy = Math.round((gameState.correctCount / gameState.totalAnswered) * 100);
  
  // Queue clearing question popup
  gameState.questionResultFeedback = {
    showUntil: Date.now() + 1000 // display feedback for 1s
  };
  
  updateHUD();
}

function updateHUDLives() {
  const livesEl = document.getElementById('hud-lives');
  let hearts = '';
  for (let i = 0; i < 3; i++) {
    if (i < gameState.lives) hearts += '❤️';
    else hearts += '🖤';
  }
  livesEl.innerText = hearts;
}


// --- 8. FLOATING TEXTS & ENVIRONMENT PARTICLES ---
function spawnFloatingText(text, x, y, color) {
  floatingTexts.push({
    text,
    x,
    y,
    color,
    opacity: 1,
    vy: -55,
    timer: 0
  });
}

function spawnParticle(x, y, color, size, speedX, speedY, life) {
  environmentParticles.push({
    x,
    y,
    color,
    size,
    vx: speedX,
    vy: speedY,
    maxLife: life,
    life: life
  });
}


// --- 9. GAME ENGINE CORE ---

// Start Level config
function startLevel(levelNum) {
  gameState.currentLevel = levelNum;
  gameState.levelQuestionsAnswered = 0;
  gameState.lives = 3;
  gameState.streak = 0;
  gameState.questionActive = false;
  gameState.questionResultFeedback = null;
  gameState.questionSpawnTimer = 0;
  gameState.playerSpeedFactor = 1.0;
  gameState.speedPenaltyTimer = 0;
  gameState.speedBoostTimer = 0;
  
  // Hide panel
  document.getElementById('question-panel').classList.add('hidden');
  document.getElementById('streak-indicator').classList.add('hidden');
  
  // Empty array of active objects
  obstacles = [];
  coins = [];
  floatingTexts = [];
  
  updateHUD();
  updateHUDLives();
  
  spawnFloatingText(`LEVEL ${levelNum} START!`, 300, 250, '#00f0ff');
  playLevelUpSound();
}

// Next level controller
function completeLevel() {
  gameState.score += 50; // +50 bonus
  gameState.levelCompletions++;
  spawnFloatingText("+50 LEVEL COMPLETE!", player.x, player.y - 70, '#39ff14');
  playLevelUpSound();
  
  if (gameState.currentLevel === 1) {
    gameState.unlockedLevel = Math.max(gameState.unlockedLevel, 2);
    showLevelCompletePrompt(2);
  } else if (gameState.currentLevel === 2) {
    gameState.unlockedLevel = Math.max(gameState.unlockedLevel, 3);
    startLevel(3);
  } else {
    // Level 3 completed! Go to completion screen.
    winGame();
  }
}

function showLevelCompletePrompt(nextLevel) {
  gameState.isPaused = true;
  gameState.pendingNextLevel = nextLevel;
  const overlay = document.getElementById('screen-level-complete');
  const msg = document.getElementById('level-complete-message');
  const title = document.getElementById('level-complete-title');
  title.innerText = 'YOU WIN';
  msg.innerText = `Level ${gameState.currentLevel} complete! Continue to Level ${nextLevel} or exit to the menu?`;
  overlay.classList.remove('hidden');
}

function hideLevelCompletePrompt() {
  const overlay = document.getElementById('screen-level-complete');
  overlay.classList.add('hidden');
  gameState.isPaused = false;
  delete gameState.pendingNextLevel;
}

function updateHUD() {
  document.getElementById('hud-level').innerText = gameState.currentLevel;
  
  // Padded score display e.g. 0120
  let pScore = gameState.score.toString();
  while (pScore.length < 4) pScore = '0' + pScore;
  document.getElementById('hud-score').innerText = pScore;
  
  document.getElementById('hud-accuracy').innerText = `${gameState.accuracy}%`;
  
  // Progress Bar
  const prog = Math.min(10, gameState.levelQuestionsAnswered);
  document.getElementById('hud-progress-text').innerText = `${prog}/10`;
  document.getElementById('hud-progress-fill').style.width = `${prog * 10}%`;
}

// Setup gameplay triggers
function initNewGame(startLevelNum = 1) {
  gameState.score = 0;
  gameState.accuracy = 100;
  gameState.correctCount = 0;
  gameState.totalAnswered = 0;
  gameState.fastestResponseTime = null;
  gameState.fastAnswerBonusesEarned = 0;
  gameState.levelCompletions = 0;
  
  resetQuestionPools();
  startLevel(startLevelNum);
}


// --- 10. SCREEN ACTIONS ---

// Navigation actions & events
document.getElementById('btn-play').addEventListener('click', () => {
  initAudio();
  showScreen('screen-instructions');
});

document.getElementById('btn-instructions').addEventListener('click', () => {
  initAudio();
  showScreen('screen-instructions');
});

document.getElementById('btn-leaderboard').addEventListener('click', () => {
  initAudio();
  renderLeaderboardView();
  showScreen('screen-leaderboard');
});

document.getElementById('btn-exit').addEventListener('click', () => {
  showScreen('screen-landing');
});

document.getElementById('btn-landing-enter').addEventListener('click', () => {
  showScreen('screen-main-menu');
});

document.getElementById('btn-landing-instructions').addEventListener('click', () => {
  initAudio();
  showScreen('screen-instructions');
});

document.getElementById('btn-toggle-sound').addEventListener('click', () => {
  toggleSound();
});

document.getElementById('btn-back-to-menu-from-inst').addEventListener('click', () => {
  showScreen('screen-main-menu');
});

document.getElementById('btn-start-game').addEventListener('click', () => {
  initAudio();
  showScreen('screen-gameplay');
  // Start at level user selected in the main menu
  const sel = gameState.selectedStartLevel || 1;
  initNewGame(sel);
});

document.getElementById('btn-back-to-menu-from-leaderboard').addEventListener('click', () => {
  showScreen('screen-main-menu');
});

document.getElementById('btn-pause-game').addEventListener('click', () => {
  pauseGame();
});

document.getElementById('btn-toggle-fullscreen').addEventListener('click', () => {
  toggleFullscreen();
});

document.getElementById('btn-minimize-screen').addEventListener('click', () => {
  toggleCompactMode();
});

// Level selector wiring (main menu)
const levelButtons = document.querySelectorAll('.level-btn');
if (levelButtons && levelButtons.length) {
  levelButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      levelButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const lv = parseInt(btn.getAttribute('data-level')) || 1;
      gameState.selectedStartLevel = lv;
    });
  });
}

// Pause Menu Buttons
document.getElementById('btn-resume').addEventListener('click', () => {
  startResumeCountdown();
});

document.getElementById('btn-continue-level').addEventListener('click', () => {
  hideLevelCompletePrompt();
  const nextLevel = gameState.pendingNextLevel || 2;
  startLevel(nextLevel);
});

document.getElementById('btn-exit-to-menu').addEventListener('click', () => {
  hideLevelCompletePrompt();
  showScreen('screen-main-menu');
});

document.getElementById('btn-restart').addEventListener('click', () => {
  resumeGame();
  startLevel(gameState.currentLevel);
});

document.getElementById('btn-main-menu').addEventListener('click', () => {
  resumeGame();
  showScreen('screen-main-menu');
});

// Question options click callbacks
document.querySelectorAll('.opt-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const idx = parseInt(btn.getAttribute('data-index'));
    submitAnswer(idx);
  });
});

// Win screen button events
document.getElementById('btn-play-again').addEventListener('click', () => {
  showScreen('screen-gameplay');
  initNewGame();
});

document.getElementById('btn-view-leaderboard-end').addEventListener('click', () => {
  renderLeaderboardView();
  showScreen('screen-leaderboard');
});

document.getElementById('btn-menu-end').addEventListener('click', () => {
  showScreen('screen-main-menu');
});

// Save Score submission
document.getElementById('btn-save-score').addEventListener('click', () => {
  const nameInput = document.getElementById('player-name-input');
  const name = nameInput.value.trim() || "Runner";
  
  saveLeaderboardScore(name, gameState.score, gameState.accuracy);
  
  const statusEl = document.getElementById('save-status');
  statusEl.innerText = "Score saved!";
  statusEl.className = "save-status-text text-green";
  
  // Disable button
  document.getElementById('btn-save-score').disabled = true;
  nameInput.disabled = true;
});


// --- 11. GAME STATE RESOLUTION (WIN / OVER / PAUSE) ---

function pauseGame() {
  if (gameState.activeScreen !== 'gameplay') return;
  gameState.isPaused = true;
  document.getElementById('screen-pause-overlay').classList.remove('hidden');
  document.getElementById('screen-pause-overlay').classList.add('active');
}

function resumeGame() {
  gameState.isPaused = false;
  document.getElementById('screen-pause-overlay').classList.remove('active');
  document.getElementById('screen-pause-overlay').classList.add('hidden');
}

function startResumeCountdown() {
  const pauseScreen = document.getElementById('screen-pause-overlay');
  const countdownScreen = document.getElementById('screen-countdown-overlay');
  const countdownText = document.getElementById('countdown-text');
  
  pauseScreen.classList.remove('active');
  pauseScreen.classList.add('hidden');
  countdownScreen.classList.remove('hidden');
  countdownText.innerText = '3';
  gameState.isPaused = true;
  
  let count = 3;
  const tick = () => {
    count -= 1;
    if (count > 0) {
      countdownText.innerText = String(count);
      setTimeout(tick, 900);
    } else if (count === 0) {
      countdownText.innerText = 'GO';
      setTimeout(tick, 700);
    } else {
      countdownScreen.classList.add('hidden');
      resumeGame();
    }
  };
  setTimeout(tick, 900);
}

function gameOver() {
  playGameOverSound();
  showEndScreen(false);
}

function winGame() {
  playLevelUpSound();
  showEndScreen(true);
}

function showEndScreen(isWin) {
  // Re-enable save button
  document.getElementById('btn-save-score').disabled = false;
  const nameInput = document.getElementById('player-name-input');
  nameInput.disabled = false;
  nameInput.value = "Runner";
  document.getElementById('save-status').innerText = "";
  
  // Update screen text
  const titleEl = document.getElementById('game-end-title');
  const msgEl = document.getElementById('game-end-message');
  
  if (isWin) {
    titleEl.innerText = "YOU WIN";
    titleEl.className = "text-green";
    msgEl.innerText = "Great job! You completed the level and proved your MathRush mastery.";
  } else {
    titleEl.innerText = "YOU LOSE";
    titleEl.className = "text-pink";
    msgEl.innerText = "Oops! You didn't make it this time. Try again to sharpen your skills.";
  }
  
  // Load Stats
  document.getElementById('end-score').innerText = gameState.score;
  document.getElementById('end-accuracy').innerText = `${gameState.accuracy}%`;
  document.getElementById('end-levels').innerText = gameState.levelCompletions;
  
  const formattedTime = gameState.fastestResponseTime !== null ? `${gameState.fastestResponseTime.toFixed(1)}s` : "N/A";
  document.getElementById('end-fastest-time').innerText = formattedTime;
  
  const bonusScore = gameState.fastAnswerBonusesEarned * 5;
  document.getElementById('end-bonuses').innerText = `${gameState.fastAnswerBonusesEarned} (+${bonusScore} pts)`;
  
  showScreen('screen-game-end');
}


// --- 12. CANVAS DRAWING LOOP (MAIN LOOP) ---
let lastTime = 0;

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  
  // Clamp delta time to avoid giant jumps on frame-drops
  if (dt > 0.1) dt = 0.1;
  
  lastTime = timestamp;
  
  if (gameState.activeScreen === 'gameplay' && !gameState.isPaused) {
    updateGameLogic(dt);
  }
  
  renderCanvas();
  
  requestAnimationFrame(gameLoop);
}






// Update game physics and positions
function updateGameLogic(dt) {
  gameState.gameTime += dt;
  
  // Screen shake timer decay
  if (gameState.screenShakeTime > 0) {
    gameState.screenShakeTime -= dt;
  }
  
  // Invincibility decay
  if (gameState.invincibilityTimer > 0) {
    gameState.invincibilityTimer -= dt;
  }
  
  // Slide character smoothly towards lane
  player.x += (player.targetX - player.x) * 12 * dt;
  
  // Running Leg cycles
  const currentSpeedMult = gameState.playerSpeedFactor;
  player.runCycle += currentSpeedMult * 18 * dt;
  
  // Handle jumping mechanics
  if (player.isJumping) {
    player.jumpVelocity -= player.gravity * dt;
    player.jumpY += player.jumpVelocity * dt;
    if (player.jumpY <= 0) {
      player.jumpY = 0;
      player.isJumping = false;
      player.jumpVelocity = 0;
    }
  }
  
  // Track scroll speed calculations
  const scrollBaseSpeed = 360; // px/sec
  const speedScale = scrollBaseSpeed * currentSpeedMult;
  
  // Scroll lane boundaries
  laneLinesY = (laneLinesY + speedScale * dt) % 60;
  
  // Handle question timers & popups
  if (gameState.questionActive) {
    // If we have active selection feedback, count it down
    if (gameState.questionResultFeedback) {
      if (Date.now() > gameState.questionResultFeedback.showUntil) {
        // Close question panel
        gameState.questionActive = false;
        gameState.questionResultFeedback = null;
        gameState.currentQuestion = null;
        document.getElementById('question-panel').classList.add('hidden');
        
        // Check level progress
        if (gameState.levelQuestionsAnswered >= 10) {
          completeLevel();
        } else {
          gameState.questionSpawnTimer = 0; // Start countdown to next question
        }
      }
    } else {
      // Normal question timer count down
      gameState.questionTimer -= dt;
      
      // Update timer progress bar in UI
      const timerFill = document.getElementById('question-timer-fill');
      const ratio = Math.max(0, gameState.questionTimer / gameState.questionTimerMax);
      timerFill.style.width = `${ratio * 100}%`;
      
      // Change color based on remaining time
      if (ratio > 0.5) timerFill.style.background = '#ffee00'; // Yellow
      else if (ratio > 0.25) timerFill.style.background = '#ff8000'; // Orange
      else timerFill.style.background = '#ff0055'; // Pink
      
      if (gameState.questionTimer <= 0) {
        submitAnswer(-1); // Timeout is equivalent to incorrect
      }
    }
  } else {
    // Count down to spawning the next math question
    gameState.questionSpawnTimer += dt;
    // Spawn question every 4.5 seconds
    if (gameState.questionSpawnTimer >= 4.5) {
      triggerQuestion();
    }
  }
  
  // Particle generator on the sides
  if (Math.random() < 0.2) {
    // Spawn left particle
    spawnParticle(15, 0, '#00f0ff', Math.random() * 4 + 2, 0, speedScale, 1.2);
    // Spawn right particle
    spawnParticle(585, 0, '#ff007f', Math.random() * 4 + 2, 0, speedScale, 1.2);
  }
  
  // Spawning obstacles
  obstacleSpawnTimer += dt;
  // Level affects obstacle spawn frequency
  const oSpawnInterval = Math.max(1.8, 3.2 - (gameState.currentLevel * 0.5));
  if (obstacleSpawnTimer > oSpawnInterval) {
    obstacleSpawnTimer = 0;
    const lane = Math.floor(Math.random() * 3);
    obstacles.push({
      lane: lane,
      x: laneXs[lane],
      y: -40,
      width: 80,
      height: 30
    });
  }
  
  // Spawning coins
  coinSpawnTimer += dt;
  const cSpawnInterval = 2.4;
  if (coinSpawnTimer > cSpawnInterval) {
    coinSpawnTimer = 0;
    // Spawn coins in a lane that isn't blocked right at the top
    const lane = Math.floor(Math.random() * 3);
    
    // Ensure we don't drop coin on top of active obstacle
    const blocked = obstacles.some(o => o.lane === lane && o.y < 120);
    if (!blocked) {
      coins.push({
        lane: lane,
        x: laneXs[lane],
        y: -30,
        size: 15,
        collected: false,
        pulse: 0
      });
    }
  }
  
  // Move and resolve Obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.y += speedScale * dt;
    
    // Collsion check with player
    if (o.lane === player.lane && gameState.invincibilityTimer <= 0) {
      const vertDistance = Math.abs(o.y - player.y);
      if (vertDistance < 32) {
        // If jumping sufficiently high, dodge the obstacle
        if (player.jumpY > 20) {
          // Dodged! Spawn some sparks for juice
          for (let p = 0; p < 8; p++) {
            spawnParticle(player.x, player.y - player.jumpY, '#00f0ff', 3, (Math.random() - 0.5) * 150, -50 - Math.random() * 100, 0.4);
          }
        } else {
          // Hit! Slow down penalty
          gameState.invincibilityTimer = 1.6;
          gameState.speedPenaltyTimer = 1.2;
          gameState.speedBoostTimer = 0;
          gameState.streak = 0;
          document.getElementById('streak-indicator').classList.add('hidden');
          gameState.screenShakeTime = 0.35;
          playWrongSound();
          spawnFloatingText("BUMP!", player.x, player.y - 40, '#ff007f');
          
          // Spawn collision sparks
          for (let p = 0; p < 15; p++) {
            spawnParticle(player.x, player.y, '#ff007f', 4, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, 0.5);
          }
          // Bump penalty: reduce player's score without removing the obstacle
          const bumpPenalty = 10;
          gameState.score = Math.max(0, gameState.score - bumpPenalty);
          spawnFloatingText(`-${bumpPenalty}`, player.x, player.y - player.jumpY - 45, '#ff007f');
          updateHUD();
        }
      }
    }
    
    // Cleanup out of bounds
    if (o.y > 850) {
      obstacles.splice(i, 1);
    }
  }
  
  // Move and resolve Coins
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.y += speedScale * dt;
    c.pulse += 6 * dt;
    
    // Collision check
    if (!c.collected && c.lane === player.lane) {
      const vertDistance = Math.abs(c.y - player.y);
      // Coins collected if player matches vertical height (and is at similar height scale)
      if (vertDistance < 32 && Math.abs(player.jumpY - 0) < 32) {
        c.collected = true;
        gameState.score += 2;
        playCoinSound();
        updateHUD();
        spawnFloatingText("+2", player.x, player.y - player.jumpY - 45, '#ffee00');
        
        // Spawn coin sparkles
        for (let p = 0; p < 10; p++) {
          spawnParticle(c.x, c.y, '#ffee00', 3, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 0.3);
        }
      }
    }
    
    if (c.y > 850 || c.collected) {
      coins.splice(i, 1);
    }
  }
  
  // Update particles
  for (let i = environmentParticles.length - 1; i >= 0; i--) {
    const p = environmentParticles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) {
      environmentParticles.splice(i, 1);
    }
  }
  
  // Update float text
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy * dt;
    ft.timer += dt;
    ft.opacity = Math.max(0, 1 - (ft.timer / 1.0));
    if (ft.opacity <= 0) {
      floatingTexts.splice(i, 1);
    }
  }
  
  // Handle speed HUD bars update
  const speedFill = document.getElementById('speed-bar-fill');
  const speedValEl = document.getElementById('speed-value');
  let dispSpeed = Math.round(100 * currentSpeedMult);
  if (gameState.speedPenaltyTimer > 0) dispSpeed = 30; // display absolute drop
  
  speedFill.style.width = `${dispSpeed}%`;
  speedValEl.innerText = `${dispSpeed} km/h`;
}

// Render everything on Canvas
function renderCanvas() {
  // Clear buffer
  ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);
  
  // Handle Screen Shake offset
  ctx.save();
  if (gameState.screenShakeTime > 0) {
    const shakeAmount = 6;
    const dx = (Math.random() - 0.5) * shakeAmount;
    const dy = (Math.random() - 0.5) * shakeAmount;
    ctx.translate(dx, dy);
  }
  
  // 1. Draw Road Track Grid
  // Dark fill for the road track
  ctx.fillStyle = '#080614';
  ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);
  
  // Lanes backgrounds
  ctx.fillStyle = '#0f0c26';
  ctx.fillRect(40, 0, 520, V_HEIGHT);
  
  // Side shoulders/barriers
  ctx.fillStyle = '#04030a';
  ctx.fillRect(0, 0, 40, V_HEIGHT);
  ctx.fillRect(560, 0, 40, V_HEIGHT);
  
  // Side boundary lines
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.lineTo(40, V_HEIGHT);
  ctx.moveTo(560, 0);
  ctx.lineTo(560, V_HEIGHT);
  ctx.stroke();
  
  // Lane separator dashed lines
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 40]);
  ctx.lineDashOffset = -laneLinesY;
  
  ctx.beginPath();
  // Line between Left and Middle lane
  ctx.moveTo(200, 0);
  ctx.lineTo(200, V_HEIGHT);
  // Line between Middle and Right lane
  ctx.moveTo(400, 0);
  ctx.lineTo(400, V_HEIGHT);
  ctx.stroke();
  
  ctx.setLineDash([]); // Reset dash
  
  // Draw glowing grid dots/lines on the shoulders
  ctx.strokeStyle = 'rgba(255, 0, 127, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = -60; y < V_HEIGHT + 60; y += 60) {
    const currentY = y + laneLinesY;
    // Horizontal lines on left shoulder
    ctx.moveTo(0, currentY);
    ctx.lineTo(40, currentY);
    // Horizontal lines on right shoulder
    ctx.moveTo(560, currentY);
    ctx.lineTo(600, currentY);
  }
  ctx.stroke();
  
  // 2. Draw Environment Particles
  environmentParticles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  
  // 3. Draw Coins
  coins.forEach(c => {
    ctx.save();
    // Inner pulse scale
    const pulseScale = 1 + Math.sin(c.pulse) * 0.12;
    
    // Draw outer glow circle
    ctx.shadowColor = '#ffee00';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffee00';
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.size * pulseScale, 0, Math.PI * 2);
    ctx.fill();
    
    // Gold emblem inner ring
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 0; // Disable shadow for inner lines
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.size * 0.7 * pulseScale, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw "C" in center
    ctx.fillStyle = '#000000';
    ctx.font = `800 ${14 * pulseScale}px var(--font-family)`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', c.x, c.y);
    
    ctx.restore();
  });
  
  // 4. Draw Obstacles
  obstacles.forEach(o => {
    ctx.save();
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 10;
    
    // Flat neon barrier styling
    const radius = 6;
    ctx.fillStyle = 'rgba(255, 0, 127, 0.2)';
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 3.5;
    
    // Rounder rectangle barrier
    ctx.beginPath();
    ctx.roundRect(o.x - o.width/2, o.y - o.height/2, o.width, o.height, radius);
    ctx.fill();
    ctx.stroke();
    
    // Draw diagonal warning lines inside
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let offset = -20; offset < 30; offset += 15) {
      ctx.moveTo(o.x + offset - 10, o.y - o.height/2 + 2);
      ctx.lineTo(o.x + offset + 10, o.y + o.height/2 - 2);
    }
    ctx.stroke();
    
    ctx.restore();
  });
  
  // 5. Draw Player character (with trails, visor, and runner motions)
  ctx.save();
  
  // Calculate vertical coordinate with jumping height
  const drawY = player.y - player.jumpY;
  
  // Invincibility flashing state
  let skipPlayerDrawing = false;
  if (gameState.invincibilityTimer > 0) {
    // Flash at 12Hz rate
    if (Math.floor(gameState.invincibilityTimer * 16) % 2 === 0) {
      skipPlayerDrawing = true;
    }
  }
  
  if (!skipPlayerDrawing) {
    // 5a. Draw shadow at baseline Y (decreases in scale as jump heights increase)
    ctx.save();
    const shadowOpacity = Math.max(0.08, 0.45 - (player.jumpY / 150));
    const shadowScale = Math.max(0.3, 1.0 - (player.jumpY / 220));
    ctx.fillStyle = 'rgba(0, 0, 0, ' + shadowOpacity + ')';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + player.height/2, player.width * 0.7 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // 5b. Draw neon trails if boosting
    if (gameState.speedBoostTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.lineWidth = 15;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(player.x, drawY);
      ctx.lineTo(player.x, drawY + 40);
      ctx.stroke();
      ctx.restore();
    }
    
    // 5c. Runner legs animation
    ctx.fillStyle = '#00a8ff';
    const legOffset1 = Math.sin(player.runCycle) * 14;
    const legOffset2 = -Math.sin(player.runCycle) * 14;
    
    // Draw Left Leg
    ctx.beginPath();
    ctx.arc(player.x - 12, drawY + player.height/2 - 4 + Math.max(0, legOffset1), 7, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw Right Leg
    ctx.beginPath();
    ctx.arc(player.x + 12, drawY + player.height/2 - 4 + Math.max(0, legOffset2), 7, 0, Math.PI * 2);
    ctx.fill();
    
    // 5d. Player Body (Futuristic cyber capsule)
    ctx.save();
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    
    // Body gradient fill
    const playerGrad = ctx.createLinearGradient(player.x - 20, drawY - 25, player.x + 20, drawY + 25);
    playerGrad.addColorStop(0, '#00f0ff');
    playerGrad.addColorStop(1, '#0c0a2a');
    
    ctx.fillStyle = playerGrad;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3.5;
    
    ctx.beginPath();
    ctx.roundRect(player.x - player.width/2, drawY - player.height/2, player.width, player.height - 8, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    
    // 5e. Glow cyber visor (horizontal line overlay)
    ctx.save();
    ctx.fillStyle = '#ff007f';
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(player.x - 15, drawY - 14, 30, 7, 3.5);
    ctx.fill();
    ctx.restore();
  }
  
  ctx.restore();
  
  // 6. Draw floating score text pops
  floatingTexts.forEach(ft => {
    ctx.save();
    ctx.globalAlpha = ft.opacity;
    ctx.fillStyle = ft.color;
    ctx.font = '800 1.25rem var(--font-family)';
    ctx.textAlign = 'center';
    
    // Glow border on text
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  });
  
  // 7. Transition Overlay text (e.g. LEVEL COMPLETED)
  if (gameState.activeScreen === 'gameplay' && gameState.levelQuestionsAnswered === 0 && gameState.gameTime < 2.0 && gameState.totalAnswered > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.font = '800 2.25rem var(--font-family)';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.fillText(`LEVEL ${gameState.currentLevel}`, 300, 300);
    ctx.font = '600 1.15rem var(--font-family)';
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.fillText("Ready runner...", 300, 335);
    ctx.restore();
  }
  
  ctx.restore(); // screen shake restore
}


if (typeof gameLoop === 'function') {
  window.gameLoop = gameLoop;
}

// --- 13. BOOTSTRAP INIT ---
// Launch game loop
requestAnimationFrame(gameLoop);

// Keyboard controls hint support for click to activate Web Audio
document.body.addEventListener('mousedown', () => {
  initAudio();
});
document.body.addEventListener('touchstart', () => {
  initAudio();
});