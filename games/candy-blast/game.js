'use strict';

const COLS      = 8;
const ROWS      = 8;
const TYPES     = 6;
const MAX_MOVES = 30;

let board, selected, score, movesLeft, busy;

const boardEl   = document.getElementById('board');
const scoreEl   = document.getElementById('score');
const movesEl   = document.getElementById('moves');
const overlayEl = document.getElementById('overlay');
const ovScoreEl = document.getElementById('ov-score');
const wrapEl    = document.getElementById('board-wrap');

// ── Init ──────────────────────────────────────────────────────────────────────

function newGame() {
  score     = 0;
  movesLeft = MAX_MOVES;
  selected  = null;
  busy      = false;
  initBoard();
  render();
  hideOverlay();
  syncHUD();
}

function initBoard() {
  board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let t;
      do {
        t = Math.ceil(Math.random() * TYPES);
      } while (
        (c >= 2 && board[r][c-1] === t && board[r][c-2] === t) ||
        (r >= 2 && board[r-1][c] === t && board[r-2][c] === t)
      );
      board[r][c] = t;
    }
  }
}

// ── Match logic ───────────────────────────────────────────────────────────────

function findMatches() {
  const set = new Set();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 2; c++) {
      const t = board[r][c];
      if (!t || t !== board[r][c+1] || t !== board[r][c+2]) continue;
      let len = 3;
      while (c + len < COLS && board[r][c+len] === t) len++;
      for (let k = 0; k < len; k++) set.add(`${r},${c+k}`);
      c += len - 1;
    }
  }

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 2; r++) {
      const t = board[r][c];
      if (!t || t !== board[r+1][c] || t !== board[r+2][c]) continue;
      let len = 3;
      while (r + len < ROWS && board[r+len][c] === t) len++;
      for (let k = 0; k < len; k++) set.add(`${r+k},${c}`);
      r += len - 1;
    }
  }

  return set;
}

function removeMatches(matches) {
  matches.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    board[r][c] = 0;
  });
}

function gravity() {
  const dropped = new Set();
  for (let c = 0; c < COLS; c++) {
    let dst = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c]) {
        if (dst !== r) {
          board[dst][c] = board[r][c];
          board[r][c]   = 0;
          dropped.add(`${dst},${c}`);
        }
        dst--;
      }
    }
    for (let r = dst; r >= 0; r--) {
      board[r][c] = Math.ceil(Math.random() * TYPES);
      dropped.add(`${r},${c}`);
    }
  }
  return dropped;
}

// ── Cascade ───────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cascade(combo = 0) {
  const matches = findMatches();
  if (!matches.size) return;

  combo++;
  score += matches.size * 10 * combo;
  syncHUD();

  matches.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    getTileEl(r, c)?.classList.add('matched');
  });

  if (combo >= 2) showComboLabel(combo);

  await sleep(310);
  removeMatches(matches);
  const dropped = gravity();
  render(dropped);

  await sleep(340);
  await cascade(combo);
}

async function trySwap(r1, c1, r2, c2) {
  if (busy) return;
  busy     = true;
  selected = null;
  render();

  [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];

  if (!findMatches().size) {
    [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
    render();
    [getTileEl(r1, c1), getTileEl(r2, c2)].forEach(el => {
      if (!el) return;
      el.classList.add('shake');
      el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
    });
    busy = false;
    return;
  }

  movesLeft--;
  syncHUD();
  render();
  await cascade();

  busy = false;
  if (movesLeft <= 0) setTimeout(showGameOver, 420);
}

// ── Render ────────────────────────────────────────────────────────────────────

function render(dropSet = new Set()) {
  boardEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;

      if (board[r][c]) {
        const tile = document.createElement('div');
        tile.className    = 'tile';
        tile.dataset.type = board[r][c];
        if (selected && selected.r === r && selected.c === c) tile.classList.add('selected');
        if (dropSet.has(`${r},${c}`)) tile.classList.add('drop');
        cell.appendChild(tile);
      }

      boardEl.appendChild(cell);
    }
  }
}

function getTileEl(r, c) {
  return boardEl.children[r * COLS + c]?.querySelector('.tile') ?? null;
}

function showComboLabel(n) {
  const msgs = ['', '', 'COMBO!', 'GREAT!!', 'AMAZING!', 'UNREAL!!'];
  const label = document.createElement('div');
  label.className   = 'combo-label';
  label.textContent = msgs[n] ?? 'INSANE!!!';
  wrapEl.appendChild(label);
  label.addEventListener('animationend', () => label.remove(), { once: true });
}

// ── HUD / overlay ─────────────────────────────────────────────────────────────

function syncHUD() {
  scoreEl.textContent = score;
  movesEl.textContent = movesLeft;
  movesEl.classList.toggle('low', movesLeft <= 5);
}

function showGameOver() {
  ovScoreEl.textContent = score;
  overlayEl.classList.remove('hidden');
}

function hideOverlay() {
  overlayEl.classList.add('hidden');
}

// ── Input ─────────────────────────────────────────────────────────────────────

function isAdj(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

function onTap(r, c) {
  if (busy || !board[r][c]) return;

  if (!selected) {
    selected = { r, c };
    render();
    return;
  }

  if (selected.r === r && selected.c === c) {
    selected = null;
    render();
    return;
  }

  if (isAdj(selected.r, selected.c, r, c)) {
    trySwap(selected.r, selected.c, r, c);
  } else {
    selected = { r, c };
    render();
  }
}

boardEl.addEventListener('click', e => {
  const cell = e.target.closest('.cell');
  if (cell) onTap(+cell.dataset.r, +cell.dataset.c);
});

// Touch swipe
let drag = null;
boardEl.addEventListener('touchstart', e => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  drag = { r: +cell.dataset.r, c: +cell.dataset.c, x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

boardEl.addEventListener('touchend', e => {
  if (!drag) return;
  const dx = e.changedTouches[0].clientX - drag.x;
  const dy = e.changedTouches[0].clientY - drag.y;

  if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
    onTap(drag.r, drag.c);
  } else {
    let { r, c } = drag;
    let tr = r, tc = c;
    if (Math.abs(dx) > Math.abs(dy)) tc += dx > 0 ? 1 : -1;
    else tr += dy > 0 ? 1 : -1;
    if (tr >= 0 && tr < ROWS && tc >= 0 && tc < COLS) {
      selected = { r, c };
      trySwap(r, c, tr, tc);
    }
  }
  drag = null;
}, { passive: true });

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-retry').addEventListener('click', newGame);

// ── Start ─────────────────────────────────────────────────────────────────────

newGame();
