'use strict';

// ── Canvas & scaling ────────────────────────────────────────────────────────
const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');

const LW = 800, LH = 600; // logical dimensions
let scale, ox, oy;

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  scale = Math.min(canvas.width / LW, canvas.height / LH);
  ox = (canvas.width  - LW * scale) / 2;
  oy = (canvas.height - LH * scale) / 2;
}
window.addEventListener('resize', resize);
resize();

// ── Constants ───────────────────────────────────────────────────────────────
const PX   = 3;                          // game-pixels per sprite pixel
const COLS = 11, ROWS = 3;
const SPR_W = 12 * PX, SPR_H = 8 * PX;  // 36 × 24
const CELL_W = 56, CELL_H = 44;
const GRID_X = (LW - COLS * CELL_W) / 2; // 92
const GRID_Y = 80;
const STEP_DOWN    = 20;
const PL_W = 16 * PX, PL_H = 8 * PX;    // 48 × 24  player sprite size
const PL_Y = 510;
const PL_SPEED     = 260;  // logical units/s
const BW = 3, BH = 14;     // bullet dimensions
const PL_BSPEED    = 500;  // player bullet speed
const INV_BSPEED   = 220;  // invader bullet speed
const SH_PX        = 3;    // pixels per shield pixel
const SH_COLS      = 22, SH_ROWS = 14;
const SH_W = SH_COLS * SH_PX; // 66
const SH_H = SH_ROWS * SH_PX; // 42
const SH_Y         = 435;

// ── Colors ──────────────────────────────────────────────────────────────────
const G_GREEN  = '#33ff55';
const G_RED    = '#ff4444';
const G_WHITE  = '#ffffff';
const G_BLACK  = '#000000';
const G_DIM    = '#0a2a0a';

