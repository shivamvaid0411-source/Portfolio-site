// ---- CUSTOM CURSOR ----
const cur = document.getElementById('cursor'), ring = document.getElementById('ring');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cur.style.left = mx + 'px'; cur.style.top = my + 'px';
});

function animRing() {
  rx += (mx - rx) * .12; ry += (my - ry) * .12;
  ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
  requestAnimationFrame(animRing);
}
animRing();

// ---- REVEAL ANIMATIONS ----
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: .15 });

document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// ---- FIREBASE SETUP & ANALYTICS ----
const firebaseConfig = {
  apiKey: "AIzaSyB6EVNWRBl2c636mmxf_jus_4Ucr-WshBY",
  authDomain: "shivam-portfolio-86s188.firebaseapp.com",
  projectId: "shivam-portfolio-86188",
  storageBucket: "shivam-portfolio-86188.firebasestorage.app",
  messagingSenderId: "715425408508",
  appId: "1:715425408508:web:a9f656a63979e99c847e79"
};
let db;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} catch (e) {
  console.warn('Firebase not configured yet:', e);
}

// ---- PAGE VIEW TRACKER ----
async function recordPageView() {
  if (!db) return;
  try {
    await db.collection('analytics').doc('siteViews').set({
      count: firebase.firestore.FieldValue.increment(1),
      lastViewed: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await db.collection('pageViews').add({
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userAgent: navigator.userAgent,
      referrer: document.referrer || 'direct'
    });
    console.log('Page view recorded successfully in Firebase!');
  } catch (e) {
    console.warn('Could not record page view:', e);
  }
}
recordPageView();

// ---- PLAYER SCORES & METADATA TRACKER ----
async function saveScore(realName, gameName, score) {
  if (!db) return;
  try {
    // Create a clean document ID from player name (e.g., "shivam_vaid")
    const playerId = realName.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
    const playerRef = db.collection('players').doc(playerId);

    // 1. Update or create the main Player Summary Document
    await playerRef.set({
      realName: realName,
      totalGamesPlayed: firebase.firestore.FieldValue.increment(1),
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 2. Add an individual game run into the player's 'gameRuns' subcollection folder
    await playerRef.collection('gameRuns').add({
      score: score,
      gameName: gameName,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      metadata: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform
      }
    });

    console.log(`Saved score of ${score} under player folder: ${playerId}`);
  } catch (e) {
    console.warn('Could not save score to Firebase:', e);
  }
}
// ---- NAME GENERATOR ----
const adjectives = ['Swift','Blazing','Silent','Golden','Rogue','Cosmic','Turbo','Shadow','Electric','Rapid'];
const nouns = ['Falcon','Tiger','Comet','Phoenix','Wolf','Rocket','Ninja','Panther','Storm','Viper'];
function generateGameName() {
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return a + n + num;
}

// ---- CUSTOM BIRD PNG LOAD MECHANISM ----
const birdImg = new Image();
let isBirdImgLoaded = false;
birdImg.src = 'bird.png';
birdImg.onload = () => { isBirdImgLoaded = true; };
birdImg.onerror = () => { isBirdImgLoaded = false; };

// ---- FLAPPY BIRD GAME ----
const toggleInput = document.getElementById('game-toggle-input');
const nameModal = document.getElementById('name-modal');
const playerNameInput = document.getElementById('player-name');
const playBtn = document.getElementById('play-btn');

const heroSection = document.getElementById('hero');
const gameCard = document.getElementById('game-card');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const countdownEl = document.getElementById('game-countdown');
const gameOverOverlay = document.getElementById('game-over-overlay');
const gameOverMsg = document.getElementById('game-over-msg');

const hudNameEl = document.getElementById('hud-name');
const hudScoreEl = document.getElementById('hud-score');
const hudBestEl = document.getElementById('hud-best');

const GRAVITY = 0.125;
const FLAP = -3.1;
const PIPE_SPEED = 1.3;
const SPAWN_INTERVAL = 175;
const GAP_HEIGHT = 165;

let bird, pipes, score, phase, frame, loopId, realName;

function updateHUD() {
  hudNameEl.textContent = (realName || 'PLAYER').toUpperCase();
  hudScoreEl.textContent = score;
  const best = Math.max(score, parseInt(localStorage.getItem('flappyBest') || '0'));
  hudBestEl.textContent = best;
}

function resetGame() {
  bird = { x: canvas.width * 0.25, y: canvas.height / 2, vy: 0, radius: 15 };
  pipes = [];
  score = 0;
  frame = 0;
  gameOverOverlay.classList.remove('active');
  updateHUD();
}

// ---- TOGGLE LISTENER WITH SESSION NAME CACHING ----
toggleInput.addEventListener('change', () => {
  if (toggleInput.checked) {
    const cachedName = sessionStorage.getItem('arcadePlayerName');
    if (cachedName) {
      realName = cachedName;
      heroSection.classList.add('game-active');
      gameCard.classList.add('active');
      startCountdown();
    } else {
      nameModal.classList.add('active');
    }
  } else {
    stopGame();
  }
});

playBtn.addEventListener('click', () => {
  realName = playerNameInput.value.trim() || 'Player';
  sessionStorage.setItem('arcadePlayerName', realName);
  nameModal.classList.remove('active');
  heroSection.classList.add('game-active');
  gameCard.classList.add('active');
  startCountdown();
});

function stopGame() {
  cancelAnimationFrame(loopId);
  toggleInput.checked = false;
  heroSection.classList.remove('game-active');
  gameCard.classList.remove('active');
  nameModal.classList.remove('active');
  gameOverOverlay.classList.remove('active');
  phase = 'idle';
}

function startCountdown() {
  resetGame();
  phase = 'countdown';
  let count = 3;
  countdownEl.textContent = count;
  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      countdownEl.textContent = count;
    } else {
      countdownEl.textContent = 'Go!';
      setTimeout(() => { countdownEl.textContent = ''; }, 500);
      clearInterval(timer);
      phase = 'ready';
      loop();
    }
  }, 600);
}

