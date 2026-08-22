const MIN_GHOSTS = 2;
const GHOST_VARIANTS = 3;
const EFFECT_DURATION_MS = 1650;
const GHOST_SOUND_URL = "./assets/sounds/boo-laugh.mp3";

let ghostAudio = null;

function randomBetween(random, min, max) {
  return min + random() * (max - min);
}

export function createGhostSwarm(random = Math.random) {
  const count = MIN_GHOSTS + Math.floor(random() * GHOST_VARIANTS);
  return Array.from({ length: count }, (_, index) => ({
    index,
    sizeRem: randomBetween(random, 2.7, 6.3),
    topPercent: randomBetween(random, 5, 70),
    delayMs: randomBetween(random, 0, 220),
    durationMs: randomBetween(random, 900, 1250),
    reverse: random() < 0.5,
    wiggleDeg: randomBetween(random, 7, 16),
  }));
}

export function playGhostSound() {
  if (typeof Audio === "undefined") return false;
  ghostAudio ||= new Audio(GHOST_SOUND_URL);
  ghostAudio.currentTime = 0;
  ghostAudio.volume = 0.8;
  ghostAudio.play().catch(() => {});
  return true;
}

export function playGhostSurpassEffect(container, { sound = true, random = Math.random } = {}) {
  const ghosts = createGhostSwarm(random);
  container.classList.remove("playing");
  container.replaceChildren(...ghosts.map((ghost) => {
    const el = document.createElement("span");
    el.className = `ghost-transition-figure${ghost.reverse ? " reverse" : ""}`;
    el.textContent = "👻";
    el.style.setProperty("--ghost-size", `${ghost.sizeRem.toFixed(2)}rem`);
    el.style.setProperty("--ghost-top", `${ghost.topPercent.toFixed(2)}%`);
    el.style.setProperty("--ghost-delay", `${Math.round(ghost.delayMs)}ms`);
    el.style.setProperty("--ghost-duration", `${Math.round(ghost.durationMs)}ms`);
    el.style.setProperty("--ghost-wiggle", `${ghost.wiggleDeg.toFixed(2)}deg`);
    return el;
  }));
  void container.offsetWidth;
  container.classList.add("playing");
  if (sound) playGhostSound();
  setTimeout(() => {
    container.classList.remove("playing");
    container.replaceChildren();
  }, EFFECT_DURATION_MS);
  return ghosts;
}