// ── Pixel sprites (12 × 8, 1 = filled) ─────────────────────────────────────
const SP = {
  // UFO type A (top row, 30pts) — saucer with dome and landing legs
  squid: [
    [ [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,0,0,1,1,1,1,0,0,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [0,1,0,1,0,0,0,0,1,0,1,0],
      [1,0,0,0,1,0,0,1,0,0,0,1],
      [0,0,0,0,0,0,0,0,0,0,0,0] ],
    [ [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,0,0,1,1,1,1,0,0,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,1,0,0,0,0,0,0,1,0,0],
      [0,1,0,1,0,0,0,0,1,0,1,0],
      [1,0,0,0,0,0,0,0,0,0,0,1] ],
  ],
  // UFO type B (middle rows, 20pts) — round saucer with portholes
  crab: [
    [ [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,0,0,1,1,0,0,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,1,1,1,1,1,1,1,1,0,1],
      [0,1,0,0,0,0,0,0,0,0,1,0],
      [1,0,1,0,0,0,0,0,0,1,0,1],
      [0,0,0,1,0,0,0,0,1,0,0,0] ],
    [ [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,0,0,1,1,0,0,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,1,1,1,1,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [0,1,0,1,0,0,0,0,1,0,1,0],
      [0,0,1,0,0,0,0,0,0,1,0,0] ],
  ],
  // UFO type C (bottom row, 10pts) — simple disc
  oct: [
    [ [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,0,1,0,1,1,0,1,0,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,1,1,0,0,0,0,1,1,0,0],
      [0,1,0,0,0,0,0,0,0,0,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0] ],
    [ [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,0,1,0,1,1,0,1,0,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [0,1,0,0,0,0,0,0,0,0,1,0],
      [1,0,1,0,0,0,0,0,0,1,0,1],
      [0,0,0,0,0,0,0,0,0,0,0,0] ],
  ],
  // Fighter jet (player)
  player: [
    [0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,1,0,1,1,1,1,1,1,1,1,1,0,1,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,0],
    [0,1,0,0,1,1,0,0,1,1,0,0,1,0,0,0],
    [0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0],
  ],
  explosion: [
    [0,1,0,0,1,0,0,1,0,0,1,0],
    [0,0,1,0,0,0,0,0,0,1,0,0],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [0,0,1,0,0,0,0,0,0,1,0,0],
    [0,1,0,0,1,0,0,1,0,0,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0],
  ],
};

// Shield template (22 × 14): classic bunker shape with arch cutout at bottom
const SHIELD_TPL = [
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1],
  [1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1],
  [1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1],
];

// ── Sprite drawing ──────────────────────────────────────────────────────────
function drawSprite(sprite, x, y, color) {
  ctx.fillStyle = color;
  for (let r = 0; r < sprite.length; r++) {
    for (let c = 0; c < sprite[r].length; c++) {
      if (sprite[r][c]) {
        ctx.fillRect(x + c * PX, y + r * PX, PX, PX);
      }
    }
  }
}

// ── Game state ──────────────────────────────────────────────────────────────
let state;       // 'intro' | 'playing' | 'levelclear' | 'gameover'
let score, hiScore, lives, level;
let plX;         // player center X
let plBullet;    // {x,y} or null
let invBullets;  // [{x,y}]
let grid;        // [row][col] = alive bool
let invOffX, invOffY, invDir;
let moveTimer, moveInterval;
let shootTimer;
let animFrame, animTimer;
let shields;     // [{x, pixels[][]}]
let sparks;      // [{x,y,timer,max}]
let flashTimer;  // player hit flash
let levelClearTimer;

hiScore = +localStorage.getItem('si_hi') || 0;
state   = 'intro';

// ── Init ────────────────────────────────────────────────────────────────────
function initGrid() {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = new Array(COLS).fill(true);
  }
}

function initShields() {
  shields = [];
  const totalW = 4 * SH_W;
  const gap    = (LW - totalW) / 5;
  for (let i = 0; i < 4; i++) {
    shields.push({
      x: gap + i * (SH_W + gap),
      pixels: SHIELD_TPL.map(row => [...row]),
    });
  }
}

function startLevel() {
  initGrid();
  initShields();
  plX     = LW / 2;
  invOffX = 0;
  invOffY = 0;
  invDir  = 1;
  plBullet    = null;
  invBullets  = [];
  sparks      = [];
  flashTimer  = 0;
  animFrame   = 0;
  animTimer   = 0;
  const base  = Math.max(200, 1000 - (level - 1) * 80);
  moveInterval = base;
  moveTimer    = base;
  shootTimer   = 1500;
  state        = 'playing';
}

function startGame() {
  score  = 0;
  lives  = 3;
  level  = 1;
  startLevel();
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function aliveCount() {
  return grid.reduce((s, row) => s + row.filter(Boolean).length, 0);
}

function invPos(r, c) {
  return {
    x: GRID_X + invOffX + c * CELL_W,
    y: GRID_Y + invOffY + r * CELL_H,
  };
}

function spriteFor(row) {
  return row === 0 ? SP.squid : row === 1 ? SP.crab : SP.oct;
}

function pointsFor(row) {
  return row === 0 ? 30 : row === 1 ? 20 : 10;
}

function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function erodeShield(sh, hitX, hitY, radius) {
  const pc = Math.floor((hitX - sh.x) / SH_PX);
  const pr = Math.floor((hitY - SH_Y) / SH_PX);
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const nr = pr + dr, nc = pc + dc;
      if (nr >= 0 && nr < SH_ROWS && nc >= 0 && nc < SH_COLS) {
        if (Math.abs(dr) + Math.abs(dc) <= radius + 1 && Math.random() > 0.3) {
          sh.pixels[nr][nc] = 0;
        }
      }
    }
  }
}

