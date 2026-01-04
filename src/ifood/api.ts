import type { Page } from "playwright";
import { normalizeText, sleep } from "../lib/utils.js";
import type { MenuItem, Restaurant } from "./types.js";
import {
  extractHomeData,
  extractMerchantsFromPage,
  shouldExcludeRestaurant,
} from "./parsers.js";

const SEARCH_ALIAS = "SEARCH_RESULTS_MERCHANT_TAB_GLOBAL";

export type ApiHeaders = Record<string, string>;

export type AddressInfo = {
  id: string;
  streetName: string;
  streetNumber: string;
  neighborhood: string;
  complement?: string;
  reference?: string;
  state: string;
  city: string;
  country: string;
  zipCode: number | string;
  coordinates: { latitude: number; longitude: number };
};

export type AccountInfo = {
  id: string;
  name: string;
  email: string;
  phone: { countryCode: number; areaCode: number; number: string };
};

export type ApiContext = {
  headers: ApiHeaders;
  address: AddressInfo;
  account: AccountInfo;
  latitude: number;
  longitude: number;
};

const REQUIRED_HEADER_KEYS = [
  "authorization",
  "x-ifood-device-id",
  "x-ifood-session-id",
  "x-ifood-user-id",
  "x-client-application-key",
  "x-device-model",
  "x-px-cookies",
  "browser",
  "country",
  "test_merchants",
  "experiment_details",
  "experiment_variant",
  "app_version",
  "platform",
  "account_id",
  "access_key",
  "secret_key",
  "accept-language",
  "user-agent",
];

const DISCOVERY_POST_BODY = {
  "supported-headers": ["OPERATION_HEADER"],
  "supported-cards": [
    "MERCHANT_LIST",
    "CATALOG_ITEM_LIST",
    "CATALOG_ITEM_LIST_V2",
    "CATALOG_ITEM_LIST_V3",
    "FEATURED_MERCHANT_LIST",
    "CATALOG_ITEM_CAROUSEL",
    "CATALOG_ITEM_CAROUSEL_V2",
    "CATALOG_ITEM_CAROUSEL_V3",
    "BIG_BANNER_CAROUSEL",
    "IMAGE_BANNER",
    "MERCHANT_LIST_WITH_ITEMS_CAROUSEL",
    "SMALL_BANNER_CAROUSEL",
    "NEXT_CONTENT",
    "MERCHANT_CAROUSEL",
    "MERCHANT_TILE_CAROUSEL",
    "SIMPLE_MERCHANT_CAROUSEL",
    "INFO_CARD",
    "MERCHANT_LIST_V2",
    "ROUND_IMAGE_CAROUSEL",
    "BANNER_GRID",
    "MEDIUM_IMAGE_BANNER",
    "MEDIUM_BANNER_CAROUSEL",
    "RELATED_SEARCH_CAROUSEL",
    "ADS_BANNER",
  ],
  "supported-actions": [
    "catalog-item",
    "item-details",
    "merchant",
    "page",
    "card-content",
    "last-restaurants",
    "webmiddleware",
    "reorder",
    "search",
    "groceries",
    "home-tab",
  ],
  "feed-feature-name": "",
  "faster-overrides": "",
};

function pickHeaders(headers: ApiHeaders): ApiHeaders {
  const picked: ApiHeaders = {
    accept: "application/json, text/plain, */*",
    origin: "https://www.ifood.com.br",
    referer: "https://www.ifood.com.br/",
  };

  for (const key of REQUIRED_HEADER_KEYS) {
    const value = headers[key];
    if (value) picked[key] = value;
  }

  return picked;
}

function mergeHeaders(base: ApiHeaders, incoming: ApiHeaders): ApiHeaders {
  return {
    ...base,
    ...pickHeaders(incoming),
  };
}

async function captureHeaders(page: Page, timeoutMs = 15000): Promise<ApiHeaders> {
  const requestPromise = page.waitForEvent("request", {
    timeout: timeoutMs,
    predicate: (request) => {
      if (!request.url().includes("cw-marketplace.ifood.com.br")) return false;
      const headers = request.headers();
      return Boolean(headers.authorization && headers["x-ifood-session-id"]);
    },
  });

  const targetUrl = "https://www.ifood.com.br/restaurantes";
  if (!page.url().includes("/restaurantes")) {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  } else {
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  }

  const request = await requestPromise;
  return request.headers();
}

