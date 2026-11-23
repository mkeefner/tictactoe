(function () {
  'use strict';

  const engine = window.TicTacToeEngine;
  const STORAGE_KEY = 'tic_tac_toe_state_v1';

  // Coordinates for the 8 winning lines inside the 300x300 SVG overlay
  const WIN_LINE_COORDS = [
    { x1: 24, y1: 50, x2: 276, y2: 50 },   // row 0
    { x1: 24, y1: 150, x2: 276, y2: 150 }, // row 1
    { x1: 24, y1: 250, x2: 276, y2: 250 }, // row 2
    { x1: 50, y1: 24, x2: 50, y2: 276 },   // col 0
    { x1: 150, y1: 24, x2: 150, y2: 276 }, // col 1
    { x1: 250, y1: 24, x2: 250, y2: 276 }, // col 2
    { x1: 28, y1: 28, x2: 272, y2: 272 },  // main diagonal
    { x1: 272, y1: 28, x2: 28, y2: 272 },  // anti-diagonal
  ];

  // Persistent & runtime state
  const state = {
    mode: 'ai',           // 'ai' | 'pvp'
    difficulty: 'hard',   // 'easy' | 'medium' | 'hard'
    humanSymbol: 'X',     // 'X' | 'O' (used in 'ai' mode)
    soundEnabled: true,
    theme: 'dark',
    scores: {
      ai: { X: 0, O: 0, draw: 0 },
      pvp: { X: 0, O: 0, draw: 0 },
    },
    board: engine.createBoard(),
    roundStarter: 'X',
    nextStarter: 'X',
    currentTurn: 'X',
    gameOver: false,
    aiThinking: false,
    aiTimerId: null,
  };

  // DOM elements
  const els = {
    board: document.getElementById('board'),
    cells: Array.from(document.querySelectorAll('.cell')),
    winLine: document.getElementById('winLine'),
    statusBanner: document.getElementById('statusBanner'),
    statusText: document.getElementById('statusText'),
    aiOptions: document.getElementById('aiOptions'),
    modeBtns: Array.from(document.querySelectorAll('[data-mode]')),
    diffBtns: Array.from(document.querySelectorAll('[data-difficulty]')),
    symbolBtns: Array.from(document.querySelectorAll('[data-symbol]')),
    scoreCardX: document.getElementById('scoreCardX'),
    scoreCardO: document.getElementById('scoreCardO'),
    scoreCardDraw: document.getElementById('scoreCardDraw'),
    labelX: document.getElementById('labelX'),
    labelO: document.getElementById('labelO'),
    scoreX: document.getElementById('scoreX'),
    scoreO: document.getElementById('scoreO'),
    scoreDraw: document.getElementById('scoreDraw'),
    newRoundBtn: document.getElementById('newRoundBtn'),
    resetScoreBtn: document.getElementById('resetScoreBtn'),
    soundToggle: document.getElementById('soundToggle'),
    soundOnIcon: document.getElementById('soundOnIcon'),
    soundOffIcon: document.getElementById('soundOffIcon'),
    themeToggle: document.getElementById('themeToggle'),
    sunIcon: document.getElementById('sunIcon'),
    moonIcon: document.getElementById('moonIcon'),
    installBtn: document.getElementById('installBtn'),
  };

  // Lightweight Web Audio synthesizer (no external audio assets needed)
  let audioCtx = null;
  function getAudioContext() {
    if (!state.soundEnabled) return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function playTone(freq, duration, type = 'sine', gainVal = 0.08, delay = 0) {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playSound(kind) {
    if (!state.soundEnabled) return;
    if (kind === 'X') {
      playTone(520, 0.11, 'triangle', 0.09);
    } else if (kind === 'O') {
      playTone(390, 0.12, 'sine', 0.09);
    } else if (kind === 'win') {
      playTone(523.25, 0.14, 'triangle', 0.09, 0);
      playTone(659.25, 0.14, 'triangle', 0.09, 0.09);
      playTone(783.99, 0.24, 'triangle', 0.1, 0.18);
    } else if (kind === 'draw') {
      playTone(340, 0.14, 'sine', 0.07, 0);
      playTone(300, 0.2, 'sine', 0.07, 0.12);
    }
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (_) {
        // Ignore if blocked
      }
    }
  }

  // Persistence
  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.mode === 'ai' || saved.mode === 'pvp') state.mode = saved.mode;
        if (['easy', 'medium', 'hard'].includes(saved.difficulty)) state.difficulty = saved.difficulty;
        if (saved.humanSymbol === 'X' || saved.humanSymbol === 'O') state.humanSymbol = saved.humanSymbol;
        if (typeof saved.soundEnabled === 'boolean') state.soundEnabled = saved.soundEnabled;
        if (saved.theme === 'dark' || saved.theme === 'light') {
          state.theme = saved.theme;
        } else {
          state.theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        if (saved.scores && saved.scores.ai && saved.scores.pvp) {
          state.scores = saved.scores;
        }
      } else {
        state.theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
    } catch (_) {
      state.theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          mode: state.mode,
          difficulty: state.difficulty,
          humanSymbol: state.humanSymbol,
          soundEnabled: state.soundEnabled,
          theme: state.theme,
          scores: state.scores,
        })
      );
    } catch (_) {
      // Ignore storage quota errors
    }
  }

  // SVG Mark builders
  function createMarkSvg(symbol) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('mark-svg', symbol === 'X' ? 'mark-x' : 'mark-o');

    if (symbol === 'X') {
      const l1 = document.createElementNS(ns, 'line');
      l1.setAttribute('x1', '22');
      l1.setAttribute('y1', '22');
      l1.setAttribute('x2', '78');
      l1.setAttribute('y2', '78');

      const l2 = document.createElementNS(ns, 'line');
      l2.setAttribute('x1', '78');
      l2.setAttribute('y1', '22');
      l2.setAttribute('x2', '22');
      l2.setAttribute('y2', '78');

      svg.append(l1, l2);
    } else {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', '50');
      c.setAttribute('cy', '50');
      c.setAttribute('r', '31');
      svg.append(c);
    }

    return svg;
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    const isLight = state.theme === 'light';
    els.sunIcon.classList.toggle('hidden', isLight);
    els.moonIcon.classList.toggle('hidden', !isLight);
  }

  function applySoundIcons() {
    els.soundOnIcon.classList.toggle('hidden', !state.soundEnabled);
    els.soundOffIcon.classList.toggle('hidden', state.soundEnabled);
  }

  function renderControls() {
    els.modeBtns.forEach((btn) => {
      const active = btn.dataset.mode === state.mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    els.aiOptions.classList.toggle('hidden', state.mode !== 'ai');

    els.diffBtns.forEach((btn) => {
      const active = btn.dataset.difficulty === state.difficulty;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', String(active));
    });

    els.symbolBtns.forEach((btn) => {
      const active = btn.dataset.symbol === state.humanSymbol;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', String(active));
    });
  }

  function renderScoreboard(result = null) {
    const scores = state.scores[state.mode];
    if (state.mode === 'ai') {
      els.labelX.textContent = state.humanSymbol === 'X' ? 'You (X)' : 'AI (X)';
      els.labelO.textContent = state.humanSymbol === 'O' ? 'You (O)' : 'AI (O)';
    } else {
      els.labelX.textContent = 'Player X';
      els.labelO.textContent = 'Player O';
    }

    els.scoreX.textContent = String(scores.X);
    els.scoreO.textContent = String(scores.O);
    els.scoreDraw.textContent = String(scores.draw);

    els.scoreCardX.classList.remove('active-turn');
    els.scoreCardO.classList.remove('active-turn');
    els.scoreCardDraw.classList.remove('active-turn');

    if (result && result.status === 'win') {
      if (result.winner === 'X') els.scoreCardX.classList.add('active-turn');
      if (result.winner === 'O') els.scoreCardO.classList.add('active-turn');
    } else if (result && result.status === 'draw') {
      els.scoreCardDraw.classList.add('active-turn');
    } else if (!state.gameOver) {
      if (state.currentTurn === 'X') els.scoreCardX.classList.add('active-turn');
      else els.scoreCardO.classList.add('active-turn');
    }
  }

  function renderStatus(result = null) {
    els.statusBanner.className = 'status-banner';

    if (result && result.status === 'win') {
      els.statusBanner.classList.add(result.winner === 'X' ? 'result-win-x' : 'result-win-o');
      if (state.mode === 'ai') {
        els.statusText.textContent =
          result.winner === state.humanSymbol ? 'You win!' : 'AI wins!';
      } else {
        els.statusText.textContent = `Player ${result.winner} wins!`;
      }
      return;
    }

    if (result && result.status === 'draw') {
      els.statusBanner.classList.add('result-draw');
      els.statusText.textContent = "It's a draw!";
      return;
    }

    els.statusBanner.classList.add(state.currentTurn === 'X' ? 'turn-x' : 'turn-o');
    if (state.mode === 'ai') {
      const aiSymbol = engine.getOpponent(state.humanSymbol);
      if (state.currentTurn === aiSymbol) {
        els.statusText.textContent = `AI is thinking (${aiSymbol})...`;
      } else {
        els.statusText.textContent = `Your turn (${state.humanSymbol})`;
      }
    } else {
      els.statusText.textContent = `Player ${state.currentTurn}'s turn`;
    }
  }

  function clearWinLine() {
    els.winLine.className.baseVal = '';
    els.winLine.setAttribute('x1', '0');
    els.winLine.setAttribute('y1', '0');
    els.winLine.setAttribute('x2', '0');
    els.winLine.setAttribute('y2', '0');
  }

  function drawWinLine(lineIndex, winner) {
    const coords = WIN_LINE_COORDS[lineIndex];
    if (!coords) return;
    els.winLine.setAttribute('x1', String(coords.x1));
    els.winLine.setAttribute('y1', String(coords.y1));
    els.winLine.setAttribute('x2', String(coords.x2));
    els.winLine.setAttribute('y2', String(coords.y2));
    // Trigger reflow so animation replays cleanly
    void els.winLine.getBoundingClientRect();
    els.winLine.className.baseVal = `visible ${winner === 'X' ? 'win-x' : 'win-o'}`;
  }

  function cancelPendingAI() {
    if (state.aiTimerId !== null) {
      clearTimeout(state.aiTimerId);
      state.aiTimerId = null;
    }
    state.aiThinking = false;
  }

  function updateCellA11y(cell, index, value) {
    const row = Math.floor(index / 3) + 1;
    const col = (index % 3) + 1;
    cell.setAttribute('aria-label', `Row ${row}, Column ${col}, ${value ? value : 'empty'}`);
  }

  function startNewRound() {
    cancelPendingAI();
    state.board = engine.createBoard();
    state.roundStarter = state.nextStarter;
    state.currentTurn = state.roundStarter;
    state.gameOver = false;

    clearWinLine();
    els.cells.forEach((cell, idx) => {
      cell.innerHTML = '';
      cell.className = 'cell';
      cell.disabled = false;
      updateCellA11y(cell, idx, null);
    });

    renderScoreboard();
    renderStatus();

    // If 1-player mode and it's AI's turn to open, schedule AI move
    if (state.mode === 'ai' && state.currentTurn !== state.humanSymbol) {
      scheduleAIMove();
    }
  }

  function placeMark(index, symbol) {
    state.board[index] = symbol;
    const cell = els.cells[index];
    cell.innerHTML = '';
    cell.appendChild(createMarkSvg(symbol));
    cell.classList.add(symbol === 'X' ? 'cell-x' : 'cell-o');
    cell.disabled = true;
    updateCellA11y(cell, index, symbol);

    playSound(symbol);
    vibrate(12);

    const result = engine.evaluateBoard(state.board);
    if (result.status === 'win') {
      state.gameOver = true;
      state.nextStarter = result.winner;
      state.scores[state.mode][result.winner] += 1;
      saveState();

      result.line.forEach((i) => els.cells[i].classList.add('win-cell'));
      els.cells.forEach((c) => (c.disabled = true));
      drawWinLine(result.lineIndex, result.winner);
      renderScoreboard(result);
      renderStatus(result);
      playSound('win');
      vibrate([25, 40, 45]);
      return;
    }

    if (result.status === 'draw') {
      state.gameOver = true;
      state.nextStarter = engine.getOpponent(state.roundStarter);
      state.scores[state.mode].draw += 1;
      saveState();

      els.cells.forEach((c) => (c.disabled = true));
      renderScoreboard(result);
      renderStatus(result);
      playSound('draw');
      vibrate([20, 30, 20]);
      return;
    }

    state.currentTurn = engine.getOpponent(symbol);
    renderScoreboard();
    renderStatus();

    if (state.mode === 'ai' && state.currentTurn !== state.humanSymbol) {
      scheduleAIMove();
    }
  }

  function scheduleAIMove() {
    cancelPendingAI();
    state.aiThinking = true;
    renderStatus();

    const aiSymbol = engine.getOpponent(state.humanSymbol);
    const delay = 320 + Math.floor(Math.random() * 160);

    state.aiTimerId = setTimeout(() => {
      state.aiTimerId = null;
      state.aiThinking = false;
      if (state.gameOver) return;
      const move = engine.getAIMove(state.board, aiSymbol, state.difficulty);
      if (move !== null) {
        placeMark(move, aiSymbol);
      }
    }, delay);
  }

  // Event Listeners
  els.cells.forEach((cell) => {
    cell.addEventListener('click', () => {
      const idx = Number(cell.dataset.index);
      if (state.gameOver || state.aiThinking || state.board[idx] !== null) return;
      if (state.mode === 'ai' && state.currentTurn !== state.humanSymbol) return;
      placeMark(idx, state.currentTurn);
    });
  });

  els.modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextMode = btn.dataset.mode;
      if (nextMode === state.mode) return;
      state.mode = nextMode;
      state.nextStarter = 'X';
      saveState();
      renderControls();
      startNewRound();
    });
  });

  els.diffBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextDiff = btn.dataset.difficulty;
      if (nextDiff === state.difficulty) return;
      state.difficulty = nextDiff;
      state.nextStarter = 'X';
      saveState();
      renderControls();
      startNewRound();
    });
  });

  els.symbolBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextSymbol = btn.dataset.symbol;
      if (nextSymbol === state.humanSymbol) return;
      state.humanSymbol = nextSymbol;
      state.nextStarter = 'X';
      saveState();
      renderControls();
      startNewRound();
    });
  });

  els.newRoundBtn.addEventListener('click', () => {
    vibrate(10);
    startNewRound();
  });

  els.resetScoreBtn.addEventListener('click', () => {
    vibrate(15);
    state.scores[state.mode] = { X: 0, O: 0, draw: 0 };
    saveState();
    renderScoreboard();
  });

  els.soundToggle.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    saveState();
    applySoundIcons();
    if (state.soundEnabled) playSound('X');
  });

  els.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    saveState();
    applyTheme();
  });

  // PWA Install prompt (Android / Chromium)
  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    els.installBtn.classList.remove('hidden');
  });

  els.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try {
      await deferredInstallPrompt.userChoice;
    } catch (_) {
      // Ignore
    }
    deferredInstallPrompt = null;
    els.installBtn.classList.add('hidden');
  });

  window.addEventListener('appinstalled', () => {
    els.installBtn.classList.add('hidden');
  });

  // Register Service Worker for offline PWA support
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  // Initialize
  loadSavedState();
  applyTheme();
  applySoundIcons();
  renderControls();
  startNewRound();
})();
