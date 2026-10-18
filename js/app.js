"use strict";

const DATA_URL = "data/cards.json";

const DEFAULTS = {
  video: "public/draw.mp4",
  seconds: 5,
  fade: 1.2,
};

const monitor = document.getElementById("monitor");
const stage = document.getElementById("stage");
const video = document.getElementById("pv");
const wipe = document.getElementById("wipe");
const flash = document.getElementById("flash");
const rays = document.getElementById("rays");
const burst = document.getElementById("burst");
const cardSlot = document.getElementById("cardSlot");
const drawBtn = document.getElementById("drawBtn");
const againBtn = document.getElementById("againBtn");
const statusEl = document.getElementById("status");
const live = document.getElementById("live");

const state = {
  phase: "boot",
  cards: [],
  settings: { ...DEFAULTS },
  timers: [],
  pending: null,
  serial: 0,
  videoOk: null,
};

let cursorTimer = 0;

function setPhase(phase) {
  state.phase = phase;
  document.body.dataset.phase = phase;
  againBtn.hidden = phase !== "shown";
  if (phase === "playing" || phase === "fading") {
    armCursorHide();
  } else {
    clearTimeout(cursorTimer);
    document.body.classList.remove("hide-cursor");
  }
}

function armCursorHide() {
  document.body.classList.remove("hide-cursor");
  clearTimeout(cursorTimer);
  if (state.phase === "playing" || state.phase === "fading") {
    cursorTimer = setTimeout(() => document.body.classList.add("hide-cursor"), 1200);
  }
}

function later(fn, ms) {
  const id = setTimeout(() => {
    state.timers = state.timers.filter((timer) => timer !== id);
    fn();
  }, ms);
  state.timers.push(id);
}

function clearTimers() {
  for (const id of state.timers) clearTimeout(id);
  state.timers = [];
}

