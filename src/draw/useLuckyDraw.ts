import { useEffect, useRef, useState, type RefObject } from "react";
import { formatRate, pickCard, type Card } from "./cards";
import { DRAW_SECONDS, FADE_SECONDS, asset } from "./constants";

export type Phase = "boot" | "idle" | "playing" | "fading" | "shown";

type Fx = {
  playing: boolean;
  wipe: boolean;
  flash: boolean;
};

const FX_OFF: Fx = { playing: false, wipe: false, flash: false };

export function useLuckyDraw(
  videoRef: RefObject<HTMLVideoElement | null>,
  pictureRef: RefObject<HTMLDivElement | null>,
  cards: Card[],
) {
  const [phase, setPhaseState] = useState<Phase>("boot");
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [hideCursor, setHideCursor] = useState(false);
  const [fx, setFx] = useState<Fx>(FX_OFF);

  const phaseRef = useRef<Phase>("boot");
  const cardsRef = useRef<Card[]>([]);
  const pendingRef = useRef<Card | null>(null);
  const timersRef = useRef<number[]>([]);
  const audioFadeRef = useRef(0);
  const cursorTimerRef = useRef(0);
  const drawIdRef = useRef(0);
  const fadeStartedRef = useRef(false);
  const onTimeRef = useRef<(() => void) | null>(null);
  cardsRef.current = cards;

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

  function clearPictureFade() {
    pictureRef.current?.style.removeProperty("opacity");
  }

  function fadePictureAndAudio(ms: number) {
    const video = videoRef.current;
    const picture = pictureRef.current;
    if (!video) return;
    stopAudioFade();
    const from = video.volume;
    const start = performance.now();
    const step = () => {
      const t = ms <= 0 ? 1 : Math.min(1, (performance.now() - start) / ms);
      const level = 1 - t;
      video.volume = from * level;
      picture?.style.setProperty("opacity", level.toFixed(4), "important");
      if (t < 1) return;
      window.clearInterval(audioFadeRef.current);
      audioFadeRef.current = 0;
      picture?.style.setProperty("opacity", "0", "important");
      video.pause();
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
    if (next.miss) console.info("[lucky-draw]", "miss", next.name);
    else console.info("[lucky-draw]", formatRate(next.rate), next.name);
  }

  function beginFade(drawId: number) {
    if (drawId !== drawIdRef.current) return;
    if (phaseRef.current !== "playing") return;
    if (fadeStartedRef.current) return;
    fadeStartedRef.current = true;
    clearPlayhead();
    setPhase("fading");
    setFx((current) => ({ ...current, wipe: true, flash: true }));
    fadePictureAndAudio(FADE_SECONDS * 1000);
    later(() => reveal(drawId), FADE_SECONDS * 1000 * 0.4);
  }

  function armFade(drawId: number) {
    later(() => beginFade(drawId), DRAW_SECONDS * 1000);
    const video = videoRef.current;
    if (!video) return;
    let seenStart = video.currentTime < 0.5;
    const onTime = () => {
      if (!seenStart) {
        if (video.currentTime < 0.5) seenStart = true;
        return;
      }
      if (video.currentTime >= DRAW_SECONDS) beginFade(drawId);
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
      if (phaseRef.current === "idle" || phaseRef.current === "boot") {
        video.pause();
        return;
      }
      setFx((current) => ({ ...current, playing: true }));
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
    clearTimers();
    clearPlayhead();
    pendingRef.current = pickCard(cardsRef.current);
    setCard(null);
    setPhase("playing");
    setFx({ ...FX_OFF });
    stopAudioFade();
    clearPictureFade();

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.volume = 1;
    }

    try {
      await playVideo();
    } catch {
      setError("영상 파일을 확인해 주세요");
    }

    if (phaseRef.current !== "playing" || drawId !== drawIdRef.current) return;
    armFade(drawId);
  }

  function abort() {
    const current = phaseRef.current;
    if (current !== "playing" && current !== "fading" && current !== "shown") return;
    drawIdRef.current += 1;
    fadeStartedRef.current = false;
    clearTimers();
    clearPlayhead();
    stopAudioFade();
    clearPictureFade();
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.volume = 1;
      rewind(video);
    }
    setFx({ ...FX_OFF });
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
      if (phaseRef.current === "idle") setError("");
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
      video.src = `${asset("draw.mp4")}?ts=${Date.now()}`;
      video.load();
      if (video.error) setError("영상 파일을 확인해 주세요");
    }

    return () => {
      clearTimers();
      clearPlayhead();
      stopAudioFade();
      clearPictureFade();
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

  return { phase, card, error, ready, hideCursor, fx, live, startDraw };
}