async function readReduxState(page: Page) {
  return page.evaluate(() => {
    const store = (window as any).__NEXT_REDUX_STORE__;
    return store ? store.getState() : null;
  });
}

export async function getApiContext(page: Page): Promise<ApiContext> {
  const state = await readReduxState(page);
  if (!state?.address || !state?.account) {
    throw new Error("Unable to read account/address from iFood session. Open iFood in browser first.");
  }

  const address = state.address;
  if (!address.addressId || !address.coords?.latitude || !address.coords?.longitude) {
    throw new Error("Delivery address is missing. Set your address in iFood first.");
  }

  const account = state.account;
  if (!account.uuid || !account.name || !account.email || !account.phone) {
    throw new Error("Account info missing. Make sure you are logged in to iFood.");
  }

  const headers = pickHeaders(await captureHeaders(page));

  return {
    headers,
    address: {
      id: address.addressId,
      streetName: address.street ?? address.location?.address ?? "",
      streetNumber: address.streetNumber ?? "",
      neighborhood: address.district ?? address.location?.district ?? "",
      complement: address.compl ?? "",
      reference: address.reference ?? "",
      state: address.state ?? address.location?.state ?? "",
      city: address.city ?? address.location?.city ?? "",
      country: address.country ?? address.location?.country ?? "BR",
      zipCode: address.zipCode ?? address.location?.zipCode ?? 0,
      coordinates: {
        latitude: address.coords.latitude,
        longitude: address.coords.longitude,
      },
    },
    account: {
      id: account.uuid,
      name: account.name,
      email: account.email,
      phone: {
        countryCode: account.phone.country_code ?? account.phone.countryCode ?? 55,
        areaCode: account.phone.area_code ?? account.phone.areaCode ?? 0,
        number: account.phone.number ?? account.phone.full_number ?? "",
      },
    },
    latitude: address.coords.latitude,
    longitude: address.coords.longitude,
  };
}

async function apiFetchViaPage<T>(
  page: Page,
  ctx: ApiContext,
  url: string,
  init?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    ...ctx.headers,
    ...(init?.headers ? (init.headers as Record<string, string>) : {}),
  };

  const result = await page.evaluate(
    async ({ url, headers, init }) => {
      const response = await fetch(url, {
        ...init,
        credentials: "include",
        headers: {
          ...headers,
        },
      });
      const text = await response.text();
      return { ok: response.ok, status: response.status, text };
    },
    { url, headers, init }
  );

  if (!result.ok) {
    throw new Error(`iFood API error ${result.status}: ${result.text.slice(0, 200)}`);
  }

  return JSON.parse(result.text) as T;
}

async function apiFetch<T>(
  ctx: ApiContext,
  url: string,
  init?: RequestInit,
  page?: Page
): Promise<T> {
  if (page) return apiFetchViaPage<T>(page, ctx, url, init);
  const headers: Record<string, string> = {
    ...ctx.headers,
    ...(init?.headers ? (init.headers as Record<string, string>) : {}),
  };

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`iFood API error ${response.status}: ${text.slice(0, 200)}`);
  }

  return (await response.json()) as T;
}

