/**
 * Core Tic-Tac-Toe game logic and AI engine.
 * Works in both browser (globalThis.TicTacToeEngine) and Node.js environments.
 */
(function (root) {
  'use strict';

  const WIN_LINES = [
    [0, 1, 2], // top row
    [3, 4, 5], // middle row
    [6, 7, 8], // bottom row
    [0, 3, 6], // left col
    [1, 4, 7], // middle col
    [2, 5, 8], // right col
    [0, 4, 8], // main diagonal
    [2, 4, 6], // anti-diagonal
  ];

  /**
   * Returns a fresh 9-cell empty board.
   * @returns {(string|null)[]}
   */
  function createBoard() {
    return Array(9).fill(null);
  }

  /**
   * Returns the opponent symbol for 'X' or 'O'.
   * @param {'X'|'O'} player
   * @returns {'X'|'O'}
   */
  function getOpponent(player) {
    return player === 'X' ? 'O' : 'X';
  }

  /**
   * Evaluates the current board state.
   * @param {(string|null)[]} board
   * @returns {{ status: 'playing'|'win'|'draw', winner: string|null, line: number[]|null, lineIndex: number|null }}
   */
  function evaluateBoard(board) {
    for (let i = 0; i < WIN_LINES.length; i++) {
      const [a, b, c] = WIN_LINES[i];
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return {
          status: 'win',
          winner: board[a],
          line: [a, b, c],
          lineIndex: i,
        };
      }
    }

    if (board.every((cell) => cell !== null)) {
      return { status: 'draw', winner: null, line: null, lineIndex: null };
    }

    return { status: 'playing', winner: null, line: null, lineIndex: null };
  }

  /**
   * Returns indices of all empty cells.
   * @param {(string|null)[]} board
   * @returns {number[]}
   */
  function getAvailableMoves(board) {
    const moves = [];
    for (let i = 0; i < board.length; i++) {
      if (board[i] === null) moves.push(i);
    }
    return moves;
  }

  /**
   * Finds an immediate winning move for `player`, or null if none exists.
   * @param {(string|null)[]} board
   * @param {'X'|'O'} player
   * @returns {number|null}
   */
  function findWinningMove(board, player) {
    for (const [a, b, c] of WIN_LINES) {
      const cells = [board[a], board[b], board[c]];
      const indices = [a, b, c];
      let playerCount = 0;
      let emptyIdx = -1;
      for (let i = 0; i < 3; i++) {
        if (cells[i] === player) playerCount++;
        else if (cells[i] === null) emptyIdx = indices[i];
      }
      if (playerCount === 2 && emptyIdx !== -1) {
        return emptyIdx;
      }
    }
    return null;
  }

  /**
   * Minimax algorithm with depth weighting (prefers faster wins, slower losses).
   */
  function minimax(board, depth, isMaximizing, aiPlayer, humanPlayer, alpha, beta) {
    const result = evaluateBoard(board);
    if (result.status === 'win') {
      return result.winner === aiPlayer ? 10 - depth : depth - 10;
    }
    if (result.status === 'draw') {
      return 0;
    }

    if (isMaximizing) {
      let best = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = aiPlayer;
          const score = minimax(board, depth + 1, false, aiPlayer, humanPlayer, alpha, beta);
          board[i] = null;
          if (score > best) best = score;
          if (best > alpha) alpha = best;
          if (beta <= alpha) break;
        }
      }
      return best;
    } else {
      let best = Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = humanPlayer;
          const score = minimax(board, depth + 1, true, aiPlayer, humanPlayer, alpha, beta);
          board[i] = null;
          if (score < best) best = score;
          if (best < beta) beta = best;
          if (beta <= alpha) break;
        }
      }
      return best;
    }
  }

  /**
   * Picks the optimal move using Minimax, breaking ties randomly for variety.
   * @param {(string|null)[]} board
   * @param {'X'|'O'} aiPlayer
   * @param {() => number} [rng=Math.random]
   * @returns {number|null}
   */
  function getBestMove(board, aiPlayer, rng = Math.random) {
    const available = getAvailableMoves(board);
    if (available.length === 0) return null;

    // Fast path for completely empty board: pick center or a corner (all optimal)
    if (available.length === 9) {
      const openings = [0, 2, 4, 6, 8];
      return openings[Math.floor(rng() * openings.length)];
    }

    const humanPlayer = getOpponent(aiPlayer);
    const copy = board.slice();
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const move of available) {
      copy[move] = aiPlayer;
      const score = minimax(copy, 0, false, aiPlayer, humanPlayer, -Infinity, Infinity);
      copy[move] = null;

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    }

    return bestMoves[Math.floor(rng() * bestMoves.length)];
  }

  /**
   * Selects an AI move according to difficulty ('easy' | 'medium' | 'hard').
   * @param {(string|null)[]} board
   * @param {'X'|'O'} aiPlayer
   * @param {'easy'|'medium'|'hard'} difficulty
   * @param {() => number} [rng=Math.random]
   * @returns {number|null}
   */
  function getAIMove(board, aiPlayer, difficulty = 'hard', rng = Math.random) {
    const available = getAvailableMoves(board);
    if (available.length === 0) return null;

    if (difficulty === 'easy') {
      // 25% chance to take an immediate win, otherwise random
      if (rng() < 0.25) {
        const winMove = findWinningMove(board, aiPlayer);
        if (winMove !== null) return winMove;
      }
      return available[Math.floor(rng() * available.length)];
    }

    if (difficulty === 'medium') {
      // Always take an immediate win if available
      const winMove = findWinningMove(board, aiPlayer);
      if (winMove !== null) return winMove;

      // 75% chance to block opponent's immediate win
      const blockMove = findWinningMove(board, getOpponent(aiPlayer));
      if (blockMove !== null && rng() < 0.75) return blockMove;

      // 50% chance to play optimally, 50% random
      if (rng() < 0.5) {
        return getBestMove(board, aiPlayer, rng);
      }
      return available[Math.floor(rng() * available.length)];
    }

    // 'hard' — Unbeatable Minimax
    return getBestMove(board, aiPlayer, rng);
  }

  const engine = {
    WIN_LINES,
    createBoard,
    getOpponent,
    evaluateBoard,
    getAvailableMoves,
    findWinningMove,
    getBestMove,
    getAIMove,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = engine;
  } else {
    root.TicTacToeEngine = engine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
