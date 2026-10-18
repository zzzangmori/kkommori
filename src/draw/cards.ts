import { MISS_NAME } from "./constants";

export type Card = {
  name: string;
  desc: string;
  rate: number;
  weight: number;
  miss: boolean;
};

type Product = {
  name?: string;
  desc?: string;
};

type RateGroup = {
  rate?: number;
  items?: Product[];
};

type CardsFile = {
  rates?: RateGroup[];
};

export function formatRate(rate: number) {
  const text = parseFloat(Number(rate).toFixed(4)).toString();
  return `${text}%`;
}

export function readProducts(data: unknown): Card[] {
  const source = data && typeof data === "object" ? (data as CardsFile) : {};
  const cards: Card[] = [];
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
        rate,
        weight: rate,
        miss: false,
      });
    }
  }

  const prizeRate = cards.reduce((sum, card) => sum + card.weight, 0);
  const missRate = 100 - prizeRate;
  if (prizeRate > 0 && missRate > 0) {
    cards.push({
      name: MISS_NAME,
      desc: "",
      rate: missRate,
      weight: missRate,
      miss: true,
    });
  }

  return cards;
}

export function pickCard(cards: Card[]) {
  const total = cards.reduce((sum, card) => sum + card.weight, 0);
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  let roll = (buf[0] / 4294967296) * total;
  for (const card of cards) {
    roll -= card.weight;
    if (roll <= 0) return card;
  }
  return cards[cards.length - 1];
}
