import { normalizeText } from "../lib/utils.js";
import type { Restaurant } from "./types.js";

export type CategoryPage = { id: string; title: string };

export function parseCategoryAction(action: string) {
  if (!action.startsWith("page?")) return null;
  const params = new URLSearchParams(action.replace("page?", ""));
  const id = params.get("identifier");
  return id ?? null;
}

export function parseMerchantAction(action: string) {
  if (!action.startsWith("merchant?")) return null;
  const params = new URLSearchParams(action.replace("merchant?", ""));
  const id = params.get("identifier");
  const slug = params.get("slug") ?? "";
  return { id: id ?? null, slug };
}

export function extractCategoryFromEntry(entry: any) {
  const main = entry?.mainCategory;
  if (main) return String(main);
  const desc = entry?.contentDescription ?? "";
  const match = String(desc).match(/Tipo de comida:\s*([^,]+)/i);
  return match ? match[1].trim() : "";
}

export function extractHomeData(payload: any) {
  const categories: CategoryPage[] = [];
  const merchants: Restaurant[] = [];
  const seen = new Set<string>();

  const cards = payload?.sections?.flatMap((section: any) => section.cards ?? []) ?? [];
  for (const card of cards) {
    const contents = card?.data?.contents ?? [];
    for (const entry of contents) {
      const action = entry?.action ?? "";
      if (typeof action !== "string") continue;

      if (action.startsWith("page?") && entry?.title) {
        const id = parseCategoryAction(action);
        if (id) categories.push({ id, title: entry.title });
      }

      if (action.startsWith("merchant?") && entry?.name) {
        const parsed = parseMerchantAction(action);
        if (!parsed?.id || seen.has(parsed.id)) continue;
        const url = parsed.slug && parsed.id ? `https://www.ifood.com.br/delivery/${parsed.slug}/${parsed.id}` : "";
        merchants.push({
          id: parsed.id,
          slug: parsed.slug,
          name: entry.name,
          url,
          info: extractCategoryFromEntry(entry),
        });
        seen.add(parsed.id);
      }
    }
  }

  return { categories, merchants };
}

export function extractMerchantsFromPage(payload: any) {
  const merchants: Restaurant[] = [];
  const seen = new Set<string>();
  const cards = payload?.sections?.flatMap((section: any) => section.cards ?? []) ?? [];

  for (const card of cards) {
    const contents = card?.data?.contents ?? [];
    for (const entry of contents) {
      const action = entry?.action ?? "";
      if (typeof action !== "string" || !action.startsWith("merchant?")) continue;
      const parsed = parseMerchantAction(action);
      if (!parsed?.id || seen.has(parsed.id)) continue;
      const url = parsed.slug && parsed.id ? `https://www.ifood.com.br/delivery/${parsed.slug}/${parsed.id}` : "";
      merchants.push({
        id: parsed.id,
        slug: parsed.slug,
        name: entry.name ?? entry.title ?? "",
        url,
        info: extractCategoryFromEntry(entry),
      });
      seen.add(parsed.id);
    }
  }

  return merchants;
}

export function shouldExcludeRestaurant(restaurant: Restaurant, excludeTerms: string[]) {
  const excludes = excludeTerms.map((term) => normalizeText(term));
  const name = normalizeText(restaurant.name ?? "");
  const info = normalizeText(restaurant.info ?? "");
  return excludes.some((term) => name.includes(term) || info.includes(term));
}