export async function searchRestaurantsApi(
  ctx: ApiContext,
  query: string,
  limit = 10,
  options?: { excludeCategories?: string[]; page?: Page }
): Promise<Restaurant[]> {
  const url = new URL("https://cw-marketplace.ifood.com.br/v2/cardstack/search/results");
  url.searchParams.set("alias", SEARCH_ALIAS);
  url.searchParams.set("latitude", String(ctx.latitude));
  url.searchParams.set("longitude", String(ctx.longitude));
  url.searchParams.set("channel", "IFOOD");
  url.searchParams.set("size", String(Math.max(limit, 20)));
  const term = query.trim().length ? query : "a";
  url.searchParams.set("term", term);

  const data = await apiFetch<any>(
    ctx,
    url.toString(),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(DISCOVERY_POST_BODY),
    },
    options?.page
  );
  const results: Restaurant[] = [];
  const seen = new Set<string>();
  const excludes = options?.excludeCategories ?? [];

  const cards = data?.sections?.flatMap((section: any) => section.cards ?? []) ?? [];
  for (const card of cards) {
    const contents = card?.data?.contents ?? [];
    for (const entry of contents) {
      if (!entry?.id || !entry?.name || !entry?.action) continue;
      const action = String(entry.action);
      if (!action.startsWith("merchant?")) continue;

      const params = new URLSearchParams(action.replace("merchant?", ""));
      const id = params.get("identifier") ?? entry.id;
      const slug = params.get("slug") ?? "";
      const mainCategory = entry.mainCategory ?? "";
      const nameText = entry.name ?? "";
      const url = slug && id ? `https://www.ifood.com.br/delivery/${slug}/${id}` : "";

      if (!id || seen.has(id)) continue;
      const restaurant = {
        id,
        slug,
        name: nameText,
        url,
        info: mainCategory ?? entry.contextMessage?.message,
      };

      if (excludes.length && shouldExcludeRestaurant(restaurant, excludes)) continue;

      results.push(restaurant);
      seen.add(id);
      if (results.length >= limit) break;
    }
    if (results.length >= limit) break;
  }

  return results;
}

export async function getCatalog(
  ctx: ApiContext,
  merchantId: string,
  options?: { page?: Page; url?: string }
) {
  if (options?.page && options.url) {
    const responsePromise = options.page.waitForResponse((response) =>
      response.url().includes(`/v1/bm/merchants/${merchantId}/catalog`)
    );
    await options.page.goto(options.url, { waitUntil: "domcontentloaded" });
    const response = await responsePromise;
    ctx.headers = mergeHeaders(ctx.headers, response.request().headers());
    return response.json();
  }

  if (!ctx.headers.access_key || !ctx.headers.secret_key) {
    throw new Error("Missing access credentials. Open a merchant page once to initialize headers.");
  }

  const url = new URL(`https://cw-marketplace.ifood.com.br/v1/bm/merchants/${merchantId}/catalog`);
  url.searchParams.set("latitude", String(ctx.latitude));
  url.searchParams.set("longitude", String(ctx.longitude));
  return apiFetch<any>(ctx, url.toString());
}

export function extractMenuItems(catalog: any, query?: string, limit = 10): MenuItem[] {
  const items: MenuItem[] = [];
  const normalizedQuery = query ? normalizeText(query) : null;
  const menus = catalog?.data?.menu ?? [];

  for (const menu of menus) {
    for (const item of menu.itens ?? []) {
      const name = item.description ?? item.name ?? "";
      if (!name) continue;
      if (normalizedQuery && !normalizeText(name).includes(normalizedQuery)) continue;

      items.push({
        id: item.id,
        name,
        price: item.unitPrice ?? item.unitMinPrice,
        priceText: item.unitPrice ? `R$ ${item.unitPrice}` : undefined,
        description: item.details,
        section: menu.name,
      });

      if (items.length >= limit) return items;
    }
  }

  return items;
}

type CartItem = {
  id: string;
  quantity: number;
  observation?: string;
  subItems?: { id: string; quantity: number }[];
};

function buildSubItems(item: any): { id: string; quantity: number }[] {
  const subItems: { id: string; quantity: number }[] = [];
  for (const choice of item.choices ?? []) {
    const min = Number(choice.min ?? 0);
    if (min <= 0) continue;
    const garnish = choice.garnishItens?.[0];
    if (!garnish?.id) continue;
    subItems.push({ id: garnish.id, quantity: Math.min(min, choice.max ?? min) });
  }
  return subItems;
}

export function buildCartItems(catalog: any, requested: { name: string; qty: number }[]): CartItem[] {
  const menus = catalog?.data?.menu ?? [];
  const allItems: any[] = [];
  for (const menu of menus) {
    for (const item of menu.itens ?? []) {
      allItems.push(item);
    }
  }

  const cartItems: CartItem[] = [];
  for (const req of requested) {
    const target = allItems.find((item) => normalizeText(item.description ?? item.name ?? "") === normalizeText(req.name))
      ?? allItems.find((item) => normalizeText(item.description ?? item.name ?? "").includes(normalizeText(req.name)));

    if (!target?.id) {
      throw new Error(`Item not found in catalog: ${req.name}`);
    }

    const subItems = target.needChoices ? buildSubItems(target) : [];

    cartItems.push({
      id: target.id,
      quantity: req.qty,
      observation: "",
      subItems: subItems.length ? subItems : undefined,
    });
  }

  return cartItems;
}

