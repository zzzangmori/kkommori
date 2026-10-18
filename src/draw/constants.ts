export const DRAW_SECONDS = 5;
export const FADE_SECONDS = 1.2;
export const MISS_NAME = "꽝";

export function asset(path: string) {
  // 상대 주소를 CSS 변수에 넣으면 스타일시트 폴더 기준으로 풀립니다.
  return new URL(`${import.meta.env.BASE_URL}${path}`, document.baseURI).href;
}