function shieldHit(bx, by) {
  for (const sh of shields) {
    const lx = bx - sh.x;
    const ly = by - SH_Y;
    const pc = Math.floor(lx / SH_PX);
    const pr = Math.floor(ly / SH_PX);
    if (pc >= 0 && pc < SH_COLS && pr >= 0 && pr < SH_ROWS && sh.pixels[pr] && sh.pixels[pr][pc]) {
      erodeShield(sh, bx, by, 1);
      return true;
    }
  }
  return false;
}

// ── Update ──────────────────────────────────────────────────────────────────
const keys = new Set();
document.addEventListener('keydown', e => { keys.add(e.code); e.preventDefault(); });
document.addEventListener('keyup',   e => keys.delete(e.code));

let prevSpace = false, prevEnter = false;

function update(dt) {
  // Intro / gameover: wait for Enter
  const enterDown = keys.has('Enter');
  if (state === 'intro' || state === 'gameover') {
    if (enterDown && !prevEnter) startGame();
    prevEnter = enterDown;
    return;
  }

  if (state === 'levelclear') {
    levelClearTimer -= dt;
    if (levelClearTimer <= 0) {
      level++;
      startLevel();
    }
    return;
  }

  // ── playing ──────────────────────────────────────────────────────────────

  // Timers
  animTimer += dt;
  if (animTimer >= 500) { animTimer -= 500; animFrame ^= 1; }
  flashTimer = Math.max(0, flashTimer - dt);

  // Player move
  const dx = (keys.has('ArrowLeft')  || keys.has('KeyA') ? -1 : 0)
           + (keys.has('ArrowRight') || keys.has('KeyD') ?  1 : 0);
  plX = Math.max(PL_W / 2, Math.min(LW - PL_W / 2, plX + dx * PL_SPEED * dt / 1000));

  // Player shoot
  const spaceDown = keys.has('Space');
  if (spaceDown && !prevSpace && !plBullet) {
    plBullet = { x: plX, y: PL_Y };
  }
  prevSpace = spaceDown;

  // Player bullet
  if (plBullet) {
    plBullet.y -= PL_BSPEED * dt / 1000;
    let hit = false;

    if (plBullet.y < 0) { plBullet = null; hit = true; }

    // vs invaders
    if (!hit) {
      outer: for (let r = 0; r < ROWS && !hit; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!grid[r][c]) continue;
          const { x, y } = invPos(r, c);
          if (overlap(plBullet.x - BW/2, plBullet.y - BH/2, BW, BH, x, y, SPR_W, SPR_H)) {
            grid[r][c] = false;
            const pts = pointsFor(r);
            score += pts;
            if (score > hiScore) { hiScore = score; localStorage.setItem('si_hi', hiScore); }
            sparks.push({ x: x + SPR_W/2, y: y + SPR_H/2, timer: 500, max: 500 });
            plBullet = null;
            hit = true;
            // Speed up fleet
            const n = aliveCount();
            moveInterval = Math.max(80, moveInterval * (n / (n + 1)));
            if (n === 0) {
              state = 'levelclear';
              levelClearTimer = 2000;
            }
            break outer;
          }
        }
      }
    }

    // vs shields
    if (!hit && plBullet && shieldHit(plBullet.x, plBullet.y)) {
      plBullet = null; hit = true;
    }

    // vs invader bullets (cancel each other)
    if (!hit && plBullet) {
      for (let i = invBullets.length - 1; i >= 0; i--) {
        const ib = invBullets[i];
        if (overlap(plBullet.x-BW/2, plBullet.y-BH/2, BW, BH, ib.x-BW/2, ib.y-BH/2, BW, BH)) {
          plBullet = null;
          invBullets.splice(i, 1);
          break;
        }
      }
    }
  }

  // Fleet movement
  moveTimer -= dt;
  if (moveTimer <= 0) {
    moveTimer = moveInterval;
    const step = 10 * invDir;
    // Find fleet bounds
    let minX = Infinity, maxX = -Infinity;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c]) {
          const { x } = invPos(r, c);
          if (x < minX)       minX = x;
          if (x + SPR_W > maxX) maxX = x + SPR_W;
        }
      }
    }
    if (maxX + step > LW - 8 || minX + step < 8) {
      invDir  *= -1;
      invOffY += STEP_DOWN;
    } else {
      invOffX += step;
    }
    animFrame ^= 1; // animate on each fleet move
    animTimer  = 0;
  }

  // Invader shooting
  shootTimer -= dt;
  if (shootTimer <= 0) {
    const interval = Math.max(400, 1500 - level * 120);
    shootTimer = interval * (0.4 + Math.random() * 0.8);
    // Pick bottom-most alive invader in a random column
    const shooters = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c]) { shooters.push({ r, c }); break; }
      }
    }
    if (shooters.length) {
      const s = shooters[Math.floor(Math.random() * shooters.length)];
      const { x, y } = invPos(s.r, s.c);
      invBullets.push({ x: x + SPR_W / 2, y: y + SPR_H });
    }
  }

  // Invader bullets
  for (let i = invBullets.length - 1; i >= 0; i--) {
    const b = invBullets[i];
    b.y += INV_BSPEED * dt / 1000;
    if (b.y > LH) { invBullets.splice(i, 1); continue; }

    // vs shields
    if (shieldHit(b.x, b.y)) { invBullets.splice(i, 1); continue; }

    // vs player
    const px = plX - PL_W / 2;
    if (overlap(b.x-BW/2, b.y-BH/2, BW, BH, px, PL_Y, PL_W, PL_H)) {
      invBullets.splice(i, 1);
      flashTimer = 700;
      lives--;
      if (lives <= 0) { state = 'gameover'; return; }
    }
  }

  // Invaders touch ground
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] && invPos(r, c).y + SPR_H > PL_Y) {
        state = 'gameover'; return;
      }
    }
  }

  // Sparks
  for (let i = sparks.length - 1; i >= 0; i--) {
    sparks[i].timer -= dt;
    if (sparks[i].timer <= 0) sparks.splice(i, 1);
  }
}

