import { useEffect, useRef, useState, type RefObject } from "react";
import { formatRate, pickCard, type Card } from "./cards";
import { DRAW_SECONDS, FADE_SECONDS, VIDEO_END_SECONDS, asset } from "./constants";

export type Phase = "boot" | "idle" | "playing" | "fading" | "shown";

function sizeCanvas(canvas: HTMLCanvasElement) {
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (!cssWidth || !cssHeight) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(cssWidth * dpr);
  const height = Math.round(cssHeight * dpr);
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
) {
  const dw = ctx.canvas.width;
  const dh = ctx.canvas.height;
  if (!sw || !sh || !dw || !dh) return;
  const scale = Math.max(dw / sw, dh / sh);
  const width = sw * scale;
  const height = sh * scale;
  ctx.drawImage(source, (dw - width) / 2, (dh - height) / 2, width, height);
}

function paintFrame(canvas: HTMLCanvasElement | null, video: HTMLVideoElement | null) {
  if (!canvas || !video) return;
  if (video.readyState < 2 || !video.videoWidth) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  sizeCanvas(canvas);
  drawCover(ctx, video, video.videoWidth, video.videoHeight);
}

export function useLuckyDraw(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  cards: Card[],
) {
  const [phase, setPhaseState] = useState<Phase>("boot");
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [hideCursor, setHideCursor] = useState(false);

  const phaseRef = useRef<Phase>("boot");
  const cardsRef = useRef<Card[]>([]);
  const pendingRef = useRef<Card | null>(null);
  const timersRef = useRef<number[]>([]);
  const audioFadeRef = useRef(0);
  const cursorTimerRef = useRef(0);
  const drawIdRef = useRef(0);
  const fadeStartedRef = useRef(false);
  const videoEndedRef = useRef(false);
  const onTimeRef = useRef<(() => void) | null>(null);
  const paintRef = useRef(0);
  const holdRef = useRef(0);
  cardsRef.current = cards;

  function stopPaint() {
    if (paintRef.current) cancelAnimationFrame(paintRef.current);
    paintRef.current = 0;
  }

  function startPaint(drawId: number) {
    stopPaint();
    const frame = () => {
      if (drawId !== drawIdRef.current || videoEndedRef.current) return;
      paintFrame(canvasRef.current, videoRef.current);
      paintRef.current = requestAnimationFrame(frame);
    };
    paintRef.current = requestAnimationFrame(frame);
  }

  function frameAt(video: HTMLVideoElement, seconds: number) {
    const cap = Number.isFinite(video.duration) && video.duration > 0
      ? Math.max(0, video.duration - 0.05)
      : seconds;
    return Math.min(Math.max(0, seconds), cap);
  }

  function holdFrame(time: number) {
    const video = videoRef.current;
    if (!video) return;
    const token = ++holdRef.current;
    video.pause();
    const paint = () => {
      if (token !== holdRef.current) return;
      paintFrame(canvasRef.current, video);
    };
    if (video.readyState >= 2 && Math.abs(video.currentTime - time) < 0.03) {
      paint();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      requestAnimationFrame(paint);
    };
    video.addEventListener("seeked", onSeeked);
    try {
      video.currentTime = time;
    } catch {
      video.removeEventListener("seeked", onSeeked);
    }
  }

  function setPhase(next: Phase) {
    phaseRef.current = next;
    setPhaseState(next);
    if (next === "playing" || next === "fading") {
      armCursorHide();
      return;
    }
    window.clearTimeout(cursorTimerRef.current);
    setHideCursor(false);
  }

  function armCursorHide() {
    setHideCursor(false);
    window.clearTimeout(cursorTimerRef.current);
    if (phaseRef.current !== "playing" && phaseRef.current !== "fading") return;
    cursorTimerRef.current = window.setTimeout(() => {
      if (phaseRef.current === "playing" || phaseRef.current === "fading") {
        setHideCursor(true);
      }
    }, 1200);
  }

  function later(fn: () => void, ms: number) {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((timer) => timer !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
  }

  function clearTimers() {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }

  function stopAudioFade() {
    if (audioFadeRef.current) window.clearInterval(audioFadeRef.current);
    audioFadeRef.current = 0;
  }

  function clearPlayhead() {
    const video = videoRef.current;
    if (video && onTimeRef.current) video.removeEventListener("timeupdate", onTimeRef.current);
    onTimeRef.current = null;
  }

  function fadeAudio(ms: number) {
    const video = videoRef.current;
    if (!video) return;
    stopAudioFade();
    const from = video.volume;
    const start = performance.now();
    const step = () => {
      const t = ms <= 0 ? 1 : Math.min(1, (performance.now() - start) / ms);
      video.volume = from * (1 - t);
      if (t < 1) return;
      window.clearInterval(audioFadeRef.current);
      audioFadeRef.current = 0;
    };
    audioFadeRef.current = window.setInterval(step, 32);
    step();
  }

  function rewind(video: HTMLVideoElement) {
    try {
      if (video.readyState > 0) video.currentTime = 0;
    } catch {
      /* 메타데이터 전에는 되감기를 건너뜁니다. */
    }
  }

  function reveal(drawId: number) {
    if (drawId !== drawIdRef.current) return;
    if (phaseRef.current !== "fading") return;
    const next = pendingRef.current;
    if (!next) return;
    setCard(next);
    setPhase("shown");
  }

  function releasePlayhead() {
    if (!videoEndedRef.current || !fadeStartedRef.current) return;
    clearPlayhead();
  }

  function endVideo(drawId: number) {
    if (drawId !== drawIdRef.current || videoEndedRef.current) return;
    const phase = phaseRef.current;
    if (phase !== "playing" && phase !== "fading" && phase !== "shown") return;
    videoEndedRef.current = true;
    stopPaint();
    const video = videoRef.current;
    if (video) holdFrame(frameAt(video, VIDEO_END_SECONDS));
    fadeAudio(FADE_SECONDS * 1000);
    releasePlayhead();
  }

  function showCard(drawId: number) {
    if (drawId !== drawIdRef.current) return;
    if (phaseRef.current !== "playing") return;
    if (fadeStartedRef.current) return;
    fadeStartedRef.current = true;
    setPhase("fading");
    later(() => reveal(drawId), FADE_SECONDS * 1000 * 0.4);
    releasePlayhead();
  }

  function armCues(drawId: number) {
    later(() => endVideo(drawId), VIDEO_END_SECONDS * 1000);
    later(() => showCard(drawId), DRAW_SECONDS * 1000);
    const video = videoRef.current;
    if (!video) return;
    let seenStart = video.currentTime < 0.5;
    const onTime = () => {
      if (drawId !== drawIdRef.current) return;
      if (!seenStart) {
        if (video.currentTime < 0.5) seenStart = true;
        return;
      }
      if (video.currentTime >= VIDEO_END_SECONDS) endVideo(drawId);
      if (video.currentTime >= DRAW_SECONDS) showCard(drawId);
    };
    onTimeRef.current = onTime;
    video.addEventListener("timeupdate", onTime);
  }

  async function playVideo() {
    const video = videoRef.current;
    if (!video) return;
    rewind(video);
    const tryPlay = async (muted: boolean) => {
      video.muted = muted;
      await video.play();
      if (phaseRef.current === "idle" || phaseRef.current === "boot") video.pause();
    };
    try {
      await tryPlay(false);
    } catch {
      await tryPlay(true);
    }
  }

  async function startDraw() {
    const phase = phaseRef.current;
    if (phase === "boot" || phase === "playing" || phase === "fading") return;
    if (!cardsRef.current.length) return;

    const drawId = ++drawIdRef.current;
    fadeStartedRef.current = false;
    videoEndedRef.current = false;
    clearTimers();
    clearPlayhead();
    pendingRef.current = pickCard(cardsRef.current);
    setCard(null);
    setPhase("playing");
    stopAudioFade();

    const video = videoRef.current;
    if (video) {
      video.volume = 1;
      holdFrame(0);
    }
    startPaint(drawId);

    try {
      await playVideo();
    } catch {
      setError("영상 파일을 확인해 주세요");
    }

    if (phaseRef.current !== "playing" || drawId !== drawIdRef.current) return;
    armCues(drawId);
  }

  function abort() {
    const current = phaseRef.current;
    if (current !== "playing" && current !== "fading" && current !== "shown") return;
    drawIdRef.current += 1;
    fadeStartedRef.current = false;
    videoEndedRef.current = false;
    clearTimers();
    clearPlayhead();
    stopAudioFade();
    stopPaint();
    const video = videoRef.current;
    if (video) {
      video.volume = 1;
      holdFrame(0);
    }
    setCard(null);
    pendingRef.current = null;
    setPhase("idle");
  }

  function showPreview(rate: number | "miss", cards: Card[]) {
    const sample = rate === "miss"
      ? cards.find((item) => item.miss)
      : cards.find((item) => !item.miss && item.rate === rate);
    if (!sample) return;
    pendingRef.current = sample;
    phaseRef.current = "fading";
    reveal(drawIdRef.current);
  }

  useEffect(() => {
    const video = videoRef.current;

    const onLoaded = () => {
      if (phaseRef.current === "playing" || phaseRef.current === "fading") return;
      setError("");
      if (!video) return;
      holdFrame(phaseRef.current === "shown" ? frameAt(video, VIDEO_END_SECONDS) : 0);
    };
    const onError = () => {
      if (phaseRef.current === "idle" || phaseRef.current === "boot") {
        setError("영상 파일을 확인해 주세요");
      }
    };
    video?.addEventListener("loadeddata", onLoaded);
    video?.addEventListener("error", onError);

    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === "Escape") abort();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", armCursorHide);

    if (video) {
      video.src = asset("draw.mp4");
      video.load();
      if (video.error) setError("영상 파일을 확인해 주세요");
    }

    return () => {
      stopPaint();
      clearTimers();
      clearPlayhead();
      stopAudioFade();
      window.clearTimeout(cursorTimerRef.current);
      video?.removeEventListener("loadeddata", onLoaded);
      video?.removeEventListener("error", onError);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", armCursorHide);
    };
  }, []);

  useEffect(() => {
    const hasPrize = cards.some((item) => !item.miss);
    setReady(hasPrize);
    if (phaseRef.current !== "boot") return;
    const preview = new URLSearchParams(location.search).get("preview");
    if (preview === "miss" || preview === "꽝") showPreview("miss", cards);
    else if (Number(preview) > 0) showPreview(Number(preview), cards);
    if (phaseRef.current === "boot") {
      setPhase("idle");
      if (videoRef.current?.error) setError("영상 파일을 확인해 주세요");
    }
  }, [cards]);

  useEffect(() => {
    if (phase !== "shown" || !card) {
      document.title = "Lucky Draw";
      return;
    }
    document.title = card.miss ? card.name : `당첨 · ${card.name}`;
  }, [phase, card]);

  const live = phase === "shown" && card
    ? card.miss
      ? card.name
      : card.desc
        ? `당첨 ${card.name}. 확률 ${formatRate(card.rate)}. ${card.desc}`
        : `당첨 ${card.name}. 확률 ${formatRate(card.rate)}`
    : "";

  return { phase, card, error, ready, hideCursor, live, startDraw };
}