function restartClass(el, name) {
  el.classList.remove(name);
  void el.offsetWidth;
  el.classList.add(name);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function randomUnit() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function safeSrc(src) {
  const value = String(src || "").trim();
  if (!value || /^(javascript|data):/i.test(value)) return "";
  return encodeURI(value);
}

function formatRate(rate) {
  const text = parseFloat(Number(rate).toFixed(4)).toString();
  return `${text}%`;
}

function readConfig(data) {
  const settings = { ...DEFAULTS };
  const source = data && typeof data === "object" ? data : {};

  if (typeof source.video === "string" && source.video.trim()) {
    settings.video = source.video.trim().replace(/\\/g, "/");
  }
  const seconds = Number(source.seconds);
  if (Number.isFinite(seconds)) settings.seconds = clamp(seconds, 0, 120);
  const fade = Number(source.fade);
  if (Number.isFinite(fade)) settings.fade = clamp(fade, 0.2, 6);

  const cards = [];
  const groups = Array.isArray(source.rates) ? source.rates : [];
  for (const group of groups) {
    const rate = Number(group && group.rate);
    if (!(rate > 0) || !Array.isArray(group.items)) continue;
    for (const item of group.items) {
      const name = String((item && item.name) || "").trim();
      if (!name) continue;
      cards.push({
        name,
        desc: String((item && item.desc) || "").trim(),
        image: safeSrc(item && item.image),
        rate,
        weight: rate,
        miss: false,
      });
    }
  }

  const prizeRate = cards.reduce((sum, card) => sum + card.weight, 0);
  const missRate = 100 - prizeRate;
  const missSource = source.miss && typeof source.miss === "object" ? source.miss : {};
  if (prizeRate > 0 && missRate > 0) {
    const name = String(missSource.name || "꽝").trim() || "꽝";
    cards.push({
      name,
      desc: String(missSource.desc || "아쉽지만 다음 기회에 다시 만나요").trim(),
      image: "",
      rate: missRate,
      weight: missRate,
      miss: true,
    });
  }

  return { settings, cards };
}

function pickCard(cards) {
  const total = cards.reduce((sum, card) => sum + card.weight, 0);
  let roll = randomUnit() * total;
  for (const card of cards) {
    roll -= card.weight;
    if (roll <= 0) return card;
  }
  return cards[cards.length - 1];
}

function showError(message) {
  statusEl.hidden = false;
  statusEl.textContent = message;
}

function updateStatus() {
  if (!state.cards.length) return;
  if (state.videoOk === false) {
    showError("영상 파일을 확인해 주세요");
    return;
  }
  statusEl.hidden = true;
  statusEl.textContent = "";
}

function rewind(el) {
  try {
    if (el.readyState > 0) el.currentTime = 0;
  } catch {
    /* 메타데이터 전에는 되감기를 건너뜁니다. */
  }
}

function renderCard(card) {
  const length = Array.from(card.name).length;
  const sizeClass = length >= 12 ? "is-long" : length >= 8 ? "is-mid" : "";
  const desc = card.desc ? `<p class="gift__desc">${escapeHtml(card.desc)}</p>` : "";

  if (card.miss) {
    cardSlot.innerHTML = `
      <article class="gift gift--miss" aria-label="${escapeHtml(card.name)}. ${escapeHtml(card.desc)}">
        <header class="gift__top">
          <span class="gift__brand"><i class="paw" aria-hidden="true"></i>LUCKY</span>
          <span class="gift__rate">MISS</span>
        </header>
        <h2 class="gift__name ${sizeClass}">${escapeHtml(card.name)}</h2>
        ${desc}
      </article>
    `;
    return;
  }

  const rateLabel = formatRate(card.rate);
  cardSlot.innerHTML = `
    <article class="gift" aria-label="${escapeHtml(card.name)} 당첨, 확률 ${escapeHtml(rateLabel)}">
      <header class="gift__top">
        <span class="gift__brand"><i class="paw" aria-hidden="true"></i>LUCKY</span>
        <span class="gift__rate">${escapeHtml(rateLabel)}</span>
      </header>
      <h2 class="gift__name ${sizeClass}">${escapeHtml(card.name)}</h2>
      ${desc}
    </article>
  `;
}

let audioFade = 0;

function stopAudioFade() {
  if (audioFade) cancelAnimationFrame(audioFade);
  audioFade = 0;
}

function fadeOutAudio(ms) {
  stopAudioFade();
  const from = video.volume;
  const start = performance.now();
  const step = (now) => {
    const t = ms <= 0 ? 1 : Math.min(1, (now - start) / ms);
    video.volume = from * (1 - t);
    if (t < 1) {
      audioFade = requestAnimationFrame(step);
      return;
    }
    audioFade = 0;
    video.pause();
  };
  audioFade = requestAnimationFrame(step);
}

function beginFade() {
  if (state.phase !== "playing") return;
  setPhase("fading");
  restartClass(video, "is-out");
  restartClass(wipe, "is-on");
  restartClass(flash, "is-on");
  fadeOutAudio(state.settings.fade * 1000);
  later(reveal, state.settings.fade * 1000 * 0.4);
}

function reveal() {
  if (state.phase !== "fading") return;
  const card = state.pending;
  if (!card) return;
  renderCard(card);
  setPhase("shown");
  if (card.miss) {
    document.title = card.name;
    live.textContent = `${card.name}. ${card.desc}`.trim();
    console.info("[lucky-draw]", "miss", card.name);
    return;
  }
  document.title = `당첨 · ${card.name}`;
  live.textContent = `당첨 ${card.name}. 확률 ${formatRate(card.rate)}. ${card.desc}`.trim();
  console.info("[lucky-draw]", formatRate(card.rate), card.name);
}

async function playVideo() {
  rewind(video);
  const tryPlay = async (muted) => {
    video.muted = muted;
    await video.play();
    if (state.phase === "idle" || state.phase === "boot") {
      video.pause();
      return;
    }
    video.classList.add("is-playing");
  };

  try {
    await tryPlay(false);
  } catch {
    await tryPlay(true);
  }
}

async function startDraw() {
  if (state.phase === "boot" || state.phase === "playing" || state.phase === "fading") return;
  if (!state.cards.length) return;

  clearTimers();
  state.pending = pickCard(state.cards);
  state.serial += 1;
  setPhase("playing");
  document.title = "Lucky Draw";
  live.textContent = "";
  cardSlot.innerHTML = "";
  burst.innerHTML = "";
  rays.className = "rays";
  stopAudioFade();
  video.pause();
  video.volume = 1;
  video.classList.remove("is-playing", "is-out");
  wipe.classList.remove("is-on");
  flash.classList.remove("is-on");

  try {
    await playVideo();
  } catch {
    state.videoOk = false;
    updateStatus();
  }

  if (state.phase !== "playing") return;
  later(beginFade, state.settings.seconds * 1000);
}

function abort() {
  if (state.phase !== "playing" && state.phase !== "fading" && state.phase !== "shown") return;
  clearTimers();
  stopAudioFade();
  video.pause();
  video.volume = 1;
  rewind(video);
  video.classList.remove("is-playing", "is-out");
  wipe.classList.remove("is-on");
  flash.classList.remove("is-on");
  rays.className = "rays";
  burst.innerHTML = "";
  cardSlot.innerHTML = "";
  document.title = "Lucky Draw";
  setPhase("idle");
}

function showPreview(rate) {
  const sample = rate === "miss"
    ? state.cards.find((card) => card.miss)
    : state.cards.find((card) => !card.miss && card.rate === rate);
  if (!sample) return;
  state.pending = sample;
  state.serial += 1;
  setPhase("fading");
  reveal();
}

function bindVideoStatus() {
  video.addEventListener("loadeddata", () => {
    state.videoOk = true;
    if (state.phase === "idle") updateStatus();
  });
  video.addEventListener("error", () => {
    state.videoOk = false;
    if (state.phase === "idle") updateStatus();
  });
}

async function load() {
  setPhase("boot");
  drawBtn.disabled = true;

  if (location.protocol === "file:") {
    showError("start.bat 을 실행한 뒤 http://localhost:8080 으로 열어 주세요");
    setPhase("idle");
    return;
  }

  try {
    const res = await fetch(`${DATA_URL}?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const parsed = readConfig(await res.json());
    state.settings = parsed.settings;
    state.cards = parsed.cards;
  } catch {
    showError("data/cards.json 을 읽지 못했습니다");
    setPhase("idle");
    return;
  }

  if (!state.cards.some((card) => !card.miss)) {
    showError("cards.json 에 상품이 없습니다");
    setPhase("idle");
    return;
  }

  document.documentElement.style.setProperty("--fade", `${state.settings.fade}s`);
  const videoUrl = `${state.settings.video}${state.settings.video.includes("?") ? "&" : "?"}ts=${Date.now()}`;
  video.src = videoUrl;
  video.load();
  bindVideoStatus();
  if (video.error) state.videoOk = false;

  drawBtn.disabled = false;
  setPhase("idle");
  updateStatus();

  const preview = new URLSearchParams(location.search).get("preview");
  if (preview === "miss" || preview === "꽝") showPreview("miss");
  else if (Number(preview) > 0) showPreview(Number(preview));
}

drawBtn.addEventListener("click", startDraw);
againBtn.addEventListener("click", startDraw);

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.code === "Escape") abort();
});

window.addEventListener("mousemove", armCursorHide);

function fitFrame() {
  const width = monitor.offsetWidth;
  const height = monitor.offsetHeight;
  if (!width || !height) return;
  const scale = Math.min(
    window.innerWidth / (width + 96),
    window.innerHeight / (height + 96)
  );
  monitor.style.setProperty("--fit", String(scale));
  monitor.classList.add("is-fit");
}

window.addEventListener("resize", fitFrame);
fitFrame();

load();