// ── Draw ────────────────────────────────────────────────────────────────────
function drawText(text, x, y, size, color, align = 'center') {
  ctx.fillStyle   = color;
  ctx.font        = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign   = align;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

function blink() { return Math.floor(Date.now() / 500) % 2 === 0; }

function drawGame() {
  // HUD
  drawText(`SCORE ${pad(score)}`, 16,  10, 11, G_GREEN, 'left');
  drawText(`HI    ${pad(hiScore)}`, LW/2, 10, 11, G_GREEN, 'center');
  drawText(`LV ${level}`, LW - 16, 10, 11, G_GREEN, 'right');

  // Ground line
  ctx.strokeStyle = G_GREEN;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, PL_Y + PL_H + 6);
  ctx.lineTo(LW, PL_Y + PL_H + 6);
  ctx.stroke();

  // Lives display
  drawText('LIVES', 16, LH - 36, 9, G_GREEN, 'left');
  for (let i = 0; i < lives; i++) {
    drawSprite(SP.player, 90 + i * (PL_W + 6), LH - 40, G_GREEN);
  }

  // Shields
  for (const sh of shields) {
    for (let r = 0; r < SH_ROWS; r++) {
      for (let c = 0; c < SH_COLS; c++) {
        if (sh.pixels[r][c]) {
          ctx.fillStyle = G_GREEN;
          ctx.fillRect(sh.x + c * SH_PX, SH_Y + r * SH_PX, SH_PX, SH_PX);
        }
      }
    }
  }

  // Invaders
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!grid[r][c]) continue;
      const { x, y } = invPos(r, c);
      drawSprite(spriteFor(r)[animFrame], x, y, G_GREEN);
    }
  }

  // Sparks (explosion)
  for (const sp of sparks) {
    const t = sp.timer / sp.max;
    drawSprite(SP.explosion, sp.x - SPR_W/2, sp.y - SPR_H/2, `rgba(51,255,85,${t})`);
  }

  // Player bullet
  if (plBullet) {
    ctx.fillStyle = G_WHITE;
    ctx.fillRect(plBullet.x - BW/2, plBullet.y - BH/2, BW, BH);
    // Glow trail
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(plBullet.x - BW/2 - 1, plBullet.y + BH/2, BW + 2, 6);
  }

  // Invader bullets
  for (const b of invBullets) {
    ctx.fillStyle = '#ff6633';
    ctx.fillRect(b.x - BW/2, b.y - BH/2, BW, BH);
  }

  // Player
  const plColor = (flashTimer > 0 && Math.floor(flashTimer / 80) % 2 === 0) ? G_RED : G_GREEN;
  drawSprite(SP.player, plX - PL_W/2, PL_Y, plColor);

  // Level clear overlay
  if (state === 'levelclear') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, LW, LH);
    drawText('LEVEL CLEAR!', LW/2, LH/2 - 30, 20, G_GREEN);
    drawText(`SCORE ${pad(score)}`, LW/2, LH/2 + 10, 12, G_GREEN);
  }
}

