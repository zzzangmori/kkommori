import type { Card } from "./cards";

const STORAGE_KEY = "lucky-draw.history";
const MAX_ROUNDS = 200;

export type HistoryCard = {
  name: string;
  desc: string;
  rate: number;
  miss: boolean;
};

export type HistoryRound = {
  id: string;
  at: number;
  cards: HistoryCard[];
};

export function readHistory(): HistoryRound[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return sanitizeRounds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeHistory(rounds: HistoryRound[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rounds: rounds.slice(0, MAX_ROUNDS) }));
  } catch {
    /* 저장이 막혀도 이번 화면의 기록은 유지합니다. */
  }
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

export function toHistoryRound(cards: Card[]): HistoryRound {
  return {
    id: crypto.randomUUID(),
    at: Date.now(),
    cards: cards.map((card) => ({
      name: card.name,
      desc: card.desc,
      rate: card.rate,
      miss: card.miss,
    })),
  };
}

function sanitizeRounds(data: unknown): HistoryRound[] {
  const source = data && typeof data === "object" ? data as { rounds?: unknown } : {};
  const list = Array.isArray(data) ? data : Array.isArray(source.rounds) ? source.rounds : [];
  const rounds: HistoryRound[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown; at?: unknown; cards?: unknown };
    if (!Array.isArray(row.cards)) continue;
    const cards: HistoryCard[] = [];
    for (const card of row.cards) {
      if (!card || typeof card !== "object") continue;
      const value = card as { name?: unknown; desc?: unknown; rate?: unknown; miss?: unknown };
      const name = String(value.name ?? "").trim();
      if (!name) continue;
      const rate = Number(value.rate);
      cards.push({
        name,
        desc: String(value.desc ?? "").trim(),
        rate: Number.isFinite(rate) ? rate : 0,
        miss: Boolean(value.miss),
      });
    }
    if (!cards.length) continue;
    const at = Number(row.at);
    rounds.push({
      id: typeof row.id === "string" && row.id ? row.id : crypto.randomUUID(),
      at: Number.isFinite(at) ? at : Date.now(),
      cards,
    });
  }

  return rounds.slice(0, MAX_ROUNDS);
}