function spawnPipe() {
  const gapY = Math.random() * (canvas.height - GAP_HEIGHT - 90) + 45;
  pipes.push({ x: canvas.width, gapY, width: 50, collected: false });
}

function scrollSitePoint() {
  window.scrollBy({ top: 180, left: 0, behavior: 'smooth' });
}

function endGame(won) {
  phase = won ? 'won' : 'lost';
  cancelAnimationFrame(loopId);
  const best = Math.max(score, parseInt(localStorage.getItem('flappyBest') || '0'));
  localStorage.setItem('flappyBest', best);
  saveScore(realName, generateGameName(), score);
  updateHUD();

  gameOverMsg.innerHTML = won
    ? `🎉 Victory! Score: <strong>${score}</strong> · Best: <strong>${best}</strong>`
    : `Score: <strong>${score}</strong> · Best: <strong>${best}</strong>`;
  gameOverOverlay.classList.add('active');
}

function flap() {
  if (phase === 'ready' || phase === 'playing') {
    phase = 'playing';
    bird.vy = FLAP;
  }
}

function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  const angle = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, bird.vy * 0.08));
  ctx.rotate(angle);

  if (isBirdImgLoaded) {
    const size = bird.radius * 2.6;
    ctx.drawImage(birdImg, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = '#f5c842';
    ctx.beginPath();
    ctx.arc(0, 0, bird.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e85d2f';
    ctx.beginPath();
    ctx.ellipse(-4, 2, 7, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(6, -4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(7, -5, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.moveTo(11, -1);
    ctx.lineTo(17, 2);
    ctx.lineTo(11, 5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (phase === 'ready') {
    frame++;
    bird.y = canvas.height / 2 + Math.sin(frame * 0.06) * 8;
  }

  if (phase === 'playing') {
    frame++;
    bird.vy += GRAVITY;
    bird.y += bird.vy;
    if (frame % SPAWN_INTERVAL === 0) spawnPipe();
  }

  drawBird();

  if (phase === 'playing') {
    for (let i = pipes.length - 1; i >= 0; i--) {
      const p = pipes[i];
      p.x -= PIPE_SPEED;

      const topGrad = ctx.createLinearGradient(p.x, 0, p.x + p.width, 0);
      topGrad.addColorStop(0, '#e85d2f');
      topGrad.addColorStop(1, '#c084fc');
      ctx.fillStyle = topGrad;
      ctx.fillRect(p.x, 0, p.width, p.gapY);

      ctx.fillStyle = '#f5c842';
      ctx.fillRect(p.x - 3, p.gapY - 10, p.width + 6, 10);

      const btmGrad = ctx.createLinearGradient(p.x, p.gapY + GAP_HEIGHT, p.x + p.width, canvas.height);
      btmGrad.addColorStop(0, '#5bceae');
      btmGrad.addColorStop(1, '#e85d2f');
      ctx.fillStyle = btmGrad;
      ctx.fillRect(p.x, p.gapY + GAP_HEIGHT, p.width, canvas.height - p.gapY - GAP_HEIGHT);

      ctx.fillStyle = '#f5c842';
      ctx.fillRect(p.x - 3, p.gapY + GAP_HEIGHT, p.width + 6, 10);

      const inX = bird.x + bird.radius > p.x && bird.x - bird.radius < p.x + p.width;
      if (inX && (bird.y - bird.radius < p.gapY || bird.y + bird.radius > p.gapY + GAP_HEIGHT)) {
        endGame(false);
      }
      if (!p.collected && inX && bird.y > p.gapY && bird.y < p.gapY + GAP_HEIGHT) {
        p.collected = true;
        score++;
        updateHUD();
        scrollSitePoint();
        if (score >= 10) { endGame(true); return; }
      }
      if (p.x + p.width < 0) pipes.splice(i, 1);
    }

    if (bird.y - bird.radius < 0 || bird.y + bird.radius > canvas.height) {
      endGame(false);
      return;
    }
  }

  if (phase === 'ready' || phase === 'playing') {
    loopId = requestAnimationFrame(loop);
  }
}

document.addEventListener('keydown', e => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  if (phase === 'ready' || phase === 'playing') {
    flap();
  } else if (phase === 'won' || phase === 'lost') {
    startCountdown();
  }
});

gameCard.addEventListener('pointerdown', e => {
  if (e.target.closest('#game-toggle-wrap')) return;

  if (phase === 'ready' || phase === 'playing') {
    e.preventDefault();
    flap();
  }
});
// QUIT BUTTON CLICK LISTENER
const quitBtn = document.getElementById('quit-btn');
if (quitBtn) {
  quitBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevents click from triggering bird flap
    stopGame();
  });
}

// MODAL CLOSE BUTTON — dismisses the name prompt without playing
const modalCloseBtn = document.getElementById('modal-close-btn');
if (modalCloseBtn) {
  modalCloseBtn.addEventListener('click', () => {
    nameModal.classList.remove('active');
    toggleInput.checked = false; // flip the toggle back off
  });
}
