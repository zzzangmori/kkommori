import { readProducts, type Card } from "./cards";

const STORAGE_KEY = "lucky-draw.products";

const DEFAULT_PRODUCTS = [
  { name: "같이 한 판", desc: "방송 중 스트리머와 플레이", rate: 10 },
  { name: "닉네임 호명", desc: "이번 방송에서 이름 불러주기", rate: 5 },
  { name: "신청곡", desc: "오늘 방송에서 틀어주기", rate: 1 },
  { name: "방송 게스트", desc: "다음 방송에 함께 출연", rate: 0.5 },
] as const;

export type Product = {
  id: string;
  name: string;
  desc: string;
  rate: number;
};

export function createId() {
  return crypto.randomUUID();
}

export function parseRate(value: string) {
  const text = value.trim().replaceAll("%", "").replace(",", ".");
  if (!text) return null;
  const rate = Number(text);
  if (!Number.isFinite(rate)) return null;
  const rounded = Math.round(rate * 10000) / 10000;
  if (!(rounded > 0)) return null;
  return rounded;
}

export function readStoredProducts(): Product[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const products = sanitizeProducts(JSON.parse(raw));
    return products.length ? products : null;
  } catch {
    return null;
  }
}

export function writeStoredProducts(products: Product[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ products }));
  } catch {
    throw new Error("이 브라우저에 저장하지 못했습니다.");
  }
}

export function clearStoredProducts() {
  localStorage.removeItem(STORAGE_KEY);
}

export function defaultProducts(): Product[] {
  return DEFAULT_PRODUCTS.map((item) => ({
    id: createId(),
    name: item.name,
    desc: item.desc,
    rate: item.rate,
  }));
}

export function productsToCards(products: Product[]): Card[] {
  return readProducts({
    rates: products.map((product) => ({
      rate: product.rate,
      items: [{ name: product.name, desc: product.desc }],
    })),
  });
}

function sanitizeProducts(data: unknown): Product[] {
  const source = data && typeof data === "object" ? data as { products?: unknown } : {};
  const list = Array.isArray(data) ? data : Array.isArray(source.products) ? source.products : [];
  const products: Product[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown; name?: unknown; desc?: unknown; rate?: unknown };
    const name = String(row.name ?? "").trim();
    const rate = Number(row.rate);
    if (!name || !(rate > 0) || !Number.isFinite(rate)) continue;
    products.push({
      id: typeof row.id === "string" && row.id ? row.id : createId(),
      name,
      desc: String(row.desc ?? "").trim(),
      rate: Math.round(rate * 10000) / 10000,
    });
  }

  return products;
}
