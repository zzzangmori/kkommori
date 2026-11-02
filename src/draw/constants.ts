export const DRAW_SECONDS = 4.8;
export const VIDEO_END_SECONDS = 6;
export const FADE_SECONDS = 0.5;
export const FLIP_LEAD_MS = 460;
export const DEAL_END_MS = 700;
export const MAX_DRAWS = 10;
export const MISS_NAME = "꽝";

export function asset(path: string) {
  return new URL(`${import.meta.env.BASE_URL}${path}`, document.baseURI).href;
}
