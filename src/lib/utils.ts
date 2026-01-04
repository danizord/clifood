import { promises as fs } from "node:fs";
import { dirname } from "node:path";

export async function ensureDir(path: string) {
  await fs.mkdir(path, { recursive: true });
}

export async function ensureParentDir(path: string) {
  await ensureDir(dirname(path));
}

export function isUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function parseNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export type ItemSpec = { name: string; qty: number };

export function parseItemSpec(input: string): ItemSpec {
  const trimmed = input.trim();
  const match = trimmed.match(/^(.*?)(?:\s*[xX*]\s*(\d+)|\s*[:=]\s*(\d+))?$/);
  if (!match) {
    return { name: trimmed, qty: 1 };
  }
  const name = match[1].trim();
  const qtyRaw = match[2] ?? match[3];
  const qty = qtyRaw ? Math.max(1, Number.parseInt(qtyRaw, 10)) : 1;
  return { name, qty };
}
