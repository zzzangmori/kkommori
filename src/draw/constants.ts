export const DRAW_SECONDS = 5;
export const FADE_SECONDS = 1.2;
export const MISS_NAME = "꽝";

export function asset(path: string) {
  return `${import.meta.env.BASE_URL}${path}`;
}