export async function createCart(
  ctx: ApiContext,
  merchant: { id: string; name: string },
  items: CartItem[],
  page?: Page
) {
  const payload = {
    merchant: { id: merchant.id, name: merchant.name },
    address: {
      id: ctx.address.id,
      coordinates: ctx.address.coordinates,
      streetName: ctx.address.streetName,
      streetNumber: ctx.address.streetNumber,
      neighborhood: ctx.address.neighborhood,
      complement: ctx.address.complement ?? "",
      state: ctx.address.state,
      city: ctx.address.city,
      zipCode: ctx.address.zipCode ?? 0,
    },
    items,
    delivery: {
      id: "DEFAULT",
      now: true,
      deliveryBy: "MERCHANT",
    },
    account: {
      id: ctx.account.id,
      name: ctx.account.name,
      email: ctx.account.email,
      phone: ctx.account.phone,
    },
  };

  const result = await apiFetch<any>(
    ctx,
    "https://cw-marketplace.ifood.com.br/v1/carts",
    {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    },
    page
  );

  return result;
}

export async function ensureOnHome(page: Page) {
  if (!page.url().includes("/inicio")) {
    await page.goto("https://www.ifood.com.br/inicio");
    await page.waitForLoadState("domcontentloaded");
    await sleep(1000);
  }
}

export async function getHomeFeed(ctx: ApiContext, page: Page, size = 20) {
  await ensureOnHome(page);
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/v2/bm/home")
  );
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  const response = await responsePromise;
  const data = await response.json();
  ctx.headers = mergeHeaders(ctx.headers, response.request().headers());
  if (size && Array.isArray(data?.sections)) {
    return data;
  }
  return data;
}

export async function getCategoryPage(ctx: ApiContext, categoryId: string) {
  const url = new URL(`https://cw-marketplace.ifood.com.br/v1/bm/page/${categoryId}`);
  url.searchParams.set("latitude", String(ctx.latitude));
  url.searchParams.set("longitude", String(ctx.longitude));
  url.searchParams.set("channel", "IFOOD");
  return apiFetch<any>(ctx, url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(DISCOVERY_POST_BODY),
  });
}

export async function topRestaurantsApi(
  ctx: ApiContext,
  page: Page,
  limit = 10,
  excludeTerms: string[] = []
): Promise<Restaurant[]> {
  const excludes = excludeTerms;
  const results: Restaurant[] = [];
  const seen = new Set<string>();

  const addRestaurant = (restaurant: Restaurant) => {
    if (!restaurant.id || seen.has(restaurant.id)) return false;
    if (excludes.length && shouldExcludeRestaurant(restaurant, excludes)) return false;
    results.push(restaurant);
    seen.add(restaurant.id);
    return true;
  };

  const home = await getHomeFeed(ctx, page, Math.max(limit * 2, 20));
  const { categories, merchants } = extractHomeData(home);

  for (const merchant of merchants) {
    addRestaurant(merchant);
    if (results.length >= limit) return results;
  }

  for (const category of categories) {
    if (results.length >= limit) break;
    if (excludes.some((term) => normalizeText(category.title).includes(normalizeText(term)))) continue;
    const pageData = await getCategoryPage(ctx, category.id);
    const merchantsFromPage = extractMerchantsFromPage(pageData);
    for (const merchant of merchantsFromPage) {
      addRestaurant(merchant);
      if (results.length >= limit) break;
    }
  }

  if (results.length < limit) {
    const fallback = await searchRestaurantsApi(ctx, "a", Math.max(limit * 2, 20), {
      excludeCategories: excludes.length ? excludes : undefined,
    });
    for (const merchant of fallback) {
      addRestaurant(merchant);
      if (results.length >= limit) break;
    }
  }

  return results;
}