function drawIntro() {
  // Title
  ctx.fillStyle = G_GREEN;
  ctx.font      = '40px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor  = G_GREEN;
  ctx.shadowBlur   = 20;
  ctx.fillText('ALIEN', LW/2, 100);
  ctx.fillText('SHOOTING', LW/2, 152);
  ctx.shadowBlur = 0;

  // Score table
  const entries = [
    { sp: SP.squid[0], pts: '= 30 PTS', y: 260 },
    { sp: SP.crab[0],  pts: '= 20 PTS', y: 320 },
    { sp: SP.oct[0],   pts: '= 10 PTS', y: 380 },
  ];
  for (const e of entries) {
    drawSprite(e.sp, LW/2 - 90, e.y, G_GREEN);
    drawText(e.pts, LW/2 + 10, e.y + 8, 10, G_GREEN, 'left');
  }

  drawText(`HI-SCORE  ${pad(hiScore)}`, LW/2, 450, 11, G_GREEN);

  if (blink()) drawText('PRESS ENTER TO START', LW/2, LH - 80, 12, G_GREEN);
  drawText('ARROWS/WASD  MOVE     SPACE  SHOOT', LW/2, LH - 40, 8, G_GREEN);
}

function drawGameOver() {
  drawGame();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, LW, LH);
  ctx.shadowColor = G_RED;
  ctx.shadowBlur  = 24;
  drawText('GAME OVER', LW/2, LH/2 - 50, 32, G_RED);
  ctx.shadowBlur = 0;
  drawText(`SCORE  ${pad(score)}`, LW/2, LH/2 + 10, 13, G_GREEN);
  if (score >= hiScore && score > 0) drawText('NEW HI-SCORE!', LW/2, LH/2 + 40, 11, '#ffdd00');
  if (blink()) drawText('PRESS ENTER TO RETRY', LW/2, LH/2 + 90, 12, G_GREEN);
}

function pad(n) { return String(n).padStart(6, '0'); }

function draw() {
  ctx.fillStyle = G_BLACK;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  ctx.fillStyle = G_BLACK;
  ctx.fillRect(0, 0, LW, LH);

  if (state === 'intro')      drawIntro();
  else if (state === 'gameover') drawGameOver();
  else                        drawGame();

  // Subtle green screen border
  ctx.strokeStyle = 'rgba(51,255,85,0.15)';
  ctx.lineWidth   = 2;
  ctx.strokeRect(1, 1, LW - 2, LH - 2);

  ctx.restore();
}

// ── Loop ────────────────────────────────────────────────────────────────────
let lastTs = 0;
function loop(ts) {
  const dt = Math.min(ts - lastTs, 50);
  lastTs = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(ts => { lastTs = ts; loop(ts); });
